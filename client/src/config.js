// client/src/config.js
// Configuração do frontend lida de variáveis de ambiente (client/.env).
//
// ATENÇÃO: variáveis `VITE_*` são embutidas no bundle gerado pelo `npm run build`
// e ficam legíveis para qualquer pessoa que abra o site. Manter estes valores
// aqui serve para não expô-los no repositório público — NÃO é um controle de
// segurança. Toda autorização de verdade precisa ser validada no backend.

/** Converte uma lista separada por vírgulas em array normalizado. */
const parseEmailList = (value) =>
  (value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);

const normalize = (value) => (value || '').trim().toLowerCase();

// O endereço da API é resolvido em client/src/api.js.

// Admin do módulo de salas (reserva a sala restrita, edita reservas de terceiros).
export const ROOM_ADMIN_EMAIL = normalize(import.meta.env.VITE_ROOM_ADMIN_EMAIL);

// Admin com acesso ao painel de histórico completo de reservas de sala.
export const ROOM_PANEL_ADMIN_EMAIL = normalize(import.meta.env.VITE_ROOM_PANEL_ADMIN_EMAIL);

// Equipe de Suprimentos — acesso ao Painel de Frota.
export const FLEET_ADMIN_EMAILS = parseEmailList(import.meta.env.VITE_FLEET_ADMIN_EMAILS);

// E-mails autorizados a reservar a sala restrita.
export const RESTRICTED_ROOM_EMAILS = parseEmailList(import.meta.env.VITE_RESTRICTED_ROOM_EMAILS);

// IDs de salas com tratamento visual específico.
export const RESTRICTED_ROOM_ID = import.meta.env.VITE_RESTRICTED_ROOM_ID || '';
export const SALAO_ROOM_ID = import.meta.env.VITE_SALAO_ROOM_ID || '';
