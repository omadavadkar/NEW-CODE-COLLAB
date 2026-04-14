import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


class ExecutionError(Exception):
    pass


def _run_command(command: list[str], work_dir: str, timeout: int = 3) -> subprocess.CompletedProcess:
    return subprocess.run(
        command,
        cwd=work_dir,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )


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
