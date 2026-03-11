const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors'); 
const app = express();
const cron = require('node-cron');

const serviceAccount = require('./serviceAccountKey.json');
const { sendInviteEmail, sendCancellationEmail, sendUpdateEmail, sendCarReservationEmail, sendCarReturnEmail, sendCarReminderEmail } = require('./mailer');
const { createCalendarEvent } = require('./calendarService');

// --- CONSTANTES DE ADMINISTRAÇÃO ---
const ADMIN_EMAIL = 'simone@fgvtn.com.br';
const RESTRICTED_ROOM_ID = 'BXkxGTCaPe37qS9ZuVvp'; // ID da sala restrita

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
    res.status(500).json({ error: "Erro ao buscar salas: " + error.message });
  }
});

// ROTA 2: Criar Reserva (POST)
app.post('/bookings', async (req, res) => {
  try {
    const { roomId, date, startTime, endTime, userEmail, roomName, attendees, title } = req.body;

    if (!roomId || !date || !startTime || !endTime || !userEmail) {
        return res.status(400).json({ error: "Campos obrigatórios faltando." });
    }

    if (roomId === RESTRICTED_ROOM_ID && userEmail !== ADMIN_EMAIL) {
        return res.status(403).json({ error: "Esta sala é restrita apenas à administração." });
    }

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);
    
    const now = new Date();
    now.setMinutes(now.getMinutes() - 10);

    if (startDateTime >= endDateTime) return res.status(400).json({ error: "Horário final deve ser maior que o inicial." });
    if (startDateTime < now) return res.status(400).json({ error: "Não é possível criar reservas no passado." });

    // --- CORREÇÃO AQUI: Filtrando emails vazios caso o usuário deixe uma vírgula sobrando ---
    let attendeesList = [];
    if (attendees && attendees.trim().length > 0) {
        attendeesList = attendees.split(',').map(e => e.trim()).filter(e => e !== '');
    }

    const bookingsRef = db.collection('bookings');
    const snapshot = await bookingsRef.where('roomId', '==', roomId).where('date', '==', date).get();

    let conflito = false;
    snapshot.forEach(doc => {
       const reserva = doc.data();
       const rStart = new Date(`${reserva.date}T${reserva.startTime}:00`);
       const rEnd = new Date(`${reserva.date}T${reserva.endTime}:00`);
       if (startDateTime < rEnd && endDateTime > rStart) conflito = true;
    });

    if (conflito) return res.status(409).json({ error: "Já existe uma reserva neste horário!" });

    // --- CORREÇÃO AQUI: Inserindo o array "convidados" no banco de dados ---
    const novaReserva = {
      roomId,
      roomName,
      date,
      startTime,
      endTime,
      userEmail,
      title: title || 'Reunião Reservada',
      attendees: attendees || '', 
      convidados: attendeesList,
      createdAt: new Date().toISOString()
    };

    await bookingsRef.add(novaReserva);
    
    const googleLink = await createCalendarEvent({ ...novaReserva, attendeesList });

    const destinatariosUnicos = new Set([...attendeesList, userEmail]);
    const listaFinalEmails = Array.from(destinatariosUnicos);

    if (listaFinalEmails.length > 0) {
        await sendInviteEmail(novaReserva, listaFinalEmails); 
    }

    res.status(201).json({ success: true, message: "Sala reservada com sucesso!", googleEventLink: googleLink });

  } catch (error) {
    console.error("Erro na rota de reserva:", error);
    res.status(500).json({ error: "Erro interno ao processar reserva." });
  }
});

// ROTA 3: Buscar reservas (GET)
app.get('/bookings/search', async (req, res) => {
  try {
    const { roomId, date } = req.query;
    if (!date) return res.status(400).json({ error: "Date é obrigatório" });

    let query = db.collection('bookings').where('date', '==', date);
    if (roomId) query = query.where('roomId', '==', roomId);

    const snapshot = await query.get(); 
    const bookings = [];
    snapshot.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));
    bookings.sort((a, b) => a.startTime.localeCompare(b.startTime));

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar agenda." });
  }
});

