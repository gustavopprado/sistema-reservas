const nodemailer = require('nodemailer');
const config = require('./config');

// Remetentes montados a partir da configuração — ver api/.env.example.
const FROM_ROOMS = `"${config.mail.fromNameRooms}" <${config.mail.user}>`;
const FROM_FLEET = `"${config.mail.fromNameFleet}" <${config.mail.user}>`;

async function createTransporter() {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.mail.user,
      pass: config.mail.appPassword
    },
  });

  return { transporter };
}

// E-mail de confirmação enviado APENAS ao organizador da reserva.
// O convite que adiciona o evento na agenda dos convidados é enviado
// automaticamente pelo Google (via Google Calendar API), não aqui.
async function sendBookingConfirmationEmail(bookingData) {
  const { transporter } = await createTransporter();

  const displayTitle = bookingData.title || 'Reunião';
  const dataFmt = bookingData.date.split('-').reverse().join('/');

  // Uma reserva pode cobrir vários dias no mesmo horário. Nesse caso vai um
  // único e-mail listando todos os dias, em vez de um e-mail por dia.
  const datas = Array.isArray(bookingData.datas) && bookingData.datas.length > 0
    ? bookingData.datas
    : [bookingData.date];

  const ehSerie = datas.length > 1;

  const convidados = Array.isArray(bookingData.convidados) && bookingData.convidados.length > 0
    ? bookingData.convidados.join(', ')
    : 'Nenhum';

  const blocoDatas = ehSerie
    ? `<p style="margin-bottom:4px;"><strong>Dias reservados (${datas.length}):</strong></p>
       <ul style="margin:0 0 12px 0; padding-left:20px; color:#334155;">
         ${datas.map((d) => `<li>${d.split('-').reverse().join('/')}</li>`).join('')}
       </ul>`
    : `<p><strong>Data:</strong> ${dataFmt}</p>`;

  const notasBloco = bookingData.notes && bookingData.notes.trim().length > 0
    ? `<p style="margin-bottom:4px;"><strong>Anotações / Pauta:</strong></p>
       <p style="white-space: pre-wrap; background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:6px; color:#334155;">${bookingData.notes}</p>`
    : '';

  // Na sala restrita, quem reserva não é quem vai usar a sala. O solicitante
  // recebe a mesma confirmação, e o e-mail deixa claro quem reservou por ele.
  const solicitante = (bookingData.solicitanteEmail || '').trim();

  const destinatarios = solicitante
    ? [bookingData.userEmail, solicitante].join(', ')
    : bookingData.userEmail;

  const blocoResponsavel = solicitante
    ? `<p><strong>Responsável pela sala:</strong> ${solicitante}</p>
       <p style="font-size:12px; color:#666;">Reserva feita por ${bookingData.userEmail} a pedido de ${solicitante}.</p>`
    : '';

  const linkBloco = bookingData.googleEventLink
    ? `<p style="margin-top:16px;"><a href="${bookingData.googleEventLink}" style="background-color:#2563eb; color:white; padding:10px 20px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">Ver na Google Agenda</a></p>`
    : '';

  try {
    await transporter.sendMail({
      from: FROM_ROOMS,
      to: destinatarios,
      subject: ehSerie
        ? `Reserva confirmada: ${displayTitle} - ${datas.length} dias a partir de ${dataFmt}`
        : `Reserva confirmada: ${displayTitle} - ${dataFmt} às ${bookingData.startTime}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
          <h2 style="color: #2563eb;">Reserva confirmada</h2>
          <p>Sua reserva foi criada com sucesso. Os convidados foram notificados pela Google Agenda e o evento já aparece na agenda deles${ehSerie ? ' — um convite para cada dia' : ''}.</p>
          <p><strong>Título:</strong> ${displayTitle}</p>
          <p><strong>Sala:</strong> ${bookingData.roomName}</p>
          ${blocoResponsavel}
          ${blocoDatas}
          <p><strong>Horário:</strong> ${bookingData.startTime} - ${bookingData.endTime}${ehSerie ? ' (em todos os dias)' : ''}</p>
          <p><strong>Convidados:</strong> ${convidados}</p>
          ${notasBloco}
          ${linkBloco}
        </div>
      `
    });
    console.log("📨 E-mail de confirmação enviado ao organizador.");
  } catch (error) {
    console.error("❌ Erro ao enviar confirmação ao organizador:", error);
  }
}

// --- EMAILS DE VEÍCULOS ---
const EMAIL_SUPRIMENTOS = config.mail.suprimentos;
const URL_SISTEMA = config.appUrl;

