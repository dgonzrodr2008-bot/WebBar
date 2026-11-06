/**
 * src/routes/public-routes.js - Rutas y API pública para la web de clientes
 */
const crypto = require('node:crypto');
const { db } = require('../db.js');
const reservationEngine = require('../reservation-engine.js');

// Secreto para firmar tokens anti-spam (cambia al iniciar el servidor)
const CAPTCHA_SECRET = crypto.randomBytes(16).toString('hex');

// Generador de retos anti-spam sencillos e intuitivos
function generateCaptcha() {
  const num1 = Math.floor(Math.random() * 8) + 2; // 2 a 9
  const num2 = Math.floor(Math.random() * 8) + 1; // 1 a 8
  const operations = ['+', '-'];
  const op = operations[Math.floor(Math.random() * operations.length)];

  let answer = 0;
  let question = '';

  if (op === '+') {
    answer = num1 + num2;
    question = `¿Cuánto es ${num1} + ${num2}?`;
  } else {
    // Para no dar negativo
    const mayor = Math.max(num1, num2);
    const menor = Math.min(num1, num2);
    answer = mayor - menor;
    question = `¿Cuánto es ${mayor} - ${menor}?`;
  }

  // Token firmado que contiene la respuesta y caducidad (15 min)
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const payload = `${answer}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', CAPTCHA_SECRET).update(payload).digest('hex');
  const token = Buffer.from(`${payload}:${hmac}`).toString('base64');

  return { question, token };
}

function verifyCaptcha(token, userAnswer) {
  try {
    if (!token || userAnswer === undefined || userAnswer === null) return false;
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [expectedAnswer, expiresAt, hmac] = decoded.split(':');

    // Comprobar caducidad
    if (Date.now() > parseInt(expiresAt, 10)) return false;

    // Comprobar firma
    const payload = `${expectedAnswer}:${expiresAt}`;
    const expectedHmac = crypto.createHmac('sha256', CAPTCHA_SECRET).update(payload).digest('hex');
    if (hmac !== expectedHmac) return false;

    // Comprobar respuesta del usuario
    return parseInt(userAnswer, 10) === parseInt(expectedAnswer, 10);
  } catch (err) {
    return false;
  }
}

// Handlers de la API pública
async function handlePublicApi(req, res, url, body) {
  const pathname = url.pathname;
  const method = req.method;

  // 1. Información general y datos del restaurante
  if (pathname === '/api/info' && method === 'GET') {
    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(row => (settings[row.key] = row.value));

    // Obtener horarios semanales y días cerrados
    const schedules = db.prepare('SELECT * FROM schedules ORDER BY day_of_week ASC').all();
    const closedDates = db.prepare("SELECT date, reason FROM closed_dates WHERE date >= date('now', 'localtime') ORDER BY date ASC").all();

    // Determinar si hoy está abierto en este momento
    const now = new Date();
    const todayDay = now.getDay();
    const todaySchedule = schedules.find(s => s.day_of_week === todayDay);

    return {
      status: 200,
      data: {
        restaurant: settings,
        schedules,
        closedDates,
        todaySchedule
      }
    };
  }

  // 2. Carta completa con categorías y platos
  if (pathname === '/api/menu' && method === 'GET') {
    const categories = db.prepare('SELECT * FROM menu_categories WHERE is_active = 1 ORDER BY display_order ASC').all();
    const dishes = db.prepare('SELECT * FROM dishes WHERE is_available = 1 ORDER BY display_order ASC').all();

    // Agrupar platos por categoría
    const menu = categories.map(cat => ({
      ...cat,
      dishes: dishes.filter(d => d.category_id === cat.id)
    }));

    return { status: 200, data: { menu, categories, allDishes: dishes } };
  }

  // 3. Galería de fotos
  if (pathname === '/api/gallery' && method === 'GET') {
    const photos = db.prepare('SELECT * FROM gallery ORDER BY display_order ASC, id DESC').all();
    return { status: 200, data: { photos } };
  }

  // 4. Reto anti-spam para el formulario de reservas
  if (pathname === '/api/captcha' && method === 'GET') {
    const captcha = generateCaptcha();
    return { status: 200, data: captcha };
  }

  // 5. Consulta de disponibilidad de horas para una fecha y comensales
  if (pathname === '/api/reservations/availability' && method === 'GET') {
    const date = url.searchParams.get('date');
    const partySize = url.searchParams.get('party_size');

    if (!date || !partySize) {
      return {
        status: 400,
        data: { error: 'Los parámetros "date" (YYYY-MM-DD) y "party_size" son obligatorios.' }
      };
    }

    const availability = reservationEngine.getAvailableSlots(date, partySize);
    return { status: 200, data: availability };
  }

  // 6. Enviar una nueva reserva
  if (pathname === '/api/reservations' && method === 'POST') {
    // 6.1 Protección contra robots (Honeypot)
    if (body.website_trap || body.hp_field) {
      // Si el campo invisible fue rellenado, es un bot: simular éxito silenciosamente
      return { status: 200, data: { success: true, message: 'Reserva procesada.' } };
    }

    // 6.2 Validar Captcha anti-spam
    if (!verifyCaptcha(body.captcha_token, body.captcha_answer)) {
      return {
        status: 400,
        data: { error: 'Respuesta al control de seguridad incorrecta. Por favor inténtalo de nuevo.' }
      };
    }

    // 6.3 Construir URL base del servidor
    const host = req.headers['host'] || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const baseUrl = `${protocol}://${host}`;

    try {
      const reservation = await reservationEngine.createReservation({
        date: body.date,
        time: body.time,
        partySize: body.party_size,
        name: body.name,
        email: body.email,
        phone: body.phone,
        notes: body.notes,
        source: 'web',
        status: 'confirmada',
        baseUrl
      });

      return {
        status: 201,
        data: {
          success: true,
          message: '¡Tu mesa ha sido reservada con éxito!',
          reservation: {
            code: reservation.code,
            customer_name: reservation.customer_name,
            customer_email: reservation.customer_email,
            reservation_date: reservation.reservation_date,
            reservation_time: reservation.reservation_time,
            party_size: reservation.party_size,
            table_name: reservation.table_name,
            table_zone: reservation.table_zone,
            notes: reservation.notes,
            cancel_token: reservation.cancel_token
          }
        }
      };
    } catch (err) {
      return {
        status: 400,
        data: { error: err.message || 'Error al procesar la reserva.' }
      };
    }
  }

  // 7. Consultar datos de una reserva antes de cancelar mediante token
  if (pathname === '/api/reservations/cancel-info' && method === 'GET') {
    const token = url.searchParams.get('token');
    if (!token) {
      return { status: 400, data: { error: 'Falta el token de reserva.' } };
    }

    const reservation = db
      .prepare(`
        SELECT r.code, r.customer_name, r.reservation_date, r.reservation_time, r.party_size, r.status, t.name as table_name
        FROM reservations r
        LEFT JOIN restaurant_tables t ON r.table_id = t.id
        WHERE r.cancel_token = ?
      `)
      .get(token);

    if (!reservation) {
      return { status: 404, data: { error: 'No existe ninguna reserva con este enlace de cancelación.' } };
    }

    return { status: 200, data: { reservation } };
  }

  // 8. Confirmar la cancelación de una reserva
  if (pathname === '/api/reservations/cancel' && method === 'POST') {
    const token = body.token;
    const reason = body.reason || 'Cancelada online por el cliente';

    const result = await reservationEngine.cancelReservationByToken(token, reason);
    return {
      status: result.success ? 200 : 400,
      data: result
    };
  }

  return null; // Ruta no pública o no encontrada
}

module.exports = {
  handlePublicApi
};
