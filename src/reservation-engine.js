/**
 * src/reservation-engine.js - Motor inteligente de disponibilidad y asignación de mesas
 */
const crypto = require('node:crypto');
const { db } = require('./db.js');
const { getSetting, sendReservationConfirmation, sendCancellationEmail } = require('./email-service.js');

// Utilidad para convertir "HH:MM" a minutos del día
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Utilidad para convertir minutos del día a "HH:MM"
function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Generar código de reserva legible y único (ej. TL-26-8K7A)
function generateReservationCode() {
  const yearSuffix = new Date().getFullYear().toString().slice(-2);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomCode = '';
  const bytes = crypto.randomBytes(4);
  for (let i = 0; i < 4; i++) {
    randomCode += chars[bytes[i] % chars.length];
  }
  return `TL-${yearSuffix}-${randomCode}`;
}

// Obtener disponibilidad para una fecha y número de comensales
function getAvailableSlots(dateString, partySize) {
  // 1. Validaciones básicas
  const enabled = getSetting('reservations_enabled', '1');
  if (enabled !== '1') {
    return {
      available: false,
      reason: getSetting('reservations_disabled_message', 'Actualmente las reservas online están pausadas temporalmente. Por favor, llámanos directamente por teléfono.')
    };
  }

  partySize = parseInt(partySize, 10);
  const maxParty = parseInt(getSetting('reservations_max_party', '12'), 10);
  if (isNaN(partySize) || partySize < 1) {
    return { available: false, reason: 'Número de comensales no válido.' };
  }
  if (partySize > maxParty) {
    return {
      available: false,
      reason: `Para reservas de más de ${maxParty} personas, por favor contacta directamente con el restaurante por teléfono.`
    };
  }

  const today = new Date();
  const [targetYear, targetMonth, targetDay] = dateString.split('-').map(Number);
  const targetDate = new Date(targetYear, targetMonth - 1, targetDay, 12, 0, 0);

  // Fecha en el pasado
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (targetDate < todayDateOnly) {
    return { available: false, reason: 'No es posible reservar en fechas pasadas.' };
  }

  // Antelación máxima (días)
  const maxAdvanceDays = parseInt(getSetting('reservation_max_advance_days', '60'), 10);
  const maxDate = new Date(todayDateOnly);
  maxDate.setDate(maxDate.getDate() + maxAdvanceDays);
  if (targetDate > maxDate) {
    return {
      available: false,
      reason: `Solo se admiten reservas con hasta ${maxAdvanceDays} días de antelación.`
    };
  }

  // 2. Comprobar si es un día festivo / cerrado
  const closedRow = db.prepare('SELECT reason FROM closed_dates WHERE date = ?').get(dateString);
  if (closedRow) {
    return {
      available: false,
      reason: `El restaurante permanecerá cerrado este día (${closedRow.reason || 'Descanso o festivo'}).`
    };
  }

  // 3. Comprobar horario semanal
  const dayOfWeek = targetDate.getDay(); // 0 = Domingo, 1 = Lunes, etc.
  const schedule = db.prepare('SELECT * FROM schedules WHERE day_of_week = ?').get(dayOfWeek);
  if (!schedule || schedule.is_open === 0) {
    return {
      available: false,
      reason: `El restaurante permanece cerrado los ${schedule ? schedule.day_name : 'este día'}.`
    };
  }

  // 4. Parámetros de servicio
  const durationMinutes = parseInt(getSetting('reservation_slot_duration_minutes', '90'), 10);
  const minAdvanceHours = parseInt(getSetting('reservation_min_advance_hours', '2'), 10);

  // Determinar hora límite si la reserva es para hoy
  const isToday =
    today.getFullYear() === targetYear &&
    today.getMonth() === targetMonth - 1 &&
    today.getDate() === targetDay;

  const currentMinutesToday = isToday ? today.getHours() * 60 + today.getMinutes() + minAdvanceHours * 60 : -1;

  // 5. Mesas activas que pueden acomodar al grupo
  const candidateTables = db
    .prepare(`
      SELECT id, name, min_capacity, max_capacity, zone
      FROM restaurant_tables
      WHERE is_active = 1
        AND min_capacity <= ?
        AND max_capacity >= ?
    `)
    .all(partySize, partySize);

  if (candidateTables.length === 0) {
    return {
      available: false,
      reason: `No disponemos de mesas para grupos de ${partySize} comensales. Por favor consúltanos por teléfono.`
    };
  }

  // 6. Obtener reservas existentes para esa fecha que estén activas
  const existingBookings = db
    .prepare(`
      SELECT table_id, reservation_time, end_time
      FROM reservations
      WHERE reservation_date = ?
        AND status IN ('confirmada', 'pendiente')
    `)
    .all(dateString);

  // Función para evaluar si hay mesa libre en un horario específico
  function isSlotAvailable(slotTimeStr) {
    const slotStartMin = timeToMinutes(slotTimeStr);
    const slotEndMin = slotStartMin + durationMinutes;

    if (isToday && slotStartMin < currentMinutesToday) {
      return false; // No cumple antelación mínima para hoy
    }

    // Buscar si alguna de las mesas candidatas está libre en este rango horario
    for (const table of candidateTables) {
      const hasConflict = existingBookings.some(booking => {
        if (booking.table_id !== table.id) return false;
        const bookStartMin = timeToMinutes(booking.reservation_time);
        const bookEndMin = timeToMinutes(booking.end_time);
        // Hay solapamiento si se cruzan los intervalos
        return slotStartMin < bookEndMin && slotEndMin > bookStartMin;
      });

      if (!hasConflict) {
        return true; // Al menos esta mesa está disponible
      }
    }
    return false;
  }

  // 7. Generar los slots de cada turno (intervalos de 30 minutos)
  const stepMinutes = 30;
  const lunchSlots = [];
  const dinnerSlots = [];

  // Turno de Almuerzo
  if (schedule.lunch_start && schedule.lunch_end) {
    const startMin = timeToMinutes(schedule.lunch_start);
    const endMin = timeToMinutes(schedule.lunch_end) - 45; // Último slot antes del cierre del servicio
    for (let m = startMin; m <= endMin; m += stepMinutes) {
      const timeStr = minutesToTime(m);
      if (isSlotAvailable(timeStr)) {
        lunchSlots.push(timeStr);
      }
    }
  }

  // Turno de Cena
  if (schedule.dinner_start && schedule.dinner_end) {
    const startMin = timeToMinutes(schedule.dinner_start);
    const endMin = timeToMinutes(schedule.dinner_end) - 45;
    for (let m = startMin; m <= endMin; m += stepMinutes) {
      const timeStr = minutesToTime(m);
      if (isSlotAvailable(timeStr)) {
        dinnerSlots.push(timeStr);
      }
    }
  }

  const hasAnySlot = lunchSlots.length > 0 || dinnerSlots.length > 0;

  return {
    available: hasAnySlot,
    date: dateString,
    dayName: schedule.day_name,
    partySize,
    shifts: {
      lunch: {
        name: 'Almuerzo',
        hours: `${schedule.lunch_start} - ${schedule.lunch_end}`,
        slots: lunchSlots
      },
      dinner: {
        name: 'Cena',
        hours: `${schedule.dinner_start} - ${schedule.dinner_end}`,
        slots: dinnerSlots
      }
    },
    reason: hasAnySlot ? null : 'Completo: no quedan mesas disponibles para los turnos de esta fecha.'
  };
}

