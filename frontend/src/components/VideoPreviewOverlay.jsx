import { useEffect, useRef } from 'react';

function VideoTile({ title, stream, muted = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  return (
    <div className="overflow-hidden rounded border border-slate-700 bg-black/70">
      <div className="px-2 py-1 text-xs text-slate-300">{title}</div>
      <video ref={videoRef} autoPlay playsInline muted={muted} className="h-24 w-40 object-cover" />
    </div>
  );
}

export default function VideoPreviewOverlay({ inCall, localStream, remoteStreams }) {
  if (!inCall) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 flex gap-2">
      <VideoTile title="You" stream={localStream} muted />
      {remoteStreams.map((remote) => (
        <VideoTile key={remote.sid} title={remote.username} stream={remote.stream} />
      ))}
    </div>
  );
}
