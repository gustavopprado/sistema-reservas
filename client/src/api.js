import axios from 'axios';

// Aqui está a mágica: ele tenta ler o .env. Se não achar, usa o localhost.
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: apiUrl
});

export default api;