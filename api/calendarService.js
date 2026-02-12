const { google } = require('googleapis');
const path = require('path');

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, 'serviceAccountKey.json'),
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

async function createCalendarEvent(bookingData) {
  try {
    console.log("🔐 Gerando credenciais...");
    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    console.log("📅 Criando bloqueio na agenda...");

    const calendarId = 'reservas@fgvtn.com.br'; // ID da sua agenda

    const event = {
      summary: `Reserva: ${bookingData.roomName}`,
      description: `Reservado por: ${bookingData.userEmail}\nCriado via Sistema de Reservas.\nConvidados notificados por e-mail.`,
      location: bookingData.roomName,
      start: {
        dateTime: `${bookingData.date}T${bookingData.startTime}:00`,
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: `${bookingData.date}T${bookingData.endTime}:00`,
        timeZone: 'America/Sao_Paulo',
      },
      // REMOVEMOS O 'attendees' DAQUI PARA EVITAR O ERRO 403
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: calendarId,
      resource: event,
      // Mudamos para 'none' pois não vamos convidar pelo Google, e sim pelo Nodemailer
      sendUpdates: 'none', 
    });

    console.log('✅ Bloqueio criado na Agenda com sucesso!');
    return response.data.htmlLink;

  } catch (error) {
    console.error('❌ Erro no Google Calendar:', error.message);
    if (error.response) console.error(error.response.data);
    return null;
  }
}

module.exports = { createCalendarEvent };