# Code Collab

A full-stack real-time collaborative coding platform with a VS Code-inspired interface.

## Tech Stack

- Frontend: React (Vite), Tailwind CSS, Monaco Editor
- Backend: Flask, Flask-SocketIO
- Execution: Python subprocess with 3-second timeout and temporary file cleanup

## Project Structure

```text
code-collab/
  frontend/
    index.html
    package.json
    postcss.config.js
    tailwind.config.js
    vite.config.js
    src/
      App.jsx
      index.css
      main.jsx
      components/
        BottomPanel.jsx
        EditorArea.jsx
        ExplorerSidebar.jsx
        TeamChatSidebar.jsx
      data/
        dummyFiles.js
      services/
        api.js
  backend/
    app.py
    requirements.txt
    services/
      executor.py
      room_store.py
```

## Setup Instructions

### 1. Backend setup

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Backend runs on `http://127.0.0.1:5000`.

### 2. Frontend setup

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://127.0.0.1:5173`.

### 3. WebRTC ICE server setup (optional but recommended)

Create `frontend/.env` and configure ICE servers:

```env
VITE_API_URL=http://127.0.0.1:5000
VITE_ICE_SERVERS_JSON=[{"urls":"stun:stun.l.google.com:19302"}]
```

Example including TURN:

```env
VITE_ICE_SERVERS_JSON=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:your-turn-server:3478","username":"turn-user","credential":"turn-password"}]
```

## API

### POST /run

Request body:

```json
{
  "language": "python",
  "code": "print('hello')"
}
```

Supported `language` values:

- `python`
- `cpp`
- `java`

## WebSocket Events

- `join_room`
- `code_change`
- `send_message`
- `user_join`
- `user_leave`

Additional call/WebRTC events:

- `call_invite`
- `call_accept`
- `call_reject`
- `webrtc_offer`
- `webrtc_answer`
- `webrtc_ice_candidate`
- `call_ended`

## Notes

- The frontend is intentionally UI-focused and communicates through API calls.
- Backend owns room management, code sync, chat broadcasting, and code execution.
- Code execution enforces a 3-second timeout and removes temporary artifacts after each run.
