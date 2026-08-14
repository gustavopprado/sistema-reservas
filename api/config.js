// api/config.js
// Fonte única de configuração do backend. Todo dado sensível (senhas, chaves,
// e-mails internos) vem de variáveis de ambiente definidas em api/.env —
// nunca deve ser escrito diretamente no código, porque o repositório é público.
//
// Use api/.env.example como modelo para criar o seu api/.env.

require('dotenv').config();

/** Lê uma variável obrigatória. Derruba o processo se estiver ausente. */
function required(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    console.error(
      `\n❌ Variável de ambiente obrigatória ausente: ${name}\n` +
      `   Crie o arquivo api/.env a partir de api/.env.example e preencha esse valor.\n`
    );
    process.exit(1);
  }
  return value.trim();
}

/** Lê uma variável opcional, com valor padrão não sensível. */
function optional(name, fallback) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

/** Lê uma lista separada por vírgulas e normaliza para minúsculas. */
function list(name) {
  return optional(name, '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

const config = {
  port: Number(optional('PORT', '3000')),

  // Caminho do JSON da service account do Firebase Admin.
  // O arquivo fica fora do versionamento (ver .gitignore).
  serviceAccountPath: optional('GOOGLE_APPLICATION_CREDENTIALS', './serviceAccountKey.json'),

  // URL pública do frontend, usada nos links dos e-mails.
  appUrl: optional('APP_URL', 'http://localhost:5173'),

  mail: {
    user: required('GMAIL_USER'),
    appPassword: required('GMAIL_APP_PASSWORD'),
    fromNameRooms: optional('MAIL_FROM_NAME_ROOMS', 'Sistema de Reservas'),
    fromNameFleet: optional('MAIL_FROM_NAME_FLEET', 'Sistema de Frotas'),
    suprimentos: required('EMAIL_SUPRIMENTOS'),
  },

  calendar: {
    // Agenda compartilhada usada como fallback quando a Delegação em Todo o
    // Domínio ainda não está habilitada no Admin Console do Workspace.
    sharedCalendarId: required('SHARED_CALENDAR_ID'),
  },

  admin: {
    // Admin do módulo de salas.
    roomsAdmin: optional('ADMIN_EMAIL', '').trim().toLowerCase(),
    // Admin do relatório completo de reservas de sala.
    bookingsReportAdmin: optional('ADMIN_BOOKINGS_EMAIL', '').trim().toLowerCase(),
    // Senha usada pelo Painel Suprimentos para forçar encerramento de reservas.
    finalizePassword: required('ADMIN_FINALIZE_PASSWORD'),
  },

  restrictedRoom: {
    id: optional('RESTRICTED_ROOM_ID', ''),
    allowedEmails: list('RESTRICTED_ROOM_EMAILS'),
  },
};

module.exports = config;
