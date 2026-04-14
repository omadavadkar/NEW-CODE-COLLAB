import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


class ExecutionError(Exception):
    pass


SAFE_PACKAGE_PATTERN = re.compile(
    r'^[A-Za-z0-9][A-Za-z0-9_.-]*(?:\[[A-Za-z0-9,_.-]+\])?(?:[<>=!~]{1,2}[A-Za-z0-9*+_.-]+)?$'
)


def _run_command(
    command: list[str],
    work_dir: str,
    timeout: int = 3,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess:
    return subprocess.run(
        command,
        cwd=work_dir,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
        env=env,
    )


def _bounded_timeout(raw_timeout: int, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(raw_timeout)
    except (TypeError, ValueError):
        return default

    return max(minimum, min(parsed, maximum))


def execute_code(language: str, code: str) -> dict:
    temp_dir = tempfile.mkdtemp(prefix='code_collab_')

    try:
        if language == 'python':
            return _execute_python(code, temp_dir)
        if language == 'cpp':
            return _execute_cpp(code, temp_dir)
        if language == 'java':
            return _execute_java(code, temp_dir)

        raise ExecutionError('Unsupported language.')
    except subprocess.TimeoutExpired as error:
        raise ExecutionError('Execution timed out after 3 seconds.') from error
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def _execute_python(code: str, temp_dir: str) -> dict:
    source_path = Path(temp_dir) / 'temp.py'
    source_path.write_text(code, encoding='utf-8')

    result = _run_command([sys.executable, str(source_path.name)], temp_dir)
    return {'stdout': result.stdout, 'stderr': result.stderr}


def _execute_cpp(code: str, temp_dir: str) -> dict:
    compiler = shutil.which('g++') or shutil.which('clang++')
    if not compiler:
        return {
            'stdout': '',
            'stderr': 'C++ compiler not found. Install g++ (MinGW) or clang++ and add it to PATH.'
        }

    source_path = Path(temp_dir) / 'temp.cpp'
    executable_name = 'temp.out' if os.name != 'nt' else 'temp.exe'
    executable_path = Path(temp_dir) / executable_name
    source_path.write_text(code, encoding='utf-8')

    compile_result = _run_command([compiler, source_path.name, '-o', executable_name], temp_dir)
    if compile_result.returncode != 0:
        return {'stdout': '', 'stderr': compile_result.stderr}

    run_result = _run_command([str(executable_path)], temp_dir)
    return {'stdout': run_result.stdout, 'stderr': run_result.stderr}


def _execute_java(code: str, temp_dir: str) -> dict:
    javac = shutil.which('javac')
    java = shutil.which('java')
    if not javac or not java:
        return {
            'stdout': '',
            'stderr': 'Java runtime/compiler not found. Install JDK and add javac/java to PATH.'
        }

    source_path = Path(temp_dir) / 'Main.java'
    source_path.write_text(code, encoding='utf-8')

    compile_result = _run_command([javac, source_path.name], temp_dir)
    if compile_result.returncode != 0:
        return {'stdout': '', 'stderr': compile_result.stderr}

    run_result = _run_command([java, 'Main'], temp_dir)
    return {'stdout': run_result.stdout, 'stderr': run_result.stderr}


def execute_python_script(code: str, timeout: int = 6) -> dict:
    if not isinstance(code, str) or not code.strip():
        raise ExecutionError('Python code is required.')

    bounded_timeout = _bounded_timeout(timeout, default=6, minimum=1, maximum=12)
    temp_dir = tempfile.mkdtemp(prefix='code_collab_py_')
    source_path = Path(temp_dir) / 'main.py'
    source_path.write_text(code, encoding='utf-8')

    try:
        # -I starts Python in isolated mode to reduce side effects from user/system environment.
        result = _run_command([sys.executable, '-I', source_path.name], temp_dir, timeout=bounded_timeout)
        return {
            'stdout': result.stdout,
            'stderr': result.stderr,
            'returncode': result.returncode,
            'command': 'python -I main.py',
        }
    except subprocess.TimeoutExpired as error:
        raise ExecutionError(f'Execution timed out after {bounded_timeout} seconds.') from error
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def execute_python_file(file_path: str, timeout: int = 6) -> dict:
    path = Path(file_path)
    if not path.exists() or not path.is_file():
        raise ExecutionError('Python file not found.')

    if path.suffix.lower() != '.py':
        raise ExecutionError('Only .py files can be executed by /run-python.')

    bounded_timeout = _bounded_timeout(timeout, default=6, minimum=1, maximum=12)

    try:
        result = _run_command(
            [sys.executable, '-I', path.name],
            work_dir=str(path.parent),
            timeout=bounded_timeout,
        )
        return {
            'stdout': result.stdout,
            'stderr': result.stderr,
            'returncode': result.returncode,
            'command': f'python -I {path.name}',
        }
    except subprocess.TimeoutExpired as error:
        raise ExecutionError(f'Execution timed out after {bounded_timeout} seconds.') from error


def execute_package_install(command: str, timeout: int = 90) -> dict:
    if not isinstance(command, str) or not command.strip():
        raise ExecutionError('Command is required. Example: pip install flask')

    try:
        tokens = shlex.split(command.strip())
    except ValueError as error:
        raise ExecutionError('Invalid command format.') from error

    if not tokens:
        raise ExecutionError('Command is required. Example: pip install flask')

    package_specs: list[str] = []
    lowered = [token.lower() for token in tokens]

    if len(tokens) >= 3 and lowered[0] in {'pip', 'pip3'} and lowered[1] == 'install':
        package_specs = tokens[2:]
    elif (
        len(tokens) >= 5
        and lowered[1] == '-m'
        and lowered[2] == 'pip'
        and lowered[3] == 'install'
        and lowered[0] in {'python', 'python3', sys.executable.lower()}
    ):
        package_specs = tokens[4:]
    else:
        raise ExecutionError('Only pip install commands are allowed. Example: pip install flask')

    if not package_specs:
        raise ExecutionError('Provide at least one package name to install.')

    if len(package_specs) > 6:
        raise ExecutionError('Install at most 6 packages per request.')

    if any(spec.startswith('-') for spec in package_specs):
        raise ExecutionError('Install flags are not allowed for safety reasons.')

    invalid = [spec for spec in package_specs if not SAFE_PACKAGE_PATTERN.fullmatch(spec)]
    if invalid:
        raise ExecutionError(f'Invalid package spec: {invalid[0]}')

    bounded_timeout = _bounded_timeout(timeout, default=90, minimum=10, maximum=180)

    try:
        result = _run_command(
            [sys.executable, '-m', 'pip', 'install', *package_specs],
            work_dir=str(Path.cwd()),
            timeout=bounded_timeout,
        )
        return {
            'stdout': result.stdout,
            'stderr': result.stderr,
            'returncode': result.returncode,
            'command': f"{sys.executable} -m pip install {' '.join(package_specs)}",
        }
    except subprocess.TimeoutExpired as error:
        raise ExecutionError(f'Package installation timed out after {bounded_timeout} seconds.') from error
