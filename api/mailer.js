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
      from: '"Sistema de Reservas" <reservas@fgvtn.com.br>',
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
      from: '"Sistema de Reservas" <reservas@fgvtn.com.br>',
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
      from: '"Sistema de Reservas" <reservas@fgvtn.com.br>',
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

// --- EMAILS DE VEÍCULOS ---
const EMAIL_SUPRIMENTOS = 'suprimentos@fgvtn.com.br';
const URL_SISTEMA = 'http://10.40.125.2:5173'; // IP do seu sistema frontend

const sendCarReservationEmail = async (reserva) => {
  const { transporter } = await createTransporter(); // <--- MÁGICA ADICIONADA AQUI

  // 1. Email para o funcionário
  await transporter.sendMail({
    from: '"Sistema de Frotas FGV" <reservas@fgvtn.com.br>',
    to: reserva.userEmail,
    subject: `🚗 Reserva Confirmada: ${reserva.carModel || reserva.carModelo}`,
    html: `
      <h2>Sua reserva foi confirmada!</h2>
      <p>Veículo: <b>${reserva.carModel || reserva.carModelo}</b></p>
      <p><b>Retirada:</b> ${reserva.startDate} às ${reserva.startTime}</p>
      <p><b>Devolução:</b> ${reserva.endDate} às ${reserva.endTime}</p>
      <p><b>Destino:</b> ${reserva.destino}</p>
      <p>Lembre-se de registrar a devolução no sistema ao terminar a viagem.</p>
    `
  });

  // 2. Email para Suprimentos
  await transporter.sendMail({
    from: '"Sistema de Frotas FGV" <reservas@fgvtn.com.br>',
    to: EMAIL_SUPRIMENTOS,
    subject: `NOVA RESERVA - Veículo: ${reserva.carModel || reserva.carModelo}`,
    html: `
      <h2>Nova Reserva de Frota</h2>
      <p>O colaborador <b>${reserva.userEmail}</b> reservou um veículo.</p>
      <p><b>Veículo:</b> ${reserva.carModel || reserva.carModelo}</p>
      <p><b>Período:</b> ${reserva.startDate} (${reserva.startTime}) até ${reserva.endDate} (${reserva.endTime})</p>
      <p><b>Destino:</b> ${reserva.destino}</p>
    `
  });
};

const sendCarReturnEmail = async (reserva) => {
  const { transporter } = await createTransporter(); // <--- MÁGICA ADICIONADA AQUI

  // 1. Email para o funcionário
  await transporter.sendMail({
    from: '"Sistema de Frotas FGV" <reservas@fgvtn.com.br>',
    to: reserva.userEmail,
    subject: `✅ Devolução Registrada: ${reserva.carModelo || reserva.carModel}`,
    html: `
      <h2>Veículo Devolvido com Sucesso</h2>
      <p>A devolução do veículo <b>${reserva.carModelo || reserva.carModel}</b> foi registrada no sistema.</p>
      <p><b>KM Final:</b> ${reserva.kmRetorno}</p>
      <p><b>Nível do Tanque:</b> ${reserva.nivelTanque}</p>
      <p>Obrigado por utilizar a frota corporativa!</p>
    `
  });

  // 2. Email para Suprimentos
  await transporter.sendMail({
    from: '"Sistema de Frotas FGV" <reservas@fgvtn.com.br>',
    to: EMAIL_SUPRIMENTOS,
    subject: `VEÍCULO DEVOLVIDO - ${reserva.carModelo || reserva.carModel}`,
    html: `
      <h2>Registro de Devolução</h2>
      <p>O colaborador <b>${reserva.userEmail}</b> finalizou a viagem.</p>
      <p><b>Veículo:</b> ${reserva.carModelo || reserva.carModel}</p>
      <p><b>KM Retorno:</b> ${reserva.kmRetorno}</p>
      <p><b>Nível do Tanque:</b> ${reserva.nivelTanque}</p>
    `
  });
};

const sendCarReminderEmail = async (reserva) => {
  const { transporter } = await createTransporter(); // <--- MÁGICA ADICIONADA AQUI

  await transporter.sendMail({
    from: '"Sistema de Frotas FGV" <reservas@fgvtn.com.br>',
    to: reserva.userEmail,
    subject: `⚠️ Lembrete: Devolução do Veículo ${reserva.carModel || reserva.carModelo}`,
    html: `
      <h2>O período da sua viagem está acabando!</h2>
      <p>Sua reserva do veículo <b>${reserva.carModel || reserva.carModelo}</b> está prevista para encerrar em breve (${reserva.endDate} às ${reserva.endTime}).</p>
      <p>Não se esqueça de acessar o sistema e realizar a devolução oficial (informando a KM e o combustível).</p>
      <br>
      <a href="${URL_SISTEMA}" style="background-color: #0c6192; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Acessar Sistema para Devolver</a>
    `
  });
};

module.exports = { sendInviteEmail, sendCancellationEmail, sendUpdateEmail, sendCarReservationEmail, sendCarReturnEmail, sendCarReminderEmail };