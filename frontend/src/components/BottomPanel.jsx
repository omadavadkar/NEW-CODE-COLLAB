export default function BottomPanel({
  tab,
  setTab,
  contentByTab,
  terminalEntries,
  terminalCommand,
  setTerminalCommand,
  onRunCommand,
  isRunningCommand,
  panelClassName
}) {
  const tabs = ['Terminal', 'Output', 'Problems', 'Logs'];
  const currentContent = contentByTab[tab] || 'No output yet.';
  const hasError = /error|failed|exception/i.test(currentContent);

  return (
    <section className={`${panelClassName || 'col-span-1 row-span-1'} flex min-h-0 flex-col border-t border-[#2a2d2e] bg-[#181818]`}>
      <div className="flex gap-2 border-b border-[#2a2d2e] px-3 py-2">
        {tabs.map((tabName) => (
          <button
            key={tabName}
            type="button"
            className={`rounded px-3 py-1 text-[11px] uppercase tracking-[0.12em] transition ${
              tab === tabName
                ? 'bg-[#2d2d2d] text-slate-100'
                : 'text-slate-500 hover:bg-[#252526] hover:text-slate-300'
            }`}
            onClick={() => setTab(tabName)}
          >
            {tabName}
          </button>
        ))}
      </div>

      {tab === 'Terminal' ? (
        <>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-xs">
            {terminalEntries.map((entry) => (
              <div
                key={entry.id}
                className={`mb-1 whitespace-pre-wrap ${
                  entry.type === 'error'
                    ? 'text-rose-300'
                    : entry.type === 'success'
                      ? 'text-emerald-300'
                      : entry.type === 'command'
                        ? 'text-sky-300'
                        : 'text-slate-300'
                }`}
              >
                <span className="mr-2 text-slate-500">[{entry.time}]</span>
                {entry.text}
              </div>
            ))}
          </div>

          <form
            className="flex items-center gap-2 border-t border-[#2a2d2e] bg-[#1f1f1f] px-3 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              onRunCommand();
            }}
          >
            <span className="font-mono text-xs text-slate-500">$</span>
            <input
              value={terminalCommand}
              onChange={(event) => setTerminalCommand(event.target.value)}
              placeholder="pip install flask"
              className="w-full border-none bg-transparent font-mono text-xs text-slate-200 outline-none placeholder:text-slate-600"
            />
            <button
              type="submit"
              disabled={isRunningCommand}
              className="rounded border border-[#3a3d41] bg-[#2d2d2d] px-2 py-1 text-[11px] text-slate-200 transition hover:border-sky-500 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunningCommand ? 'Running...' : 'Run'}
            </button>
          </form>
        </>
      ) : (
        <pre className={`scrollbar-thin min-h-0 flex-1 overflow-auto px-4 py-3 text-sm ${hasError ? 'text-rose-300' : 'text-emerald-300'}`}>
          {currentContent}
        </pre>
      )}
    </section>
  );
}
