import axios from 'axios';

// Aqui está a mágica: ele tenta ler o .env. Se não achar, usa o localhost.
const api = axios.create({
  baseURL: 'http://10.40.125.2:3000'
});

export default api;