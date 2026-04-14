import shutil
import tempfile
import uuid
from pathlib import Path, PurePosixPath
from threading import Lock


class WorkspaceStoreError(Exception):
    pass


class WorkspaceStore:
    def __init__(self, max_workspaces: int = 20, max_files: int = 400, max_file_size_bytes: int = 2_000_000):
        self._workspaces: dict[str, Path] = {}
        self._workspace_order: list[str] = []
        self._max_workspaces = max_workspaces
        self._max_files = max_files
        self._max_file_size_bytes = max_file_size_bytes
        self._lock = Lock()

    def save_uploaded_files(self, uploaded_files: list) -> dict:
        files = [item for item in uploaded_files if getattr(item, 'filename', None)]
        if not files:
            raise WorkspaceStoreError('Upload must include at least one file.')

        if len(files) > self._max_files:
            raise WorkspaceStoreError(f'Upload limit exceeded. Max {self._max_files} files are allowed per upload.')

        workspace_id = uuid.uuid4().hex[:12]
        workspace_dir = Path(tempfile.mkdtemp(prefix='code_collab_ws_'))

        relative_paths: list[str] = []
        try:
            for file_storage in files:
                relative_path = self._sanitize_relative_path(file_storage.filename)
                destination = (workspace_dir / relative_path).resolve()
                if not str(destination).startswith(str(workspace_dir.resolve())):
                    raise WorkspaceStoreError('Unsafe file path detected in upload.')

                destination.parent.mkdir(parents=True, exist_ok=True)

                stream = file_storage.stream
                current_position = stream.tell()
                stream.seek(0, 2)
                file_size = stream.tell()
                stream.seek(current_position)
                if file_size > self._max_file_size_bytes:
                    raise WorkspaceStoreError(
                        f'File too large: {relative_path.as_posix()} (max {self._max_file_size_bytes // 1_000_000}MB per file).'
                    )

                file_storage.save(destination)
                relative_paths.append(relative_path.as_posix())

            if not relative_paths:
                raise WorkspaceStoreError('No valid files were uploaded.')

            with self._lock:
                self._workspaces[workspace_id] = workspace_dir
                self._workspace_order.append(workspace_id)
                self._enforce_workspace_limit()

            tree = self._build_tree(workspace_dir, workspace_dir)
            return {
                'workspaceId': workspace_id,
                'tree': tree,
                'fileCount': len(relative_paths),
            }
        except Exception:
            shutil.rmtree(workspace_dir, ignore_errors=True)
            raise

    def resolve_file(self, workspace_id: str, relative_file_path: str) -> Path | None:
        with self._lock:
            workspace_dir = self._workspaces.get(workspace_id)

        if not workspace_dir:
            return None

        try:
            relative_path = self._sanitize_relative_path(relative_file_path)
        except WorkspaceStoreError:
            return None

        candidate = (workspace_dir / relative_path).resolve()
        if not str(candidate).startswith(str(workspace_dir.resolve())):
            return None

        if not candidate.exists() or not candidate.is_file():
            return None

        return candidate

    def _enforce_workspace_limit(self) -> None:
        while len(self._workspace_order) > self._max_workspaces:
            oldest_id = self._workspace_order.pop(0)
            directory = self._workspaces.pop(oldest_id, None)
            if directory:
                shutil.rmtree(directory, ignore_errors=True)

    def _sanitize_relative_path(self, raw_path: str) -> Path:
        normalized = (raw_path or '').replace('\\', '/').strip().lstrip('/')
        if not normalized:
            raise WorkspaceStoreError('Uploaded file has an empty path.')

        pure_path = PurePosixPath(normalized)
        clean_parts = [part for part in pure_path.parts if part not in {'', '.'}]
        if not clean_parts or any(part == '..' for part in clean_parts):
            raise WorkspaceStoreError('Upload contains invalid relative paths.')

        return Path(*clean_parts)

    def _build_tree(self, directory: Path, root: Path) -> list[dict]:
        nodes: list[dict] = []

        for child in sorted(directory.iterdir(), key=lambda item: (item.is_file(), item.name.lower())):
            relative_path = child.relative_to(root).as_posix()
            if child.is_dir():
                nodes.append(
                    {
                        'name': child.name,
                        'type': 'folder',
                        'path': relative_path,
                        'children': self._build_tree(child, root),
                    }
                )
            else:
                nodes.append({'name': child.name, 'type': 'file', 'path': relative_path})

        return nodes
