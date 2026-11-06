/**
 * src/smtp-client.js - Cliente SMTP nativo para Node.js (Sin dependencias externas)
 * Compatible con Gmail, Outlook, Brevo, SendGrid, Mailgun y servidores SMTP estándar.
 */
const tls = require('node:tls');
const net = require('node:net');

function sendSmtpMail({ host, port = 465, secure = true, user, pass, from, to, subject, text, html }) {
  return new Promise((resolve, reject) => {
    if (!host || !user || !pass) {
      return reject(new Error('Faltan datos de configuración SMTP (servidor, usuario o contraseña).'));
    }

    port = parseInt(port, 10) || (secure ? 465 : 587);
    const isDirectTls = secure || port === 465;

    let socket;
    let buffer = '';
    let currentStep = 0;
    let timer = null;

    function cleanup() {
      if (timer) clearTimeout(timer);
      if (socket && !socket.destroyed) {
        try { socket.end(); } catch (e) {}
      }
    }

    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Tiempo de espera agotado al conectar al servidor SMTP (${host}:${port}).`));
    }, 12000);

    function sendCommand(cmd) {
      socket.write(cmd + '\r\n');
    }

    function onConnect() {
      // Esperar banner 220
    }

    function processResponse(code, line) {
      // Pasos del protocolo SMTP
      switch (currentStep) {
        case 0: // Banner de bienvenida (220)
          if (code === 220) {
            currentStep = 1;
            sendCommand(`EHLO localhost`);
          } else {
            cleanup();
            reject(new Error(`Respuesta inicial no válida del servidor SMTP: ${line}`));
          }
          break;

        case 1: // Respuesta a EHLO (250)
          if (code === 250) {
            currentStep = 2;
            sendCommand('AUTH LOGIN');
          }
          break;

        case 2: // Servidor pide usuario (334)
          if (code === 334) {
            currentStep = 3;
            sendCommand(Buffer.from(user).toString('base64'));
          } else {
            cleanup();
            reject(new Error(`El servidor SMTP no aceptó AUTH LOGIN: ${line}`));
          }
          break;

        case 3: // Servidor pide contraseña (334)
          if (code === 334) {
            currentStep = 4;
            // Eliminar espacios por si el usuario copió la contraseña de aplicación de Google con espacios
            const cleanPass = pass.replace(/\s+/g, '');
            sendCommand(Buffer.from(cleanPass).toString('base64'));
          }
          break;

        case 4: // Autenticación exitosa (235)
          if (code === 235) {
            currentStep = 5;
            const fromEmail = from.includes('<') ? from.match(/<([^>]+)>/)[1] : from;
            sendCommand(`MAIL FROM:<${fromEmail}>`);
          } else {
            cleanup();
            reject(new Error(`Autenticación SMTP fallida (usuario o contraseña incorrectos): ${line}`));
          }
          break;

        case 5: // MAIL FROM aceptado (250)
          if (code === 250) {
            currentStep = 6;
            const toEmail = to.includes('<') ? to.match(/<([^>]+)>/)[1] : to;
            sendCommand(`RCPT TO:<${toEmail}>`);
          } else {
            cleanup();
            reject(new Error(`Servidor rechazó el remitente MAIL FROM: ${line}`));
          }
          break;

        case 6: // RCPT TO aceptado (250)
          if (code === 250) {
            currentStep = 7;
            sendCommand('DATA');
          } else {
            cleanup();
            reject(new Error(`Servidor rechazó el destinatario RCPT TO: ${line}`));
          }
          break;

        case 7: // Servidor listo para datos (354)
          if (code === 354) {
            currentStep = 8;
            const boundary = '----=_Part_' + Date.now().toString(16);
            const dateStr = new Date().toUTCString();

            // Codificar subject en UTF-8 si contiene acentos
            const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;

            let emailData = `From: ${from}\r\n`;
            emailData += `To: ${to}\r\n`;
            emailData += `Subject: ${encodedSubject}\r\n`;
            emailData += `Date: ${dateStr}\r\n`;
            emailData += `MIME-Version: 1.0\r\n`;
            emailData += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;

            // Versión texto plano
            if (text) {
              emailData += `--${boundary}\r\n`;
              emailData += `Content-Type: text/plain; charset=UTF-8\r\n`;
              emailData += `Content-Transfer-Encoding: base64\r\n\r\n`;
              emailData += Buffer.from(text).toString('base64') + '\r\n\r\n';
            }

            // Versión HTML enriquecida
            if (html) {
              emailData += `--${boundary}\r\n`;
              emailData += `Content-Type: text/html; charset=UTF-8\r\n`;
              emailData += `Content-Transfer-Encoding: base64\r\n\r\n`;
              emailData += Buffer.from(html).toString('base64') + '\r\n\r\n';
            }

            emailData += `--${boundary}--\r\n.\r\n`;

            socket.write(emailData);
          }
          break;

        case 8: // Mensaje aceptado para entrega (250)
          if (code === 250) {
            currentStep = 9;
            sendCommand('QUIT');
            cleanup();
            resolve({ success: true, message: 'Correo enviado satisfactoriamente al servidor SMTP.' });
          } else {
            cleanup();
            reject(new Error(`Error enviando datos del correo: ${line}`));
          }
          break;
      }
    }

    try {
      if (isDirectTls) {
        socket = tls.connect({ host, port, minVersion: 'TLSv1.2' }, onConnect);
      } else {
        socket = net.connect({ host, port }, onConnect);
      }

      socket.setEncoding('utf8');

      socket.on('data', data => {
        buffer += data;
        const lines = buffer.split('\r\n');
        buffer = lines.pop(); // Mantener el último segmento incompleto

        for (const line of lines) {
          if (!line) continue;
          // Códigos de 3 dígitos (ej: "220 mx.google.com ...")
          const match = line.match(/^(\d{3})([ -])(.*)$/);
          if (match) {
            const code = parseInt(match[1], 10);
            const isLastLine = match[2] === ' ';
            if (isLastLine) {
              processResponse(code, line);
            }
          }
        }
      });

      socket.on('error', err => {
        cleanup();
        reject(err);
      });
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

module.exports = {
  sendSmtpMail
};
