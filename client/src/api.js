import axios from 'axios';

// Aqui está a mágica: ele tenta ler o .env. Se não achar, usa o localhost.
const api = axios.create({
  baseURL: 'http://***IP-INTERNO***:3000'
});

export default api;