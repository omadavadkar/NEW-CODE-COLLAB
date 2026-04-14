import Editor from '@monaco-editor/react';
import { useEffect, useRef } from 'react';

const languageMap = {
  python: 'python',
  javascript: 'javascript',
  cpp: 'cpp',
  java: 'java',
  plaintext: 'plaintext'
};

export default function EditorArea({
  roomId,
  username,
  users,
  language,
  code,
  setCode,
  openTabs,
  activeFilePath,
  onSelectTab,
  onCloseTab,
  onRun,
  isRunning,
  overlay,
  markers,
  isRunDisabled,
  runLabel
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const visibleUsers = users.slice(0, 4);

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) {
      return;
    }

    const model = editorRef.current.getModel();
    if (!model) {
      return;
    }

    monacoRef.current.editor.setModelMarkers(model, 'code-collab-runtime', markers || []);
  }, [markers, activeFilePath]);

  return (
    <section className="col-span-1 row-span-1 flex h-full min-h-0 flex-col overflow-hidden border-r border-[#2a2d2e] bg-[#1e1e1e]">
      <div className="flex items-center justify-between gap-3 border-b border-[#2a2d2e] bg-[#252526] px-3 py-2">
        <div className="flex items-center gap-2">
          {visibleUsers.map((user) => (
            <div
              key={user.sid}
              title={user.username}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-[10px] font-semibold text-slate-100"
            >
              {user.username.slice(0, 2).toUpperCase()}
            </div>
          ))}
          <div className="text-xs text-slate-300">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Editing as {username}
          </div>
        </div>
        <div className="rounded border border-[#3a3d41] bg-[#1f1f1f] px-2 py-1 text-[11px] text-slate-300">Room {roomId}</div>
      </div>

      <div className="scrollbar-thin flex items-center gap-1 overflow-auto border-b border-[#2a2d2e] bg-[#2d2d2d] px-1 py-1">
        {openTabs.map((tabPath) => (
          <button
            key={tabPath}
            type="button"
            className={`group flex items-center gap-2 rounded px-2 py-1 text-xs transition ${
              activeFilePath === tabPath
                ? 'bg-[#1e1e1e] text-slate-100'
                : 'text-slate-400 hover:bg-[#1e1e1e] hover:text-slate-200'
            }`}
            onClick={() => onSelectTab(tabPath)}
          >
            <span className="max-w-48 truncate">{tabPath.split('/').pop()}</span>
            <span
              role="button"
              aria-label={`Close ${tabPath}`}
              className="rounded px-1 text-slate-500 hover:bg-slate-700 hover:text-slate-200"
              onClick={(event) => {
                event.stopPropagation();
                onCloseTab(tabPath);
              }}
            >
              x
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2a2d2e] bg-[#252526] px-4 py-2">
        <div className="text-xs text-slate-300">
          Language: <span className="text-slate-100">{language}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded border border-[#3a3d41] bg-[#1f1f1f] px-2 py-1 text-[11px] text-slate-300">
            Monaco Editor
          </span>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-[#1e1e1e]">
        {overlay}
        {activeFilePath ? (
          <Editor
            key={activeFilePath}
            height="100%"
            defaultLanguage="python"
            language={languageMap[language] || 'plaintext'}
            value={code}
            theme="vs-dark"
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              lineNumbers: 'on',
              fontFamily: 'JetBrains Mono, monospace',
              scrollBeyondLastLine: false,
              mouseWheelZoom: true,
              smoothScrolling: true,
              tabSize: 2,
              insertSpaces: true,
              automaticLayout: true,
              formatOnType: true,
              renderWhitespace: 'selection'
            }}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              monacoRef.current = monaco;
            }}
            onChange={(value) => setCode(value ?? '')}
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-slate-400">
            Select a file from Explorer to start editing.
          </div>
        )}

        <button
          type="button"
          onClick={onRun}
          disabled={isRunning || isRunDisabled}
          className="absolute bottom-4 left-4 z-30 flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-200 border-t-transparent" /> : null}
          {isRunning ? 'Running...' : runLabel}
        </button>
      </div>
    </section>
  );
}
