/**
 * test/unit-test.js - Prueba unitaria y de lógica interna (Sin requerir socket de red)
 */
const { db } = require('../src/db.js');
const { hashPassword, verifyPassword, createSession, verifySession } = require('../src/auth.js');
const reservationEngine = require('../src/reservation-engine.js');
const { handlePublicApi } = require('../src/routes/public-routes.js');
const { handleAdminApi } = require('../src/routes/admin-routes.js');

async function runUnitTests() {
  console.log('--- INICIANDO VERIFICACIÓN INTERNA DE RESTAURANTE TARCA LUIS ---');
  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✓ ${msg}`);
      passed++;
    } else {
      console.error(`  ✕ ERROR: ${msg}`);
      failed++;
    }
  }

  // 1. Verificar tablas de la base de datos
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const tableNames = tables.map(t => t.name);
  assert(tableNames.includes('restaurant_tables'), 'Tabla restaurant_tables existe');
  assert(tableNames.includes('reservations'), 'Tabla reservations existe');
  assert(tableNames.includes('dishes'), 'Tabla dishes existe');
  assert(tableNames.includes('menu_categories'), 'Tabla menu_categories existe');
  assert(tableNames.includes('gallery'), 'Tabla gallery existe');
  assert(tableNames.includes('settings'), 'Tabla settings existe');
  assert(tableNames.includes('schedules'), 'Tabla schedules existe');
  assert(tableNames.includes('users'), 'Tabla users existe');

  // 2. Verificar datos de autenticación
  const adminUser = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
  assert(adminUser !== undefined, 'Usuario admin existe');
  assert(verifyPassword('admin1234', adminUser.password_hash, adminUser.salt), 'Contraseña admin1234 verificada correctamente');

  // Sesión
  const session = createSession(adminUser.id);
  assert(session.token.length >= 32, 'Token de sesión seguro generado');
  const verified = verifySession(session.token);
  assert(verified && verified.user_id === adminUser.id, 'Verificación de sesión correcta');

  // 3. Verificar motor de reservas
  const testDate = '2026-11-10'; // Martes (abierto)
  const avail = reservationEngine.getAvailableSlots(testDate, 2);
  assert(avail.available === true, `Disponibilidad para ${testDate} (2 comensales) confirmada`);
  assert(avail.shifts.lunch.slots.length > 0, 'Turno de almuerzo con slots disponibles');
  assert(avail.shifts.dinner.slots.length > 0, 'Turno de cena con slots disponibles');

  // Crear reserva
  const reservation = await reservationEngine.createReservation({
    date: testDate,
    time: '14:00',
    partySize: 2,
    name: 'Juan Palmero',
    email: 'juan.palmero@ejemplo.com',
    phone: '+34 611 222 333',
    notes: 'Preferencia mesa en terraza',
    source: 'web'
  });

  assert(reservation.id > 0, 'Reserva insertada en DB con ID asignado');
  assert(reservation.code.startsWith('TL-'), `Código de reserva generado: ${reservation.code}`);
  assert(reservation.table_id !== null, `Mesa asignada automáticamente: ${reservation.table_name}`);

  // Cancelar reserva mediante token
  const cancelRes = await reservationEngine.cancelReservationByToken(reservation.cancel_token, 'Cambio de planes');
  assert(cancelRes.success === true, 'Cancelación por token exitosa');
  assert(cancelRes.reservation.status === 'cancelada', 'Estado cambiado a cancelada');

  // 4. Probar API Pública
  const infoApi = await handlePublicApi(
    { method: 'GET', headers: {} },
    {},
    new URL('http://localhost:3000/api/info')
  );
  assert(infoApi.status === 200, 'API /api/info responde 200');
  assert(infoApi.data.restaurant.restaurant_name === 'Restaurante Tarca Luis', 'Nombre de restaurante correcto');

  const menuApi = await handlePublicApi(
    { method: 'GET', headers: {} },
    {},
    new URL('http://localhost:3000/api/menu')
  );
  assert(menuApi.status === 200, 'API /api/menu responde 200');
  assert(menuApi.data.allDishes.length >= 20, '20 platos auténticos canarios en la carta');

  // 5. Probar API Admin
  const adminDash = await handleAdminApi(
    { method: 'GET', headers: { authorization: `Bearer ${session.token}` } },
    {},
    new URL('http://localhost:3000/api/admin/dashboard')
  );
  assert(adminDash.status === 200, 'API Admin /api/admin/dashboard autorizada (200)');
  assert(adminDash.data.stats.totalTables >= 10, 'Estadísticas del restaurante generadas');

  const adminTables = await handleAdminApi(
    { method: 'GET', headers: { authorization: `Bearer ${session.token}` } },
    {},
    new URL('http://localhost:3000/api/admin/tables')
  );
  assert(adminTables.status === 200, 'API Admin /api/admin/tables responde 200');
  assert(adminTables.data.tables.length >= 12, '12 mesas registradas por zonas');

  console.log('------------------------------------------------');
  console.log(`RESUMEN: ${passed} pruebas superadas de ${passed + failed}`);
  console.log('------------------------------------------------');

  if (failed === 0) {
    console.log('✨ ¡TODO EL SISTEMA FUNCIONA A LA PERFECCIÓN!');
  }
}

runUnitTests().catch(console.error);
