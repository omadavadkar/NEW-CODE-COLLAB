import { useEffect, useRef } from 'react';

export default function ChatRoomPage({ roomId, username, messages, chatInput, setChatInput, onSend, isTyping, onBack }) {
  const chatListRef = useRef(null);

  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <section className="h-[calc(100vh-210px)] overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">ChatRoom</h2>
          <p className="text-xs text-slate-400">Room {roomId || 'Not joined'}</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm transition hover:bg-white/20"
        >
          Back
        </button>
      </div>

      <div ref={chatListRef} className="scrollbar-thin h-[calc(100%-122px)] overflow-y-auto overflow-x-hidden px-4 py-4">
        <div className="space-y-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[72%] rounded-2xl px-3 py-2 text-sm shadow-md ${
                message.sender === username ? 'ml-auto bg-cyan-500/20 text-cyan-100' : 'bg-slate-800/90 text-slate-100'
              }`}
            >
              <p className="font-semibold text-xs text-slate-300">{message.sender}</p>
              <p>{message.text}</p>
              <p className="mt-1 text-[10px] text-slate-400">{message.timestamp || 'now'}</p>
            </div>
          ))}
          {isTyping ? (
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-300" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-300 [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-300 [animation-delay:240ms]" />
              typing...
            </div>
          ) : null}
        </div>
      </div>

      <form
        className="flex gap-2 border-t border-white/10 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <input
          value={chatInput}
          onChange={(event) => setChatInput(event.target.value)}
          placeholder="Type message..."
          className="flex-1 rounded-full border border-white/15 bg-slate-900/90 px-4 py-2 text-sm outline-none transition focus:border-cyan-400"
        />
        <button
          type="submit"
          className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold transition hover:scale-105"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4z" />
          </svg>
        </button>
      </form>
    </section>
  );
}
