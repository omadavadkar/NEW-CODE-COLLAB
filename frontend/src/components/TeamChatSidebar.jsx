import { useEffect, useRef } from 'react';

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 10l4.5-2.5a1 1 0 011.5.87v7.26a1 1 0 01-1.5.87L15 14" />
      <rect x="3" y="6" width="12" height="12" rx="2" ry="2" />
    </svg>
  );
}

function MicOnIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0014 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0014 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

function EndCallIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 15c4-4 12-4 16 0" />
      <path d="M7 14l-2 3" />
      <path d="M17 14l2 3" />
    </svg>
  );
}

function LocalPreview({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  if (!stream) {
    return null;
  }

  return (
    <div className="mt-2 w-fit overflow-hidden rounded border border-slate-700 bg-black/70">
      <div className="px-2 py-1 text-xs text-slate-300">Preview</div>
      <video ref={videoRef} autoPlay playsInline muted className="h-24 w-40 object-cover" />
    </div>
  );
}

function RemotePreviewTile({ stream, username }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  if (!stream) {
    return null;
  }

  return (
    <div className="mt-2 w-fit overflow-hidden rounded border border-slate-700 bg-black/70">
      <div className="px-2 py-1 text-xs text-slate-300">{username}</div>
      <video ref={videoRef} autoPlay playsInline className="h-24 w-40 object-cover" />
    </div>
  );
}

export default function TeamChatSidebar({
  username,
  users,
  callParticipants,
  inCall,
  isMicOn,
  localStream,
  remoteStreams,
  callStatus,
  isTyping,
  onVideo,
  onMic,
  onEndCall,
  onOpenChatRoom
}) {
  const hasAnyVideoStream = Boolean(localStream) || Boolean(remoteStreams?.length);

  return (
    <aside className="scrollbar-thin col-span-1 row-span-2 flex h-full min-h-0 min-w-[300px] flex-col overflow-y-auto overflow-x-hidden border-l border-[#2a2d2e] bg-[#181818]">
      <div className="flex items-center justify-between border-b border-[#2a2d2e] px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-200">Collaboration</h2>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={onVideo}
            className="flex items-center gap-1 rounded border border-[#3a3d41] bg-[#252526] px-2.5 py-1.5 text-slate-300 transition hover:border-sky-500 hover:text-sky-200"
          >
            <CameraIcon />
            <span>{inCall ? 'In Call' : 'Video'}</span>
          </button>
          <button
            type="button"
            onClick={onMic}
            className="flex items-center gap-1 rounded border border-[#3a3d41] bg-[#252526] px-2.5 py-1.5 text-slate-300 transition hover:border-sky-500 hover:text-sky-200"
          >
            {isMicOn ? <MicOnIcon /> : <MicOffIcon />}
            <span>{isMicOn ? 'Mic On' : 'Mic Off'}</span>
          </button>
          <button
            type="button"
            onClick={onEndCall}
            className="flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/15 px-2.5 py-1.5 text-rose-200 transition hover:bg-rose-500/25"
          >
            <EndCallIcon />
            <span>End</span>
          </button>
        </div>
      </div>

      <div className="shrink-0 border-b border-[#2a2d2e] px-4 py-3">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Call Status</h3>
        <p className="rounded border border-[#3a3d41] bg-[#252526] p-2 text-sm text-slate-200">{callStatus}</p>
        <div className="flex flex-wrap justify-start gap-2">
          <LocalPreview stream={localStream} />
          {remoteStreams?.map((remote) => (
            <RemotePreviewTile key={remote.sid} stream={remote.stream} username={remote.username} />
          ))}
          {!hasAnyVideoStream ? (
            <div className="mt-2 rounded border border-dashed border-[#3a3d41] bg-[#1f1f1f] px-3 py-2 text-xs text-slate-400">
              Video preview appears here once a call starts.
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-b border-[#2a2d2e] px-4 py-3">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Team Presence</h3>
        {users.length ? (
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.sid} className="flex items-center justify-between rounded border border-[#3a3d41] bg-[#252526] p-2 text-sm transition hover:border-slate-500">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-100">
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p>{user.username}</p>
                    <p className="text-xs text-slate-400">{user.username === username && isTyping ? 'typing...' : 'online'}</p>
                  </div>
                </div>
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Only you are in this room right now.</p>
        )}
      </div>

      <div className="flex min-h-0 flex-1 items-end p-4">
        <button
          type="button"
          onClick={onOpenChatRoom}
          className="w-full rounded border border-[#3a3d41] bg-[#252526] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-sky-500 hover:text-sky-200"
        >
          Open ChatRoom
        </button>
      </div>
    </aside>
  );
}
