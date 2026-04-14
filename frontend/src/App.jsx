import { useEffect, useMemo, useRef, useState } from 'react';
import BottomPanel from './components/BottomPanel';
import ChatRoomPage from './components/ChatRoomPage';
import EditorArea from './components/EditorArea';
import ExplorerSidebar from './components/ExplorerSidebar';
import TeamChatSidebar from './components/TeamChatSidebar';
import { getWorkspaceFile, installPackage, runCode, runPython, uploadFolder } from './services/api';
import { createCollabClient } from './services/collabClient';
import { createWebRtcManager } from './services/webrtcService';

const starterFiles = {
  'workspace/main.py': "print('Hello from Code Collab IDE')\n",
  'workspace/app.js': "console.log('Code Collab: JavaScript file loaded.');\n",
  'workspace/main.cpp': '#include <iostream>\n\nint main() {\n  std::cout << "Hello from Code Collab IDE" << std::endl;\n  return 0;\n}\n',
  'workspace/Main.java':
    'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello from Code Collab IDE");\n  }\n}\n'
};

const starterTree = [
  {
    name: 'workspace',
    type: 'folder',
    path: 'workspace',
    children: [
      { name: 'main.py', type: 'file', path: 'workspace/main.py' },
      { name: 'app.js', type: 'file', path: 'workspace/app.js' },
      { name: 'main.cpp', type: 'file', path: 'workspace/main.cpp' },
      { name: 'Main.java', type: 'file', path: 'workspace/Main.java' }
    ]
  }
];

const languageByExtension = {
  py: 'python',
  js: 'javascript',
  jsx: 'javascript',
  ts: 'javascript',
  tsx: 'javascript',
  cpp: 'cpp',
  cxx: 'cpp',
  cc: 'cpp',
  h: 'cpp',
  hpp: 'cpp',
  java: 'java'
};