const sendCarReservationEmail = async (reserva) => {
  const { transporter } = await createTransporter();
  const idTag = reserva.bookingCode ? `<p style="font-size:12px; color:#888;"><b>ID da Reserva:</b> <code>${reserva.bookingCode}</code></p>` : '';

  // 1. Email para o funcionário
  await transporter.sendMail({
    from: FROM_FLEET,
    to: reserva.userEmail,
    subject: `🚗 Reserva Confirmada: ${reserva.carModel || reserva.carModelo}${reserva.bookingCode ? ' [' + reserva.bookingCode + ']' : ''}`,
    html: `
      <h2>Sua reserva foi confirmada!</h2>
      ${idTag}
      <p>Veículo: <b>${reserva.carModel || reserva.carModelo}</b></p>
      <p><b>Retirada:</b> ${reserva.startDate.split('-').reverse().join('/')} às ${reserva.startTime}</p>
      <p><b>Devolução:</b> ${reserva.endDate.split('-').reverse().join('/')} às ${reserva.endTime}</p>
      <p><b>Destino:</b> ${reserva.destino}</p>
      <p>Lembre-se de registrar a devolução no sistema ao terminar a viagem.</p>
    `
  });

  // 2. Email para Suprimentos
  await transporter.sendMail({
    from: FROM_FLEET,
    to: EMAIL_SUPRIMENTOS,
    subject: `NOVA RESERVA - Veículo: ${reserva.carModel || reserva.carModelo}${reserva.bookingCode ? ' [' + reserva.bookingCode + ']' : ''}`,
    html: `
      <h2>Nova Reserva de Frota</h2>
      ${idTag}
      <p>O colaborador <b>${reserva.userEmail}</b> reservou um veículo.</p>
      <p><b>Veículo:</b> ${reserva.carModel || reserva.carModelo}</p>
      <p><b>Período:</b> ${reserva.startDate.split('-').reverse().join('/')} (${reserva.startTime}) até ${reserva.endDate.split('-').reverse().join('/')} (${reserva.endTime})</p>
      <p><b>Destino:</b> ${reserva.destino}</p>
    `
  });
};

const sendCarReturnEmail = async (reserva) => {
  const { transporter } = await createTransporter();
  const idTag = reserva.bookingCode ? `<p style="font-size:12px; color:#888;"><b>ID da Reserva:</b> <code>${reserva.bookingCode}</code></p>` : '';

  // 1. Email para o funcionário
  await transporter.sendMail({
    from: FROM_FLEET,
    to: reserva.userEmail,
    subject: `✅ Devolução Registrada: ${reserva.carModelo || reserva.carModel}${reserva.bookingCode ? ' [' + reserva.bookingCode + ']' : ''}`,
    html: `
      <h2>Veículo Devolvido com Sucesso</h2>
      ${idTag}
      <p>A devolução do veículo <b>${reserva.carModelo || reserva.carModel}</b> foi registrada no sistema.</p>
      <p><b>KM Final:</b> ${reserva.kmRetorno}</p>
      <p><b>Nível do Tanque:</b> ${reserva.nivelTanque}</p>
      <p>Obrigado por utilizar a frota corporativa!</p>
    `
  });

  // 2. Email para Suprimentos
  await transporter.sendMail({
    from: FROM_FLEET,
    to: EMAIL_SUPRIMENTOS,
    subject: `VEÍCULO DEVOLVIDO - ${reserva.carModelo || reserva.carModel}${reserva.bookingCode ? ' [' + reserva.bookingCode + ']' : ''}`,
    html: `
      <h2>Registro de Devolução</h2>
      ${idTag}
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
    from: FROM_FLEET,
    to: reserva.userEmail,
    subject: `⚠️ Lembrete: Devolução do Veículo ${reserva.carModel || reserva.carModelo}`,
    html: `
      <h2>O período da sua viagem está acabando!</h2>
      <p>Sua reserva do veículo <b>${reserva.carModel || reserva.carModelo}</b> está prevista para encerrar em breve (${reserva.endDate.split('-').reverse().join('/')} às ${reserva.endTime}).</p>
      <p>Não se esqueça de acessar o sistema e realizar a devolução oficial (informando a KM e o combustível).</p>
      <br>
      <a href="${URL_SISTEMA}" style="background-color: #0c6192; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Acessar Sistema para Devolver</a>
    `
  });
};

const sendCarOverdueReminderEmail = async (reserva) => {
  const { transporter } = await createTransporter();

  const carName = reserva.carModel || reserva.carModelo;
  const previsaoDevolucao = `${reserva.endDate.split('-').reverse().join('/')} às ${reserva.endTime}`;

  await transporter.sendMail({
    from: FROM_FLEET,
    to: reserva.userEmail,
    subject: `⏰ Devolução Pendente: ${carName} — prazo encerrado`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
        <div style="background-color: #dc2626; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #fff; margin: 0; font-size: 20px;">⏰ Devolução do Veículo Pendente</h2>
        </div>
        <div style="background-color: #fff5f5; border: 1px solid #fecaca; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          <p style="margin: 0 0 12px; font-size: 15px;">
            Olá! O prazo de devolução do veículo <strong>${carName}</strong> já encerrou
            (<strong>${previsaoDevolucao}</strong>) e a devolução ainda não foi registrada no sistema.
          </p>
          <p style="margin: 0 0 20px; font-size: 14px; color: #555;">
            Por favor, acesse o sistema o quanto antes e registre a devolução informando
            a quilometragem e o nível do combustível.
          </p>
          <a href="${URL_SISTEMA}"
             style="background-color: #0c6192; color: white; padding: 12px 28px;
                    text-decoration: none; border-radius: 6px; font-weight: bold;
                    display: inline-block; font-size: 15px;">
            Acessar Sistema e Registrar Devolução
          </a>
          <p style="margin: 24px 0 0; font-size: 12px; color: #999;">
            Este lembrete é enviado automaticamente a cada hora enquanto a devolução
            não for registrada. Em caso de dúvidas, entre em contato com o setor de Suprimentos.
          </p>
        </div>
      </div>
    `
  });
};

