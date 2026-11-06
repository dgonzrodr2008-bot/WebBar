/**
 * src/email-service.js - Sistema de plantillas y envío/registro de notificaciones por email
 */
const { db } = require('./db.js');
const { sendSmtpMail } = require('./smtp-client.js');

// Obtener valor de configuración de settings
function getSetting(key, defaultValue = '') {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  } catch (err) {
    return defaultValue;
  }
}

// Reemplazar variables en plantillas
function interpolateTemplate(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, value ?? '');
  }
  return result;
}

// Plantilla HTML visual profesional para el cliente
function generateHtmlEmail({ title, subtitle, details, ctaUrl, ctaText, footerText }) {
  const restName = getSetting('restaurant_name', 'Restaurante Tarca Luis');
  const restAddress = getSetting('restaurant_address', 'Calle Real 14, Los Llanos de Aridane, La Palma');
  const restPhone = getSetting('restaurant_phone', '+34 922 40 12 34');

  let detailsHtml = '';
  if (details && Array.isArray(details)) {
    detailsHtml = details
      .map(
        d => `
        <tr>
          <td style="padding: 8px 12px; color: #666; font-size: 14px; border-bottom: 1px solid #f0e6dc; width: 35%; font-weight: 600;">${d.label}:</td>
          <td style="padding: 8px 12px; color: #222; font-size: 15px; border-bottom: 1px solid #f0e6dc; font-weight: bold;">${d.value}</td>
        </tr>`
      )
      .join('');
  }

  const ctaButtonHtml = ctaUrl
    ? `
      <div style="text-align: center; margin: 30px 0 20px;">
        <a href="${ctaUrl}" style="background-color: #c85a32; color: #ffffff; padding: 13px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block; letter-spacing: 0.5px;">${ctaText || 'Ver Detalles'}</a>
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f3ee; margin: 0; padding: 25px 15px; color: #2d2a26;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e8dfd5;">
    <!-- Encabezado con imagen/estilo canario -->
    <tr>
      <td style="background: linear-gradient(135deg, #231f20 0%, #3a2e2b 100%); padding: 32px 25px; text-align: center; border-bottom: 4px solid #c85a32;">
        <h1 style="color: #faf7f2; margin: 0 0 6px; font-size: 26px; letter-spacing: 1px; font-family: Georgia, serif;">${restName}</h1>
        <p style="color: #e5a84b; margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">Cocina Canaria & Brasas • La Palma</p>
      </td>
    </tr>
    <!-- Contenido -->
    <tr>
      <td style="padding: 30px 25px;">
        <h2 style="color: #c85a32; margin: 0 0 10px; font-size: 20px;">${title}</h2>
        <p style="color: #4a453e; font-size: 15px; line-height: 1.6; margin: 0 0 22px;">${subtitle}</p>
        
        <!-- Tabla con detalles de la reserva -->
        ${
          detailsHtml
            ? `
          <table width="100%" cellspacing="0" cellpadding="0" style="background-color: #faf7f2; border-radius: 8px; border: 1px solid #ede3d7; margin-bottom: 22px;">
            ${detailsHtml}
          </table>
        `
            : ''
        }

        ${ctaButtonHtml}

        <p style="color: #7a7268; font-size: 13px; line-height: 1.5; margin: 25px 0 0; border-top: 1px dashed #dcd3c8; padding-top: 15px;">
          ${footerText || 'Si necesitas modificar tu reserva o tienes dudas, puedes llamarnos al ' + restPhone + '.'}
        </p>
      </td>
    </tr>
    <!-- Pie de página -->
    <tr>
      <td style="background-color: #f1ebe3; padding: 20px 25px; text-align: center; font-size: 12px; color: #887d72; border-top: 1px solid #e4dacd;">
        <strong style="color: #4a453e;">${restName}</strong><br>
        ${restAddress}<br>
        Teléfono: ${restPhone}<br>
        Islas Canarias, España
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Enviar correo real por SMTP o registrarlo localmente si aún no está configurado
async function dispatchEmail({ to, subject, text, html, emailType }) {
  const host = getSetting('smtp_host', process.env.SMTP_HOST || '');
  const port = getSetting('smtp_port', process.env.SMTP_PORT || '465');
  const user = getSetting('smtp_user', process.env.SMTP_USER || '');
  const pass = getSetting('smtp_pass', process.env.SMTP_PASS || '');
  const fromName = getSetting('restaurant_name', 'Restaurante Tarca Luis');
  const from = getSetting('smtp_from', user ? `"${fromName}" <${user}>` : `"${fromName}" <reservas@tarcaluis.es>`);

  let status = 'registrado_en_panel (falta configurar SMTP para envío real a Gmail)';
  let errorDetail = null;

  if (host && user && pass) {
    try {
      await sendSmtpMail({
        host,
        port: parseInt(port, 10),
        secure: String(port) === '465' || parseInt(port, 10) === 465,
        user,
        pass,
        from,
        to,
        subject,
        text,
        html
      });
      status = 'enviado_real_smtp';
      console.log(`[SMTP ÉXITO] Correo entregado correctamente a ${to} a través de ${host}`);
    } catch (err) {
      status = `error_smtp: ${err.message}`;
      errorDetail = err.message;
      console.error(`[SMTP ERROR] Falló la entrega a ${to}:`, err.message);
    }
  } else {
    console.log(`[AVISO CORREO] Correo a ${to} guardado en el historial de la base de datos.`);
    console.log(`  -> Para recibirlo en tu Gmail real, configura los datos SMTP en el Panel Admin -> Plantillas Email.`);
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO email_logs (recipient, subject, body, email_type, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(to, subject, text || html || '', emailType, status);
  } catch (err) {
    console.error('Error guardando log de email:', err);
  }

  return { success: !errorDetail, status, errorDetail };
}

// Enviar y registrar email de confirmación al cliente
async function sendReservationConfirmation(reservation, baseUrl = 'http://localhost:3000') {
  const restName = getSetting('restaurant_name', 'Restaurante Tarca Luis');
  const restPhone = getSetting('restaurant_phone', '+34 922 40 12 34');
  const restAddress = getSetting('restaurant_address', 'Calle Real 14, Los Llanos de Aridane, La Palma');

  const cancelUrl = `${baseUrl}/cancelar-reserva?token=${reservation.cancel_token}`;

  const defaultSubject = 'Confirmación de tu reserva en {restaurante_nombre} ({codigo})';
  const defaultBody = `¡Hola {nombre}!

Tu reserva para {personas} personas ha sido registrada correctamente.

Detalles de la reserva:
- Localizador: {codigo}
- Fecha: {fecha}
- Hora: {hora}
- Número de comensales: {personas}
- Observaciones: {notas}

Si necesitas cancelar tu reserva, puedes hacerlo fácilmente desde este enlace:
{enlace_cancelar}

¡Te esperamos en La Palma!`;

  const subjectTemplate = getSetting('email_confirm_subject', defaultSubject);
  const bodyTemplate = getSetting('email_confirm_body', defaultBody);

  const templateData = {
    nombre: reservation.customer_name,
    codigo: reservation.code,
    fecha: reservation.reservation_date,
    hora: reservation.reservation_time,
    personas: reservation.party_size,
    telefono: reservation.customer_phone,
    notas: reservation.notes || 'Ninguna',
    enlace_cancelar: cancelUrl,
    restaurante_nombre: restName,
    restaurante_telefono: restPhone,
    restaurante_direccion: restAddress
  };

  const subject = interpolateTemplate(subjectTemplate, templateData);
  const textBody = interpolateTemplate(bodyTemplate, templateData);

  const htmlBody = generateHtmlEmail({
    title: '¡Mesa reservada con éxito!',
    subtitle: `Hola <strong>${reservation.customer_name}</strong>, nos alegra confirmarte que tu mesa en <strong>${restName}</strong> está lista para recibirte.`,
    details: [
      { label: 'Localizador', value: reservation.code },
      { label: 'Fecha', value: reservation.reservation_date },
      { label: 'Hora', value: `${reservation.reservation_time} h` },
      { label: 'Comensales', value: `${reservation.party_size} persona(s)` },
      { label: 'Teléfono', value: reservation.customer_phone },
      { label: 'Peticiones / Alergias', value: reservation.notes || 'Sin observaciones' }
    ],
    ctaUrl: cancelUrl,
    ctaText: 'Cancelar o Gestionar Reserva',
    footerText: `Rogamos puntualidad (guardamos tu mesa hasta 15 minutos). Si no puedes asistir, por favor cancela tu reserva desde el botón superior o llámanos al ${restPhone}.`
  });

  // Enviar al cliente
  await dispatchEmail({
    to: reservation.customer_email,
    subject,
    text: textBody,
    html: htmlBody,
    emailType: 'confirmacion'
  });

  // Enviar aviso interno al restaurante
  await sendRestaurantAlert(reservation, 'nueva');

  return { success: true, cancelUrl, subject, textBody, htmlBody };
}

// Enviar aviso interno al restaurante cuando entra una reserva
async function sendRestaurantAlert(reservation, type = 'nueva') {
  const adminEmail = getSetting('admin_notification_email', 'reservas@tarcaluis.es');
  const restName = getSetting('restaurant_name', 'Restaurante Tarca Luis');

  const isNueva = type === 'nueva';
  const subject = isNueva
    ? `[Nueva Reserva] ${reservation.reservation_date} a las ${reservation.reservation_time} (${reservation.party_size}p) - ${reservation.customer_name}`
    : `[Reserva Cancelada] ${reservation.reservation_date} a las ${reservation.reservation_time} - ${reservation.customer_name}`;

  const body = `Notificación interna de ${restName}:

Tipo: ${isNueva ? 'NUEVA RESERVA' : 'CANCELACIÓN'}
Localizador: ${reservation.code}
Cliente: ${reservation.customer_name}
Teléfono: ${reservation.customer_phone}
Email: ${reservation.customer_email}
Fecha: ${reservation.reservation_date}
Hora: ${reservation.reservation_time}
Personas: ${reservation.party_size}
Notas: ${reservation.notes || 'Ninguna'}
Mesa asignada: ${reservation.table_name || 'Automática'}
  `;

  await dispatchEmail({
    to: adminEmail,
    subject,
    text: body,
    html: `<pre style="font-family:sans-serif; line-height:1.6; font-size:14px;">${body}</pre>`,
    emailType: 'aviso_restaurante'
  });
}

// Enviar email al cliente confirmando la cancelación
async function sendCancellationEmail(reservation) {
  const restName = getSetting('restaurant_name', 'Restaurante Tarca Luis');
  const restPhone = getSetting('restaurant_phone', '+34 922 40 12 34');

  const defaultSubject = 'Tu reserva en {restaurante_nombre} ha sido cancelada ({codigo})';
  const defaultBody = `Hola {nombre},

Te confirmamos que tu reserva con localizador {codigo} para el día {fecha} a las {hora} ha sido cancelada satisfactoriamente.

Esperamos poder recibirte en otra ocasión en {restaurante_nombre}.

Un cordial saludo,
El equipo de {restaurante_nombre}`;

  const subjectTemplate = getSetting('email_cancel_subject', defaultSubject);
  const bodyTemplate = getSetting('email_cancel_body', defaultBody);

  const templateData = {
    nombre: reservation.customer_name,
    codigo: reservation.code,
    fecha: reservation.reservation_date,
    hora: reservation.reservation_time,
    personas: reservation.party_size,
    restaurante_nombre: restName,
    restaurante_telefono: restPhone
  };

  const subject = interpolateTemplate(subjectTemplate, templateData);
  const textBody = interpolateTemplate(bodyTemplate, templateData);

  await dispatchEmail({
    to: reservation.customer_email,
    subject,
    text: textBody,
    html: `<div style="font-family:sans-serif; padding:20px; color:#333;"><p>${textBody.replace(/\n/g, '<br>')}</p></div>`,
    emailType: 'cancelacion'
  });

  // Avisar al restaurante de la cancelación
  await sendRestaurantAlert(reservation, 'cancelada');

  return { success: true, subject, textBody };
}

module.exports = {
  getSetting,
  interpolateTemplate,
  generateHtmlEmail,
  sendReservationConfirmation,
  sendCancellationEmail,
  sendRestaurantAlert
};
