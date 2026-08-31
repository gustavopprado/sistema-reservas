const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const path = require('path');
const app = express();
const cron = require('node-cron');

const config = require('./config');

// A chave da service account fica fora do versionamento; o caminho vem de
// GOOGLE_APPLICATION_CREDENTIALS (ver api/.env.example).
const serviceAccount = require(path.resolve(__dirname, config.serviceAccountPath));
const {
  sendBookingConfirmationEmail,
  sendCarReservationEmail,
  sendCarReturnEmail,
  sendCarReminderEmail,
  sendCarOverdueReminderEmail,
  sendCarRegularizacaoEmail
} = require('./mailer');
const {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getFreeBusy
} = require('./calendarService');
const directory = require('./directoryService');
const emailGroups = require('./emailGroups');

// --- CONSTANTES DE ADMINISTRAÇÃO ---
const ADMIN_EMAIL = config.admin.roomsAdmin;

// --- RESERVAS DE VÁRIOS DIAS ---
// Uma reserva pode cobrir vários dias no mesmo horário. Cada dia é um
// documento próprio na coleção `bookings`, com seu próprio evento no Google
// Calendar; os documentos de uma mesma solicitação compartilham um `serieId`.
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

// Teto por reserva. Cada dia consome uma chamada de criação de evento no
// Google, então uma série gigante seria lenta e fácil de criar por engano.
const MAX_DATAS_SERIE = 30;

/** '2026-09-15' -> '15/09/2026' (para mensagens de erro legíveis). */
function formatarDataBR(data) {
  return (data || '').split('-').reverse().join('/');
}

// --- GERADOR DE ID ÚNICO DE RESERVA ---
function generateBookingCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'VEI-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
const RESTRICTED_ROOM_ID = config.restrictedRoom.id; // ID da sala restrita
const RESTRICTED_ROOM_EMAILS = config.restrictedRoom.allowedEmails; // Emails autorizados a reservar a sala restrita

// --- SOLICITANTE (SALA RESTRITA) ---
// A sala restrita só pode ser reservada pelos e-mails de RESTRICTED_ROOM_EMAILS,
// mas quem vai USAR a sala normalmente é outra pessoa, que pediu a reserva.
// Esse campo guarda o e-mail dela: é ele que aparece como "Responsável" nas
// telas e recebe a confirmação. A posse da reserva continua com `userEmail`.
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida o solicitante informado. Só é aceito na sala restrita — nas outras
 * salas quem reserva é quem usa, e um segundo responsável só confundiria.
 * Retorna { email } ou { erro }.
 */
function validarSolicitante(roomId, solicitanteEmail) {
  const email = (solicitanteEmail || '').trim().toLowerCase();

  if (email.length === 0) return { email: null };

  if (roomId !== RESTRICTED_ROOM_ID) {
    // Ignora em silêncio em vez de recusar: o campo simplesmente não existe
    // para as outras salas.
    return { email: null };
  }

  if (!FORMATO_EMAIL.test(email)) {
    return { erro: `"${solicitanteEmail}" não é um e-mail válido para o responsável.` };
  }

  return { email };
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

app.use(cors());
app.use(express.json());

// ==========================================
//        AUTENTICAÇÃO (ROTAS NOVAS)
// ==========================================
// As rotas de diretório devolvem nomes e e-mails de toda a organização —
// dado pessoal. Por isso elas exigem um ID Token do Firebase, enviado
// automaticamente pelo interceptor em client/src/api.js.
//
// As rotas antigas seguem sem verificação para não quebrar nada em produção;
// migrá-las é um passo separado (ver README).

/** Exige um usuário autenticado no Firebase do projeto. */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();

    if (!email) {
      return res.status(403).json({ error: 'Conta sem e-mail associado.' });
    }

    const dominios = config.auth.allowedDomains;
    if (dominios.length > 0) {
      const dominio = email.split('@')[1] || '';
      if (!dominios.includes(dominio)) {
        return res.status(403).json({ error: 'Domínio não autorizado.' });
      }
    }

    req.authUser = { email, uid: decoded.uid };
    next();
  } catch (error) {
    console.error('Falha ao validar ID Token:', error.message);
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
}

/** Exige que o usuário autenticado seja um dos admins configurados. */
function requireAdmin(req, res, next) {
  const admins = [config.admin.roomsAdmin, config.admin.bookingsReportAdmin]
    .filter((email) => email && email.length > 0);

  if (!admins.includes(req.authUser.email)) {
    return res.status(403).json({ error: 'Acesso restrito à administração.' });
  }
  next();
}

// ==========================================
//          ROTAS DE SALAS DE REUNIÃO
// ==========================================

// ROTA 1: Listar salas
app.get('/rooms', async (req, res) => {
  try {
    const roomsSnapshot = await db.collection('rooms').get();
    const roomsList = [];
    roomsSnapshot.forEach(doc => roomsList.push({ id: doc.id, ...doc.data() }));
    res.json(roomsList);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar salas: ' + error.message });
  }
});

