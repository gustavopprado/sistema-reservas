const { google } = require('googleapis');
const path = require('path');
const config = require('./config');

// A chave da service account fica fora do versionamento; o caminho vem de
// GOOGLE_APPLICATION_CREDENTIALS (ver api/.env.example).
const key = require(path.resolve(__dirname, config.serviceAccountPath));

// Escopo necessário para criar/editar eventos e consultar disponibilidade (free/busy).
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// Agenda compartilhada usada como "fallback" caso a delegação de domínio
// ainda não tenha sido habilitada no Admin Console do Google Workspace.
const SHARED_CALENDAR_ID = config.calendar.sharedCalendarId;

/**
 * Cria um cliente autenticado.
 * Se `subject` for informado, a Service Account "personifica" (impersonate)
 * aquele usuário — isso exige Delegação em Todo o Domínio (Domain-Wide
 * Delegation) habilitada no Admin Console do Google Workspace.
 */
function getAuthClient(subject) {
  return new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
    subject: subject || undefined,
  });
}

function buildEventResource(bookingData) {
  const displayTitle = bookingData.title || 'Reunião Reservada';
  const attendees = Array.isArray(bookingData.attendeesList)
    ? bookingData.attendeesList
        .filter((email) => email && email !== bookingData.userEmail)
        .map((email) => ({ email }))
    : [];

  const pauta = (bookingData.notes && bookingData.notes.trim().length > 0)
    ? `\n\nPauta / Anotações:\n${bookingData.notes}`
    : '';

  // Na sala restrita, quem reserva não é quem vai usar a sala; o evento precisa
  // dizer isso, senão só aparece o nome de quem reservou.
  const responsavel = bookingData.solicitanteEmail
    ? `\nResponsável pela sala: ${bookingData.solicitanteEmail}`
    : '';

  return {
    summary: displayTitle,
    description:
      `Reserva de sala criada pelo Sistema de Reservas.\n` +
      `Organizador: ${bookingData.userEmail}` +
      responsavel +
      pauta,
    location: bookingData.roomName,
    start: {
      dateTime: `${bookingData.date}T${bookingData.startTime}:00`,
      timeZone: 'America/Sao_Paulo',
    },
    end: {
      dateTime: `${bookingData.date}T${bookingData.endTime}:00`,
      timeZone: 'America/Sao_Paulo',
    },
    attendees,
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 10 }],
    },
  };
}

/**
 * Cria o evento na agenda do organizador e convida os participantes.
 * Com a delegação habilitada, o Google adiciona o evento direto na agenda
 * de cada convidado (sendUpdates: 'all').
 *
 * Retorna { eventId, htmlLink, calendarId } ou null em caso de erro.
 */
async function createCalendarEvent(bookingData) {
  try {
    const organizer = bookingData.userEmail;
    const authClient = getAuthClient(organizer);
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: buildEventResource(bookingData),
      sendUpdates: 'all',
    });

    console.log('✅ Evento criado na agenda do organizador e convidados notificados.');
    return {
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
      calendarId: organizer,
    };
  } catch (error) {
    console.error('❌ Erro ao criar evento no Google Calendar:', error.message);
    if (error.response) console.error(error.response.data);
    return null;
  }
}

/**
 * Atualiza um evento já existente (mudança de horário, título ou convidados).
 */
async function updateCalendarEvent(bookingData) {
  if (!bookingData.googleEventId) return null;
  try {
    const organizer = bookingData.googleCalendarId || bookingData.userEmail;
    const authClient = getAuthClient(organizer);
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: bookingData.googleEventId,
      resource: buildEventResource(bookingData),
      sendUpdates: 'all',
    });

    console.log('✏️ Evento atualizado no Google Calendar.');
    return {
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
      calendarId: organizer,
    };
  } catch (error) {
    console.error('❌ Erro ao atualizar evento no Google Calendar:', error.message);
    if (error.response) console.error(error.response.data);
    return null;
  }
}

/**
 * Remove o evento da agenda do organizador e dos convidados.
 */
async function deleteCalendarEvent(organizerEmail, eventId) {
  if (!eventId) return;
  try {
    const authClient = getAuthClient(organizerEmail);
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
      sendUpdates: 'all',
    });
    console.log('🗑️ Evento removido do Google Calendar.');
  } catch (error) {
    console.error('❌ Erro ao remover evento no Google Calendar:', error.message);
    if (error.response) console.error(error.response.data);
  }
}

/**
 * Consulta a disponibilidade (free/busy) de uma lista de e-mails num intervalo.
 * Retorna um objeto: { 'email@dominio': [ { start, end }, ... ], ... }
 * contendo apenas os intervalos OCUPADOS de cada pessoa.
 *
 * `requesterEmail` é o usuário que a Service Account vai personificar para
 * fazer a consulta (normalmente o organizador logado).
 */
async function getFreeBusy(requesterEmail, emails, timeMin, timeMax) {
  const result = {};
  if (!Array.isArray(emails) || emails.length === 0) return result;

  try {
    const authClient = getAuthClient(requesterEmail);
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const response = await calendar.freebusy.query({
      resource: {
        timeMin,
        timeMax,
        timeZone: 'America/Sao_Paulo',
        items: emails.map((email) => ({ id: email })),
      },
    });

    const calendars = response.data.calendars || {};
    for (const email of emails) {
      const info = calendars[email];
      // Se a API não conseguir ler a agenda da pessoa (ex.: externo),
      // retornamos lista vazia em vez de quebrar.
      result[email] = (info && Array.isArray(info.busy)) ? info.busy : [];
    }
    return result;
  } catch (error) {
    console.error('❌ Erro ao consultar disponibilidade (free/busy):', error.message);
    if (error.response) console.error(error.response.data);
    // Em caso de erro (ex.: delegação ainda não habilitada), devolve vazio
    // para o fluxo de reserva continuar funcionando.
    return result;
  }
}

/**
 * Lê a resposta de cada convidado direto do evento no Google Calendar.
 *
 * É a única fonte que sabe quem aceitou pelo convite que chegou por e-mail —
 * o RSVP feito dentro do sistema grava apenas no Firestore, e a maioria das
 * pessoas responde pelo Gmail/Agenda, não pela tela.
 *
 * Retorna [{ email, resposta, organizador }] com `resposta` em:
 * 'aceito' | 'recusado' | 'talvez' | 'pendente'.
 * Devolve null se o evento não puder ser lido (evento apagado, delegação fora
 * do ar), para o chamador saber que não há dado em vez de assumir "pendente".
 */
async function getEventAttendees(organizerEmail, eventId) {
  if (!eventId) return null;

  // Traducao dos valores da API do Google.
  const RESPOSTAS = {
    accepted: 'aceito',
    declined: 'recusado',
    tentative: 'talvez',
    needsAction: 'pendente',
  };

  try {
    const authClient = getAuthClient(organizerEmail);
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const response = await calendar.events.get({
      calendarId: 'primary',
      eventId,
    });

    const attendees = Array.isArray(response.data.attendees) ? response.data.attendees : [];

    return attendees.map((pessoa) => ({
      email: (pessoa.email || '').toLowerCase(),
      resposta: RESPOSTAS[pessoa.responseStatus] || 'pendente',
      organizador: pessoa.organizer === true,
    }));
  } catch (error) {
    console.error('❌ Erro ao ler respostas do evento no Google Calendar:', error.message);
    if (error.response) console.error(error.response.data);
    return null;
  }
}

module.exports = {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getFreeBusy,
  getEventAttendees,
  SHARED_CALENDAR_ID,
};
