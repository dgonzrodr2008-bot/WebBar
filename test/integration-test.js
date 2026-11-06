/**
 * test/integration-test.js - Prueba de integración completa del sistema
 */
const http = require('node:http');
const server = require('../server.js');
const { db } = require('../src/db.js');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          json
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- INICIANDO SUITE DE PRUEBAS AUTOMATIZADAS ---');
  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      testsPassed++;
    } else {
      console.error(`  ✕ FALLÓ: ${message}`);
      testsFailed++;
    }
  }

  // Esperar un momento a que el server esté listo
  await new Promise(r => setTimeout(r, 500));

  const PORT = server.address() ? server.address().port : 3000;
  console.log(`Conectando al servidor en puerto ${PORT}...`);

  try {
    // 1. Web pública (HTML)
    const homeRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/',
      method: 'GET'
    });
    assert(homeRes.statusCode === 200, 'GET / devuelve código 200');
    assert(homeRes.body.includes('Restaurante Tarca Luis'), 'GET / contiene el título del restaurante');
    assert(homeRes.body.includes('Reservar Mesa'), 'GET / contiene el botón de reserva');

    // 2. API Info del restaurante
    const infoRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/info',
      method: 'GET'
    });
    assert(infoRes.statusCode === 200, 'GET /api/info devuelve código 200');
    assert(infoRes.json.restaurant.restaurant_name === 'Restaurante Tarca Luis', 'Nombre de restaurante correcto en DB');
    assert(infoRes.json.schedules.length === 7, '7 días de horarios semanales cargados');

    // 3. API Menú y Platos
    const menuRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/menu',
      method: 'GET'
    });
    assert(menuRes.statusCode === 200, 'GET /api/menu devuelve código 200');
    assert(menuRes.json.categories.length >= 5, 'Categorías de carta disponibles');
    assert(menuRes.json.allDishes.length >= 15, 'Platos canarios cargados en la carta');

    // 4. API Galería de Fotos
    const galRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/gallery',
      method: 'GET'
    });
    assert(galRes.statusCode === 200, 'GET /api/gallery devuelve código 200');
    assert(galRes.json.photos.length >= 8, 'Imágenes de galería cargadas');

    // 5. Captcha anti-spam
    const captchaRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/captcha',
      method: 'GET'
    });
    assert(captchaRes.statusCode === 200, 'GET /api/captcha genera reto');
    assert(captchaRes.json.token && captchaRes.json.question, 'Token y pregunta matemática anti-spam generados');

    // Resolver captcha
    const decoded = Buffer.from(captchaRes.json.token, 'base64').toString('utf8');
    const answer = decoded.split(':')[0];

    // 6. Disponibilidad de reservas
    const tomorrow = new Date(Date.now() + 86400000);
    // Si mañana es lunes (día cerrado), sumamos otro día
    if (tomorrow.getDay() === 1) {
      tomorrow.setDate(tomorrow.getDate() + 1);
    }
    const testDate = tomorrow.toISOString().split('T')[0];

    const availRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: `/api/reservations/availability?date=${testDate}&party_size=2`,
      method: 'GET'
    });
    assert(availRes.statusCode === 200, 'GET /api/reservations/availability responde 200');
    assert(availRes.json.available === true, 'Hay turnos y mesas disponibles para la fecha de prueba');

    const testTime = availRes.json.shifts.lunch.slots[0] || '14:00';

    // 7. Crear una reserva online
    const createRes = await makeRequest(
      {
        hostname: 'localhost',
        port: PORT,
        path: '/api/reservations',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        name: 'Prueba Automatizada',
        phone: '+34 622 999 888',
        email: 'test.reserva@tarcaluis.es',
        date: testDate,
        time: testTime,
        party_size: 2,
        notes: 'Mesa de prueba del sistema',
        captcha_token: captchaRes.json.token,
        captcha_answer: answer
      }
    );
    assert(createRes.statusCode === 201, 'POST /api/reservations crea reserva con éxito (201)');
    assert(createRes.json.reservation.code.startsWith('TL-'), 'Código de reserva único generado');
    const cancelToken = createRes.json.reservation.cancel_token;

    // 8. Consultar cancelación por token
    const cancelInfoRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: `/api/reservations/cancel-info?token=${cancelToken}`,
      method: 'GET'
    });
    assert(cancelInfoRes.statusCode === 200, 'GET /api/reservations/cancel-info recupera reserva');
    assert(cancelInfoRes.json.reservation.customer_name === 'Prueba Automatizada', 'Datos correctos en consulta de cancelación');

    // 9. Cancelar la reserva
    const doCancelRes = await makeRequest(
      {
        hostname: 'localhost',
        port: PORT,
        path: '/api/reservations/cancel',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { token: cancelToken, reason: 'Prueba de cancelación automática' }
    );
    assert(doCancelRes.statusCode === 200, 'POST /api/reservations/cancel cancela la reserva');
    assert(doCancelRes.json.success === true, 'Reserva marcada como cancelada y mesa liberada');

    // 10. Login de Administrador
    const loginRes = await makeRequest(
      {
        hostname: 'localhost',
        port: PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { username: 'admin', password: 'admin1234' }
    );
    assert(loginRes.statusCode === 200, 'POST /api/auth/login con credenciales por defecto');
    assert(loginRes.json.token, 'Token de sesión de administrador devuelto');
    const sessionToken = loginRes.json.token;

    // 11. Dashboard Admin con sesión autenticada
    const dashRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/admin/dashboard',
      method: 'GET',
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    assert(dashRes.statusCode === 200, 'GET /api/admin/dashboard protegido responde 200');
    assert(dashRes.json.stats.totalTables >= 10, 'Estadísticas de mesas activas devueltas');

    // 12. Listar Mesas Admin
    const tablesRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/admin/tables',
      method: 'GET',
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    assert(tablesRes.statusCode === 200, 'GET /api/admin/tables responde 200');
    assert(tablesRes.json.tables.length >= 10, 'Listado de mesas devuelto correctamente');

    console.log('------------------------------------------------');
    console.log(`TOTAL PRUEBAS: ${testsPassed + testsFailed} | PASADAS: ${testsPassed} | FALLIDAS: ${testsFailed}`);
    console.log('------------------------------------------------');

    if (testsFailed === 0) {
      console.log('🎉 ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!');
    }
  } catch (err) {
    console.error('Error durante la ejecución de pruebas:', err);
  } finally {
    process.exit(testsFailed === 0 ? 0 : 1);
  }
}

runTests();
