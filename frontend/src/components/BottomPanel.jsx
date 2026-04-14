export default function BottomPanel({ tab, setTab, contentByTab, panelClassName }) {
  const tabs = ['Problems', 'Output', 'Debug Console', 'Terminal'];
  const currentContent = contentByTab[tab] || 'No output yet.';
  const hasError = /error|failed|exception/i.test(currentContent);

  return (
    <section className={`${panelClassName || 'col-span-12 row-span-1'} border-t border-white/10 bg-slate-950/60 backdrop-blur-xl`}>
      <div className="flex gap-2 border-b border-white/10 px-4 py-2">
        {tabs.map((tabName) => (
          <button
            key={tabName}
            type="button"
            className={`rounded-xl px-3 py-1 text-xs transition ${
              tab === tabName
                ? 'bg-gradient-to-r from-cyan-500/80 to-blue-500/80 text-white shadow-lg'
                : 'text-slate-400 hover:bg-white/10'
            }`}
            onClick={() => setTab(tabName)}
          >
            {tabName}
          </button>
        ))}
      </div>
      <pre className={`scrollbar-thin h-36 overflow-auto px-4 py-3 text-sm ${hasError ? 'text-rose-300' : 'text-emerald-300'}`}>
        {currentContent}
      </pre>
    </section>
  );
}
