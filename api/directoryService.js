// api/directoryService.js
// Leitura do diretório do Google Workspace (Admin SDK Directory API).
//
// Substitui o antigo client/src/users.json: os colaboradores e os Google Groups
// passam a vir direto da organização, então admissões e desligamentos refletem
// sozinhos, sem precisar editar arquivo nenhum.
//
// Requer Delegação em Todo o Domínio (a mesma já usada pelo calendarService)
// com escopos de leitura autorizados no Admin Console, e um e-mail de
// administrador do Workspace em DIRECTORY_ADMIN_SUBJECT (ver api/.env.example).
// Sem essa configuração o módulo fica inativo e o sistema continua funcionando
// com a lista local como fallback.

const { google } = require('googleapis');
const path = require('path');
const config = require('./config');

const key = require(path.resolve(__dirname, config.serviceAccountPath));

// Escopos separados de propósito: se a organização autorizar apenas o de
// usuários, o autocomplete de pessoas continua funcionando mesmo que a
// listagem de grupos falhe (e vice-versa).
const USERS_SCOPES = ['https://www.googleapis.com/auth/admin.directory.user.readonly'];
const GROUPS_SCOPES = ['https://www.googleapis.com/auth/admin.directory.group.readonly'];

const SUBJECT = config.directory.adminSubject;
const TTL_MS = Math.max(1, config.directory.cacheTtlMinutes) * 60 * 1000;

/** O módulo só opera se houver um admin do Workspace para personificar. */
function isEnabled() {
  return SUBJECT.length > 0;
}

function buildClient(scopes) {
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes,
    subject: SUBJECT,
  });
  return google.admin({ version: 'directory_v1', auth });
}

/**
 * Traduz os erros mais comuns da Directory API em mensagens acionáveis,
 * porque o texto cru do Google não diz o que fazer.
 */
function explainError(error) {
  const raw = (error && error.message) || '';
  const detail = error && error.response && error.response.data
    ? JSON.stringify(error.response.data)
    : '';
  const texto = `${raw} ${detail}`;

  if (texto.includes('unauthorized_client')) {
    return 'A Delegação em Todo o Domínio não autoriza os escopos de diretório. ' +
      `Adicione os escopos de leitura do Admin SDK ao Client ID ${key.client_id} ` +
      'em Admin Console > Segurança > Controles de API > Delegação em todo o domínio.';
  }
  if (texto.includes('Not Authorized to access this resource') || texto.includes('forbidden')) {
    return `O usuário ${SUBJECT} não tem privilégio de administrador no Workspace, ` +
      'ou a Admin SDK API não está ativada no projeto do Google Cloud.';
  }
  if (texto.includes('invalid_grant')) {
    return `Não foi possível personificar ${SUBJECT}. Confira se o e-mail existe e ` +
      'pertence ao domínio da organização.';
  }
  if (texto.includes('has not been used') || texto.includes('is disabled')) {
    return 'A Admin SDK API não está ativada no projeto do Google Cloud. ' +
      'Ative em console.cloud.google.com > APIs e serviços > Admin SDK API.';
  }
  return raw || 'Erro desconhecido ao consultar o diretório do Workspace.';
}

// --- Cache em memória -------------------------------------------------------
// O autocomplete consulta a cada digitação; sem cache isso viraria uma rajada
// de chamadas à API do Google e bateria na cota rapidinho.

const cache = new Map();

async function cached(chave, produtor) {
  const agora = Date.now();
  const atual = cache.get(chave);
  if (atual && agora - atual.gravadoEm < TTL_MS) return atual.valor;

  const valor = await produtor();
  cache.set(chave, { valor, gravadoEm: agora });
  return valor;
}

/** Descarta o cache — usado pelo botão de atualização no painel de admin. */
function invalidateCache() {
  cache.clear();
}

