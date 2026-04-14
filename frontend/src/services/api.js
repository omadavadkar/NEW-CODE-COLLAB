import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

export async function runCode(language, code) {
  const response = await axios.post(`${BASE_URL}/run`, {
    language,
    code
  });

  return response.data;
}