// Asignar la mejor mesa disponible para el grupo
function assignBestTable(dateString, timeString, partySize, durationMinutes) {
  const slotStartMin = timeToMinutes(timeString);
  const slotEndMin = slotStartMin + durationMinutes;

  // Candidatas activas que admitan el número de comensales
  const candidateTables = db
    .prepare(`
      SELECT id, name, min_capacity, max_capacity, zone
      FROM restaurant_tables
      WHERE is_active = 1
        AND min_capacity <= ?
        AND max_capacity >= ?
    `)
    .all(partySize, partySize);

  // Reservas existentes en esa fecha
  const existingBookings = db
    .prepare(`
      SELECT table_id, reservation_time, end_time
      FROM reservations
      WHERE reservation_date = ?
        AND status IN ('confirmada', 'pendiente')
    `)
    .all(dateString);

  // Filtrar mesas ocupadas
  const freeTables = candidateTables.filter(table => {
    return !existingBookings.some(booking => {
      if (booking.table_id !== table.id) return false;
      const bookStart = timeToMinutes(booking.reservation_time);
      const bookEnd = timeToMinutes(booking.end_time);
      return slotStartMin < bookEnd && slotEndMin > bookStart;
    });
  });

  if (freeTables.length === 0) {
    return null;
  }

  // Ordenar para encontrar el "ajuste óptimo" (capacidad más cercana al tamaño del grupo)
  // De este modo, 2 personas ocupan una mesa de 2 antes que una de 6
  freeTables.sort((a, b) => {
    const diffA = a.max_capacity - partySize;
    const diffB = b.max_capacity - partySize;
    if (diffA !== diffB) return diffA - diffB;
    return a.id - b.id;
  });

  return freeTables[0];
}

