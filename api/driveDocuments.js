// api/driveDocuments.js
// Leitura dos documentos da frota guardados no Google Drive.
//
// Os PDFs ficam no Drive com acesso restrito ao domínio, espalhados em pastas
// de áreas diferentes. Há dois modos de leitura:
//
// - Com DRIVE_SUBJECT preenchido, a Service Account personifica essa conta do
//   Workspace (Delegação em Todo o Domínio, escopo drive.readonly). Tudo que
//   essa pessoa abriria pelo link, o sistema abre também — inclusive arquivos
//   com acesso "Qualquer pessoa na organização com o link".
// - Com DRIVE_SUBJECT vazio, a Service Account lê sozinha e só enxerga o que
//   foi compartilhado diretamente com o e-mail dela.
//
// O PDF nunca é exposto diretamente ao navegador: a API baixa do Drive e
// repassa para quem está logado no sistema (ver rotas /car-documents).
//
// Requer a Google Drive API ativada no projeto do Google Cloud da Service
// Account (ver README).

const { google } = require('googleapis');
const path = require('path');
const config = require('./config');

const key = require(path.resolve(__dirname, config.serviceAccountPath));

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const SUBJECT = config.drive.subject;

const MIME_PDF = 'application/pdf';

// Arquivos nativos do Google são convertidos para PDF na hora da leitura.
const MIMES_EXPORTAVEIS = new Set([
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.drawing',
]);

// Um ID de arquivo do Drive tem letras, números, "-" e "_" (25+ caracteres).
const FORMATO_ID = /^[A-Za-z0-9_-]{20,}$/;

/** Conta com que o Drive enxerga o sistema: a personificada ou a própria Service Account. */
const contaLeitura = SUBJECT || key.client_email;

let driveClient = null;

function getDrive() {
  if (!driveClient) {
    const auth = new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: SCOPES,
      subject: SUBJECT || undefined,
    });
    driveClient = google.drive({ version: 'v3', auth });
  }
  return driveClient;
}

/**
 * Extrai o ID do arquivo de um link do Drive. Aceita os formatos que o botão
 * "Copiar link" costuma gerar:
 *   https://drive.google.com/file/d/<ID>/view?usp=sharing
 *   https://drive.google.com/open?id=<ID>
 *   https://drive.google.com/uc?id=<ID>&export=download
 *   https://docs.google.com/document/d/<ID>/edit
 * e também o ID puro. Retorna null se não reconhecer.
 */
function extractFileId(link) {
  const texto = String(link || '').trim();
  if (!texto) return null;

  if (FORMATO_ID.test(texto)) return texto;

  const porCaminho = texto.match(/\/d\/([A-Za-z0-9_-]{20,})/);
  if (porCaminho) return porCaminho[1];

  try {
    const url = new URL(texto);
    const id = url.searchParams.get('id');
    if (id && FORMATO_ID.test(id)) return id;
  } catch {
    // Não é uma URL: cai no null abaixo.
  }

  return null;
}

/**
 * Chave de recurso do link, se houver. Arquivos antigos compartilhados por
 * link exigem o parâmetro `resourcekey` para quem não tem acesso direto —
 * sem ele o Drive responde "não encontrado" mesmo com o link liberado.
 */
function extractResourceKey(link) {
  try {
    const valor = new URL(String(link || '').trim()).searchParams.get('resourcekey');
    return valor && /^[A-Za-z0-9_-]+$/.test(valor) ? valor : null;
  } catch {
    return null;
  }
}

/** Cabeçalho que entrega a chave de recurso ao Drive, quando o link tem uma. */
function requestOptions(fileId, resourceKey, extra = {}) {
  if (!resourceKey) return extra;
  return { ...extra, headers: { 'X-Goog-Drive-Resource-Keys': `${fileId}/${resourceKey}` } };
}

/** Diz se o tipo do arquivo pode ser exibido como PDF. */
function isSupportedMime(mimeType) {
  return mimeType === MIME_PDF || MIMES_EXPORTAVEIS.has(mimeType);
}

/**
 * Traduz os erros mais comuns da Drive API em mensagens que dizem ao
 * Suprimentos (ou a quem configura o servidor) o que fazer, porque o texto
 * cru do Google não diz.
 */
function explainError(error) {
  const status = error && (error.code || (error.response && error.response.status));
  const raw = (error && error.message) || '';
  const detail = error && error.response && error.response.data
    ? JSON.stringify(error.response.data)
    : '';
  const texto = `${raw} ${detail}`;

  if (texto.includes('has not been used in project') || texto.includes('it is disabled')) {
    return 'A Google Drive API está desativada no projeto da conta de serviço. ' +
      `Ative em https://console.cloud.google.com/apis/library/drive.googleapis.com?project=${key.project_id}.`;
  }
  if (texto.includes('unauthorized_client')) {
    return 'A Delegação em Todo o Domínio ainda não autoriza a leitura do Drive. ' +
      `No Admin Console, inclua o escopo ${SCOPES[0]} no Client ID ${key.client_id}.`;
  }
  if (texto.includes('invalid_grant')) {
    return `A conta ${SUBJECT} (DRIVE_SUBJECT) não existe ou está suspensa no Workspace.`;
  }
  if (texto.includes('cannotDownloadFile') || texto.includes('cannotExportFile')) {
    return 'O dono do arquivo bloqueou download, impressão e cópia para leitores. ' +
      'Libere essa opção nas configurações de compartilhamento do arquivo.';
  }
  if (status === 404) {
    return SUBJECT
      ? `${SUBJECT} não consegue abrir esse arquivo. Confira se o acesso geral do link é ` +
        '"Qualquer pessoa na organização com o link" ou compartilhe o arquivo com essa conta.'
      : 'O sistema não tem acesso a esse arquivo. Compartilhe o arquivo (ou a pasta) ' +
        `com ${key.client_email} como Leitor e tente de novo.`;
  }
  if (status === 403) {
    return `O Google recusou o acesso ao arquivo para ${contaLeitura}.`;
  }
  return 'Não foi possível consultar o Google Drive: ' + raw;
}

/** Busca nome, tipo e data de alteração do arquivo. Lança se não tiver acesso. */
async function getFileMeta(fileId, resourceKey) {
  const { data } = await getDrive().files.get(
    {
      fileId,
      fields: 'id, name, mimeType, size, modifiedTime',
      supportsAllDrives: true,
    },
    requestOptions(fileId, resourceKey)
  );
  return data;
}

/**
 * Devolve o conteúdo do arquivo como stream de PDF. PDFs vêm como estão;
 * arquivos do Google Docs/Slides/Sheets são exportados para PDF.
 */
async function openPdfStream(fileId, mimeType, resourceKey) {
  const drive = getDrive();
  const options = requestOptions(fileId, resourceKey, { responseType: 'stream' });

  if (mimeType === MIME_PDF) {
    const res = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      options
    );
    return res.data;
  }

  const res = await drive.files.export({ fileId, mimeType: MIME_PDF }, options);
  return res.data;
}

module.exports = {
  extractFileId,
  extractResourceKey,
  isSupportedMime,
  explainError,
  getFileMeta,
  openPdfStream,
  // Para a tela de Documentos explicar como liberar o acesso.
  leitura: {
    conta: contaLeitura,
    modo: SUBJECT ? 'dominio' : 'compartilhamento',
  },
};
