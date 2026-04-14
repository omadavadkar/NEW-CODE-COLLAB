function getIceServers() {
  const fallback = [{ urls: 'stun:stun.l.google.com:19302' }];
  const raw = import.meta.env.VITE_ICE_SERVERS_JSON;

  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function createWebRtcManager({ localStream, signaling, onRemoteStream, onPeerDisconnected, onDebug, onProblem }) {
  const peers = new Map();
  const iceServers = getIceServers();

  function cleanupPeer(remoteSid) {
    const existing = peers.get(remoteSid);
    if (!existing) {
      return;
    }

    existing.connection.ontrack = null;
    existing.connection.onicecandidate = null;
    existing.connection.onconnectionstatechange = null;
    existing.connection.close();
    peers.delete(remoteSid);
    onPeerDisconnected?.(remoteSid);
  }

  function ensurePeer(remoteSid) {
    const current = peers.get(remoteSid);
    if (current) {
      return current.connection;
    }

    const connection = new RTCPeerConnection({ iceServers });

    localStream.getTracks().forEach((track) => {
      connection.addTrack(track, localStream);
    });

    connection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        onRemoteStream?.(remoteSid, remoteStream);
      }
    };

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.sendIceCandidate(remoteSid, event.candidate.toJSON());
      }
    };

    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        cleanupPeer(remoteSid);
      }
    };

    peers.set(remoteSid, { connection });
    return connection;
  }

  return {
    async createOffer(remoteSid) {
      try {
        const connection = ensurePeer(remoteSid);
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        signaling.sendOffer(remoteSid, offer);
        onDebug?.(`Created offer for peer ${remoteSid}`);
      } catch (error) {
        onProblem?.(error.message || 'Failed to create WebRTC offer.');
      }
    },

    async handleOffer(fromSid, offer) {
      try {
        const connection = ensurePeer(fromSid);
        if (connection.signalingState !== 'stable') {
          await connection.setLocalDescription({ type: 'rollback' });
        }
        await connection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        signaling.sendAnswer(fromSid, answer);
        onDebug?.(`Answered offer from peer ${fromSid}`);
      } catch (error) {
        onProblem?.(error.message || 'Failed to handle WebRTC offer.');
      }
    },

    async handleAnswer(fromSid, answer) {
      try {
        const connection = ensurePeer(fromSid);
        await connection.setRemoteDescription(new RTCSessionDescription(answer));
        onDebug?.(`Peer ${fromSid} connected with answer.`);
      } catch (error) {
        onProblem?.(error.message || 'Failed to handle WebRTC answer.');
      }
    },

    async handleIceCandidate(fromSid, candidate) {
      try {
        const connection = ensurePeer(fromSid);
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        onProblem?.(error.message || 'Failed to add ICE candidate.');
      }
    },

    removePeer(remoteSid) {
      cleanupPeer(remoteSid);
    },

    closeAll() {
      Array.from(peers.keys()).forEach((remoteSid) => {
        cleanupPeer(remoteSid);
      });
    }
  };
}