/** Percorre todas as páginas de um endpoint paginado da Directory API. */
async function paginar(chamada, campo) {
  const itens = [];
  let pageToken;
  do {
    const resposta = await chamada(pageToken);
    const dados = resposta.data || {};
    if (Array.isArray(dados[campo])) itens.push(...dados[campo]);
    pageToken = dados.nextPageToken;
  } while (pageToken);
  return itens;
}

const normalizar = (email) => (email || '').trim().toLowerCase();

// --- Usuários ---------------------------------------------------------------

/**
 * Lista os colaboradores ativos da organização.
 * Retorna [{ nome, email }] no mesmo formato do antigo users.json, para o
 * autocomplete não precisar saber de onde os dados vieram.
 */
async function listUsers() {
  if (!isEnabled()) return [];

  return cached('users', async () => {
    const dir = buildClient(USERS_SCOPES);

    const usuarios = await paginar(
      (pageToken) => dir.users.list({
        customer: 'my_customer',
        maxResults: 500,
        orderBy: 'email',
        projection: 'basic',
        pageToken,
      }),
      'users'
    );

    const excluidos = new Set(config.directory.excludedEmails);

    return usuarios
      .filter((u) => !u.suspended && !u.archived && u.primaryEmail)
      .map((u) => ({
        nome: (u.name && u.name.fullName) || u.primaryEmail.split('@')[0],
        email: normalizar(u.primaryEmail),
      }))
      .filter((u) => !excluidos.has(u.email))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  });
}

// --- Grupos -----------------------------------------------------------------

/**
 * Membros de um Google Group, já resolvendo grupos aninhados.
 * `visitados` corta ciclos (grupo A contém B que contém A).
 */
async function listGroupMembers(groupKey, visitados = new Set()) {
  if (!isEnabled()) return [];

  const chave = normalizar(groupKey);
  if (visitados.has(chave)) return [];
  visitados.add(chave);

  const diretos = await cached(`members:${chave}`, async () => {
    const dir = buildClient(GROUPS_SCOPES);
    return paginar(
      (pageToken) => dir.members.list({
        groupKey: chave,
        maxResults: 200,
        pageToken,
      }),
      'members'
    );
  });

  const emails = [];
  for (const membro of diretos) {
    const email = normalizar(membro.email);
    if (!email) continue;

    // Membros suspensos continuam listados pela API, mas não devem ser convidados.
    if (membro.status && membro.status.toUpperCase() === 'SUSPENDED') continue;

    if ((membro.type || '').toUpperCase() === 'GROUP') {
      emails.push(...await listGroupMembers(email, visitados));
    } else {
      emails.push(email);
    }
  }

  return [...new Set(emails)];
}

/**
 * Lista os Google Groups da organização já com os membros resolvidos.
 * Retorna [{ id, nome, email, descricao, tipo: 'google', membros: [] }].
 */
async function listGoogleGroups() {
  if (!isEnabled() || !config.directory.includeGoogleGroups) return [];

  const grupos = await cached('groups', async () => {
    const dir = buildClient(GROUPS_SCOPES);
    return paginar(
      (pageToken) => dir.groups.list({
        customer: 'my_customer',
        maxResults: 200,
        pageToken,
      }),
      'groups'
    );
  });

  const resultado = [];
  for (const grupo of grupos) {
    const email = normalizar(grupo.email);
    if (!email) continue;

    let membros = [];
    try {
      membros = await listGroupMembers(email);
    } catch (error) {
      // Um grupo sem permissão de leitura não deve derrubar a listagem toda:
      // ele aparece sem membros e o convite cai no e-mail do próprio grupo.
      console.error(`⚠️ Não foi possível ler os membros de ${email}:`, error.message);
    }

    resultado.push({
      id: email,
      nome: grupo.name || email,
      email,
      descricao: grupo.description || '',
      tipo: 'google',
      membros,
    });
  }

  return resultado.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

module.exports = {
  isEnabled,
  listUsers,
  listGoogleGroups,
  listGroupMembers,
  invalidateCache,
  explainError,
  serviceAccountClientId: key.client_id,
};