// Crear una nueva reserva (desde la web o manual desde el admin)
async function createReservation({
  date,
  time,
  partySize,
  name,
  email,
  phone,
  notes = '',
  source = 'web',
  status = 'confirmada',
  tableId = null,
  baseUrl = 'http://localhost:3000'
}) {
  // Limpieza básica
  name = (name || '').trim();
  email = (email || '').trim().toLowerCase();
  phone = (phone || '').trim();
  notes = (notes || '').trim();
  partySize = parseInt(partySize, 10);

  if (!name || name.length < 2) {
    throw new Error('Por favor introduce tu nombre completo.');
  }
  if (!email || !email.includes('@')) {
    throw new Error('Por favor introduce un email válido para recibir la confirmación.');
  }
  if (!phone || phone.length < 6) {
    throw new Error('Por favor introduce un teléfono de contacto válido.');
  }
  if (!date || !time) {
    throw new Error('Debes seleccionar fecha y hora para la reserva.');
  }

  const durationMinutes = parseInt(getSetting('reservation_slot_duration_minutes', '90'), 10);
  const startMin = timeToMinutes(time);
  const endMin = startMin + durationMinutes;
  const endTimeStr = minutesToTime(endMin);

  let selectedTable = null;

  if (tableId) {
    // Si viene fijada manualmente desde el panel admin
    selectedTable = db.prepare('SELECT id, name, zone FROM restaurant_tables WHERE id = ?').get(tableId);
  } else {
    // Asignación automática inteligente
    selectedTable = assignBestTable(date, time, partySize, durationMinutes);
    if (!selectedTable) {
      throw new Error('No hay mesas disponibles para ese número de comensales a la hora seleccionada.');
    }
  }

  const code = generateReservationCode();
  const cancelToken = crypto.randomUUID();

  const insertStmt = db.prepare(`
    INSERT INTO reservations (
      code, customer_name, customer_email, customer_phone, party_size,
      reservation_date, reservation_time, end_time, table_id,
      status, notes, cancel_token, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insertStmt.run(
    code,
    name,
    email,
    phone,
    partySize,
    date,
    time,
    endTimeStr,
    selectedTable ? selectedTable.id : null,
    status,
    notes,
    cancelToken,
    source
  );

  const reservation = {
    id: Number(result.lastInsertRowid),
    code,
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    party_size: partySize,
    reservation_date: date,
    reservation_time: time,
    end_time: endTimeStr,
    table_id: selectedTable ? selectedTable.id : null,
    table_name: selectedTable ? selectedTable.name : null,
    table_zone: selectedTable ? selectedTable.zone : null,
    status,
    notes,
    cancel_token: cancelToken,
    source
  };

  // Enviar confirmación por email (asíncrono, no bloquea)
  try {
    await sendReservationConfirmation(reservation, baseUrl);
  } catch (err) {
    console.error('Error enviando email de confirmación:', err);
  }

  return reservation;
}

// Cancelar reserva mediante el token único
async function cancelReservationByToken(token, reason = 'Cancelada por el cliente') {
  if (!token) {
    return { success: false, message: 'Token de cancelación no proporcionado.' };
  }

  const reservation = db.prepare('SELECT * FROM reservations WHERE cancel_token = ?').get(token);
  if (!reservation) {
    return { success: false, message: 'No se ha encontrado ninguna reserva asociada a este enlace.' };
  }

  if (reservation.status === 'cancelada') {
    return {
      success: true,
      alreadyCancelled: true,
      message: 'Esta reserva ya había sido cancelada con anterioridad.',
      reservation
    };
  }

  db.prepare(`
    UPDATE reservations
    SET status = 'cancelada', notes = notes || ' | ' || ?
    WHERE id = ?
  `).run(reason, reservation.id);

  reservation.status = 'cancelada';

  try {
    await sendCancellationEmail(reservation);
  } catch (err) {
    console.error('Error enviando email de cancelación:', err);
  }

  return {
    success: true,
    message: 'Tu reserva ha sido cancelada satisfactoriamente. La mesa ha quedado liberada.',
    reservation
  };
}

module.exports = {
  timeToMinutes,
  minutesToTime,
  generateReservationCode,
  getAvailableSlots,
  assignBestTable,
  createReservation,
  cancelReservationByToken
};