function normalizeRelativePath(path) {
  return (path || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
}

function getLanguageFromPath(filePath) {
  const extension = filePath?.split('.').pop()?.toLowerCase();
  return languageByExtension[extension] || 'plaintext';
}

function countFiles(nodes) {
  return nodes.reduce((total, node) => {
    if (node.type === 'file') {
      return total + 1;
    }

    return total + countFiles(node.children || []);
  }, 0);
}

function getFirstFilePath(nodes) {
  for (const node of nodes) {
    if (node.type === 'file') {
      return node.path;
    }

    const child = getFirstFilePath(node.children || []);
    if (child) {
      return child;
    }
  }

  return '';
}

function parsePythonMarkers(stderr) {
  const lineMatches = [...stderr.matchAll(/line\s+(\d+)/gi)];
  if (!lineMatches.length) {
    return [];
  }

  const uniqueLines = Array.from(new Set(lineMatches.map((match) => Number(match[1])))).filter((line) => Number.isFinite(line));
  const summary = stderr.trim().split('\n').slice(-1)[0] || 'Runtime error';

  return uniqueLines.map((line) => ({
    startLineNumber: line,
    startColumn: 1,
    endLineNumber: line,
    endColumn: 200,
    message: summary,
    severity: 8
  }));
}

export default function App() {
  const [roomId, setRoomId] = useState('');
  const [roomInput, setRoomInput] = useState('ROOM-7F4A');
  const [isJoinedRoom, setIsJoinedRoom] = useState(false);
  const [username] = useState(() => {
    const existing = localStorage.getItem('code-collab-username');
    if (existing) {
      return existing;
    }

    const generated = `User-${Math.floor(Math.random() * 1000)}`;
    localStorage.setItem('code-collab-username', generated);
    return generated;
  });

  const [workspaceTree, setWorkspaceTree] = useState(starterTree);
  const [workspaceId, setWorkspaceId] = useState('');
  const [fileContents, setFileContents] = useState(starterFiles);
  const [openTabs, setOpenTabs] = useState(['workspace/main.py']);
  const [activeFilePath, setActiveFilePath] = useState('workspace/main.py');
  const [output, setOutput] = useState('Terminal ready. Click Run to execute code from backend.');
  const [debugOutput, setDebugOutput] = useState('Debug console initialized.');
  const [problemsOutput, setProblemsOutput] = useState('No problems detected.');
  const [logsOutput, setLogsOutput] = useState('Workspace booted successfully.');
  const [panelTab, setPanelTab] = useState('Terminal');
  const [terminalEntries, setTerminalEntries] = useState([{ id: 1, type: 'system', text: 'Terminal ready.', time: 'now' }]);
  const [terminalCommand, setTerminalCommand] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isRunningCommand, setIsRunningCommand] = useState(false);
  const [isUploadingFolder, setIsUploadingFolder] = useState(false);
  const [isChatRoomOpen, setIsChatRoomOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [incomingInvite, setIncomingInvite] = useState(null);
  const [inCall, setInCall] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [callStatus, setCallStatus] = useState('No active call.');
  const [callParticipants, setCallParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [editorMarkers, setEditorMarkers] = useState([]);
  const [messages, setMessages] = useState([{ id: 1, sender: 'System', text: 'Welcome to Code Collab chat.' }]);

  const mediaStreamRef = useRef(null);
  const collabClientRef = useRef(null);
  const webRtcManagerRef = useRef(null);
  const remoteCodeUpdateRef = useRef(false);
  const activeFilePathRef = useRef(activeFilePath);
  const openTabsRef = useRef(openTabs);
  const fileContentsRef = useRef(fileContents);
  const localUploadedFilesRef = useRef(new Map());
  const folderInputRef = useRef(null);

  const fileCount = useMemo(() => countFiles(workspaceTree), [workspaceTree]);
  const activeCode = activeFilePath ? fileContents[activeFilePath] ?? '' : '';
  const activeLanguage = getLanguageFromPath(activeFilePath);

  useEffect(() => {
    activeFilePathRef.current = activeFilePath;
  }, [activeFilePath]);

  useEffect(() => {
    openTabsRef.current = openTabs;
  }, [openTabs]);

  useEffect(() => {
    fileContentsRef.current = fileContents;
  }, [fileContents]);

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
    }
  }, []);

  const getTimeLabel = () =>
    new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

  const appendTerminalEntry = (type, text) => {
    setTerminalEntries((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        type,
        text,
        time: getTimeLabel()
      }
    ]);
  };

  const ensureFileContent = async (filePath) => {
    if (!filePath || fileContentsRef.current[filePath] !== undefined) {
      return;
    }

    const localFile = localUploadedFilesRef.current.get(filePath);
    if (localFile) {
      const text = await localFile.text();
      setFileContents((prev) => ({ ...prev, [filePath]: text }));
      return;
    }

    if (workspaceId) {
      const response = await getWorkspaceFile(workspaceId, filePath);
      setFileContents((prev) => ({ ...prev, [filePath]: response.content || '' }));
    }
  };

  useEffect(() => {
    if (!activeFilePath) {
      return;
    }

    ensureFileContent(activeFilePath).catch(() => {
      setProblemsOutput(`Unable to open ${activeFilePath}. File may be binary or unavailable.`);
      setPanelTab('Problems');
    });
  }, [activeFilePath, workspaceId]);

  const startLocalMedia = async () => {
    if (mediaStreamRef.current) {
      return mediaStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    mediaStreamRef.current = stream;
    return stream;
  };

  const ensureWebRtcManager = () => {
    if (!mediaStreamRef.current || !collabClientRef.current || webRtcManagerRef.current) {
      return webRtcManagerRef.current;
    }

    webRtcManagerRef.current = createWebRtcManager({
      localStream: mediaStreamRef.current,
      signaling: {
        sendOffer: (targetSid, offer) => collabClientRef.current?.sendOffer(targetSid, offer),
        sendAnswer: (targetSid, answer) => collabClientRef.current?.sendAnswer(targetSid, answer),
        sendIceCandidate: (targetSid, candidate) => collabClientRef.current?.sendIceCandidate(targetSid, candidate)
      },
      onRemoteStream: (sid, stream) => {
        setRemoteStreams((prev) => {
          const withoutPeer = prev.filter((item) => item.sid !== sid);
          const participant = callParticipants.find((entry) => entry.sid === sid);
          return [...withoutPeer, { sid, username: participant?.username || 'Peer', stream }];
        });
      },
      onPeerDisconnected: (sid) => {
        setRemoteStreams((prev) => prev.filter((item) => item.sid !== sid));
      },
      onDebug: (message) => {
        setDebugOutput(message);
      },
      onProblem: (message) => {
        setProblemsOutput(message);
        setPanelTab('Problems');
      }
    });

    return webRtcManagerRef.current;
  };

  useEffect(() => {
    if (!isJoinedRoom || !roomId) {
      return undefined;
    }

    collabClientRef.current = createCollabClient({
      roomId,
      username,
      handlers: {
        onUsers: (nextUsers) => {
          setUsers(nextUsers);
        },
        onCodeSync: (nextCode) => {
          const targetFile = activeFilePathRef.current || openTabsRef.current[0] || 'workspace/main.py';
          remoteCodeUpdateRef.current = true;
          setFileContents((prev) => ({ ...prev, [targetFile]: nextCode || '' }));
        },
        onCodeChange: (nextCode) => {
          const targetFile = activeFilePathRef.current || openTabsRef.current[0] || 'workspace/main.py';
          remoteCodeUpdateRef.current = true;
          setFileContents((prev) => ({ ...prev, [targetFile]: nextCode || '' }));
        },
        onMessage: (message) => {
          setMessages((prev) => [...prev, { ...message, timestamp: message.timestamp || getTimeLabel() }]);
        },
        onCallParticipants: (participants) => {
          setCallParticipants(participants);
          const me = participants.find((participant) => participant.username === username);
          const meInCall = Boolean(me);
          setInCall(meInCall);
          setIsMicOn(Boolean(me?.isMicOn));
          if (!meInCall) {
            setCallStatus('No active call.');
            setRemoteStreams([]);
          }
        },
        onCallInvite: (payload) => {
          setIncomingInvite(payload);
          setCallStatus(`Incoming call from ${payload.fromUsername}. Accept or Reject.`);
          setPanelTab('Logs');
        },
        onCallAccept: async (payload) => {
          const manager = ensureWebRtcManager();
          if (manager) {
            await manager.createOffer(payload.fromSid);
            setCallStatus(`${payload.fromUsername} accepted the call.`);
          }
        },
        onCallReject: (payload) => {
          setCallStatus(`${payload.fromUsername} rejected the call.`);
        },
        onWebRtcOffer: async (payload) => {
          const manager = ensureWebRtcManager();
          if (manager) {
            await manager.handleOffer(payload.fromSid, payload.offer);
          }
        },
        onWebRtcAnswer: async (payload) => {
          const manager = ensureWebRtcManager();
          if (manager) {
            await manager.handleAnswer(payload.fromSid, payload.answer);
          }
        },
        onWebRtcIceCandidate: async (payload) => {
          const manager = ensureWebRtcManager();
          if (manager) {
            await manager.handleIceCandidate(payload.fromSid, payload.candidate);
          }
        },
        onCallEnded: () => {
          setCallStatus('Call ended by peer.');
          setRemoteStreams([]);
          setIncomingInvite(null);
          webRtcManagerRef.current?.closeAll();
          webRtcManagerRef.current = null;
        },
        onDebug: (message) => {
          setDebugOutput(message);
        },
        onProblem: (message) => {
          setProblemsOutput(message);
          setPanelTab('Problems');
        }
      }
    });

    return () => {
      collabClientRef.current?.disconnect();
      collabClientRef.current = null;
      webRtcManagerRef.current?.closeAll();
      webRtcManagerRef.current = null;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      setUsers([]);
    };
  }, [isJoinedRoom, roomId, username]);

  const joinRoom = (value) => {
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      setProblemsOutput('Please enter a valid room id.');
      setPanelTab('Problems');
      return;
    }

    collabClientRef.current?.disconnect();
    collabClientRef.current = null;
    webRtcManagerRef.current?.closeAll();
    webRtcManagerRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    setIncomingInvite(null);
    setInCall(false);
    setIsMicOn(false);
    setCallParticipants([]);
    setRemoteStreams([]);
    setEditorMarkers([]);
    setMessages([{ id: Date.now(), sender: 'System', text: `Joined room ${normalized}`, timestamp: getTimeLabel() }]);
    setCallStatus('No active call.');
    setRoomId(normalized);
    setRoomInput(normalized);
    setIsJoinedRoom(true);
  };

  const handleCreateRoom = () => {
    const generated = `ROOM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    joinRoom(generated);
  };

  const handleOpenFile = (filePath) => {
    setActiveFilePath(filePath);
    setOpenTabs((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]));
    ensureFileContent(filePath).catch(() => {
      setProblemsOutput(`Unable to read ${filePath}.`);
      setPanelTab('Problems');
    });
  };

  const handleCloseTab = (tabPath) => {
    setOpenTabs((prev) => {
      const nextTabs = prev.filter((tab) => tab !== tabPath);
      if (tabPath === activeFilePath) {
        setActiveFilePath(nextTabs[nextTabs.length - 1] || '');
      }
      return nextTabs;
    });
  };

  const handleFolderUpload = async (incomingFiles) => {
    const files = Array.from(incomingFiles || []);
    if (!files.length) {
      return;
    }

    const entries = files
      .map((file) => {
        const relativePath = normalizeRelativePath(file.webkitRelativePath || file.name);
        return relativePath ? { file, relativePath } : null;
      })
      .filter(Boolean);

    if (!entries.length) {
      setProblemsOutput('No valid files detected in selected folder upload.');
      setPanelTab('Problems');
      return;
    }

    setIsUploadingFolder(true);
    appendTerminalEntry('command', '$ upload-folder');
    try {
      const payload = await uploadFolder(entries);
      const localFileMap = new Map();
      entries.forEach((entry) => {
        localFileMap.set(entry.relativePath, entry.file);
      });
      localUploadedFilesRef.current = localFileMap;

      setWorkspaceId(payload.workspaceId || '');
      setWorkspaceTree(payload.tree || []);
      setFileContents({});
      setOpenTabs([]);
      setActiveFilePath('');
      setEditorMarkers([]);

      const firstFile = getFirstFilePath(payload.tree || []);
      if (firstFile) {
        setOpenTabs([firstFile]);
        setActiveFilePath(firstFile);
      }

      const uploadedCount = payload.fileCount || entries.length;
      setLogsOutput(`Uploaded ${uploadedCount} files to temporary workspace ${payload.workspaceId}.`);
      setDebugOutput(`Folder uploaded at ${getTimeLabel()} and structure parsed by backend.`);
      setProblemsOutput('No problems detected.');
      appendTerminalEntry('success', `Workspace upload completed (${uploadedCount} files).`);
    } catch (error) {
      const message = error.response?.data?.error || 'Folder upload failed. Check backend server.';
      setProblemsOutput(message);
      setPanelTab('Problems');
      appendTerminalEntry('error', message);
    } finally {
      setIsUploadingFolder(false);
    }
  };

  const handleRun = async () => {
    if (!activeFilePath) {
      setProblemsOutput('Select a file before executing code.');
      setPanelTab('Problems');
      return;
    }

    setIsRunning(true);
    setEditorMarkers([]);
    try {
      setOutput('Running...');
      setDebugOutput(`Executing ${activeLanguage.toUpperCase()} code in room ${roomId || 'local'}...`);
      appendTerminalEntry('command', `$ run ${activeFilePath}`);

      let response;
      if (activeLanguage === 'python') {
        response = await runPython({
          code: activeCode,
          workspaceId,
          filePath: activeFilePath,
          timeout: 8
        });
      } else if (activeLanguage === 'cpp' || activeLanguage === 'java') {
        response = await runCode(activeLanguage, activeCode);
      } else {
        const warning = 'Execution is enabled for Python/C++/Java. JavaScript is currently editor-only.';
        setOutput(warning);
        setProblemsOutput(warning);
        setPanelTab('Problems');
        appendTerminalEntry('error', warning);
        return;
      }

      if (response.error) {
        setOutput(response.error);
        setProblemsOutput(response.error);
        setPanelTab('Problems');
        appendTerminalEntry('error', response.error);
        return;
      }

      const renderedOutput = response.stderr
        ? `${response.stdout || ''}\n${response.stderr}`.trim()
        : response.stdout || 'Program executed with no output.';

      setOutput(renderedOutput);
      setDebugOutput(`Execution finished at ${new Date().toLocaleTimeString()}`);
      setLogsOutput(`Executed ${activeFilePath} with exit code ${response.returncode ?? 0}.`);
      setProblemsOutput(response.stderr ? 'Runtime/compile warnings found. Check Output.' : 'No problems detected.');
      appendTerminalEntry(response.stderr ? 'error' : 'success', renderedOutput);

      if (response.stderr && activeLanguage === 'python') {
        setEditorMarkers(parsePythonMarkers(response.stderr));
      }

      setPanelTab(response.stderr ? 'Problems' : 'Output');
    } catch (error) {
      const message = error.response?.data?.error || 'Execution failed. Check backend server.';
      setOutput(message);
      setProblemsOutput(message);
      setDebugOutput(`Execution request failed at ${new Date().toLocaleTimeString()}`);
      setPanelTab('Problems');
      appendTerminalEntry('error', message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleEditorCodeChange = (nextCode) => {
    if (!activeFilePath) {
      return;
    }

    setFileContents((prev) => ({ ...prev, [activeFilePath]: nextCode }));
    if (remoteCodeUpdateRef.current) {
      remoteCodeUpdateRef.current = false;
      return;
    }
    collabClientRef.current?.sendCodeChange(nextCode);
  };

  const handleRunTerminalCommand = async () => {
    const command = terminalCommand.trim();
    if (!command) {
      return;
    }

    setTerminalCommand('');
    appendTerminalEntry('command', `$ ${command}`);
    setIsRunningCommand(true);

    try {
      if (/^pip\s+install\s+/i.test(command)) {
        const response = await installPackage(command);
        const rendered = `${response.stdout || ''}\n${response.stderr || ''}`.trim() || 'pip finished with no output.';
        setOutput(rendered);
        setLogsOutput(`Package command completed with exit code ${response.returncode ?? 0}.`);
        setPanelTab('Output');
        appendTerminalEntry(response.returncode === 0 ? 'success' : 'error', rendered);
        if (response.returncode !== 0) {
          setProblemsOutput(rendered);
          setPanelTab('Problems');
        }
        return;
      }

      if (/^python(\s+.*)?$/i.test(command)) {
        const requestedFile = normalizeRelativePath(command.replace(/^python\s*/i, ''));
        const targetFile = requestedFile || activeFilePath;

        if (!targetFile) {
          throw new Error('No Python file is active. Open a .py file first.');
        }

        if (!targetFile.endsWith('.py')) {
          throw new Error('Only Python files can run from terminal command mode.');
        }

        await ensureFileContent(targetFile);
        const sourceCode = fileContentsRef.current[targetFile] ?? '';

        const response = await runPython({
          code: sourceCode,
          workspaceId,
          filePath: targetFile,
          timeout: 8
        });

        const rendered = `${response.stdout || ''}\n${response.stderr || ''}`.trim() || 'Python execution completed with no output.';
        setOutput(rendered);
        setLogsOutput(`Terminal executed ${targetFile} with exit code ${response.returncode ?? 0}.`);
        setPanelTab(response.stderr ? 'Problems' : 'Output');
        appendTerminalEntry(response.stderr ? 'error' : 'success', rendered);
        if (response.stderr) {
          setEditorMarkers(parsePythonMarkers(response.stderr));
          setProblemsOutput(rendered);
        }
        return;
      }

      throw new Error('Allowed commands: pip install <package>, python [file.py]');
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Terminal command failed.';
      setProblemsOutput(message);
      setPanelTab('Problems');
      appendTerminalEntry('error', message);
    } finally {
      setIsRunningCommand(false);
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) {
      return;
    }
    collabClientRef.current?.sendMessage(chatInput.trim());
    setChatInput('');
  };

  const handleStartVideo = async () => {
    if (inCall) {
      setCallStatus('Video call is already active.');
      return;
    }

    if (users.length < 2) {
      setCallStatus('Your friend must join the same room before starting a call.');
      setProblemsOutput('Need at least 2 users in the same room for video call.');
      setPanelTab('Problems');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCallStatus('This browser does not support camera access.');
      setProblemsOutput('Camera API is not available in this browser.');
      setPanelTab('Problems');
      return;
    }

    try {
      setCallStatus('Requesting camera permission...');
      await startLocalMedia();
      ensureWebRtcManager();
      setCallStatus('Call started. Camera and mic access granted.');
      setDebugOutput('Video call established and local media stream started.');
      setPanelTab('Logs');
      collabClientRef.current?.startCall(true);
      collabClientRef.current?.inviteCall();
      setIncomingInvite(null);
    } catch (error) {
      setCallStatus('Camera/mic permission denied. Please allow access and retry.');
      setProblemsOutput(error.message || 'Failed to start video call due to media permissions.');
      setPanelTab('Problems');
    }
  };

  const handleToggleMic = () => {
    if (!inCall) {
      setCallStatus('Start a video call before toggling mic.');
      return;
    }

    if (mediaStreamRef.current) {
      const nextMicState = !isMicOn;
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = nextMicState;
      });
      setIsMicOn(nextMicState);
      setCallStatus(nextMicState ? 'Mic is on.' : 'Mic is muted.');
      collabClientRef.current?.toggleMic(nextMicState);
      return;
    }

    setCallStatus('Mic stream not available. Restart call.');
  };

  const handleEndCall = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    webRtcManagerRef.current?.closeAll();
    webRtcManagerRef.current = null;
    setInCall(false);
    setIsMicOn(false);
    setCallParticipants([]);
    setRemoteStreams([]);
    setCallStatus('Call ended.');
    setDebugOutput('Video call ended and media tracks stopped.');
    setPanelTab('Logs');
    collabClientRef.current?.leaveCall();
  };

  const handleAcceptInvite = async () => {
    if (!incomingInvite) {
      return;
    }

    try {
      setCallStatus(`Accepting call from ${incomingInvite.fromUsername}...`);
      await startLocalMedia();
      ensureWebRtcManager();
      collabClientRef.current?.startCall(true);
      collabClientRef.current?.acceptCall(incomingInvite.fromSid);
      setIncomingInvite(null);
      setPanelTab('Logs');
    } catch (error) {
      setCallStatus('Call accept failed. Camera/mic permission denied.');
      setProblemsOutput(error.message || 'Could not accept call invite.');
      setPanelTab('Problems');
    }
  };

  const handleRejectInvite = () => {
    if (!incomingInvite) {
      return;
    }

    collabClientRef.current?.rejectCall(incomingInvite.fromSid);
    setCallStatus(`Rejected call from ${incomingInvite.fromUsername}.`);
    setIncomingInvite(null);
  };

  const panelContent = {
    Problems: problemsOutput,
    Output: output,
    Logs: `${logsOutput}\n${debugOutput}`
  };

  const isTyping = chatInput.trim().length > 0;
  const canRunFromEditor = activeFilePath && ['python', 'cpp', 'java'].includes(activeLanguage);

  const copyRoomId = async () => {
    if (!roomId) {
      return;
    }
    await navigator.clipboard.writeText(roomId);
    setDebugOutput('Room ID copied to clipboard.');
    setPanelTab('Logs');
  };

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#111111] text-slate-100">
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(event) => {
          handleFolderUpload(event.target.files);
          event.target.value = '';
        }}
      />

      <header className="border-b border-[#2a2d2e] bg-[#181818] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-[#007acc] font-bold text-white">CC</div>
            <div>
              <p className="text-lg font-semibold tracking-wide">Code Collab</p>
              <p className="text-xs text-slate-400">Collaborative browser IDE with Python backend runtime</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={roomInput}
              onChange={(event) => setRoomInput(event.target.value)}
              placeholder="Room ID"
              className="rounded border border-[#3a3d41] bg-[#252526] px-3 py-1.5 text-sm outline-none focus:border-sky-500"
            />
            <button
              type="button"
              onClick={() => joinRoom(roomInput)}
              className="rounded border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-sm text-sky-100 transition hover:bg-sky-500/25"
            >
              Join Room
            </button>
            <button
              type="button"
              onClick={handleCreateRoom}
              className="rounded border border-[#3a3d41] bg-[#252526] px-3 py-1.5 text-sm transition hover:border-slate-400"
            >
              Create Room
            </button>
            <button
              type="button"
              onClick={copyRoomId}
              className="rounded border border-[#3a3d41] bg-[#252526] px-3 py-1.5 text-sm transition hover:border-slate-400"
            >
              Copy Room
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded border border-[#3a3d41] bg-[#252526] px-3 py-1 text-xs text-slate-300">{roomId || 'Not joined'}</div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-100">
              {username.slice(0, 2).toUpperCase()}
            </div>
            <p className="text-sm text-slate-300">{username}</p>
          </div>
        </div>
      </header>

      {incomingInvite ? (
        <div className="flex items-center justify-between border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm">
          <span>Incoming call from {incomingInvite.fromUsername}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAcceptInvite}
              className="rounded border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-emerald-200"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={handleRejectInvite}
              className="rounded border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-rose-200"
            >
              Reject
            </button>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        {!isJoinedRoom ? (
          <div className="grid h-full place-items-center bg-[#111111]">
            <div className="max-w-xl rounded border border-[#2a2d2e] bg-[#181818] p-8 text-center">
              <h2 className="text-2xl font-semibold">Join or create a room to start collaboration</h2>
              <p className="mt-2 text-slate-400">
                Real-time code sync, developer-grade editor, package management, and built-in team video.
              </p>
            </div>
          </div>
        ) : isChatRoomOpen ? (
          <div className="h-full p-4">
            <ChatRoomPage
              roomId={roomId}
              username={username}
              messages={messages}
              chatInput={chatInput}
              setChatInput={setChatInput}
              onSend={handleSendMessage}
              isTyping={isTyping}
              onBack={() => setIsChatRoomOpen(false)}
            />
          </div>
        ) : (
          <div className="grid h-full min-h-0 grid-cols-[minmax(210px,16%)_minmax(0,1fr)_minmax(300px,24%)] grid-rows-[minmax(0,1fr)_230px]">
            <ExplorerSidebar
              files={workspaceTree}
              activeFilePath={activeFilePath}
              onSelectFile={handleOpenFile}
              onUploadClick={() => folderInputRef.current?.click()}
              onFolderDrop={handleFolderUpload}
              isUploading={isUploadingFolder}
              workspaceId={workspaceId}
            />

            <EditorArea
              roomId={roomId || 'Not joined'}
              username={username}
              users={users}
              language={activeLanguage}
              code={activeCode}
              setCode={handleEditorCodeChange}
              openTabs={openTabs}
              activeFilePath={activeFilePath}
              onSelectTab={handleOpenFile}
              onCloseTab={handleCloseTab}
              onRun={handleRun}
              isRunning={isRunning}
              markers={editorMarkers}
              isRunDisabled={!canRunFromEditor}
              runLabel={activeLanguage === 'python' ? 'Run Python' : 'Run Code'}
            />

            <TeamChatSidebar
              username={username}
              users={users}
              callParticipants={callParticipants}
              inCall={inCall}
              isMicOn={isMicOn}
              localStream={mediaStreamRef.current}
              remoteStreams={remoteStreams}
              callStatus={callStatus}
              isTyping={isTyping}
              onOpenChatRoom={() => setIsChatRoomOpen(true)}
              onVideo={handleStartVideo}
              onMic={handleToggleMic}
              onEndCall={handleEndCall}
            />

            <BottomPanel
              tab={panelTab}
              setTab={setPanelTab}
              contentByTab={panelContent}
              terminalEntries={terminalEntries}
              terminalCommand={terminalCommand}
              setTerminalCommand={setTerminalCommand}
              onRunCommand={handleRunTerminalCommand}
              isRunningCommand={isRunningCommand}
            />
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-[#1f5f8b] bg-[#007acc] px-4 py-1.5 text-xs text-white">
        <div className="flex items-center gap-4">
          <span>Workspace: {workspaceId || 'local'}</span>
          <span>Files: {fileCount}</span>
          <span>Users: {users.length || 1}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Active: {activeFilePath || 'none'}</span>
          <span>Language: {activeLanguage}</span>
          <span>Room: {roomId || 'not-joined'}</span>
        </div>
      </footer>
    </main>
  );
}