const sendCarRegularizacaoEmail = async (reserva) => {
  const { transporter } = await createTransporter();

  const carName = reserva.carModel || reserva.carModelo;
  const periodo = `${reserva.startDate.split('-').reverse().join('/')} às ${reserva.startTime} → ${reserva.endDate.split('-').reverse().join('/')} às ${reserva.endTime}`;
  const idLine = reserva.bookingCode ? `<p style="margin: 0 0 12px;"><strong>ID da Reserva:</strong> <code>${reserva.bookingCode}</code></p>` : '';

  // 1. Email para Suprimentos
  await transporter.sendMail({
    from: FROM_FLEET,
    to: EMAIL_SUPRIMENTOS,
    subject: `📋 REGULARIZAÇÃO DE RESERVA - ${carName}${reserva.bookingCode ? ' [' + reserva.bookingCode + ']' : ''}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
        <div style="background-color: #d97706; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #fff; margin: 0; font-size: 20px;">⚠️ Registro Retroativo de Uso de Veículo</h2>
        </div>
        <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          ${idLine}
          <p style="margin: 0 0 12px;"><strong>Colaborador:</strong> ${reserva.userEmail}</p>
          <p style="margin: 0 0 12px;"><strong>Veículo:</strong> ${carName}</p>
          <p style="margin: 0 0 12px;"><strong>Período:</strong> ${periodo}</p>
          <p style="margin: 0 0 12px;"><strong>Destino:</strong> ${reserva.destino || 'Não informado'}</p>
          <p style="margin: 0 0 12px;"><strong>Registrado por:</strong> ${reserva.registradoPor || 'Não informado'}</p>
          <hr style="border: none; border-top: 1px solid #fde68a; margin: 16px 0;"/>
          <p style="font-size: 12px; color: #92400e; margin: 0;">Este registro foi lançado retroativamente pelo setor de Suprimentos.</p>
        </div>
      </div>
    `
  });

  // 2. Email para o colaborador
  await transporter.sendMail({
    from: FROM_FLEET,
    to: reserva.userEmail,
    subject: `📋 Registro Regularizado: ${carName}${reserva.bookingCode ? ' [' + reserva.bookingCode + ']' : ''}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
        <h2 style="color: #d97706;">Uso de Veículo Regularizado</h2>
        ${idLine}
        <p>Seu uso do veículo <strong>${carName}</strong> no período <strong>${periodo}</strong> foi regularizado no sistema pelo setor de Suprimentos.</p>
        <p style="font-size: 12px; color: #666;">Em caso de dúvidas, entre em contato com o setor de Suprimentos.</p>
      </div>
    `
  });
};

module.exports = { sendBookingConfirmationEmail, sendCarReservationEmail, sendCarReturnEmail, sendCarReminderEmail, sendCarOverdueReminderEmail, sendCarRegularizacaoEmail };