// ROTA 4: Cancelar (DELETE)
app.delete('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.query?.email || req.body?.userEmail; 

    const docRef = db.collection('bookings').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) return res.status(404).json({ error: "Reserva não encontrada." });
    const bookingData = doc.data();

    if (userEmail && bookingData.userEmail !== userEmail && userEmail !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Permissão negada. Apenas o dono ou Admin podem cancelar." });
    }

    let attendeesList = [];
    if (bookingData.convidados && Array.isArray(bookingData.convidados)) {
        attendeesList = bookingData.convidados;
    } else if (bookingData.attendees && typeof bookingData.attendees === 'string') {
        attendeesList = bookingData.attendees.split(',').map(e => e.trim());
    }

    await docRef.delete();

    try {
        const destinatariosUnicos = new Set([...attendeesList, bookingData.userEmail]);
        const listaFinalEmails = Array.from(destinatariosUnicos).filter(email => email);
        if (listaFinalEmails.length > 0 && typeof sendCancellationEmail === 'function') {
            await sendCancellationEmail(bookingData, listaFinalEmails);
        }
    } catch (emailError) {}

    res.json({ success: true, message: "Reserva cancelada." });
  } catch (error) {
    res.status(500).json({ error: "Erro interno ao cancelar." });
  }
});

// ROTA 5: Editar (PUT)
app.put('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime, attendees, title, userEmail, roomId } = req.body;

    const docRef = db.collection('bookings').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: "Reserva não encontrada" });

    const currentData = doc.data();

    if (currentData.userEmail !== userEmail && userEmail !== ADMIN_EMAIL) {
        return res.status(403).json({ error: "Permissão negada." });
    }
    
    const targetRoomId = roomId || currentData.roomId;
    if (targetRoomId === RESTRICTED_ROOM_ID && userEmail !== ADMIN_EMAIL) {
         return res.status(403).json({ error: "Apenas Admin pode usar esta sala." });
    }

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);
    const now = new Date();
    now.setMinutes(now.getMinutes() - 10);

    if (startDateTime >= endDateTime) return res.status(400).json({ error: "Horário inválido" });
    if (startDateTime < now) return res.status(400).json({ error: "Não é possível mover para o passado." });

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

    if (conflito) return res.status(409).json({ error: "Novo horário indisponível!" });

    const updatedData = {
        roomId: targetRoomId,
        date, startTime, endTime, 
        title: title || currentData.title || 'Reunião',
        attendees: attendees || ''
    };

    await docRef.update(updatedData);

    let attendeesList = [];
    if (updatedData.attendees && updatedData.attendees.trim().length > 0) {
        attendeesList = updatedData.attendees.split(',').map(e => e.trim());
    }
    const destinatariosUnicos = new Set([...attendeesList, currentData.userEmail]);
    const listaFinalEmails = Array.from(destinatariosUnicos);

    if (listaFinalEmails.length > 0) {
        await sendUpdateEmail({ ...currentData, ...updatedData }, listaFinalEmails);
    }
    
    res.json({ success: true, message: "Reserva atualizada com sucesso!" });

  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar." });
  }
});

// ROTA 6: Responder Convite de Sala (RSVP)
app.put('/bookings/:id/rsvp', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, status } = req.body;

    const bookingRef = db.collection('bookings').doc(id);
    const doc = await bookingRef.get();

    if (!doc.exists) return res.status(404).json({ error: "Reserva não encontrada." });

    const data = doc.data();
    const guestStatuses = data.guestStatuses || {};
    guestStatuses[email] = status;

    await bookingRef.update({ guestStatuses });
    res.json({ success: true, message: "Resposta salva com sucesso." });
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar convite." });
  }
});

// ROTA 7: Buscar Minhas Reservas (Dono) e Convites (Convidado)
app.get('/bookings/my', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: "Email obrigatório" });
    }

    // 1. Busca as reservas onde o usuário é o DONO
    const snapshotOwner = await db.collection('bookings')
      .where('userEmail', '==', email)
      .get();

    // 2. Busca as reservas onde o usuário é CONVIDADO (está dentro do array 'convidados')
    const snapshotGuest = await db.collection('bookings')
      .where('convidados', 'array-contains', email)
      .get();

    // Usamos um Map para juntar as duas listas sem duplicar (caso ele seja dono e se convide)
    const bookingsMap = new Map();

    snapshotOwner.forEach(doc => bookingsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    snapshotGuest.forEach(doc => bookingsMap.set(doc.id, { id: doc.id, ...doc.data() }));

    const bookings = Array.from(bookingsMap.values());

    // Ordena as reservas por data
    bookings.sort((a, b) => new Date(`${b.date}T${b.startTime}`) - new Date(`${a.date}T${a.startTime}`));

    res.json(bookings);
  } catch (error) {
    console.error("Erro ao buscar minhas reservas e convites:", error);
    res.status(500).json({ error: "Erro interno ao buscar as reservas." });
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
    res.status(500).json({ error: "Erro ao buscar veículos: " + error.message });
  }
});

