const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors'); 
const app = express();

const serviceAccount = require('./serviceAccountKey.json');
const { sendInviteEmail, sendCancellationEmail, sendUpdateEmail } = require('./mailer'); 
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

app.use(express.json());
app.use(cors()); 

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

    // --- TRAVA 1: SALA RESTRITA ---
    // Se for a sala restrita E o usuário NÃO for a Simone, bloqueia.
    if (roomId === RESTRICTED_ROOM_ID && userEmail !== ADMIN_EMAIL) {
        return res.status(403).json({ error: "Esta sala é restrita apenas à administração." });
    }

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);
    
    // Ajuste de fuso horário (colher de chá de 10 min) para validação
    const now = new Date();
    now.setMinutes(now.getMinutes() - 10);

    if (startDateTime >= endDateTime) {
      return res.status(400).json({ error: "Horário final deve ser maior que o inicial." });
    }

    if (startDateTime < now) {
        return res.status(400).json({ error: "Não é possível criar reservas no passado." });
    }

    let attendeesList = [];
    if (attendees && attendees.trim().length > 0) {
        attendeesList = attendees.split(',').map(e => e.trim());
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
       
       if (startDateTime < rEnd && endDateTime > rStart) {
           conflito = true;
       }
    });

    if (conflito) return res.status(409).json({ error: "Já existe uma reserva neste horário!" });

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
    const { userEmail } = req.body; // Quem está pedindo para cancelar

    const docRef = db.collection('bookings').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) return res.status(404).json({ error: "Reserva não encontrada." });
    const bookingData = doc.data();

    // --- TRAVA 2: PERMISSÃO DE ADMIN ---
    // Só cancela se for o dono da reserva OU se for a Simone (Admin)
    if (bookingData.userEmail !== userEmail && userEmail !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Permissão negada. Apenas o dono ou Admin podem cancelar." });
    }

    let attendeesList = [];
    if (bookingData.attendees && bookingData.attendees.trim().length > 0) {
        attendeesList = bookingData.attendees.split(',').map(e => e.trim());
    }

    await docRef.delete();

    const destinatariosUnicos = new Set([...attendeesList, bookingData.userEmail]);
    const listaFinalEmails = Array.from(destinatariosUnicos);
    if (listaFinalEmails.length > 0) {
        await sendCancellationEmail(bookingData, listaFinalEmails);
    }

    res.json({ success: true, message: "Reserva cancelada." });

  } catch (error) {
    res.status(500).json({ error: "Erro interno ao cancelar." });
  }
});

// ROTA 5: Listar minhas reservas
app.get('/my-bookings', async (req, res) => {
  try {
    const { userEmail } = req.query;
    if (!userEmail) return res.status(400).json({ error: "Email obrigatório" });

    const snapshot = await db.collection('bookings').where('userEmail', '==', userEmail).get(); 
    const bookings = [];
    snapshot.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));
    bookings.sort((a, b) => new Date(b.date + 'T' + b.startTime) - new Date(a.date + 'T' + a.startTime));

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar reservas." });
  }
});

// ROTA 6: Editar (PUT)
app.put('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime, attendees, title, userEmail, roomId } = req.body;

    const docRef = db.collection('bookings').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: "Reserva não encontrada" });

    const currentData = doc.data();

    // --- TRAVA 3: PERMISSÃO DE ADMIN ---
    // Só edita se for o dono OU a Simone
    if (currentData.userEmail !== userEmail && userEmail !== ADMIN_EMAIL) {
        return res.status(403).json({ error: "Permissão negada." });
    }
    
    // Se for a sala restrita, verifica de novo se quem está editando é admin
    // (Caso alguém tente mover uma reserva normal para a sala restrita)
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
    const destinatariosUnicos = new Set([...attendeesList, currentData.userEmail]); // Manda email pro dono original
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
  console.log(`Servidor rodando na porta ${PORT}`);
});