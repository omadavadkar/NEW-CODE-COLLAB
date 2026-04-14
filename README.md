# Code Collab

Code Collab is a browser-based collaborative coding platform with a professional VS Code-like interface, real-time room collaboration, Monaco editor, Python runtime execution, package installation flow, and integrated team video calling.

## Stack

- Frontend: React + Vite + Tailwind + Monaco Editor
- Backend: Flask + Flask-CORS + Flask-SocketIO
- Runtime: Python subprocess execution with timeout and command safety checks

## Core IDE Features

- VS Code-inspired dark workspace layout
- Left Explorer with nested folders, active file highlight, and file icons
- Center Monaco editor with multi-file tabs and syntax highlighting (Python, JavaScript, C++, Java)
- Bottom dock with Terminal, Output, Problems, and Logs
- Right collaboration panel with room members + existing video calling flow
- Drag-and-drop folder upload and folder picker upload
- Status bar with workspace/runtime details

## Video Calling

The existing room-based video calling flow is preserved and continues to use the same Socket.IO + WebRTC signaling path.

## Backend Routes

### `POST /upload-folder`

Uploads a folder from the client as multipart files and stores it in temporary backend workspace storage.

Response includes:

- `workspaceId`
- `tree` (nested file/folder structure)
- `fileCount`

### `GET /workspace-file`

Fetches UTF-8 text content for a file in a previously uploaded workspace.

Query params:

- `workspaceId`
- `filePath`

### `POST /run-python`

Runs Python safely via subprocess in isolated mode.

Accepts either inline code or workspace file reference.

```json
{
  "code": "print('hello')",
  "workspaceId": "optional",
  "filePath": "optional",
  "timeout": 8
}
```

Returns:

- `stdout`
- `stderr`
- `returncode`

### `POST /install-package`

Runs safe package install commands (pip install only).

```json
{
  "command": "pip install flask"
}
```

Returns command logs in `stdout`/`stderr`.

### Existing compatibility route

- `POST /run` remains available for Python/C++/Java snippet execution.

## Safety Controls

- Only controlled command families are accepted for package install (`pip install ...`)
- Install flags are blocked for safety
- Command timeout limits are enforced
- Uploaded paths are sanitized to prevent traversal
- Temporary workspace directories are managed and capped

## Run Instructions

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Backend starts at `http://127.0.0.1:5000`.

### 2. Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend starts at `http://127.0.0.1:5173`.

## Optional Environment Configuration

Create `frontend/.env` if needed:

```env
VITE_API_URL=http://127.0.0.1:5000
VITE_ICE_SERVERS_JSON=[{"urls":"stun:stun.l.google.com:19302"}]
```

## Quick Verify

1. Join or create a room.
2. Upload a folder from Explorer.
3. Open a `.py` file and run it.
4. Run terminal command: `pip install flask`.
5. Open collaboration panel and start video call with another user in the same room.