// ROTA: Criar Reserva de Veículo (POST)
app.post('/car-bookings', async (req, res) => {
  try {
    const { carId, carModel, startDate, startTime, endDate, endTime, userEmail, destino } = req.body;

    if (!carId || !startDate || !startTime || !endDate || !endTime || !userEmail) return res.status(400).json({ error: "Campos obrigatórios faltando." });

    const startDateTime = new Date(`${startDate}T${startTime}:00`);
    const endDateTime = new Date(`${endDate}T${endTime}:00`);
    const now = new Date();
    now.setMinutes(now.getMinutes() - 10);

    if (startDateTime >= endDateTime) return res.status(400).json({ error: "A devolução deve ser após a retirada." });
    if (startDateTime < now) return res.status(400).json({ error: "Não é possível reservar no passado." });

    const bookingsRef = db.collection('car_bookings');
    const snapshot = await bookingsRef.where('carId', '==', carId).where('status', 'in', ['ativa', 'em_uso']).get();

    let conflito = false;
    snapshot.forEach(doc => {
       const reserva = doc.data();
       const rStart = new Date(`${reserva.startDate}T${reserva.startTime}:00`);
       const rEnd = new Date(`${reserva.endDate}T${reserva.endTime}:00`);
       if (startDateTime < rEnd && endDateTime > rStart) conflito = true;
    });

    if (conflito) return res.status(409).json({ error: "Veículo já reservado neste período!" });

    const novaReserva = {
      carId, carModel, startDate, startTime, endDate, endTime, userEmail,
      destino: destino || 'Não informado',
      status: 'ativa',
      reminderSent: false, // Flag para controlar o robô de e-mails
      createdAt: new Date().toISOString()
    };

    await bookingsRef.add(novaReserva);

    // === MÁGICA 1: EMAIL DE RESERVA ===
    try { await sendCarReservationEmail(novaReserva); } catch (e) { console.error("Erro email:", e); }

    res.status(201).json({ success: true, message: "Veículo reservado com sucesso!" });
  } catch (error) {
    res.status(500).json({ error: "Erro interno ao processar reserva." });
  }
});

// ROTA: Buscar reservas de um veículo (para a agenda visual do modal)
app.get('/car-bookings/search', async (req, res) => {
  try {
    const { carId } = req.query;
    if (!carId) return res.status(400).json({ error: "carId é obrigatório" });

    const snapshot = await db.collection('car_bookings')
      .where('carId', '==', carId)
      .where('status', 'in', ['ativa', 'em_uso'])
      .get(); 
      
    const bookings = [];
    snapshot.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));
    bookings.sort((a, b) => new Date(`${a.startDate}T${a.startTime}`) - new Date(`${b.startDate}T${b.startTime}`));

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar agenda do veículo." });
  }
});

// ROTA: Buscar as viagens de um usuário específico
app.get('/car_bookings/my', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email obrigatório" });

    const snapshot = await db.collection('car_bookings').where('userEmail', '==', email).get();
    const bookings = [];
    snapshot.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));
    bookings.sort((a, b) => new Date(`${b.startDate}T${b.startTime}`) - new Date(`${a.startDate}T${a.startTime}`));

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: "Erro interno." });
  }
});

