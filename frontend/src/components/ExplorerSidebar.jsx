import { useState } from 'react';

function FolderIcon({ isOpen }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      {isOpen ? <path d="M8 12h8" /> : <path d="M8 12h8M12 8v8" />}
    </svg>
  );
}

function FileIcon({ fileName }) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const color = extension === 'js' || extension === 'jsx' ? 'text-amber-300' : extension === 'py' ? 'text-emerald-300' : 'text-sky-300';

  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${color}`} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
      <path d="M14 3v6h6" />
    </svg>
  );
}

function NodeItem({ node, depth, expanded, toggle }) {
  const isFolder = node.type === 'folder';
  const isOpen = expanded[node.name] ?? true;

  return (
    <div>
      <button
        type="button"
        onClick={() => isFolder && toggle(node.name)}
        className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-200 transition hover:bg-white/10"
        style={{ marginLeft: `${depth * 10}px` }}
      >
        <span className="text-slate-400">{isFolder ? <FolderIcon isOpen={isOpen} /> : <FileIcon fileName={node.name} />}</span>
        <span className="truncate">{node.name}</span>
      </button>
      {isFolder && isOpen
        ? node.children?.map((child) => (
            <NodeItem key={`${node.name}-${child.name}`} node={child} depth={depth + 1} expanded={expanded} toggle={toggle} />
          ))
        : null}
    </div>
  );
}

export default function ExplorerSidebar({ files }) {
  const [expanded, setExpanded] = useState({});

  const toggleFolder = (name) => {
    setExpanded((prev) => ({ ...prev, [name]: !(prev[name] ?? true) }));
  };

  return (
    <aside className="col-span-2 row-span-2 flex h-full min-h-0 flex-col rounded-l-2xl border-r border-white/10 bg-white/5 backdrop-blur-xl">
      <div className="shrink-0 border-b border-white/10 px-4 py-3 text-xs font-semibold tracking-[0.25em] text-slate-300">EXPLORER</div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto px-2 py-3">
        {files.map((node) => (
          <NodeItem key={node.name} node={node} depth={0} expanded={expanded} toggle={toggleFolder} />
        ))}
      </div>
    </aside>
  );
}
