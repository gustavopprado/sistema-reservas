const nodemailer = require('nodemailer');
const ical = require('ical-generator').default; // Importante o .default em algumas versões

async function createTransporter() {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'reservas@fgvtn.com.br', // <--- SEU EMAIL
      pass: '***SEGREDO-REMOVIDO***'     // <--- SUA SENHA DE APP
    },
  });

  return { transporter };
}

// ... dentro de api/mailer.js

async function sendInviteEmail(bookingData, attendeesList) {
  const { transporter } = await createTransporter();

  // GARANTE QUE O TÍTULO APAREÇA, OU USA O PADRÃO
  const displayTitle = bookingData.title || 'Reunião'; 

  const calendar = ical({ name: 'Convite de Reunião' });
  calendar.createEvent({
    start: new Date(`${bookingData.date}T${bookingData.startTime}:00`),
    end: new Date(`${bookingData.date}T${bookingData.endTime}:00`),
    summary: displayTitle, // <--- AQUI
    description: `Reserva de sala confirmada.\nOrganizador: ${bookingData.userEmail}`,
    location: bookingData.roomName,
    organizer: { name: 'Sistema Reservas', email: bookingData.userEmail }
  });

  try {
    await transporter.sendMail({
      from: '"Sistema de Reservas" <SEU_EMAIL_NOVO@gmail.com>',
      to: attendeesList,
      // TÍTULO NO ASSUNTO
      subject: `CONVITE: ${displayTitle} - ${bookingData.date.split('-').reverse().join('/')} às ${bookingData.startTime}`,
      // TÍTULO NO CORPO DO EMAIL
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #2563eb;">Você foi convidado: ${displayTitle}</h2>
          <p><strong>Sala:</strong> ${bookingData.roomName}</p>
          <p><strong>Data:</strong> ${bookingData.date.split('-').reverse().join('/')}</p>
          <p><strong>Horário:</strong> ${bookingData.startTime} - ${bookingData.endTime}</p>
          <p><strong>Organizador:</strong> ${bookingData.userEmail}</p>
          <hr/>
          <p style="font-size: 12px; color: #666;">Verifique o anexo para adicionar à sua agenda.</p>
        </div>
      `,
      icalEvent: {
        filename: 'invite.ics',
        method: 'request',
        content: calendar.toString()
      }
    });
    console.log("📨 E-mail de convite enviado.");
  } catch (error) {
    console.error("❌ Erro ao enviar convite:", error);
  }
}

async function sendCancellationEmail(bookingData, attendeesList) {
  if (!attendeesList || attendeesList.length === 0) return;

  const { transporter } = await createTransporter();

  // Cria o evento iCal configurado como CANCELAMENTO
  const calendar = ical({ name: 'Cancelamento de Reserva' });
  
  calendar.createEvent({
    start: new Date(`${bookingData.date}T${bookingData.startTime}:00`),
    end: new Date(`${bookingData.date}T${bookingData.endTime}:00`),
    summary: `CANCELADO: ${bookingData.roomName}`,
    description: `Esta reunião foi cancelada pelo organizador.`,
    location: bookingData.roomName,
    organizer: {
      name: 'Sistema de Reservas',
      email: bookingData.userEmail
    },
    // O Pulo do Gato para cancelamento:
    status: 'cancelled',
    sequence: 1 // Indica que é uma atualização de um evento anterior
  });

  try {
    await transporter.sendMail({
      from: '"Sistema de Reservas" <SEU_EMAIL_AQUI@gmail.com>',
      to: attendeesList,
      subject: `CANCELADO: ${bookingData.roomName} - ${bookingData.date.split('-').reverse().join('/')}`,
      text: `A reunião na ${bookingData.roomName} foi cancelada.`,
      icalEvent: {
        filename: 'cancellation.ics',
        method: 'cancel', // Importante: método CANCEL remove da agenda
        content: calendar.toString()
      }
    });
    console.log("🗑️ E-mail de cancelamento enviado.");
  } catch (error) {
    console.error("❌ Erro ao enviar cancelamento:", error);
  }
}

async function sendUpdateEmail(bookingData, attendeesList) {
  if (!attendeesList || attendeesList.length === 0) return;

  const { transporter } = await createTransporter();

  // Cria um novo ical com "SEQUENCE" maior (indica atualização)
  const calendar = ical({ name: 'Atualização de Reserva' });
  
  calendar.createEvent({
    start: new Date(`${bookingData.date}T${bookingData.startTime}:00`),
    end: new Date(`${bookingData.date}T${bookingData.endTime}:00`),
    summary: `ATUALIZADO: ${bookingData.title || 'Reunião'}`, // Usa o título se tiver
    description: `Esta reserva foi alterada.\nNova Data/Hora ou Assunto.\nOrganizador: ${bookingData.userEmail}`,
    location: bookingData.roomName,
    organizer: { name: 'Sistema', email: bookingData.userEmail },
    sequence: 2 // Importante: força o Outlook/Gmail a entender que é uma atualização
  });

  try {
    await transporter.sendMail({
      from: '"Sistema de Reservas" <SEU_EMAIL_AQUI@gmail.com>',
      to: attendeesList,
      subject: `ALTERAÇÃO: ${bookingData.title || 'Reunião'} - ${bookingData.date.split('-').reverse().join('/')}`,
      text: `A reunião foi alterada. Verifique os novos detalhes.`,
      icalEvent: {
        filename: 'invite.ics',
        method: 'request',
        content: calendar.toString()
      }
    });
    console.log("📨 E-mail de atualização enviado.");
  } catch (error) {
    console.error("❌ Erro ao enviar atualização:", error);
  }
}

module.exports = { sendInviteEmail, sendCancellationEmail, sendUpdateEmail };