// ROTA: Fazer a Devolução do Veículo (Atualiza status e KM)
app.put('/car_bookings/:id/return', async (req, res) => {
  try {
    const { id } = req.params;
    const { kmRetorno, nivelTanque, carId } = req.body;

    const bookingRef = db.collection('car_bookings').doc(id);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) return res.status(404).json({ error: "Reserva não encontrada." });
    const bookingData = bookingDoc.data();

    // Trava do KM
    if (carId && kmRetorno) {
      const carRef = db.collection('cars').doc(carId);
      const carDoc = await carRef.get();
      if (carDoc.exists) {
        const carData = carDoc.data();
        const kmAtualBanco = Number(carData.km_atual || 0);
        const kmDigitado = Number(kmRetorno);

        if (kmDigitado < kmAtualBanco) return res.status(400).json({ error: `KM inválida! O veículo está com ${kmAtualBanco} km.` });
        await carRef.update({ km_atual: kmDigitado });
      }
    }

    await bookingRef.update({
      status: 'concluida',
      kmRetorno: Number(kmRetorno),
      nivelTanque: nivelTanque,
      dataDevolucaoReal: new Date().toISOString()
    });

    // === MÁGICA 2: EMAIL DE DEVOLUÇÃO ===
    try {
      await sendCarReturnEmail({ ...bookingData, kmRetorno, nivelTanque });
    } catch(e) { console.error("Erro email devolução:", e); }

    res.json({ success: true, message: "Veículo devolvido com sucesso!" });
  } catch (error) {
    res.status(500).json({ error: "Erro interno na devolução." });
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
    res.json({ success: true, message: "Viagem cancelada." });
  } catch (error) {
    res.status(500).json({ error: "Erro interno ao cancelar." });
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
    res.status(201).json({ success: true, id: docRef.id, message: "Veículo cadastrado!" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao adicionar veículo." });
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
    res.json({ success: true, message: "Veículo atualizado!" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar veículo." });
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
    res.status(500).json({ error: "Erro ao buscar histórico de viagens." });
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

    // Ordena pela data/hora de retirada (para o admin ver quem saiu primeiro)
    bookings.sort((a, b) => new Date(`${a.startDate}T${a.startTime}`) - new Date(`${b.startDate}T${b.startTime}`));

    res.json(bookings);
  } catch (error) {
    console.error("Erro ao buscar viagens ativas gerais:", error);
    res.status(500).json({ error: "Erro interno." });
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
    costData.valor = Number(costData.valor); // Garante que o valor seja salvo como número

    const docRef = await db.collection('car_costs').add(costData);
    res.status(201).json({ success: true, id: docRef.id, message: "Custo lançado com sucesso!" });
  } catch (error) {
    console.error("Erro ao lançar custo:", error);
    res.status(500).json({ error: "Erro ao registrar o custo do veículo." });
  }
});

// ROTA: Buscar todos os custos registrados
app.get('/car_costs', async (req, res) => {
  try {
    const snapshot = await db.collection('car_costs').get();
    const costs = [];
    snapshot.forEach(doc => costs.push({ id: doc.id, ...doc.data() }));
    
    // Ordena do mais recente para o mais antigo
    costs.sort((a, b) => new Date(b.dataServico) - new Date(a.dataServico));

    res.json(costs);
  } catch (error) {
    console.error("Erro ao buscar custos:", error);
    res.status(500).json({ error: "Erro ao buscar histórico de custos." });
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
      .where('reminderSent', '==', false) // Busca só os que ainda não foram avisados
      .get();

    const now = new Date();

    snapshot.forEach(async (doc) => {
      const reserva = doc.data();
      const endDateTime = new Date(`${reserva.endDate}T${reserva.endTime}:00`);
      
      // Diferença em horas entre Agora e o fim da reserva
      const diffHours = (endDateTime - now) / (1000 * 60 * 60);

      // Se faltar 1 hora ou menos para o fim, ou se já passou e a pessoa não devolveu: Dispara!
      if (diffHours <= 1) {
        try {
          await sendCarReminderEmail(reserva);
          await db.collection('car_bookings').doc(doc.id).update({ reminderSent: true }); // Marca como enviado para não fazer spam
          console.log(`Lembrete enviado para ${reserva.userEmail} - Carro: ${reserva.carModel}`);
        } catch(e) {
          console.error(`Erro ao enviar lembrete automático`, e);
        }
      }
    });
  } catch (error) {
    console.error('Erro no Cron Job de lembretes:', error);
  }
});

const PORT = process.env.PORT || 4411;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});