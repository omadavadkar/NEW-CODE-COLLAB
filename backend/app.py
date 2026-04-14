from collections import defaultdict

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room

from services.executor import ExecutionError, execute_code, execute_package_install, execute_python_file, execute_python_script
from services.room_store import CodeStore, RoomStore
from services.workspace_store import WorkspaceStore, WorkspaceStoreError

app = Flask(__name__)
app.config['SECRET_KEY'] = 'code-collab-secret'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins='*')

room_store = RoomStore()
code_store = CodeStore()
workspace_store = WorkspaceStore()
call_store = defaultdict(dict)


def _serialize_call_participants(room_id):
    participants = call_store.get(room_id, {})
    return [
        {'sid': sid, 'username': participant['username'], 'isMicOn': participant['isMicOn']}
        for sid, participant in participants.items()
    ]


@app.post('/run')
def run_code():
    body = request.get_json(silent=True) or {}
    language = body.get('language')
    code = body.get('code', '')

    if language not in {'python', 'cpp', 'java'}:
        return jsonify({'error': 'Invalid language. Use python, cpp, or java.'}), 400

    try:
        result = execute_code(language=language, code=code)
        return jsonify(result), 200
    except ExecutionError as error:
        return jsonify({'error': str(error)}), 400


@app.post('/upload-folder')
def upload_folder():
    files = request.files.getlist('files')

    try:
        payload = workspace_store.save_uploaded_files(files)
        return jsonify(payload), 200
    except WorkspaceStoreError as error:
        return jsonify({'error': str(error)}), 400


@app.get('/workspace-file')
def get_workspace_file():
    workspace_id = (request.args.get('workspaceId') or '').strip()
    file_path = (request.args.get('filePath') or '').strip()

    if not workspace_id or not file_path:
        return jsonify({'error': 'workspaceId and filePath are required'}), 400

    resolved_file = workspace_store.resolve_file(workspace_id, file_path)
    if not resolved_file:
        return jsonify({'error': 'File not found in uploaded workspace'}), 404

    try:
        content = resolved_file.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        return jsonify({'error': 'Only UTF-8 text files are supported in editor preview'}), 400

    return jsonify({'filePath': file_path, 'content': content}), 200


@app.post('/run-python')
def run_python_file_or_snippet():
    body = request.get_json(silent=True) or {}
    timeout = body.get('timeout', 6)

    inline_code = body.get('code')
    workspace_id = (body.get('workspaceId') or '').strip()
    file_path = (body.get('filePath') or '').strip()

    try:
        if isinstance(inline_code, str) and inline_code.strip():
            result = execute_python_script(inline_code, timeout=timeout)
            return jsonify(result), 200

        if not workspace_id or not file_path:
            return jsonify({'error': 'Provide either code or workspaceId + filePath'}), 400

        resolved_file = workspace_store.resolve_file(workspace_id, file_path)
        if not resolved_file:
            return jsonify({'error': 'Target Python file not found in uploaded workspace'}), 404

        result = execute_python_file(str(resolved_file), timeout=timeout)
        return jsonify(result), 200
    except ExecutionError as error:
        return jsonify({'error': str(error)}), 400


@app.post('/install-package')
def install_package():
    body = request.get_json(silent=True) or {}
    command = body.get('command', '')
    timeout = body.get('timeout', 90)

    try:
        result = execute_package_install(command, timeout=timeout)
        return jsonify(result), 200
    except ExecutionError as error:
        return jsonify({'error': str(error)}), 400


@socketio.on('join_room')
def handle_join_room(payload):
    room_id = payload.get('roomId')
    username = payload.get('username', 'Guest')

    if not room_id:
        emit('error', {'message': 'roomId is required'})
        return

    join_room(room_id)
    users = room_store.join_user(room_id=room_id, sid=request.sid, username=username)

    emit('joined_room', {'roomId': room_id, 'sid': request.sid, 'username': username}, room=request.sid)
    emit('user_join', {'username': username, 'users': users}, room=room_id)
    emit('code_sync', {'code': code_store.get_code(room_id)}, room=request.sid)


@socketio.on('code_change')
def handle_code_change(payload):
    room_id = payload.get('roomId')
    code = payload.get('code', '')

    if not room_id:
        emit('error', {'message': 'roomId is required'})
        return

    code_store.set_code(room_id, code)
    emit('code_change', {'code': code}, room=room_id, include_self=False)


@socketio.on('send_message')
def handle_send_message(payload):
    room_id = payload.get('roomId')
    username = payload.get('username', 'Guest')
    message = payload.get('message', '')

    if not room_id:
        emit('error', {'message': 'roomId is required'})
        return

    emit('send_message', {'username': username, 'message': message}, room=room_id)


@socketio.on('start_call')
def handle_start_call(payload):
    room_id = payload.get('roomId')
    username = payload.get('username', 'Guest')
    is_mic_on = bool(payload.get('isMicOn', True))

    if not room_id:
        emit('error', {'message': 'roomId is required'})
        return

    if not room_store.has_user(room_id, request.sid):
        emit('error', {'message': 'Join the room before starting a call'})
        return

    if len(room_store.get_users_detailed(room_id)) < 2:
        emit('error', {'message': 'At least 2 users must be in the same room before video call'})
        return

    call_store[room_id][request.sid] = {'username': username, 'isMicOn': is_mic_on}
    emit('call_participants', {'participants': _serialize_call_participants(room_id)}, room=room_id)


