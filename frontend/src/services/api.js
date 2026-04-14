import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

export async function runCode(language, code) {
  const response = await axios.post(`${BASE_URL}/run`, {
    language,
    code
  });

  return response.data;
}

export async function uploadFolder(files) {
  const formData = new FormData();

  files.forEach((entry) => {
    const file = entry.file || entry;
    const relativePath = entry.relativePath || file.webkitRelativePath || file.name;
    formData.append('files', file, relativePath);
  });

  const response = await axios.post(`${BASE_URL}/upload-folder`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
}

export async function getWorkspaceFile(workspaceId, filePath) {
  const response = await axios.get(`${BASE_URL}/workspace-file`, {
    params: {
      workspaceId,
      filePath
    }
  });

  return response.data;
}

export async function runPython(payload) {
  const response = await axios.post(`${BASE_URL}/run-python`, payload);
  return response.data;
}

export async function installPackage(command) {
  const response = await axios.post(`${BASE_URL}/install-package`, { command });
  return response.data;
}
