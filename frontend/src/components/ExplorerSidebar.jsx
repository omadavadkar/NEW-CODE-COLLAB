import { useEffect, useState } from 'react';

function ChevronIcon({ isOpen }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function FolderIcon({ isOpen }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-300" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      {isOpen ? <path d="M8 12h8" /> : <path d="M8 12h8M12 8v8" />}
    </svg>
  );
}

function FileIcon({ fileName }) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const iconColorByExtension = {
    py: 'text-emerald-300',
    js: 'text-yellow-300',
    jsx: 'text-yellow-300',
    cpp: 'text-sky-300',
    cxx: 'text-sky-300',
    cc: 'text-sky-300',
    java: 'text-rose-300',
    json: 'text-orange-300',
    md: 'text-violet-300'
  };

  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 ${iconColorByExtension[extension] || 'text-slate-300'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
      <path d="M14 3v6h6" />
    </svg>
  );
}

function NodeItem({ node, depth, expanded, onToggle, activeFilePath, onSelectFile }) {
  const isFolder = node.type === 'folder';
  const isOpen = expanded[node.path] ?? true;
  const isActiveFile = !isFolder && node.path === activeFilePath;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (isFolder) {
            onToggle(node.path);
            return;
          }
          onSelectFile(node.path);
        }}
        className={`group flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-sm transition ${
          isActiveFile
            ? 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/40'
            : 'text-slate-300 hover:bg-slate-800/90 hover:text-slate-100'
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {isFolder ? <ChevronIcon isOpen={isOpen} /> : <span className="inline-block w-3.5" />}
        {isFolder ? <FolderIcon isOpen={isOpen} /> : <FileIcon fileName={node.name} />}
        <span className="truncate">{node.name}</span>
      </button>
      {isFolder && isOpen
        ? node.children?.map((child) => (
            <NodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              activeFilePath={activeFilePath}
              onSelectFile={onSelectFile}
            />
          ))
        : null}
    </div>
  );
}

export default function ExplorerSidebar({
  files,
  activeFilePath,
  onSelectFile,
  onUploadClick,
  onFolderDrop,
  isUploading,
  workspaceId
}) {
  const [expanded, setExpanded] = useState({});
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    setExpanded((previous) => {
      const next = { ...previous };

      const markFolders = (nodes) => {
        nodes.forEach((node) => {
          if (node.type === 'folder') {
            if (next[node.path] === undefined) {
              next[node.path] = true;
            }
            markFolders(node.children || []);
          }
        });
      };

      markFolders(files || []);
      return next;
    });
  }, [files]);

  const toggleFolder = (path) => {
    setExpanded((previous) => ({ ...previous, [path]: !(previous[path] ?? true) }));
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(event.dataTransfer.files || []);
    if (droppedFiles.length) {
      onFolderDrop(droppedFiles);
    }
  };

  return (
    <aside className="col-span-1 row-span-2 flex h-full min-h-0 flex-col border-r border-[#2a2d2e] bg-[#181818]">
      <div className="flex items-center justify-between border-b border-[#2a2d2e] px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Explorer</p>
        <button
          type="button"
          onClick={onUploadClick}
          disabled={isUploading}
          className="rounded border border-[#3a3d41] bg-[#252526] px-2 py-1 text-[11px] text-slate-200 transition hover:border-sky-500 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? 'Uploading...' : 'Upload Folder'}
        </button>
      </div>

      <div
        className={`mx-3 mt-3 rounded border border-dashed px-3 py-2 text-xs transition ${
          isDragOver ? 'border-sky-400 bg-sky-500/10 text-sky-200' : 'border-[#3a3d41] bg-[#1f1f1f] text-slate-400'
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        Drag & drop a folder here
      </div>

      <div className="mt-2 px-3 text-[11px] text-slate-500">Workspace: {workspaceId || 'local (not uploaded)'}</div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto px-1 py-2">
        {files.length ? (
          files.map((node) => (
            <NodeItem
              key={node.path}
              node={node}
              depth={0}
              expanded={expanded}
              onToggle={toggleFolder}
              activeFilePath={activeFilePath}
              onSelectFile={onSelectFile}
            />
          ))
        ) : (
          <div className="px-3 py-4 text-xs text-slate-500">Upload a folder to populate the explorer.</div>
        )}
      </div>
    </aside>
  );
}