@socketio.on('call_invite')
def handle_call_invite(payload):
    room_id = payload.get('roomId')

    if not room_id:
        emit('error', {'message': 'roomId is required'})
        return

    if not room_store.has_user(room_id, request.sid):
        emit('error', {'message': 'Join the room before inviting participants'})
        return

    emit(
        'call_invite',
        {
            'roomId': room_id,
            'fromSid': request.sid,
            'fromUsername': room_store.get_username(room_id, request.sid) or 'Guest',
        },
        room=room_id,
        include_self=False,
    )


@socketio.on('call_accept')
def handle_call_accept(payload):
    room_id = payload.get('roomId')
    target_sid = payload.get('targetSid')

    if not room_id or not target_sid:
        emit('error', {'message': 'roomId and targetSid are required'})
        return

    emit(
        'call_accept',
        {
            'roomId': room_id,
            'fromSid': request.sid,
            'fromUsername': room_store.get_username(room_id, request.sid) or 'Guest',
        },
        room=target_sid,
    )


@socketio.on('call_reject')
def handle_call_reject(payload):
    room_id = payload.get('roomId')
    target_sid = payload.get('targetSid')

    if not room_id or not target_sid:
        emit('error', {'message': 'roomId and targetSid are required'})
        return

    emit(
        'call_reject',
        {
            'roomId': room_id,
            'fromSid': request.sid,
            'fromUsername': room_store.get_username(room_id, request.sid) or 'Guest',
        },
        room=target_sid,
    )


@socketio.on('webrtc_offer')
def handle_webrtc_offer(payload):
    room_id = payload.get('roomId')
    target_sid = payload.get('targetSid')
    offer = payload.get('offer')

    if not room_id or not target_sid or not offer:
        emit('error', {'message': 'roomId, targetSid and offer are required'})
        return

    emit(
        'webrtc_offer',
        {
            'roomId': room_id,
            'fromSid': request.sid,
            'fromUsername': room_store.get_username(room_id, request.sid) or 'Guest',
            'offer': offer,
        },
        room=target_sid,
    )


@socketio.on('webrtc_answer')
def handle_webrtc_answer(payload):
    room_id = payload.get('roomId')
    target_sid = payload.get('targetSid')
    answer = payload.get('answer')

    if not room_id or not target_sid or not answer:
        emit('error', {'message': 'roomId, targetSid and answer are required'})
        return

    emit(
        'webrtc_answer',
        {
            'roomId': room_id,
            'fromSid': request.sid,
            'answer': answer,
        },
        room=target_sid,
    )


@socketio.on('webrtc_ice_candidate')
def handle_webrtc_ice_candidate(payload):
    room_id = payload.get('roomId')
    target_sid = payload.get('targetSid')
    candidate = payload.get('candidate')

    if not room_id or not target_sid or not candidate:
        emit('error', {'message': 'roomId, targetSid and candidate are required'})
        return

    emit(
        'webrtc_ice_candidate',
        {
            'roomId': room_id,
            'fromSid': request.sid,
            'candidate': candidate,
        },
        room=target_sid,
    )


@socketio.on('toggle_mic')
def handle_toggle_mic(payload):
    room_id = payload.get('roomId')
    is_mic_on = bool(payload.get('isMicOn', False))

    if not room_id:
        emit('error', {'message': 'roomId is required'})
        return

    participant = call_store.get(room_id, {}).get(request.sid)
    if not participant:
        emit('error', {'message': 'Join call before toggling mic'})
        return

    participant['isMicOn'] = is_mic_on
    emit('call_participants', {'participants': _serialize_call_participants(room_id)}, room=room_id)


@socketio.on('leave_call')
def handle_leave_call(payload):
    room_id = payload.get('roomId')

    if not room_id:
        emit('error', {'message': 'roomId is required'})
        return

    call_store.get(room_id, {}).pop(request.sid, None)
    if not call_store.get(room_id):
        call_store.pop(room_id, None)
        emit('call_ended', {'roomId': room_id, 'bySid': request.sid}, room=room_id)
    emit('call_participants', {'participants': _serialize_call_participants(room_id)}, room=room_id)


@socketio.on('disconnect')
def handle_disconnect():
    for room_id in room_store.get_room_ids():
        call_store.get(room_id, {}).pop(request.sid, None)
        if not call_store.get(room_id):
            call_store.pop(room_id, None)
        else:
            emit('call_participants', {'participants': _serialize_call_participants(room_id)}, room=room_id)
        emit('call_ended', {'roomId': room_id, 'bySid': request.sid}, room=room_id)

        username, users = room_store.leave_user(room_id=room_id, sid=request.sid)
        if username:
            leave_room(room_id)
            emit('user_leave', {'username': username, 'users': users}, room=room_id)
            if not users:
                code_store.delete_code(room_id)
                call_store.pop(room_id, None)


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
