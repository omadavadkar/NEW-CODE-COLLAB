import { io } from 'socket.io-client';

const API_URL = 'https://new-code-collab-8.onrender.com';

export function createCollabClient({ roomId, username, handlers }) {
  const socket = io(API_URL, {
    transports: ['websocket'],
    withCredentials: true
  });

  socket.on('connect', () => {
    handlers.onSelfSid?.(socket.id);
    socket.emit('join_room', { roomId, username });
    handlers.onDebug?.(`Connected to room ${roomId}`);
  });

  socket.on('joined_room', (payload) => {
    handlers.onJoinedRoom?.(payload);
  });

  socket.on('connect_error', (error) => {
    handlers.onProblem?.(error.message || 'Socket connection failed.');
  });

  socket.on('error', (payload) => {
    handlers.onProblem?.(payload?.message || 'Server returned a socket error.');
  });

  socket.on('user_join', (payload) => {
    handlers.onUsers?.(payload.users || []);
  });

  socket.on('user_leave', (payload) => {
    handlers.onUsers?.(payload.users || []);
  });

  socket.on('code_sync', (payload) => {
    handlers.onCodeSync?.(payload.code || '');
  });

  socket.on('code_change', (payload) => {
    handlers.onCodeChange?.(payload.code || '');
  });

  socket.on('send_message', (payload) => {
    handlers.onMessage?.({
      id: Date.now() + Math.random(),
      sender: payload.username || 'Guest',
      text: payload.message || ''
    });
  });

  socket.on('call_participants', (payload) => {
    handlers.onCallParticipants?.(payload.participants || []);
  });

  socket.on('call_invite', (payload) => {
    handlers.onCallInvite?.(payload);
  });

  socket.on('call_accept', (payload) => {
    handlers.onCallAccept?.(payload);
  });

  socket.on('call_reject', (payload) => {
    handlers.onCallReject?.(payload);
  });

  socket.on('webrtc_offer', (payload) => {
    handlers.onWebRtcOffer?.(payload);
  });

  socket.on('webrtc_answer', (payload) => {
    handlers.onWebRtcAnswer?.(payload);
  });

  socket.on('webrtc_ice_candidate', (payload) => {
    handlers.onWebRtcIceCandidate?.(payload);
  });

  socket.on('call_ended', (payload) => {
    handlers.onCallEnded?.(payload);
  });

  return {
    sendCodeChange(code) {
      socket.emit('code_change', { roomId, code });
    },
    sendMessage(message) {
      socket.emit('send_message', { roomId, username, message });
    },
    startCall(isMicOn) {
      socket.emit('start_call', { roomId, username, isMicOn });
    },
    inviteCall() {
      socket.emit('call_invite', { roomId });
    },
    acceptCall(targetSid) {
      socket.emit('call_accept', { roomId, targetSid });
    },
    rejectCall(targetSid) {
      socket.emit('call_reject', { roomId, targetSid });
    },
    toggleMic(isMicOn) {
      socket.emit('toggle_mic', { roomId, isMicOn });
    },
    sendOffer(targetSid, offer) {
      socket.emit('webrtc_offer', { roomId, targetSid, offer });
    },
    sendAnswer(targetSid, answer) {
      socket.emit('webrtc_answer', { roomId, targetSid, answer });
    },
    sendIceCandidate(targetSid, candidate) {
      socket.emit('webrtc_ice_candidate', { roomId, targetSid, candidate });
    },
    leaveCall() {
      socket.emit('leave_call', { roomId });
    },
    disconnect() {
      socket.disconnect();
    }
  };
}
