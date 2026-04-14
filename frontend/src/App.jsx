import { useEffect, useMemo, useRef, useState } from 'react';
import BottomPanel from './components/BottomPanel';
import ChatRoomPage from './components/ChatRoomPage';
import EditorArea from './components/EditorArea';
import ExplorerSidebar from './components/ExplorerSidebar';
import TeamChatSidebar from './components/TeamChatSidebar';
import { dummyFiles, editorTabs } from './data/dummyFiles';
import { runCode } from './services/api';
import { createCollabClient } from './services/collabClient';
import { createWebRtcManager } from './services/webrtcService';

const starterCode = {
  python: "print('Hello from Code Collab')",
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello from Code Collab" << endl;\n  return 0;\n}',
  java: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello from Code Collab");\n  }\n}'
};

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

  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(starterCode.python);
  const [activeTab, setActiveTab] = useState('main.py');
  const [output, setOutput] = useState('Terminal ready. Click Run to execute code from backend.');
  const [debugOutput, setDebugOutput] = useState('Debug console initialized.');
  const [problemsOutput, setProblemsOutput] = useState('No problems detected.');
  const [panelTab, setPanelTab] = useState('Terminal');
  const [chatInput, setChatInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isChatRoomOpen, setIsChatRoomOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [incomingInvite, setIncomingInvite] = useState(null);
  const [inCall, setInCall] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [callStatus, setCallStatus] = useState('No active call.');
  const [callParticipants, setCallParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [messages, setMessages] = useState([{ id: 1, sender: 'System', text: 'Welcome to Code Collab chat.' }]);

  const mediaStreamRef = useRef(null);
  const collabClientRef = useRef(null);
  const webRtcManagerRef = useRef(null);
  const remoteCodeUpdateRef = useRef(false);
  const tabs = useMemo(() => editorTabs, []);

  const getTimeLabel = () =>
    new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

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
          if (!nextCode) {
            return;
          }
          remoteCodeUpdateRef.current = true;
          setCode(nextCode);
        },
        onCodeChange: (nextCode) => {
          remoteCodeUpdateRef.current = true;
          setCode(nextCode);
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
          setPanelTab('Debug Console');
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

  const handleRun = async () => {
    setIsRunning(true);
    try {
      setOutput('Running...');
      setDebugOutput(`Executing ${language.toUpperCase()} code in room ${roomId}...`);
      const response = await runCode(language, code);
      if (response.error) {
        setOutput(response.error);
        setProblemsOutput(response.error);
        setPanelTab('Problems');
        return;
      }

      const renderedOutput = response.stderr
        ? `${response.stdout || ''}\n${response.stderr}`.trim()
        : response.stdout || 'Program executed with no output.';
      setOutput(renderedOutput);
      setDebugOutput(`Execution finished at ${new Date().toLocaleTimeString()}`);
      setProblemsOutput(response.stderr ? 'Runtime/compile warnings found. Check Output.' : 'No problems detected.');
      setPanelTab('Output');
    } catch (error) {
      const message = error.response?.data?.error || 'Execution failed. Check backend server.';
      setOutput(message);
      setProblemsOutput(message);
      setDebugOutput(`Execution request failed at ${new Date().toLocaleTimeString()}`);
      setPanelTab('Problems');
    } finally {
      setIsRunning(false);
    }
  };

  const handleEditorCodeChange = (nextCode) => {
    setCode(nextCode);
    if (remoteCodeUpdateRef.current) {
      remoteCodeUpdateRef.current = false;
      return;
    }
    collabClientRef.current?.sendCodeChange(nextCode);
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
      setPanelTab('Debug Console');
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
    setPanelTab('Debug Console');
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
      setPanelTab('Debug Console');
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
    'Debug Console': debugOutput,
    Terminal: output
  };

  const isTyping = chatInput.trim().length > 0;

  const copyRoomId = async () => {
    if (!roomId) {
      return;
    }
    await navigator.clipboard.writeText(roomId);
    setDebugOutput('Room ID copied to clipboard.');
    setPanelTab('Debug Console');
  };

  return (
    <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_5%_5%,#0e7490_0%,#020617_45%,#020617_100%)] p-4 text-slate-100">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 font-bold text-slate-950">CC</div>
          <div>
            <p className="text-lg font-semibold tracking-wide">Code Collab</p>
            <p className="text-xs text-slate-400">Collaboration-first coding workspace</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-100">Room: {roomId || 'Not joined'}</div>
          <button
            type="button"
            onClick={copyRoomId}
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-1 text-sm transition hover:bg-white/20"
          >
            Copy Room ID
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 text-sm font-semibold text-slate-950">
            {username.slice(0, 2).toUpperCase()}
          </div>
          <p className="text-sm text-slate-200">{username}</p>
        </div>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/50 px-3 py-3 backdrop-blur-xl">
        <input
          value={roomInput}
          onChange={(event) => setRoomInput(event.target.value)}
          placeholder="Enter room id"
          className="rounded-xl border border-white/20 bg-slate-800/80 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => joinRoom(roomInput)}
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold transition hover:scale-[1.02]"
        >
          Join Room
        </button>
        <button
          type="button"
          onClick={handleCreateRoom}
          className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-4 py-2 text-sm font-semibold transition hover:scale-[1.02]"
        >
          Create Room
        </button>
        <span className="text-sm text-slate-300">Current: {roomId || 'Not joined'}</span>
      </div>

      {incomingInvite ? (
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-amber-400/40 bg-amber-900/20 px-3 py-2 backdrop-blur-xl">
          <span className="text-sm">Incoming call from {incomingInvite.fromUsername}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAcceptInvite}
              className="rounded bg-emerald-600 px-3 py-1 text-sm font-semibold hover:bg-emerald-500"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={handleRejectInvite}
              className="rounded bg-rose-600 px-3 py-1 text-sm font-semibold hover:bg-rose-500"
            >
              Reject
            </button>
          </div>
        </div>
      ) : null}

      {!isJoinedRoom ? (
        <div className="grid h-[calc(100vh-210px)] place-items-center rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-2xl font-bold text-slate-950">
              <span>{'</>'}</span>
            </div>
            <h2 className="text-2xl font-semibold">Join or create a room to start collaborating</h2>
            <p className="mt-2 text-slate-400">Real-time code, team presence, and chat are waiting for you.</p>
          </div>
        </div>
      ) : isChatRoomOpen ? (
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
      ) : (
      <div className="grid h-[calc(100vh-210px)] min-h-0 grid-cols-12 grid-rows-[1fr_1fr_210px] overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
        <ExplorerSidebar files={dummyFiles} />
        <EditorArea
          roomId={roomId || 'Not joined'}
          username={username}
          users={users}
          language={language}
          setLanguage={(nextLanguage) => {
            setLanguage(nextLanguage);
            setCode(starterCode[nextLanguage]);
          }}
          code={code}
          setCode={handleEditorCodeChange}
          tabs={tabs}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onRun={handleRun}
          isRunning={isRunning}
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
          panelClassName="col-span-9 row-span-1"
        />
      </div>
      )}
    </main>
  );
}
