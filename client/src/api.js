import axios from 'axios';
import { auth } from './firebase-config';

function resolveApiUrl() {
  const envUrl = import.meta.env.VITE_API_URL?.trim();
  if (envUrl) return envUrl;

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3000`;
  }

  return 'http://localhost:3000';
}

const api = axios.create({
  baseURL: resolveApiUrl()
});

// As rotas de diretório (/directory/*, /admin/email-groups) exigem um ID Token
// do Firebase, porque devolvem nomes e e-mails de toda a organização. O token
// é anexado automaticamente aqui; o SDK do Firebase cuida da renovação.
api.interceptors.request.use(async (requestConfig) => {
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      requestConfig.headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      console.error('Não foi possível obter o token de autenticação:', error);
    }
  }
  return requestConfig;
});

export default api;