// ROTA 2: Criar Reserva (POST)
app.post('/bookings', async (req, res) => {
  try {
    const {
      roomId, date, dates, startTime, endTime, userEmail, roomName,
      attendees, title, notes, termConfirmed, solicitanteEmail
    } = req.body;

    if (!roomId || !startTime || !endTime || !userEmail) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
    }

    // Aceita `date` (uma data) e/ou `dates` (várias). Uma reserva de vários
    // dias é gravada como N documentos independentes — um por dia — unidos por
    // um `serieId`. Isso mantém intactas todas as consultas que assumem uma
    // data única por documento (agenda diária, visão mensal, busca, RSVP).
    const datasSolicitadas = [
      ...(date ? [date] : []),
      ...(Array.isArray(dates) ? dates : [])
    ]
      .map((d) => (d || '').trim())
      .filter((d) => FORMATO_DATA.test(d));

    const datasUnicas = [...new Set(datasSolicitadas)].sort();

    if (datasUnicas.length === 0) {
      return res.status(400).json({ error: 'Informe pelo menos uma data válida (YYYY-MM-DD).' });
    }

    if (datasUnicas.length > MAX_DATAS_SERIE) {
      return res.status(400).json({
        error: `Máximo de ${MAX_DATAS_SERIE} dias por reserva. Selecione menos dias ou crie outra reserva.`
      });
    }

    if (roomId === RESTRICTED_ROOM_ID && !RESTRICTED_ROOM_EMAILS.includes(userEmail)) {
      return res.status(403).json({ error: 'Esta sala é restrita apenas à administração.' });
    }

    // Solicitante: na sala restrita, quem reserva (userEmail) não é quem vai
    // usar a sala. `userEmail` continua sendo o dono — é ele quem edita,
    // cancela e organiza o evento no Google — e o solicitante é quem aparece
    // como responsável nas telas e recebe a confirmação por e-mail.
    const solicitante = validarSolicitante(roomId, solicitanteEmail);
    if (solicitante.erro) {
      return res.status(400).json({ error: solicitante.erro });
    }

    // O horário é o mesmo em todos os dias, então basta validar uma vez.
    if (startTime >= endTime) {
      return res.status(400).json({ error: 'Horário final deve ser maior que o inicial.' });
    }

    const limiteDoPassado = new Date();
    limiteDoPassado.setMinutes(limiteDoPassado.getMinutes() - 10);

    const datasNoPassado = datasUnicas.filter(
      (d) => new Date(`${d}T${startTime}:00`) < limiteDoPassado
    );

    if (datasNoPassado.length > 0) {
      return res.status(400).json({
        error: datasUnicas.length === 1
          ? 'Não é possível criar reservas no passado.'
          : `Estes dias já passaram: ${datasNoPassado.map(formatarDataBR).join(', ')}.`,
        datasInvalidas: datasNoPassado
      });
    }

    // Checa TODOS os dias antes de gravar qualquer coisa: criar metade da série
    // e falhar no meio deixaria o usuário sem saber quais dias tem de fato.
    const bookingsRef = db.collection('bookings');
    const snapshot = await bookingsRef.where('roomId', '==', roomId).get();

    const conflitos = [];
    for (const dia of datasUnicas) {
      const inicio = new Date(`${dia}T${startTime}:00`);
      const fim = new Date(`${dia}T${endTime}:00`);

      const ocupado = snapshot.docs.some((doc) => {
        const reserva = doc.data();
        if (reserva.date !== dia) return false;
        const rStart = new Date(`${reserva.date}T${reserva.startTime}:00`);
        const rEnd = new Date(`${reserva.date}T${reserva.endTime}:00`);
        return inicio < rEnd && fim > rStart;
      });

      if (ocupado) conflitos.push(dia);
    }

    if (conflitos.length > 0) {
      return res.status(409).json({
        error: datasUnicas.length === 1
          ? 'Já existe uma reserva neste horário!'
          : `A sala já está ocupada neste horário em: ${conflitos.map(formatarDataBR).join(', ')}. Nenhum dia foi reservado.`,
        conflitos
      });
    }

    // Expande grupos (do painel e Google Groups) em pessoas. O texto original
    // digitado pelo usuário continua salvo em `attendees`, para que a edição
    // da reserva mostre o grupo em vez de dezenas de e-mails soltos.
    // Resolvido uma única vez e reutilizado em todos os dias da série.
    const convidados = await emailGroups.resolverConvidados(attendees);
    const attendeesList = convidados.emails;

    const guestStatuses = {};
    attendeesList.forEach(email => {
      guestStatuses[email] = 'pendente';
    });

    const ehSerie = datasUnicas.length > 1;
    const serieId = ehSerie ? `serie-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : null;
    const criadoEm = new Date().toISOString();

    const criadas = [];
    const falhas = [];

    for (const dia of datasUnicas) {
      const novaReserva = {
        roomId,
        roomName,
        date: dia,
        startTime,
        endTime,
        userEmail,
        title: title || 'Reunião Reservada',
        notes: notes || '',
        attendees: attendees || '',
        convidados: attendeesList,
        guestStatuses: { ...guestStatuses },
        termConfirmed: termConfirmed === true || termConfirmed === 'true',
        createdAt: criadoEm
      };

      if (solicitante.email) {
        novaReserva.solicitanteEmail = solicitante.email;
      }

      // Campos da série só existem quando há mais de um dia, para não poluir
      // as reservas simples que são a maioria.
      if (ehSerie) {
        novaReserva.serieId = serieId;
        novaReserva.serieDatas = datasUnicas;
      }

      const docRef = await bookingsRef.add(novaReserva);

      // Um evento (e portanto um convite) por dia, como pedido: cada dia pode
      // ser aceito, recusado ou remarcado de forma independente.
      const googleEvent = await createCalendarEvent({ ...novaReserva, attendeesList });

      if (googleEvent && googleEvent.eventId) {
        await docRef.update({
          googleEventId: googleEvent.eventId,
          googleCalendarId: googleEvent.calendarId
        });
      } else {
        // A reserva existe no sistema, mas o convite não saiu. Precisa aparecer
        // na resposta em vez de passar por confirmada.
        falhas.push(dia);
      }

      criadas.push({
        id: docRef.id,
        date: dia,
        googleEventLink: googleEvent ? googleEvent.htmlLink : null
      });
    }

    // Uma única confirmação ao organizador, listando todos os dias — não faz
    // sentido encher a caixa dele com um e-mail por dia. Os convidados recebem
    // os convites pela Google Agenda, um por dia.
    //
    // Havendo solicitante, ele recebe a mesma confirmação: é ele quem vai usar
    // a sala e precisa ter o registro por escrito.
    await sendBookingConfirmationEmail({
      roomName,
      userEmail,
      solicitanteEmail: solicitante.email,
      title: title || 'Reunião Reservada',
      notes: notes || '',
      date: datasUnicas[0],
      datas: datasUnicas,
      startTime,
      endTime,
      convidados: attendeesList,
      googleEventLink: criadas[0] ? criadas[0].googleEventLink : null
    });

    res.status(201).json({
      success: true,
      message: ehSerie
        ? `Sala reservada em ${criadas.length} dias!`
        : 'Sala reservada com sucesso!',
      googleEventLink: criadas[0] ? criadas[0].googleEventLink : null,
      serieId,
      criadas,
      totalDias: criadas.length,
      conviteNaoEnviado: falhas,
      totalConvidados: attendeesList.length,
      gruposExpandidos: convidados.gruposUsados,
      naoResolvidos: convidados.naoResolvidos
    });
  } catch (error) {
    console.error('Erro na rota de reserva:', error);
    res.status(500).json({ error: 'Erro interno ao processar reserva.' });
  }
});

// ROTA 3: Buscar reservas (GET)
app.get('/bookings/search', async (req, res) => {
  try {
    const { roomId, date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date é obrigatório' });

    let query = db.collection('bookings').where('date', '==', date);
    if (roomId) query = query.where('roomId', '==', roomId);

    const snapshot = await query.get();
    const bookings = [];
    snapshot.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));
    bookings.sort((a, b) => a.startTime.localeCompare(b.startTime));

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar agenda.' });
  }
});

// ROTA: Buscar todas as reservas de uma sala em um mês (para visão mensal)
app.get('/bookings/room-month', async (req, res) => {
  try {
    const { roomId, month } = req.query; // month = "YYYY-MM"
    if (!roomId || !month) return res.status(400).json({ error: 'roomId e month são obrigatórios.' });

    const snapshot = await db.collection('bookings').where('roomId', '==', roomId).get();
    const bookings = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.date && data.date.startsWith(month)) {
        bookings.push({ id: doc.id, ...data });
      }
    });
    bookings.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar reservas do mês.' });
  }
});

// ROTA: Consultar disponibilidade dos convidados no Google Agenda (free/busy)
app.post('/calendar/freebusy', async (req, res) => {
  try {
    const { requesterEmail, emails, date, startTime, endTime } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'date, startTime e endTime são obrigatórios.' });
    }

    const recebidos = Array.isArray(emails)
      ? emails.map(e => (e || '').trim()).filter(e => e !== '')
      : [];

    if (recebidos.length === 0) {
      return res.json({ busy: {}, conflitos: [] });
    }

    // O front já expande os grupos antes de chamar, mas resolvemos de novo aqui
    // para que um token de grupo nunca vá para a consulta free/busy como se
    // fosse uma pessoa (o Google devolveria erro para aquele "calendário").
    const { emails: lista } = await emailGroups.resolverConvidados(recebidos.join(','));

    if (lista.length === 0) {
      return res.json({ busy: {}, conflitos: [] });
    }

    const timeMin = new Date(`${date}T${startTime}:00`).toISOString();
    const timeMax = new Date(`${date}T${endTime}:00`).toISOString();

    const busy = await getFreeBusy(requesterEmail || lista[0], lista, timeMin, timeMax);

    // Lista de e-mails que possuem QUALQUER compromisso sobreposto ao período.
    const conflitos = Object.keys(busy).filter(email => (busy[email] || []).length > 0);

    res.json({ busy, conflitos });
  } catch (error) {
    console.error('Erro ao consultar disponibilidade:', error);
    res.status(500).json({ error: 'Erro ao consultar disponibilidade.' });
  }
});

// ROTA 4: Cancelar (DELETE)
app.delete('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.query?.email || req.body?.userEmail;

    const docRef = db.collection('bookings').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) return res.status(404).json({ error: 'Reserva não encontrada.' });
    const bookingData = doc.data();

    if (userEmail && bookingData.userEmail !== userEmail && userEmail !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Permissão negada. Apenas o dono ou Admin podem cancelar.' });
    }

    // `escopo=serie` cancela todos os dias restantes da série de uma vez —
    // sem isso, cancelar uma reserva de 10 dias exigiria 10 cancelamentos.
    const escopo = req.query?.escopo || req.body?.escopo;
    const cancelarSerie = escopo === 'serie' && bookingData.serieId;

    let paraCancelar = [{ id: docRef.id, ref: docRef, dados: bookingData }];

    if (cancelarSerie) {
      const daSerie = await db.collection('bookings')
        .where('serieId', '==', bookingData.serieId)
        .get();

      const hoje = new Date().toISOString().split('T')[0];

      paraCancelar = daSerie.docs
        // Dias que já aconteceram ficam como histórico; cancelar o passado não
        // faz sentido e removeria o registro de um uso que de fato ocorreu.
        .filter((d) => (d.data().date || '') >= hoje)
        // Um admin pode cancelar a reserva de outra pessoa, mas não deve
        // arrastar consigo dias de uma série que não é dele.
        .filter((d) => !userEmail || d.data().userEmail === bookingData.userEmail)
        .map((d) => ({ id: d.id, ref: d.ref, dados: d.data() }));

      // Garante que o dia clicado entre na lista mesmo se for anterior a hoje.
      if (!paraCancelar.some((item) => item.id === docRef.id)) {
        paraCancelar.push({ id: docRef.id, ref: docRef, dados: bookingData });
      }
    }

    const canceladas = [];
    for (const item of paraCancelar) {
      await item.ref.delete();

      // Remove o evento do Google Agenda. O próprio Google notifica os
      // convidados sobre o cancelamento (sendUpdates: 'all').
      if (item.dados.googleEventId) {
        await deleteCalendarEvent(
          item.dados.googleCalendarId || item.dados.userEmail,
          item.dados.googleEventId
        );
      }
      canceladas.push(item.dados.date);
    }

    res.json({
      success: true,
      message: canceladas.length > 1
        ? `${canceladas.length} dias cancelados.`
        : 'Reserva cancelada.',
      totalCancelado: canceladas.length,
      datasCanceladas: canceladas.sort()
    });
  } catch (error) {
    console.error('Erro ao cancelar reserva:', error);
    res.status(500).json({ error: 'Erro interno ao cancelar.' });
  }
});

// ROTA 5: Editar (PUT)
app.put('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime, attendees, title, userEmail, roomId, notes, solicitanteEmail } = req.body;

    const docRef = db.collection('bookings').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Reserva não encontrada' });

    const currentData = doc.data();

    if (currentData.userEmail !== userEmail && userEmail !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Permissão negada.' });
    }

    const targetRoomId = roomId || currentData.roomId;
    if (targetRoomId === RESTRICTED_ROOM_ID && !RESTRICTED_ROOM_EMAILS.includes(userEmail)) {
      return res.status(403).json({ error: 'Apenas Admin pode usar esta sala.' });
    }

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);
    const now = new Date();
    now.setMinutes(now.getMinutes() - 10);

    if (startDateTime >= endDateTime) {
      return res.status(400).json({ error: 'Horário inválido' });
    }

    if (startDateTime < now) {
      return res.status(400).json({ error: 'Não é possível mover para o passado.' });
    }

    const snapshot = await db.collection('bookings')
      .where('roomId', '==', targetRoomId)
      .where('date', '==', date)
      .get();

    let conflito = false;
    snapshot.forEach(otherDoc => {
      if (otherDoc.id !== id) {
        const r = otherDoc.data();
        const rStart = new Date(`${r.date}T${r.startTime}:00`);
        const rEnd = new Date(`${r.date}T${r.endTime}:00`);
        if (startDateTime < rEnd && endDateTime > rStart) conflito = true;
      }
    });

    if (conflito) {
      return res.status(409).json({ error: 'Novo horário indisponível!' });
    }

    // Mesma expansão de grupos da criação. Como o token do grupo fica salvo em
    // `attendees`, editar uma reserva antiga reexpande o grupo com os membros
    // ATUAIS — quem entrou depois passa a ser convidado, quem saiu deixa de ser.
    const convidados = await emailGroups.resolverConvidados(attendees);
    const attendeesList = convidados.emails;

    const previousStatuses = currentData.guestStatuses || {};
    const guestStatuses = {};

    attendeesList.forEach(email => {
      guestStatuses[email] = previousStatuses[email] || 'pendente';
    });

    const updatedData = {
      roomId: targetRoomId,
      roomName: currentData.roomName,
      date,
      startTime,
      endTime,
      title: title || currentData.title || 'Reunião',
      notes: notes !== undefined ? notes : (currentData.notes || ''),
      attendees: attendees || '',
      convidados: attendeesList,
      guestStatuses
    };

    // Solicitante da sala restrita: se o campo não vier na requisição, mantém
    // o que já estava gravado — só é alterado quando enviado de propósito.
    if (solicitanteEmail !== undefined) {
      const solicitante = validarSolicitante(targetRoomId, solicitanteEmail);
      if (solicitante.erro) {
        return res.status(400).json({ error: solicitante.erro });
      }
      updatedData.solicitanteEmail = solicitante.email || null;
    }

    await docRef.update(updatedData);

    // Atualiza o evento no Google Agenda. Se a reserva ainda não tiver um
    // evento vinculado (criada antes da integração), cria um agora.
    const dadosEvento = {
      ...updatedData,
      userEmail: currentData.userEmail,
      // Sem isto, editar sem mexer no responsável apagaria o nome dele da
      // descrição do evento no Google.
      solicitanteEmail: updatedData.solicitanteEmail !== undefined
        ? updatedData.solicitanteEmail
        : currentData.solicitanteEmail,
      attendeesList,
      googleEventId: currentData.googleEventId,
      googleCalendarId: currentData.googleCalendarId
    };

    if (currentData.googleEventId) {
      await updateCalendarEvent(dadosEvento);
    } else {
      const novoEvento = await createCalendarEvent(dadosEvento);
      if (novoEvento && novoEvento.eventId) {
        await docRef.update({
          googleEventId: novoEvento.eventId,
          googleCalendarId: novoEvento.calendarId
        });
      }
    }

    // A atualização/criação do evento no Google já notifica os convidados
    // (sendUpdates: 'all'), então não enviamos e-mail próprio aqui.

    res.json({
      success: true,
      message: 'Reserva atualizada com sucesso!',
      totalConvidados: attendeesList.length,
      gruposExpandidos: convidados.gruposUsados,
      naoResolvidos: convidados.naoResolvidos
    });
  } catch (error) {
    console.error('Erro ao atualizar reserva:', error);
    res.status(500).json({ error: 'Erro ao atualizar.' });
  }
});

// ROTA 6: Responder Convite de Sala (RSVP)
app.put('/bookings/:id/rsvp', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, status } = req.body;

    const allowedStatuses = ['aceito', 'recusado', 'pendente'];

    if (!email || !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Dados inválidos.' });
    }

    const bookingRef = db.collection('bookings').doc(id);
    const doc = await bookingRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }

    const data = doc.data();
    const convidados = Array.isArray(data.convidados) ? data.convidados : [];

    if (!convidados.includes(email)) {
      return res.status(403).json({ error: 'Apenas convidados podem responder ao convite.' });
    }

    const guestStatuses = data.guestStatuses || {};
    guestStatuses[email] = status;

    await bookingRef.update({ guestStatuses });
    res.json({ success: true, message: 'Resposta salva com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar convite:', error);
    res.status(500).json({ error: 'Erro ao atualizar convite.' });
  }
});

// ROTA 7: Buscar Minhas Reservas (Dono) e Convites (Convidado)
app.get('/bookings/my', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email obrigatório' });
    }

    const snapshotOwner = await db.collection('bookings')
      .where('userEmail', '==', email)
      .get();

    const snapshotGuest = await db.collection('bookings')
      .where('convidados', 'array-contains', email)
      .get();

    const bookingsMap = new Map();

    snapshotOwner.forEach(doc => {
      const data = doc.data();
      bookingsMap.set(doc.id, {
        id: doc.id,
        ...data,
        isOwner: true,
        isGuest: false,
        myGuestStatus: null
      });
    });

    snapshotGuest.forEach(doc => {
      const data = doc.data();
      const existing = bookingsMap.get(doc.id);
      const guestStatuses = data.guestStatuses || {};

      bookingsMap.set(doc.id, {
        id: doc.id,
        ...data,
        isOwner: existing?.isOwner || false,
        isGuest: true,
        myGuestStatus: guestStatuses[email] || 'pendente'
      });
    });

    const now = new Date();

    const bookings = Array.from(bookingsMap.values())
      .filter((booking) => {
        if (!booking.date || !booking.endTime) return false;

        const bookingEnd = new Date(`${booking.date}T${booking.endTime}:00`);
        return bookingEnd >= now;
      })
      .sort(
        (a, b) =>
          new Date(`${a.date}T${a.startTime}`) - new Date(`${b.date}T${b.startTime}`)
      );

    res.json(bookings);
  } catch (error) {
    console.error('Erro ao buscar minhas reservas e convites:', error);
    res.status(500).json({ error: 'Erro interno ao buscar as reservas.' });
  }
});

// ROTA ADMIN: Histórico completo de reservas (restrito a ADMIN_BOOKINGS_EMAIL)
app.get('/bookings/admin', async (req, res) => {
  try {
    const { adminEmail, startDate, endDate, roomId, userEmail } = req.query;

    if (!adminEmail || adminEmail.trim().toLowerCase() !== config.admin.bookingsReportAdmin) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const snapshot = await db.collection('bookings').get();
    let bookings = [];
    snapshot.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));

    if (startDate) bookings = bookings.filter(b => b.date >= startDate);
    if (endDate)   bookings = bookings.filter(b => b.date <= endDate);
    if (roomId)    bookings = bookings.filter(b => b.roomId === roomId);
    if (userEmail) bookings = bookings.filter(b =>
      b.userEmail && b.userEmail.toLowerCase().includes(userEmail.toLowerCase())
    );

    bookings.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.startTime.localeCompare(a.startTime);
    });

    res.json(bookings);
  } catch (error) {
    console.error('Erro ao buscar reservas (admin):', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ==========================================
//     ROTAS DE DIRETÓRIO E GRUPOS DE E-MAIL
// ==========================================

// ROTA: Colaboradores da organização (alimenta o autocomplete de convidados).
// Fonte: Google Workspace via Admin SDK. Se a integração estiver desligada ou
// falhar, devolve lista vazia com um aviso — o front usa o fallback local.
app.get('/directory/users', requireAuth, async (req, res) => {
  if (!directory.isEnabled()) {
    return res.json({
      users: [],
      fonte: 'desativada',
      aviso: 'Integração com o diretório do Workspace não configurada (DIRECTORY_ADMIN_SUBJECT).'
    });
  }

  try {
    const users = await directory.listUsers();
    res.json({ users, fonte: 'workspace', aviso: null });
  } catch (error) {
    const aviso = directory.explainError(error);
    console.error('Erro ao listar usuários do diretório:', aviso);
    res.json({ users: [], fonte: 'erro', aviso });
  }
});

// ROTA: Grupos disponíveis para convite — os do painel + os Google Groups.
// Os membros vêm junto para o front poder checar free/busy por pessoa sem
// precisar de outra chamada.
app.get('/directory/groups', requireAuth, async (req, res) => {
  try {
    const { doPainel, doGoogle, avisoGoogle } = await emailGroups.listarTodosGrupos();

    const grupos = [
      ...doPainel.map((g) => ({
        id: g.id,
        token: `${emailGroups.PREFIXO_TOKEN}${g.slug}`,
        nome: g.nome,
        descricao: g.descricao,
        tipo: 'painel',
        membros: g.membros,
      })),
      ...doGoogle.map((g) => ({
        id: g.id,
        token: g.email,
        nome: g.nome,
        descricao: g.descricao,
        tipo: 'google',
        membros: g.membros,
      })),
    ];

    res.json({ grupos, aviso: avisoGoogle });
  } catch (error) {
    console.error('Erro ao listar grupos:', error);
    res.status(500).json({ error: 'Erro ao listar grupos de e-mail.' });
  }
});

// ROTA: Descarta o cache do diretório (botão de atualizar no painel).
app.post('/directory/refresh', requireAuth, requireAdmin, (req, res) => {
  directory.invalidateCache();
  res.json({ success: true, message: 'Cache do diretório limpo.' });
});

// ROTA: Diagnóstico da integração — mostra o que falta configurar no Google.
app.get('/directory/status', requireAuth, requireAdmin, async (req, res) => {
  const status = {
    configurado: directory.isEnabled(),
    adminSubject: config.directory.adminSubject || null,
    serviceAccountClientId: directory.serviceAccountClientId,
    cacheTtlMinutes: config.directory.cacheTtlMinutes,
    usuarios: { ok: false, total: 0, erro: null },
    grupos: { ok: false, total: 0, erro: null },
  };

  if (!status.configurado) {
    status.usuarios.erro = 'DIRECTORY_ADMIN_SUBJECT não definido em api/.env.';
    status.grupos.erro = status.usuarios.erro;
    return res.json(status);
  }

  try {
    const users = await directory.listUsers();
    status.usuarios = { ok: true, total: users.length, erro: null };
  } catch (error) {
    status.usuarios.erro = directory.explainError(error);
  }

  try {
    const grupos = await directory.listGoogleGroups();
    status.grupos = { ok: true, total: grupos.length, erro: null };
  } catch (error) {
    status.grupos.erro = directory.explainError(error);
  }

  res.json(status);
});

// ROTA: Lista os grupos criados no painel (visão de administração).
app.get('/admin/email-groups', requireAuth, requireAdmin, async (req, res) => {
  try {
    const grupos = await emailGroups.listarGruposPainel();
    res.json(grupos);
  } catch (error) {
    console.error('Erro ao listar grupos do painel:', error);
    res.status(500).json({ error: 'Erro ao listar grupos.' });
  }
});

// ROTA: Cria um grupo no painel.
app.post('/admin/email-groups', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { nome, descricao, membros } = req.body;
    const grupo = await emailGroups.criarGrupo({
      nome,
      descricao,
      membros,
      criadoPor: req.authUser.email,
    });
    res.status(201).json(grupo);
  } catch (error) {
    console.error('Erro ao criar grupo:', error.message);
    res.status(error.status || 500).json({ error: error.message || 'Erro ao criar grupo.' });
  }
});

// ROTA: Edita um grupo do painel.
app.put('/admin/email-groups/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { nome, descricao, membros } = req.body;
    const grupo = await emailGroups.atualizarGrupo(req.params.id, { nome, descricao, membros });
    res.json(grupo);
  } catch (error) {
    console.error('Erro ao atualizar grupo:', error.message);
    res.status(error.status || 500).json({ error: error.message || 'Erro ao atualizar grupo.' });
  }
});

// ROTA: Remove um grupo do painel.
app.delete('/admin/email-groups/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await emailGroups.removerGrupo(req.params.id);
    res.json({ success: true, message: 'Grupo removido.' });
  } catch (error) {
    console.error('Erro ao remover grupo:', error.message);
    res.status(error.status || 500).json({ error: error.message || 'Erro ao remover grupo.' });
  }
});

// ==========================================
//          ROTAS DE VEÍCULOS (FROTA)
// ==========================================

// ROTA: Listar Veículos
app.get('/cars', async (req, res) => {
  try {
    const carsSnapshot = await db.collection('cars').get();
    const carsList = [];
    carsSnapshot.forEach(doc => carsList.push({ id: doc.id, ...doc.data() }));
    res.json(carsList);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar veículos: ' + error.message });
  }
});

// ROTA: Criar Reserva Regularizada (permite datas no passado)
app.post('/car-bookings/regularizada', async (req, res) => {
  try {
    const { carId, carModel, carModelo, startDate, startTime, endDate, endTime, userEmail, destino, observacoes, registradoPor, kmSaida, kmRetorno } = req.body;

    if (!carId || !startDate || !startTime || !endDate || !endTime || !userEmail) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
    }

    const startDateTime = new Date(`${startDate}T${startTime}:00`);
    const endDateTime = new Date(`${endDate}T${endTime}:00`);

    if (startDateTime >= endDateTime) {
      return res.status(400).json({ error: 'A devolução deve ser após a retirada.' });
    }

    // Check conflicts with existing active/in-use bookings
    const bookingsRef = db.collection('car_bookings');
    const snapshot = await bookingsRef
      .where('carId', '==', carId)
      .where('status', 'in', ['ativa', 'em_uso'])
      .get();

    let conflito = false;
    snapshot.forEach(doc => {
      const reserva = doc.data();
      const rStart = new Date(`${reserva.startDate}T${reserva.startTime}:00`);
      const rEnd = new Date(`${reserva.endDate}T${reserva.endTime}:00`);
      if (startDateTime < rEnd && endDateTime > rStart) conflito = true;
    });

    if (conflito) {
      return res.status(409).json({ error: 'Veículo já possui reserva ativa neste período!' });
    }

    const novaReserva = {
      carId,
      carModel: carModel || carModelo || '',
      carModelo: carModelo || carModel || '',
      startDate,
      startTime,
      endDate,
      endTime,
      userEmail,
      destino: destino || 'Não informado',
      observacoes: observacoes || '',
      status: 'concluida',
      tipo: 'regularizada',
      registradoPor: registradoPor || '',
      reminderSent: true,
      bookingCode: generateBookingCode(),
      createdAt: new Date().toISOString(),
      ...(kmSaida != null && { kmSaida: Number(kmSaida) }),
      ...(kmRetorno != null && { kmRetorno: Number(kmRetorno) }),
    };

    await bookingsRef.add(novaReserva);

    try {
      await sendCarRegularizacaoEmail(novaReserva);
    } catch (e) {
      console.error('Erro email regularização:', e);
    }

    res.status(201).json({ success: true, message: 'Reserva regularizada com sucesso!' });
  } catch (error) {
    console.error('Erro ao regularizar reserva:', error);
    res.status(500).json({ error: 'Erro interno ao regularizar reserva.' });
  }
});

// ROTA: Criar Reserva de Veículo (POST)
app.post('/car-bookings', async (req, res) => {
  try {
    const { carId, carModel, startDate, startTime, endDate, endTime, userEmail, destino } = req.body;

    if (!carId || !startDate || !startTime || !endDate || !endTime || !userEmail) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
    }

    const startDateTime = new Date(`${startDate}T${startTime}:00`);
    const endDateTime = new Date(`${endDate}T${endTime}:00`);
    const now = new Date();
    now.setMinutes(now.getMinutes() - 10);

    if (startDateTime >= endDateTime) {
      return res.status(400).json({ error: 'A devolução deve ser após a retirada.' });
    }

    if (startDateTime < now) {
      return res.status(400).json({ error: 'Não é possível reservar no passado.' });
    }

    const carDoc = await db.collection('cars').doc(carId).get();
    if (carDoc.exists && carDoc.data().bloqueado === true) {
      return res.status(403).json({ error: 'Este veículo está bloqueado e não pode ser reservado.' });
    }

    const bookingsRef = db.collection('car_bookings');
    const snapshot = await bookingsRef
      .where('carId', '==', carId)
      .where('status', 'in', ['ativa', 'em_uso'])
      .get();

    let conflito = false;
    snapshot.forEach(doc => {
      const reserva = doc.data();
      const rStart = new Date(`${reserva.startDate}T${reserva.startTime}:00`);
      const rEnd = new Date(`${reserva.endDate}T${reserva.endTime}:00`);
      if (startDateTime < rEnd && endDateTime > rStart) conflito = true;
    });

    if (conflito) {
      return res.status(409).json({ error: 'Veículo já reservado neste período!' });
    }

    const novaReserva = {
      carId,
      carModel,
      startDate,
      startTime,
      endDate,
      endTime,
      userEmail,
      destino: destino || 'Não informado',
      status: 'ativa',
      reminderSent: false,
      bookingCode: generateBookingCode(),
      createdAt: new Date().toISOString()
    };

    await bookingsRef.add(novaReserva);

    try {
      await sendCarReservationEmail(novaReserva);
    } catch (e) {
      console.error('Erro email:', e);
    }

    res.status(201).json({ success: true, message: 'Veículo reservado com sucesso!' });
  } catch (error) {
    console.error('Erro ao processar reserva de veículo:', error);
    res.status(500).json({ error: 'Erro interno ao processar reserva.' });
  }
});

// ROTA: Editar Reserva de Veículo (PUT)
app.put('/car_bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, startTime, endDate, endTime, destino } = req.body;

    if (!startDate || !startTime || !endDate || !endTime) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
    }

    const bookingRef = db.collection('car_bookings').doc(id);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) return res.status(404).json({ error: 'Reserva não encontrada.' });

    const bookingData = bookingDoc.data();

    if (bookingData.status !== 'ativa' && bookingData.status !== 'em_uso') {
      return res.status(400).json({ error: 'Apenas reservas ativas podem ser editadas.' });
    }

    const startDateTime = new Date(`${startDate}T${startTime}:00`);
    const endDateTime = new Date(`${endDate}T${endTime}:00`);
    const now = new Date();
    now.setMinutes(now.getMinutes() - 10);

    if (startDateTime >= endDateTime) {
      return res.status(400).json({ error: 'A devolução deve ser após a retirada.' });
    }

    if (startDateTime < now) {
      return res.status(400).json({ error: 'Não é possível reservar no passado.' });
    }

    const bookingsRef = db.collection('car_bookings');
    const snapshot = await bookingsRef
      .where('carId', '==', bookingData.carId)
      .where('status', 'in', ['ativa', 'em_uso'])
      .get();

    let conflito = false;
    snapshot.forEach(doc => {
      if (doc.id === id) return; // ignora a própria reserva sendo editada
      const reserva = doc.data();
      const rStart = new Date(`${reserva.startDate}T${reserva.startTime}:00`);
      const rEnd = new Date(`${reserva.endDate}T${reserva.endTime}:00`);
      if (startDateTime < rEnd && endDateTime > rStart) conflito = true;
    });

    if (conflito) {
      return res.status(409).json({ error: 'Veículo já reservado neste período!' });
    }

    await bookingRef.update({
      startDate,
      startTime,
      endDate,
      endTime,
      destino: destino || 'Não informado',
      updatedAt: new Date().toISOString()
    });

    res.json({ success: true, message: 'Reserva atualizada com sucesso!' });
  } catch (error) {
    console.error('Erro ao editar reserva de veículo:', error);
    res.status(500).json({ error: 'Erro interno ao editar reserva.' });
  }
});

// ROTA: Buscar reservas de um veículo (para a agenda visual do modal)
app.get('/car-bookings/search', async (req, res) => {
  try {
    const { carId } = req.query;
    if (!carId) return res.status(400).json({ error: 'carId é obrigatório' });

    const snapshot = await db.collection('car_bookings')
      .where('carId', '==', carId)
      .where('status', 'in', ['ativa', 'em_uso'])
      .get();

    const bookings = [];
    snapshot.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));
    bookings.sort((a, b) => new Date(`${a.startDate}T${a.startTime}`) - new Date(`${b.startDate}T${b.startTime}`));

    res.json(bookings);
  } catch (error) {
    console.error('Erro ao buscar agenda do veículo:', error);
    res.status(500).json({ error: 'Erro ao buscar agenda do veículo.' });
  }
});

// ROTA: Buscar as viagens de um usuário específico
app.get('/car_bookings/my', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email obrigatório' });

    const snapshot = await db.collection('car_bookings').where('userEmail', '==', email).get();
    const bookings = [];
    snapshot.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));
    bookings.sort((a, b) => new Date(`${b.startDate}T${b.startTime}`) - new Date(`${a.startDate}T${a.startTime}`));

    res.json(bookings);
  } catch (error) {
    console.error('Erro ao buscar viagens do usuário:', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ROTA: Fazer a Devolução do Veículo (Atualiza status e KM)
app.put('/car_bookings/:id/return', async (req, res) => {
  try {
    const { id } = req.params;
    const { kmRetorno, nivelTanque, carId } = req.body;

    const bookingRef = db.collection('car_bookings').doc(id);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) return res.status(404).json({ error: 'Reserva não encontrada.' });

    const bookingData = bookingDoc.data();

    if (carId && kmRetorno) {
      const carRef = db.collection('cars').doc(carId);
      const carDoc = await carRef.get();
      if (carDoc.exists) {
        const carData = carDoc.data();
        const kmAtualBanco = Number(carData.km_atual || 0);
        const kmDigitado = Number(kmRetorno);

        if (kmDigitado < kmAtualBanco) {
          return res.status(400).json({ error: `KM inválida! O veículo está com ${kmAtualBanco} km.` });
        }

        await carRef.update({
          km_atual: kmDigitado,
          ...(nivelTanque && {
            ultimoNivelTanque: nivelTanque,
            ultimoNivelTanqueData: new Date().toISOString()
          })
        });
      }
    }

    await bookingRef.update({
      status: 'concluida',
      kmRetorno: Number(kmRetorno),
      nivelTanque: nivelTanque,
      dataDevolucaoReal: new Date().toISOString()
    });

    try {
      await sendCarReturnEmail({ ...bookingData, kmRetorno, nivelTanque });
    } catch (e) {
      console.error('Erro email devolução:', e);
    }

    res.json({ success: true, message: 'Veículo devolvido com sucesso!' });
  } catch (error) {
    console.error('Erro interno na devolução:', error);
    res.status(500).json({ error: 'Erro interno na devolução.' });
  }
});

// ROTA: Admin força finalização de reserva (com senha)
const ADMIN_FINALIZE_PASSWORD = config.admin.finalizePassword;

app.post('/car_bookings/:id/admin-finalize', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password !== ADMIN_FINALIZE_PASSWORD) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    const bookingRef = db.collection('car_bookings').doc(id);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) return res.status(404).json({ error: 'Reserva não encontrada.' });

    const bookingData = bookingDoc.data();

    if (bookingData.status === 'concluida' || bookingData.status === 'cancelada') {
      return res.status(400).json({ error: 'Esta reserva já está finalizada.' });
    }

    await bookingRef.update({
      status: 'concluida',
      adminFinalized: true,
      adminFinalizedAt: new Date().toISOString(),
      dataDevolucaoReal: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Reserva finalizada pelo administrador.' });
  } catch (error) {
    console.error('Erro ao finalizar reserva (admin):', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ROTA: Cancelar Reserva de Veículo
app.delete('/car_bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('car_bookings').doc(id).update({
      status: 'cancelada',
      dataCancelamento: new Date().toISOString()
    });
    res.json({ success: true, message: 'Viagem cancelada.' });
  } catch (error) {
    console.error('Erro ao cancelar viagem:', error);
    res.status(500).json({ error: 'Erro interno ao cancelar.' });
  }
});

// ROTA: Adicionar Novo Veículo (Admin)
app.post('/cars', async (req, res) => {
  try {
    const newCar = req.body;
    newCar.createdAt = new Date().toISOString();
    if (newCar.km_atual) newCar.km_atual = Number(newCar.km_atual);
    if (newCar.capacidade) newCar.capacidade = Number(newCar.capacidade);

    const docRef = await db.collection('cars').add(newCar);
    res.status(201).json({ success: true, id: docRef.id, message: 'Veículo cadastrado!' });
  } catch (error) {
    console.error('Erro ao adicionar veículo:', error);
    res.status(500).json({ error: 'Erro ao adicionar veículo.' });
  }
});

// ROTA: Editar Veículo (Admin)
app.put('/cars/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;
    if (updatedData.km_atual) updatedData.km_atual = Number(updatedData.km_atual);
    if (updatedData.capacidade) updatedData.capacidade = Number(updatedData.capacidade);

    await db.collection('cars').doc(id).update(updatedData);
    res.json({ success: true, message: 'Veículo atualizado!' });
  } catch (error) {
    console.error('Erro ao atualizar veículo:', error);
    res.status(500).json({ error: 'Erro ao atualizar veículo.' });
  }
});

// ROTA: Buscar histórico de viagens de um veículo específico (Admin)
app.get('/cars/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const snapshot = await db.collection('car_bookings').where('carId', '==', id).get();
    const history = [];
    snapshot.forEach(doc => history.push({ id: doc.id, ...doc.data() }));
    history.sort((a, b) => new Date(`${b.startDate}T${b.startTime}`) - new Date(`${a.startDate}T${a.startTime}`));

    res.json(history);
  } catch (error) {
    console.error('Erro ao buscar histórico de viagens:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico de viagens.' });
  }
});

// ROTA: Buscar reservas de veículos por data (para agenda geral)
app.get('/car_bookings/by-date', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date é obrigatório' });

    const snapshot = await db.collection('car_bookings')
      .where('status', 'in', ['ativa', 'em_uso', 'concluida'])
      .get();

    const bookings = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.startDate <= date && data.endDate >= date) {
        bookings.push({ id: doc.id, ...data });
      }
    });

    res.json(bookings);
  } catch (error) {
    console.error('Erro ao buscar reservas por data:', error);
    res.status(500).json({ error: 'Erro ao buscar reservas.' });
  }
});

// ROTA: Listar TODAS as viagens ativas (Para o Painel do Admin)
app.get('/car_bookings/active', async (req, res) => {
  try {
    const snapshot = await db.collection('car_bookings')
      .where('status', 'in', ['ativa', 'em_uso'])
      .get();

    const bookings = [];
    snapshot.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));

    bookings.sort((a, b) => new Date(`${a.startDate}T${a.startTime}`) - new Date(`${b.startDate}T${b.startTime}`));

    res.json(bookings);
  } catch (error) {
    console.error('Erro ao buscar viagens ativas gerais:', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ROTA: Buscar todas as reservas de um veículo em um mês (para visão mensal do calendário)
app.get('/car_bookings/car-month', async (req, res) => {
  try {
    const { carId, month } = req.query; // month = "YYYY-MM"
    if (!carId || !month) return res.status(400).json({ error: 'carId e month são obrigatórios.' });

    const [year, mon] = month.split('-').map(Number);
    const monthStart = `${month}-01`;
    const nextMonth = new Date(year, mon, 1);
    const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

    const snapshot = await db.collection('car_bookings').where('carId', '==', carId).get();
    const bookings = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.startDate || !data.endDate) return;
      // Inclui reservas que se sobrepõem ao mês (não canceladas)
      if (data.status !== 'cancelada' && data.startDate < monthEnd && data.endDate >= monthStart) {
        bookings.push({ id: doc.id, ...data });
      }
    });

    bookings.sort((a, b) => new Date(`${a.startDate}T${a.startTime}`) - new Date(`${b.startDate}T${b.startTime}`));
    res.json(bookings);
  } catch (error) {
    console.error('Erro ao buscar reservas do mês do veículo:', error);
    res.status(500).json({ error: 'Erro ao buscar reservas do mês.' });
  }
});

// ROTA: Listar agendamentos finalizados/cancelados (Para o Painel do Admin)
app.get('/car_bookings/finalizados', async (req, res) => {
  try {
    const snapshot = await db.collection('car_bookings')
      .where('status', 'in', ['concluida', 'cancelada'])
      .get();

    const bookings = [];
    snapshot.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));

    bookings.sort((a, b) => new Date(`${b.startDate}T${b.startTime}`) - new Date(`${a.startDate}T${a.startTime}`));

    res.json(bookings);
  } catch (error) {
    console.error('Erro ao buscar agendamentos finalizados:', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ==========================================
//          ROTAS DE CUSTOS (FINANCEIRO)
// ==========================================

// ROTA: Lançar um novo custo para o veículo
app.post('/car_costs', async (req, res) => {
  try {
    const costData = req.body;
    costData.createdAt = new Date().toISOString();
    costData.valor = Number(costData.valor);

    const docRef = await db.collection('car_costs').add(costData);
    res.status(201).json({ success: true, id: docRef.id, message: 'Custo lançado com sucesso!' });
  } catch (error) {
    console.error('Erro ao lançar custo:', error);
    res.status(500).json({ error: 'Erro ao registrar o custo do veículo.' });
  }
});

// ROTA: Buscar todos os custos registrados
app.get('/car_costs', async (req, res) => {
  try {
    const snapshot = await db.collection('car_costs').get();
    const costs = [];
    snapshot.forEach(doc => costs.push({ id: doc.id, ...doc.data() }));

    costs.sort((a, b) => new Date(b.dataServico) - new Date(a.dataServico));

    res.json(costs);
  } catch (error) {
    console.error('Erro ao buscar custos:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico de custos.' });
  }
});

// ROTA: Editar um custo existente
app.put('/car_costs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    if (updateData.valor !== undefined) updateData.valor = Number(updateData.valor);
    delete updateData.id;

    await db.collection('car_costs').doc(id).update(updateData);
    res.json({ success: true, message: 'Custo atualizado com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar custo:', error);
    res.status(500).json({ error: 'Erro ao atualizar o custo.' });
  }
});

// ROTA: Excluir um custo
app.delete('/car_costs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('car_costs').doc(id).delete();
    res.json({ success: true, message: 'Custo excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir custo:', error);
    res.status(500).json({ error: 'Erro ao excluir o custo.' });
  }
});

// ==========================================
// ROBÔ DE LEMBRETES AUTOMÁTICOS (CRON JOB)
// Roda a cada 15 minutos verificando a frota
// ==========================================
cron.schedule('*/15 * * * *', async () => {
  try {
    const snapshot = await db.collection('car_bookings')
      .where('status', '==', 'ativa')
      .where('reminderSent', '==', false)
      .get();

    const now = new Date();

    snapshot.forEach(async (doc) => {
      const reserva = doc.data();
      const endDateTime = new Date(`${reserva.endDate}T${reserva.endTime}:00`);

      const diffHours = (endDateTime - now) / (1000 * 60 * 60);

      if (diffHours <= 1) {
        try {
          await sendCarReminderEmail(reserva);
          await db.collection('car_bookings').doc(doc.id).update({ reminderSent: true });
          console.log(`Lembrete enviado para ${reserva.userEmail} - Carro: ${reserva.carModel}`);
        } catch (e) {
          console.error('Erro ao enviar lembrete automático', e);
        }
      }
    });
  } catch (error) {
    console.error('Erro no Cron Job de lembretes:', error);
  }
});

// ==========================================
// ROBÔ DE LEMBRETES DE DEVOLUÇÃO EM ATRASO
// Roda a cada hora verificando reservas vencidas
// ==========================================
cron.schedule('0 * * * *', async () => {
  try {
    const snapshot = await db.collection('car_bookings')
      .where('status', 'in', ['ativa', 'em_uso'])
      .get();

    const now = new Date();

    for (const doc of snapshot.docs) {
      const reserva = doc.data();
      const endDateTime = new Date(`${reserva.endDate}T${reserva.endTime}:00`);

      // Só age se o prazo já passou
      if (now <= endDateTime) continue;

      // Verifica se já foi enviado lembrete na última hora
      const lastReminder = reserva.lastOverdueReminder
        ? new Date(reserva.lastOverdueReminder)
        : null;

      const minutesSinceLast = lastReminder
        ? (now - lastReminder) / (1000 * 60)
        : Infinity;

      if (minutesSinceLast < 55) continue;

      try {
        await sendCarOverdueReminderEmail(reserva);
        await db.collection('car_bookings').doc(doc.id).update({
          lastOverdueReminder: now.toISOString()
        });
        console.log(`⏰ Lembrete de atraso enviado para ${reserva.userEmail} - Carro: ${reserva.carModel || reserva.carModelo}`);
      } catch (e) {
        console.error('Erro ao enviar lembrete de atraso:', e);
      }
    }
  } catch (error) {
    console.error('Erro no Cron Job de lembretes de atraso:', error);
  }
});

app.get('/teste', (req, res) => {
  res.send('TESTE API CERTA');
});

app.listen(config.port, () => {
  console.log(`Servidor rodando na porta ${config.port}`);
});