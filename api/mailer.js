const nodemailer = require('nodemailer');
const ical = require('ical-generator').default; // Importante o .default em algumas versões

async function createTransporter() {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'reservas@fgvtn.com.br', // <--- SEU EMAIL
      pass: 'nvagailztalipvvn'     // <--- SUA SENHA DE APP
    },
  });

  return { transporter };
}

async function sendInviteEmail(bookingData, attendeesList) {
  if (!attendeesList || attendeesList.length === 0) return;

  const { transporter } = await createTransporter();

  // 1. Criar o Objeto de Calendário (O Arquivo .ics)
  const calendar = ical({ name: 'Reserva de Sala' });
  
  // Horários precisam ser objetos Date
  const start = new Date(`${bookingData.date}T${bookingData.startTime}:00`);
  const end = new Date(`${bookingData.date}T${bookingData.endTime}:00`);

  calendar.createEvent({
    start: start,
    end: end,
    summary: `Reserva: ${bookingData.roomName}`,
    description: `Reserva realizada pelo sistema.\nOrganizador: ${bookingData.userEmail}`,
    location: bookingData.roomName,
    url: 'http://localhost:5173', // Link do seu sistema
    organizer: {
      name: 'Sistema de Reservas',
      email: bookingData.userEmail // Aparece que foi o usuário quem convidou
    },
  });

  try {
    // 2. Enviar o E-mail com o "icalEvent"
    await transporter.sendMail({
      from: '"Sistema de Reservas" <SEU_EMAIL_AQUI@gmail.com>',
      to: attendeesList, 
      subject: `Convite: ${bookingData.roomName} - ${bookingData.date.split('-').reverse().join('/')}`,
      
      // Corpo simples para quem não tem calendário compatível
      text: `Você foi convidado para uma reunião em ${bookingData.roomName} no dia ${bookingData.date}. Verifique o anexo.`,
      
      // O PULO DO GATO: Anexar o evento como convite oficial
      icalEvent: {
        filename: 'invitation.ics',
        method: 'request', // 'request' diz ao Gmail que é um CONVITE para ser respondido
        content: calendar.toString()
      }
    });
    
    console.log("📨 Convite iCal enviado com sucesso!");
    return true;

  } catch (error) {
    console.error("❌ Erro ao enviar convite iCal:", error);
    return false;
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