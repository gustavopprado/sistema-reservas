// api/emailGroups.js
// Grupos de convidados criados no painel de admin (coleção `email_groups` do
// Firestore) e a resolução da lista de convidados de uma reserva.
//
// Um grupo do painel é referenciado no campo "Convidados" pelo token
// `grupo:<slug>`; um Google Group é referenciado pelo próprio e-mail dele.
// Nos dois casos a expansão em pessoas acontece AQUI, no backend, antes de
// montar o evento do Google Calendar — assim o free/busy e o RSVP continuam
// funcionando por pessoa, do jeito que o sistema já fazia.

const admin = require('firebase-admin');
const directory = require('./directoryService');

const COLECAO = 'email_groups';
const PREFIXO_TOKEN = 'grupo:';

// O Firestore só pode ser acessado depois do initializeApp() do index.js,
// então resolvemos a instância na hora do uso, não no require.
const db = () => admin.firestore();

const normalizar = (email) => (email || '').trim().toLowerCase();

/**
 * Gera o identificador legível usado no token `grupo:<slug>`.
 * Ex.: "Comitê de Obras" -> "comite-de-obras"
 */
function gerarSlug(nome) {
  return (nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Garante que o slug não colida com outro grupo já existente. */
async function slugDisponivel(base, ignorarId) {
  const snapshot = await db().collection(COLECAO).get();
  const usados = new Set();
  snapshot.forEach((doc) => {
    if (doc.id !== ignorarId) usados.add(doc.data().slug);
  });

  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Normaliza e deduplica a lista de membros vinda do formulário. */
function limparMembros(membros) {
  const lista = Array.isArray(membros) ? membros : [];
  const vistos = new Set();
  const resultado = [];

  for (const item of lista) {
    const email = normalizar(item);
    if (!email || !email.includes('@')) continue;
    if (vistos.has(email)) continue;
    vistos.add(email);
    resultado.push(email);
  }
  return resultado;
}

// --- CRUD dos grupos do painel ---------------------------------------------

async function listarGruposPainel() {
  const snapshot = await db().collection(COLECAO).get();
  const grupos = [];
  snapshot.forEach((doc) => {
    const dados = doc.data();
    grupos.push({
      id: doc.id,
      nome: dados.nome || '',
      slug: dados.slug || '',
      descricao: dados.descricao || '',
      membros: Array.isArray(dados.membros) ? dados.membros : [],
      tipo: 'painel',
      criadoPor: dados.criadoPor || '',
      createdAt: dados.createdAt || null,
      updatedAt: dados.updatedAt || null,
    });
  });
  return grupos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

async function criarGrupo({ nome, descricao, membros, criadoPor }) {
  const nomeLimpo = (nome || '').trim();
  if (nomeLimpo.length < 2) {
    throw Object.assign(new Error('Informe um nome para o grupo.'), { status: 400 });
  }

  const base = gerarSlug(nomeLimpo);
  if (!base) {
    throw Object.assign(new Error('O nome do grupo precisa conter letras ou números.'), { status: 400 });
  }

  const agora = new Date().toISOString();
  const novoGrupo = {
    nome: nomeLimpo,
    slug: await slugDisponivel(base),
    descricao: (descricao || '').trim(),
    membros: limparMembros(membros),
    criadoPor: normalizar(criadoPor),
    createdAt: agora,
    updatedAt: agora,
  };

  const docRef = await db().collection(COLECAO).add(novoGrupo);
  return { id: docRef.id, tipo: 'painel', ...novoGrupo };
}

async function atualizarGrupo(id, { nome, descricao, membros }) {
  const docRef = db().collection(COLECAO).doc(id);
  const doc = await docRef.get();
  if (!doc.exists) {
    throw Object.assign(new Error('Grupo não encontrado.'), { status: 404 });
  }

  const atual = doc.data();
  const alteracoes = { updatedAt: new Date().toISOString() };

  if (nome !== undefined) {
    const nomeLimpo = nome.trim();
    if (nomeLimpo.length < 2) {
      throw Object.assign(new Error('Informe um nome para o grupo.'), { status: 400 });
    }
    alteracoes.nome = nomeLimpo;

    // O slug só muda se o nome mudou, para não invalidar reservas futuras que
    // já guardaram o token antigo.
    const novoSlug = gerarSlug(nomeLimpo);
    if (novoSlug && novoSlug !== atual.slug) {
      alteracoes.slug = await slugDisponivel(novoSlug, id);
    }
  }

  if (descricao !== undefined) alteracoes.descricao = descricao.trim();
  if (membros !== undefined) alteracoes.membros = limparMembros(membros);

  await docRef.update(alteracoes);
  return { id, tipo: 'painel', ...atual, ...alteracoes };
}

async function removerGrupo(id) {
  const docRef = db().collection(COLECAO).doc(id);
  const doc = await docRef.get();
  if (!doc.exists) {
    throw Object.assign(new Error('Grupo não encontrado.'), { status: 404 });
  }
  await docRef.delete();
}

// --- Listagem combinada -----------------------------------------------------

/**
 * Junta os grupos do painel com os Google Groups da organização.
 * Se a Directory API estiver indisponível, devolve só os do painel — o
 * autocomplete degrada, mas não quebra.
 */
async function listarTodosGrupos() {
  const doPainel = await listarGruposPainel();

  let doGoogle = [];
  let avisoGoogle = null;
  try {
    doGoogle = await directory.listGoogleGroups();
  } catch (error) {
    avisoGoogle = directory.explainError(error);
    console.error('⚠️ Não foi possível listar os Google Groups:', avisoGoogle);
  }

  return { doPainel, doGoogle, avisoGoogle };
}

// --- Resolução dos convidados ----------------------------------------------

/**
 * Expande a string de convidados em e-mails de pessoas.
 *
 * Aceita, separados por vírgula:
 *   - e-mails individuais                  -> mantidos
 *   - `grupo:<slug>` (grupo do painel)     -> trocado pelos membros
 *   - e-mail de um Google Group            -> trocado pelos membros
 *
 * Retorna { emails, gruposUsados, naoResolvidos }. Se um Google Group não
 * puder ser expandido (sem permissão de leitura dos membros), o e-mail do
 * grupo é mantido como convidado: o próprio Google entrega aos membros.
 */
async function resolverConvidados(attendeesRaw) {
  const tokens = (attendeesRaw || '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const resultado = { emails: [], gruposUsados: [], naoResolvidos: [] };
  if (tokens.length === 0) return resultado;

  const temToken = tokens.some((t) => t.toLowerCase().startsWith(PREFIXO_TOKEN));
  const gruposPainel = temToken ? await listarGruposPainel() : [];
  const porSlug = new Map(gruposPainel.map((g) => [g.slug, g]));

  // Os Google Groups só são consultados se algum token puder ser um deles.
  let gruposGoogle = null;
  const carregarGruposGoogle = async () => {
    if (gruposGoogle) return gruposGoogle;
    try {
      gruposGoogle = await directory.listGoogleGroups();
    } catch (error) {
      console.error('⚠️ Falha ao resolver Google Groups:', directory.explainError(error));
      gruposGoogle = [];
    }
    return gruposGoogle;
  };

  const vistos = new Set();
  const adicionar = (email) => {
    const limpo = normalizar(email);
    if (!limpo || !limpo.includes('@') || vistos.has(limpo)) return;
    vistos.add(limpo);
    resultado.emails.push(limpo);
  };

  for (const token of tokens) {
    const minusculo = token.toLowerCase();

    // 1. Grupo do painel: grupo:<slug>
    if (minusculo.startsWith(PREFIXO_TOKEN)) {
      const slug = minusculo.slice(PREFIXO_TOKEN.length).trim();
      const grupo = porSlug.get(slug);

      if (grupo) {
        // Um grupo do painel pode ter um Google Group como membro; nesse caso
        // ele também precisa ser aberto em pessoas.
        const gruposDoGoogle = grupo.membros.length > 0 ? await carregarGruposGoogle() : [];

        for (const membro of grupo.membros) {
          const aninhado = gruposDoGoogle.find((g) => g.email === normalizar(membro));
          if (aninhado && aninhado.membros.length > 0) {
            aninhado.membros.forEach(adicionar);
          } else {
            adicionar(membro);
          }
        }
        resultado.gruposUsados.push({
          nome: grupo.nome,
          tipo: 'painel',
          quantidade: grupo.membros.length,
        });
      } else {
        resultado.naoResolvidos.push(token);
      }
      continue;
    }

    // 2. E-mail que pode ser de um Google Group
    if (minusculo.includes('@')) {
      const gruposDoGoogle = await carregarGruposGoogle();
      const grupo = gruposDoGoogle.find((g) => g.email === minusculo);

      if (grupo) {
        if (grupo.membros.length > 0) {
          grupo.membros.forEach(adicionar);
        } else {
          // Sem membros legíveis: convida o grupo e deixa o Google distribuir.
          adicionar(grupo.email);
        }
        resultado.gruposUsados.push({
          nome: grupo.nome,
          tipo: 'google',
          quantidade: grupo.membros.length,
        });
      } else {
        adicionar(minusculo);
      }
      continue;
    }

    // 3. Qualquer outra coisa (texto solto) é reportada, não convidada.
    resultado.naoResolvidos.push(token);
  }

  return resultado;
}

module.exports = {
  listarGruposPainel,
  listarTodosGrupos,
  criarGrupo,
  atualizarGrupo,
  removerGrupo,
  resolverConvidados,
  gerarSlug,
  PREFIXO_TOKEN,
};
