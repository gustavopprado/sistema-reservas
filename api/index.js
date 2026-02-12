const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors'); 
const app = express();

const serviceAccount = require('./serviceAccountKey.json');
const { sendInviteEmail, sendCancellationEmail, sendUpdateEmail } = require('./mailer'); 
const { createCalendarEvent } = require('./calendarService');

// Inicialização do Firebase
if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

app.use(express.json());
app.use(cors()); 

// ==========================================
// ROTA 1: Listar todas as salas
// ==========================================
app.get('/rooms', async (req, res) => {
  try {
    const roomsSnapshot = await db.collection('rooms').get();
    const roomsList = [];

    roomsSnapshot.forEach(doc => {
      roomsList.push({
        id: doc.id,       
        ...doc.data()    
      });
    });

    res.json(roomsList);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar salas: " + error.message });
  }
});

// ==========================================
// ROTA 2: Criar Reserva (POST)
// ==========================================
app.post('/bookings', async (req, res) => {
  try {
    const { roomId, date, startTime, endTime, userEmail, roomName, attendees, title } = req.body;

    // --- 1. Validações Básicas ---
    if (!roomId || !date || !startTime || !endTime || !userEmail) {
        return res.status(400).json({ error: "Campos obrigatórios faltando." });
    }

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);
    const now = new Date(); // Hora atual do servidor

    // Validação de Lógica de Horário
    if (startDateTime >= endDateTime) {
      return res.status(400).json({ error: "Horário final deve ser maior que o inicial." });
    }

    // --- NOVA VALIDAÇÃO: Bloqueio de Passado ---
    // Se o horário de início for menor que AGORA, bloqueia.
    if (startDateTime < now) {
        return res.status(400).json({ error: "Não é possível criar reservas no passado." });
    }

    // --- 2. Preparar Lista de Convidados ---
    let attendeesList = [];
    if (attendees && attendees.trim().length > 0) {
        attendeesList = attendees.split(',').map(e => e.trim());
    }

    // --- 3. Verificação de Conflito ---
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
       
       if (startDateTime < rEnd && endDateTime > rStart) {
           conflito = true;
       }
    });

    if (conflito) return res.status(409).json({ error: "Já existe uma reserva neste horário!" });

    // --- 4. Salvar no Banco (Firebase) ---
    const novaReserva = {
      roomId,
      roomName,
      date,
      startTime,
      endTime,
      userEmail,
      title: title || 'Reunião Reservada',
      attendees: attendees || '', 
      createdAt: new Date().toISOString()
    };

    await bookingsRef.add(novaReserva);

    // --- 5. Integração Google Calendar ---
    const googleLink = await createCalendarEvent({
        ...novaReserva, 
        attendeesList 
    });

    // --- 6. Envio de E-mail (Convidados + Dono) ---
    const destinatariosUnicos = new Set([...attendeesList, userEmail]);
    const listaFinalEmails = Array.from(destinatariosUnicos);

    if (listaFinalEmails.length > 0) {
        console.log(`📧 Enviando convites para: ${listaFinalEmails.join(', ')}`);
        await sendInviteEmail(novaReserva, listaFinalEmails); 
    }

    res.status(201).json({ 
        success: true, 
        message: "Sala reservada com sucesso!",
        googleEventLink: googleLink 
    });

  } catch (error) {
    console.error("Erro na rota de reserva:", error);
    res.status(500).json({ error: "Erro interno ao processar reserva." });
  }
});

// ==========================================
// ROTA 3: Buscar reservas (GET)
// ==========================================
app.get('/bookings/search', async (req, res) => {
  try {
    const { roomId, date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Date é obrigatório" });
    }

    let query = db.collection('bookings').where('date', '==', date);

    if (roomId) {
      query = query.where('roomId', '==', roomId);
    }

    const snapshot = await query.get(); 

    const bookings = [];
    snapshot.forEach(doc => {
      bookings.push({ id: doc.id, ...doc.data() });
    });

    bookings.sort((a, b) => a.startTime.localeCompare(b.startTime));

    res.json(bookings);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar agenda." });
  }
});

// ==========================================
// ROTA 4: Cancelar uma reserva (DELETE)
// ==========================================
app.delete('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail } = req.body; 

    const docRef = db.collection('bookings').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Reserva não encontrada." });
    }

    const bookingData = doc.data();

    if (bookingData.userEmail !== userEmail) {
      return res.status(403).json({ error: "Você só pode cancelar suas próprias reservas." });
    }

    let attendeesList = [];
    if (bookingData.attendees && bookingData.attendees.trim().length > 0) {
        attendeesList = bookingData.attendees.split(',').map(e => e.trim());
    }

    await docRef.delete();

    // Avisar cancelamento (Convidados + Dono)
    const destinatariosUnicos = new Set([...attendeesList, bookingData.userEmail]);
    const listaFinalEmails = Array.from(destinatariosUnicos);

    if (listaFinalEmails.length > 0) {
        await sendCancellationEmail(bookingData, listaFinalEmails);
    }

    res.json({ success: true, message: "Reserva cancelada." });

  } catch (error) {
    console.error("Erro ao cancelar:", error);
    res.status(500).json({ error: "Erro interno ao cancelar." });
  }
});

// ==========================================
// ROTA 5: Listar minhas reservas (GET)
// ==========================================
app.get('/my-bookings', async (req, res) => {
  try {
    const { userEmail } = req.query;
    if (!userEmail) return res.status(400).json({ error: "Email obrigatório" });

    const snapshot = await db.collection('bookings')
      .where('userEmail', '==', userEmail)
      .get(); 

    const bookings = [];
    snapshot.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));

    bookings.sort((a, b) => new Date(b.date + 'T' + b.startTime) - new Date(a.date + 'T' + a.startTime));

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar reservas." });
  }
});

// ==========================================
// ROTA 6: Editar Reserva (PUT)
// ==========================================
app.put('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime, attendees, title, userEmail, roomId } = req.body;

    const docRef = db.collection('bookings').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) return res.status(404).json({ error: "Reserva não encontrada" });

    const currentData = doc.data();

    if (currentData.userEmail !== userEmail) {
        return res.status(403).json({ error: "Permissão negada." });
    }

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);
    const now = new Date(); // Hora atual do servidor
    
    // Validação Lógica
    if (startDateTime >= endDateTime) return res.status(400).json({ error: "Horário inválido" });

    // --- NOVA VALIDAÇÃO: Bloqueio de Passado na Edição ---
    if (startDateTime < now) {
        return res.status(400).json({ error: "Não é possível mover a reserva para o passado." });
    }

    const snapshot = await db.collection('bookings')
        .where('roomId', '==', roomId || currentData.roomId)
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
        date, 
        startTime, 
        endTime, 
        title: title || currentData.title || 'Reunião',
        attendees: attendees || ''
    };

    await docRef.update(updatedData);

    // Avisar atualização (Convidados + Dono)
    let attendeesList = [];
    if (updatedData.attendees && updatedData.attendees.trim().length > 0) {
        attendeesList = updatedData.attendees.split(',').map(e => e.trim());
    }
    
    const destinatariosUnicos = new Set([...attendeesList, userEmail]);
    const listaFinalEmails = Array.from(destinatariosUnicos);

    if (listaFinalEmails.length > 0) {
        await sendUpdateEmail({ ...currentData, ...updatedData }, listaFinalEmails);
    }
    
    res.json({ success: true, message: "Reserva atualizada com sucesso!" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar." });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});