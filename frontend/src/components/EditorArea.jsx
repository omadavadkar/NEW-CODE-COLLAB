import Editor from '@monaco-editor/react';

const languageMap = {
  python: 'python',
  cpp: 'cpp',
  java: 'java'
};

export default function EditorArea({
  roomId,
  username,
  users,
  language,
  setLanguage,
  code,
  setCode,
  tabs,
  activeTab,
  setActiveTab,
  onRun,
  isRunning,
  overlay
}) {
  const visibleUsers = users.slice(0, 4);

  return (
    <section className="col-span-7 row-span-2 flex h-full min-h-0 flex-col overflow-hidden border-r border-white/10 bg-slate-950/70 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.15)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-900/60 px-3 py-2">
        <div className="flex items-center gap-2">
          {visibleUsers.map((user) => (
            <div
              key={user.sid}
              title={user.username}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-cyan-400 to-blue-500 text-xs font-semibold text-white shadow-lg"
            >
              {user.username.slice(0, 2).toUpperCase()}
            </div>
          ))}
          <div className="text-xs text-slate-300">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Currently editing: {username}
          </div>
        </div>
        <div className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">Live Room: {roomId}</div>
      </div>

      <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900 px-2 py-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`rounded-xl px-3 py-1 text-xs transition ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                : 'text-slate-400 hover:bg-white/10'
            }`}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id.endsWith('.py')) {
                setLanguage('python');
              } else if (tab.id.endsWith('.cpp')) {
                setLanguage('cpp');
              } else {
                setLanguage('java');
              }
            }}
          >
            {tab.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-950 px-4 py-3">
        <div className="text-sm text-slate-300">Language runtime</div>
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="rounded-xl border border-white/20 bg-slate-800/80 px-3 py-1.5 text-sm text-slate-100 shadow-inner"
          >
            <option value="python">Python</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
          </select>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 transition-all duration-300 hover:shadow-[inset_0_0_0_1px_rgba(56,189,248,0.4)]">
        {overlay}
        <Editor
          height="100%"
          defaultLanguage="python"
          language={languageMap[language]}
          value={code}
          theme="vs-dark"
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            fontFamily: 'Fira Code, monospace',
            scrollBeyondLastLine: false,
            mouseWheelZoom: true,
            smoothScrolling: true
          }}
          onChange={(value) => setCode(value ?? '')}
        />

        <button
          type="button"
          onClick={onRun}
          disabled={isRunning}
          className="absolute bottom-4 left-4 z-30 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-2 text-sm font-semibold text-slate-900 shadow-xl transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isRunning ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" /> : null}
          {isRunning ? 'Running' : 'Run Code'}
        </button>
      </div>
    </section>
  );
}
