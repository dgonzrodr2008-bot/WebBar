/**
 * src/routes/admin-routes.js - API completa para el Panel de Administración
 */
const { db } = require('../db.js');
const {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  getAuthenticatedUser
} = require('../auth.js');
const { saveBase64Image } = require('../image-handler.js');
const { sendReservationConfirmation, sendCancellationEmail } = require('../email-service.js');
const reservationEngine = require('../reservation-engine.js');

async function handleAdminApi(req, res, url, body) {
  const pathname = url.pathname;
  const method = req.method;

  // ==========================================
  // 1. AUTENTICACIÓN Y SESIONES
  // ==========================================

  // Login de administrador
  if (pathname === '/api/auth/login' && method === 'POST') {
    const { username, password } = body;
    if (!username || !password) {
      return { status: 400, data: { error: 'Introduce usuario y contraseña.' } };
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
    if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
      return { status: 401, data: { error: 'Usuario o contraseña incorrectos.' } };
    }

    const { token, expiresAt } = createSession(user.id);

    // Configurar cookie segura tl_session
    const cookieHeader = `tl_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`;

    return {
      status: 200,
      headers: { 'Set-Cookie': cookieHeader },
      data: {
        success: true,
        token,
        user: { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role }
      }
    };
  }

  // Comprobar usuario conectado actual
  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return { status: 401, data: { error: 'No autenticado.' } };
    }
    return { status: 200, data: { user } };
  }

  // Cerrar sesión
  if (pathname === '/api/auth/logout' && method === 'POST') {
    const user = getAuthenticatedUser(req);
    if (user) {
      deleteSession(user.token);
    }
    const clearCookie = 'tl_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
    return {
      status: 200,
      headers: { 'Set-Cookie': clearCookie },
      data: { success: true, message: 'Sesión cerrada correctamente.' }
    };
  }

  // =========================================================
  // PROTECCIÓN DE RUTAS DE ADMINISTRACIÓN: REQUIERE SESIÓN
  // =========================================================
  if (pathname.startsWith('/api/admin') || pathname === '/api/auth/change-password' || pathname === '/api/auth/create-user') {
    const currentUser = getAuthenticatedUser(req);
    if (!currentUser) {
      return { status: 401, data: { error: 'Acceso restringido. Inicia sesión como administrador.' } };
    }

    // Cambiar contraseña del administrador actual
    if (pathname === '/api/auth/change-password' && method === 'POST') {
      const { currentPassword, newPassword } = body;
      if (!currentPassword || !newPassword || newPassword.length < 6) {
        return { status: 400, data: { error: 'La nueva contraseña debe tener al menos 6 caracteres.' } };
      }

      const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(currentUser.user_id);
      if (!verifyPassword(currentPassword, userRow.password_hash, userRow.salt)) {
        return { status: 400, data: { error: 'La contraseña actual no es correcta.' } };
      }

      const { hash, salt } = hashPassword(newPassword);
      db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, currentUser.user_id);

      return { status: 200, data: { success: true, message: 'Contraseña actualizada correctamente.' } };
    }

    // Crear un nuevo usuario administrador
    if (pathname === '/api/auth/create-user' && method === 'POST') {
      const { username, password, name, email, role } = body;
      if (!username || !password || !name || !email) {
        return { status: 400, data: { error: 'Todos los campos son obligatorios.' } };
      }

      const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
      if (exists) {
        return { status: 400, data: { error: 'Ese nombre de usuario ya está registrado.' } };
      }

      const { hash, salt } = hashPassword(password);
      db.prepare(`
        INSERT INTO users (username, password_hash, salt, name, email, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(username.trim(), hash, salt, name.trim(), email.trim(), role || 'admin');

      return { status: 201, data: { success: true, message: 'Nuevo usuario administrador creado con éxito.' } };
    }

    // Listar usuarios administradores
    if (pathname === '/api/admin/users' && method === 'GET') {
      const users = db.prepare('SELECT id, username, name, email, role, created_at FROM users ORDER BY id ASC').all();
      return { status: 200, data: { users } };
    }

    // ==========================================
    // 2. DASHBOARD Y ESTADÍSTICAS
    // ==========================================
    if (pathname === '/api/admin/dashboard' && method === 'GET') {
      const todayStr = new Date().toISOString().split('T')[0];

      // Reservas de hoy
      const todayBookings = db
        .prepare(`
          SELECT r.*, t.name as table_name
          FROM reservations r
          LEFT JOIN restaurant_tables t ON r.table_id = t.id
          WHERE r.reservation_date = ?
          ORDER BY r.reservation_time ASC
        `)
        .all(todayStr);

      const totalToday = todayBookings.length;
      const comensalesToday = todayBookings
        .filter(r => r.status !== 'cancelada')
        .reduce((sum, r) => sum + r.party_size, 0);

      const countPending = todayBookings.filter(r => r.status === 'pendiente').length;
      const countConfirmed = todayBookings.filter(r => r.status === 'confirmada').length;
      const countCancelled = todayBookings.filter(r => r.status === 'cancelada').length;

      // Total de mesas
      const totalTables = db.prepare('SELECT count(*) as c FROM restaurant_tables WHERE is_active = 1').get().c;

      // Próximas reservas (próximos 7 días)
      const upcoming = db
        .prepare(`
          SELECT r.*, t.name as table_name
          FROM reservations r
          LEFT JOIN restaurant_tables t ON r.table_id = t.id
          WHERE r.reservation_date >= ?
          ORDER BY r.reservation_date ASC, r.reservation_time ASC
          LIMIT 10
        `)
        .all(todayStr);

      return {
        status: 200,
        data: {
          todayDate: todayStr,
          stats: {
            totalToday,
            comensalesToday,
            countPending,
            countConfirmed,
            countCancelled,
            totalTables
          },
          todayBookings,
          upcoming
        }
      };
    }

    // ==========================================
    // 3. GESTIÓN DE MESAS
    // ==========================================
    if (pathname === '/api/admin/tables' && method === 'GET') {
      const tables = db.prepare('SELECT * FROM restaurant_tables ORDER BY zone ASC, name ASC').all();
      return { status: 200, data: { tables } };
    }

    if (pathname === '/api/admin/tables' && method === 'POST') {
      const { name, min_capacity, max_capacity, zone, is_active, notes } = body;
      if (!name) return { status: 400, data: { error: 'El nombre o número de mesa es obligatorio.' } };

      const stmt = db.prepare(`
        INSERT INTO restaurant_tables (name, min_capacity, max_capacity, zone, is_active, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        name.trim(),
        parseInt(min_capacity, 10) || 1,
        parseInt(max_capacity, 10) || 4,
        zone || 'interior',
        is_active === undefined ? 1 : Number(is_active),
        notes || ''
      );

      return { status: 201, data: { success: true, id: Number(result.lastInsertRowid) } };
    }

    if (pathname.match(/^\/api\/admin\/tables\/(\d+)$/) && method === 'PUT') {
      const id = pathname.split('/').pop();
      const { name, min_capacity, max_capacity, zone, is_active, notes } = body;

      db.prepare(`
        UPDATE restaurant_tables
        SET name = ?, min_capacity = ?, max_capacity = ?, zone = ?, is_active = ?, notes = ?
        WHERE id = ?
      `).run(
        name.trim(),
        parseInt(min_capacity, 10) || 1,
        parseInt(max_capacity, 10) || 4,
        zone || 'interior',
        Number(is_active),
        notes || '',
        id
      );

      return { status: 200, data: { success: true, message: 'Mesa actualizada correctamente.' } };
    }

    if (pathname.match(/^\/api\/admin\/tables\/(\d+)$/) && method === 'DELETE') {
      const id = pathname.split('/').pop();
      db.prepare('DELETE FROM restaurant_tables WHERE id = ?').run(id);
      return { status: 200, data: { success: true, message: 'Mesa eliminada correctamente.' } };
    }

    // ==========================================
    // 4. GESTIÓN DE RESERVAS
    // ==========================================
    if (pathname === '/api/admin/reservations' && method === 'GET') {
      const filterDate = url.searchParams.get('date');
      const filterStatus = url.searchParams.get('status');
      const search = url.searchParams.get('search');

      let query = `
        SELECT r.*, t.name as table_name, t.zone as table_zone
        FROM reservations r
        LEFT JOIN restaurant_tables t ON r.table_id = t.id
        WHERE 1=1
      `;
      const params = [];

      if (filterDate && filterDate !== 'all') {
        if (filterDate === 'today') {
          query += ` AND r.reservation_date = date('now', 'localtime')`;
        } else if (filterDate === 'upcoming') {
          query += ` AND r.reservation_date >= date('now', 'localtime')`;
        } else {
          query += ` AND r.reservation_date = ?`;
          params.push(filterDate);
        }
      }

      if (filterStatus && filterStatus !== 'all') {
        query += ` AND r.status = ?`;
        params.push(filterStatus);
      }

      if (search && search.trim()) {
        query += ` AND (r.customer_name LIKE ? OR r.customer_phone LIKE ? OR r.code LIKE ? OR r.customer_email LIKE ?)`;
        const s = `%${search.trim()}%`;
        params.push(s, s, s, s);
      }

      query += ` ORDER BY r.reservation_date DESC, r.reservation_time DESC LIMIT 200`;

      const reservations = db.prepare(query).all(...params);
      return { status: 200, data: { reservations } };
    }

    // Crear reserva manual desde el admin (ej: llamada telefónica)
    if (pathname === '/api/admin/reservations' && method === 'POST') {
      const host = req.headers['host'] || 'localhost:3000';
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const baseUrl = `${protocol}://${host}`;

      try {
        const resObj = await reservationEngine.createReservation({
          date: body.date,
          time: body.time,
          partySize: body.party_size,
          name: body.name,
          email: body.email || 'telefono@tarcaluis.es',
          phone: body.phone,
          notes: body.notes || 'Reserva introducida manualmente desde administración',
          source: body.source || 'manual',
          status: body.status || 'confirmada',
          tableId: body.table_id ? parseInt(body.table_id, 10) : null,
          baseUrl
        });

        return { status: 201, data: { success: true, reservation: resObj } };
      } catch (err) {
        return { status: 400, data: { error: err.message } };
      }
    }

    // Modificar reserva (estado, mesa, fecha, hora, comensales, notas)
    if (pathname.match(/^\/api\/admin\/reservations\/(\d+)$/) && method === 'PUT') {
      const id = pathname.split('/').pop();
      const currentRes = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
      if (!currentRes) {
        return { status: 404, data: { error: 'Reserva no encontrada.' } };
      }

      const status = body.status || currentRes.status;
      const notes = body.notes !== undefined ? body.notes : currentRes.notes;
      const tableId = body.table_id !== undefined ? (body.table_id ? parseInt(body.table_id, 10) : null) : currentRes.table_id;
      const date = body.reservation_date || currentRes.reservation_date;
      const time = body.reservation_time || currentRes.reservation_time;
      const partySize = body.party_size ? parseInt(body.party_size, 10) : currentRes.party_size;

      db.prepare(`
        UPDATE reservations
        SET status = ?, notes = ?, table_id = ?, reservation_date = ?, reservation_time = ?, party_size = ?
        WHERE id = ?
      `).run(status, notes, tableId, date, time, partySize, id);

      // Si se acaba de cancelar y antes no lo estaba, avisar
      if (status === 'cancelada' && currentRes.status !== 'cancelada') {
        const updatedRes = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
        sendCancellationEmail(updatedRes).catch(console.error);
      }

      return { status: 200, data: { success: true, message: 'Reserva actualizada correctamente.' } };
    }

    // Eliminar reserva
    if (pathname.match(/^\/api\/admin\/reservations\/(\d+)$/) && method === 'DELETE') {
      const id = pathname.split('/').pop();
      db.prepare('DELETE FROM reservations WHERE id = ?').run(id);
      return { status: 200, data: { success: true, message: 'Reserva eliminada del sistema.' } };
    }

    // ==========================================
    // 5. HORARIOS Y DÍAS CERRADOS
    // ==========================================
    if (pathname === '/api/admin/schedules' && method === 'GET') {
      const schedules = db.prepare('SELECT * FROM schedules ORDER BY day_of_week ASC').all();
      const closedDates = db.prepare('SELECT * FROM closed_dates ORDER BY date ASC').all();
      return { status: 200, data: { schedules, closedDates } };
    }

    // Actualizar horarios semanales
    if (pathname === '/api/admin/schedules' && method === 'PUT') {
      const { schedules } = body;
      if (!Array.isArray(schedules)) {
        return { status: 400, data: { error: 'Lista de horarios no válida.' } };
      }

      const updateStmt = db.prepare(`
        UPDATE schedules
        SET is_open = ?, lunch_start = ?, lunch_end = ?, dinner_start = ?, dinner_end = ?
        WHERE day_of_week = ?
      `);

      for (const s of schedules) {
        updateStmt.run(
          s.is_open ? 1 : 0,
          s.lunch_start || null,
          s.lunch_end || null,
          s.dinner_start || null,
          s.dinner_end || null,
          s.day_of_week
        );
      }

      return { status: 200, data: { success: true, message: 'Horarios semanales guardados.' } };
    }

    // Añadir fecha cerrada / vacaciones
    if (pathname === '/api/admin/closed-dates' && method === 'POST') {
      const { date, reason } = body;
      if (!date) return { status: 400, data: { error: 'La fecha es obligatoria.' } };

      db.prepare(`
        INSERT INTO closed_dates (date, reason)
        VALUES (?, ?)
        ON CONFLICT(date) DO UPDATE SET reason = excluded.reason
      `).run(date, reason || 'Día cerrado por descanso o festivo');

      return { status: 201, data: { success: true, message: 'Fecha cerrada registrada con éxito.' } };
    }

    // Eliminar fecha cerrada
    if (pathname.match(/^\/api\/admin\/closed-dates\/(\d+)$/) && method === 'DELETE') {
      const id = pathname.split('/').pop();
      db.prepare('DELETE FROM closed_dates WHERE id = ?').run(id);
      return { status: 200, data: { success: true, message: 'Fecha eliminada.' } };
    }

    // ==========================================
    // 6. GESTIÓN DE CARTA (CATEGORÍAS Y PLATOS)
    // ==========================================
    if (pathname === '/api/admin/menu' && method === 'GET') {
      const categories = db.prepare('SELECT * FROM menu_categories ORDER BY display_order ASC, id ASC').all();
      const dishes = db.prepare('SELECT * FROM dishes ORDER BY display_order ASC, id ASC').all();
      return { status: 200, data: { categories, dishes } };
    }

    // Crear categoría
    if (pathname === '/api/admin/categories' && method === 'POST') {
      const { name, description, display_order } = body;
      if (!name) return { status: 400, data: { error: 'El nombre de categoría es obligatorio.' } };

      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-');

      const stmt = db.prepare(`
        INSERT INTO menu_categories (name, slug, description, display_order, is_active)
        VALUES (?, ?, ?, ?, 1)
      `);
      const result = stmt.run(name.trim(), slug + '-' + Date.now().toString().slice(-4), description || '', parseInt(display_order, 10) || 0);

      return { status: 201, data: { success: true, id: Number(result.lastInsertRowid) } };
    }

    // Editar categoría
    if (pathname.match(/^\/api\/admin\/categories\/(\d+)$/) && method === 'PUT') {
      const id = pathname.split('/').pop();
      const { name, description, display_order, is_active } = body;

      db.prepare(`
        UPDATE menu_categories
        SET name = ?, description = ?, display_order = ?, is_active = ?
        WHERE id = ?
      `).run(name.trim(), description || '', parseInt(display_order, 10) || 0, is_active ? 1 : 0, id);

      return { status: 200, data: { success: true, message: 'Categoría actualizada.' } };
    }

    // Eliminar categoría
    if (pathname.match(/^\/api\/admin\/categories\/(\d+)$/) && method === 'DELETE') {
      const id = pathname.split('/').pop();
      db.prepare('DELETE FROM menu_categories WHERE id = ?').run(id);
      return { status: 200, data: { success: true, message: 'Categoría y sus platos eliminados.' } };
    }

    // Crear plato
    if (pathname === '/api/admin/dishes' && method === 'POST') {
      const { category_id, name, description, price, photo_url, allergens, is_available, is_featured, display_order } = body;
      if (!name || !price || !category_id) {
        return { status: 400, data: { error: 'Nombre, precio y categoría son obligatorios.' } };
      }

      const stmt = db.prepare(`
        INSERT INTO dishes (category_id, name, description, price, photo_url, allergens, is_available, is_featured, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        parseInt(category_id, 10),
        name.trim(),
        description || '',
        parseFloat(price) || 0,
        photo_url || '',
        allergens || '',
        is_available !== undefined ? (is_available ? 1 : 0) : 1,
        is_featured ? 1 : 0,
        parseInt(display_order, 10) || 0
      );

      return { status: 201, data: { success: true, id: Number(result.lastInsertRowid) } };
    }

    // Modificar plato
    if (pathname.match(/^\/api\/admin\/dishes\/(\d+)$/) && method === 'PUT') {
      const id = pathname.split('/').pop();
      const { category_id, name, description, price, photo_url, allergens, is_available, is_featured, display_order } = body;

      db.prepare(`
        UPDATE dishes
        SET category_id = ?, name = ?, description = ?, price = ?, photo_url = ?, allergens = ?, is_available = ?, is_featured = ?, display_order = ?
        WHERE id = ?
      `).run(
        parseInt(category_id, 10),
        name.trim(),
        description || '',
        parseFloat(price) || 0,
        photo_url || '',
        allergens || '',
        is_available ? 1 : 0,
        is_featured ? 1 : 0,
        parseInt(display_order, 10) || 0,
        id
      );

      return { status: 200, data: { success: true, message: 'Plato actualizado correctamente.' } };
    }

    // Eliminar plato
    if (pathname.match(/^\/api\/admin\/dishes\/(\d+)$/) && method === 'DELETE') {
      const id = pathname.split('/').pop();
      db.prepare('DELETE FROM dishes WHERE id = ?').run(id);
      return { status: 200, data: { success: true, message: 'Plato eliminado de la carta.' } };
    }

    // Alternar disponibilidad rápida del plato (agotado / disponible)
    if (pathname.match(/^\/api\/admin\/dishes\/(\d+)\/toggle$/) && method === 'POST') {
      const id = pathname.split('/')[4];
      const dish = db.prepare('SELECT is_available FROM dishes WHERE id = ?').get(id);
      if (!dish) return { status: 404, data: { error: 'Plato no encontrado' } };

      const newStatus = dish.is_available === 1 ? 0 : 1;
      db.prepare('UPDATE dishes SET is_available = ? WHERE id = ?').run(newStatus, id);

      return { status: 200, data: { success: true, is_available: newStatus } };
    }

    // ==========================================
    // 7. GALERÍA DE FOTOS Y PORTADA
    // ==========================================
    if (pathname === '/api/admin/gallery' && method === 'GET') {
      const gallery = db.prepare('SELECT * FROM gallery ORDER BY display_order ASC, id DESC').all();
      return { status: 200, data: { gallery } };
    }

    if (pathname === '/api/admin/gallery' && method === 'POST') {
      const { title, category, image_url, display_order, is_hero } = body;
      if (!image_url) return { status: 400, data: { error: 'La URL o archivo de imagen es obligatorio.' } };

      const stmt = db.prepare(`
        INSERT INTO gallery (title, category, image_url, display_order, is_hero)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = stmt.run(title || 'Foto de Tarca Luis', category || 'general', image_url, parseInt(display_order, 10) || 0, is_hero ? 1 : 0);

      // Si se marca como hero, actualizar el setting también
      if (is_hero) {
        db.prepare("UPDATE settings SET value = ? WHERE key = 'hero_image'").run(image_url);
      }

      return { status: 201, data: { success: true, id: Number(result.lastInsertRowid) } };
    }

    // Establecer foto como principal de la portada (Hero)
    if (pathname.match(/^\/api\/admin\/gallery\/(\d+)\/set-hero$/) && method === 'POST') {
      const id = pathname.split('/')[4];
      const photo = db.prepare('SELECT image_url FROM gallery WHERE id = ?').get(id);
      if (!photo) return { status: 404, data: { error: 'Foto no encontrada.' } };

      // Quitar hero de otras fotos
      db.prepare('UPDATE gallery SET is_hero = 0').run();
      db.prepare('UPDATE gallery SET is_hero = 1 WHERE id = ?').run(id);

      // Actualizar setting general
      db.prepare("UPDATE settings SET value = ? WHERE key = 'hero_image'").run(photo.image_url);

      return { status: 200, data: { success: true, message: 'Foto establecida como imagen principal de portada.', hero_image: photo.image_url } };
    }

    // Eliminar foto de galería
    if (pathname.match(/^\/api\/admin\/gallery\/(\d+)$/) && method === 'DELETE') {
      const id = pathname.split('/').pop();
      db.prepare('DELETE FROM gallery WHERE id = ?').run(id);
      return { status: 200, data: { success: true, message: 'Foto eliminada de la galería.' } };
    }

    // ==========================================
    // 8. CONFIGURACIÓN Y AJUSTES GENERALES
    // ==========================================
    if (pathname === '/api/admin/settings' && method === 'GET') {
      const rows = db.prepare('SELECT key, value, description FROM settings').all();
      const settings = {};
      rows.forEach(r => (settings[r.key] = r.value));
      return { status: 200, data: { settings, rows } };
    }

    // Actualizar configuración en bloque
    if (pathname === '/api/admin/settings' && method === 'PUT') {
      const updateStmt = db.prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')
      `);

      for (const [key, value] of Object.entries(body)) {
        updateStmt.run(key, String(value));
      }

      return { status: 200, data: { success: true, message: 'Ajustes del restaurante guardados correctamente.' } };
    }

    // ==========================================
    // 9. SUBIDA SEGURA DE IMÁGENES
    // ==========================================
    if (pathname === '/api/admin/upload' && method === 'POST') {
      const { dataUrl, filename } = body;
      if (!dataUrl) {
        return { status: 400, data: { error: 'No se recibieron datos de imagen.' } };
      }

      try {
        const saved = saveBase64Image(dataUrl, filename);
        return {
          status: 201,
          data: {
            success: true,
            url: saved.url,
            filename: saved.filename,
            size: saved.size,
            message: 'Imagen subida y guardada correctamente.'
          }
        };
      } catch (err) {
        return { status: 400, data: { error: err.message } };
      }
    }

    // ==========================================
    // 10. HISTORIAL DE EMAILS Y PRUEBA
    // ==========================================
    if (pathname === '/api/admin/emails' && method === 'GET') {
      const logs = db.prepare('SELECT * FROM email_logs ORDER BY id DESC LIMIT 100').all();
      return { status: 200, data: { logs } };
    }

    // Enviar email de prueba al correo especificado o al del admin
    if (pathname === '/api/admin/emails/test' && method === 'POST') {
      const host = req.headers['host'] || 'localhost:3000';
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const baseUrl = `${protocol}://${host}`;

      const targetEmail = body.targetEmail || currentUser.email || 'admin@tarcaluis.es';

      const testReservation = {
        id: 9999,
        code: 'TL-TEST-GMAIL',
        customer_name: currentUser.name || 'Propietario Tarca Luis',
        customer_email: targetEmail.trim(),
        customer_phone: '+34 922 40 12 34',
        party_size: 4,
        reservation_date: new Date().toISOString().split('T')[0],
        reservation_time: '14:30',
        table_name: 'Mesa 1 - Rincón de Tea',
        notes: 'Reserva de prueba generada desde el panel admin.',
        cancel_token: 'demo-token-test-1234'
      };

      try {
        const result = await sendReservationConfirmation(testReservation, baseUrl);
        return {
          status: 200,
          data: {
            success: true,
            message: `Email procesado para ${testReservation.customer_email}. Revisa el historial de auditoría abajo para ver si fue entregado por SMTP o guardado localmente.`,
            preview: result
          }
        };
      } catch (err) {
        return {
          status: 400,
          data: {
            error: `Error al enviar correo: ${err.message}`
          }
        };
      }
    }
  }

  return null;
}

module.exports = {
  handleAdminApi
};
