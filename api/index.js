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

// --- CONSTANTES DE ADMINISTRAÇÃO ---
const ADMIN_EMAIL = config.admin.roomsAdmin;

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

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

app.use(cors());
app.use(express.json());

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
    const { roomId, date, startTime, endTime, userEmail, roomName, attendees, title, notes, termConfirmed } = req.body;

    if (!roomId || !date || !startTime || !endTime || !userEmail) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
    }

    if (roomId === RESTRICTED_ROOM_ID && !RESTRICTED_ROOM_EMAILS.includes(userEmail)) {
      return res.status(403).json({ error: 'Esta sala é restrita apenas à administração.' });
    }

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);

    const now = new Date();
    now.setMinutes(now.getMinutes() - 10);

    if (startDateTime >= endDateTime) {
      return res.status(400).json({ error: 'Horário final deve ser maior que o inicial.' });
    }

    if (startDateTime < now) {
      return res.status(400).json({ error: 'Não é possível criar reservas no passado.' });
    }

    let attendeesList = [];
    if (attendees && attendees.trim().length > 0) {
      attendeesList = attendees
        .split(',')
        .map(e => e.trim())
        .filter(e => e !== '');
    }

    const bookingsRef = db.collection('bookings');
    const snapshot = await bookingsRef
      .where('roomId', '==', roomId)
      .where('date', '==', date)
      .get();

    let conflito = false;
    snapshot.forEach(doc => {
      const reserva = doc.data();
      const rStart = new Date(`${reserva.date}T${reserva.startTime}:00`);
      const rEnd = new Date(`${reserva.date}T${reserva.endTime}:00`);
      if (startDateTime < rEnd && endDateTime > rStart) conflito = true;
    });

    if (conflito) {
      return res.status(409).json({ error: 'Já existe uma reserva neste horário!' });
    }

    const guestStatuses = {};
    attendeesList.forEach(email => {
      guestStatuses[email] = 'pendente';
    });

    const novaReserva = {
      roomId,
      roomName,
      date,
      startTime,
      endTime,
      userEmail,
      title: title || 'Reunião Reservada',
      notes: notes || '',
      attendees: attendees || '',
      convidados: attendeesList,
      guestStatuses,
      termConfirmed: termConfirmed === true || termConfirmed === 'true',
      createdAt: new Date().toISOString()
    };

    const docRef = await bookingsRef.add(novaReserva);

    const googleEvent = await createCalendarEvent({ ...novaReserva, attendeesList });

    // Guarda os identificadores do evento do Google para permitir
    // atualizar/cancelar esse mesmo evento depois.
    if (googleEvent && googleEvent.eventId) {
      await docRef.update({
        googleEventId: googleEvent.eventId,
        googleCalendarId: googleEvent.calendarId
      });
    }

    // Envia confirmação apenas ao organizador. Os convidados recebem o
    // convite que adiciona o evento na agenda automaticamente, via Google.
    await sendBookingConfirmationEmail({
      ...novaReserva,
      googleEventLink: googleEvent ? googleEvent.htmlLink : null
    });

    res.status(201).json({
      success: true,
      message: 'Sala reservada com sucesso!',
      googleEventLink: googleEvent ? googleEvent.htmlLink : null
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

    const lista = Array.isArray(emails)
      ? emails.map(e => (e || '').trim()).filter(e => e !== '')
      : [];

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

    await docRef.delete();

    // Remove o evento do Google Agenda. O próprio Google notifica os
    // convidados sobre o cancelamento (sendUpdates: 'all').
    if (bookingData.googleEventId) {
      await deleteCalendarEvent(
        bookingData.googleCalendarId || bookingData.userEmail,
        bookingData.googleEventId
      );
    }

    res.json({ success: true, message: 'Reserva cancelada.' });
  } catch (error) {
    console.error('Erro ao cancelar reserva:', error);
    res.status(500).json({ error: 'Erro interno ao cancelar.' });
  }
});

// ROTA 5: Editar (PUT)
app.put('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime, attendees, title, userEmail, roomId, notes } = req.body;

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

    let attendeesList = [];
    if (attendees && attendees.trim().length > 0) {
      attendeesList = attendees
        .split(',')
        .map(e => e.trim())
        .filter(e => e !== '');
    }

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

    await docRef.update(updatedData);

    // Atualiza o evento no Google Agenda. Se a reserva ainda não tiver um
    // evento vinculado (criada antes da integração), cria um agora.
    const dadosEvento = {
      ...updatedData,
      userEmail: currentData.userEmail,
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

    res.json({ success: true, message: 'Reserva atualizada com sucesso!' });
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