import axios from 'axios';

function resolveApiUrl() {
  const envUrl = import.meta.env.VITE_API_URL?.trim();
  if (envUrl) return envUrl;

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:4411`;
  }

  return 'http://localhost:4411';
}

const api = axios.create({
  baseURL: resolveApiUrl()
});

export default api;
