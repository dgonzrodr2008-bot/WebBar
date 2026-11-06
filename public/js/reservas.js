/**
 * public/js/reservas.js - Controlador del sistema de reservas públicas
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reservationForm');
  if (!form) return;

  const dateInput = document.getElementById('resDate');
  const partySelect = document.getElementById('resParty');
  const slotsContainer = document.getElementById('slotsContainer');
  const timeInput = document.getElementById('resTime');
  const captchaQuestion = document.getElementById('captchaQuestion');
  const captchaToken = document.getElementById('captchaToken');
  const captchaAnswer = document.getElementById('captchaAnswer');
  const formAlert = document.getElementById('resFormAlert');
  const submitBtn = document.getElementById('btnSubmitReservation');
  const successBox = document.getElementById('reservationSuccessBox');

  // Configurar fechas mínimas y máximas
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  dateInput.min = todayStr;

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 60);
  const max_yyyy = maxDate.getFullYear();
  const max_mm = String(maxDate.getMonth() + 1).padStart(2, '0');
  const max_dd = String(maxDate.getDate()).padStart(2, '0');
  dateInput.max = `${max_yyyy}-${max_mm}-${max_dd}`;

  // Si no hay fecha elegida, fijar hoy o mañana
  if (!dateInput.value) {
    dateInput.value = todayStr;
  }

  // Cargar reto anti-spam
  async function loadCaptcha() {
    try {
      const res = await fetch('/api/captcha');
      const data = await res.json();
      if (data.question && data.token) {
        captchaQuestion.textContent = data.question;
        captchaToken.value = data.token;
        captchaAnswer.value = '';
      }
    } catch (err) {
      console.error('Error cargando captcha:', err);
    }
  }

  // Cargar disponibilidad de turnos y horas
  async function checkAvailability() {
    const date = dateInput.value;
    const party = partySelect.value;

    if (!date || !party) return;

    timeInput.value = '';
    slotsContainer.innerHTML = '<p style="color:var(--color-text-muted); font-size:0.9rem; text-align:center; padding:1.5rem;">Comprobando mesas disponibles...</p>';

    try {
      const res = await fetch(`/api/reservations/availability?date=${date}&party_size=${party}`);
      const data = await res.json();

      if (!data.available) {
        slotsContainer.innerHTML = `
          <div style="background:#fff3cd; color:#856404; padding:1rem; border-radius:8px; text-align:center; font-size:0.92rem;">
            ⚠️ <strong>No disponible:</strong> ${data.reason || 'No hay mesas disponibles para este día.'}
          </div>
        `;
        return;
      }

      let html = '';

      // Turno Almuerzo
      const lunchSlots = data.shifts?.lunch?.slots || [];
      if (lunchSlots.length > 0) {
        html += `
          <div class="shift-slots-wrapper">
            <div class="shift-title">
              <span>☀️ Turno de Almuerzo (${data.shifts.lunch.hours})</span>
            </div>
            <div class="slots-grid">
              ${lunchSlots.map(t => `<button type="button" class="time-slot-btn" data-time="${t}">${t}</button>`).join('')}
            </div>
          </div>
        `;
      }

      // Turno Cena
      const dinnerSlots = data.shifts?.dinner?.slots || [];
      if (dinnerSlots.length > 0) {
        html += `
          <div class="shift-slots-wrapper">
            <div class="shift-title">
              <span>🌙 Turno de Cena (${data.shifts.dinner.hours})</span>
            </div>
            <div class="slots-grid">
              ${dinnerSlots.map(t => `<button type="button" class="time-slot-btn" data-time="${t}">${t}</button>`).join('')}
            </div>
          </div>
        `;
      }

      if (lunchSlots.length === 0 && dinnerSlots.length === 0) {
        html = `
          <div style="background:#f8d7da; color:#721c24; padding:1rem; border-radius:8px; text-align:center;">
            Completo: todas las mesas para ${party} comensales están reservadas en esta fecha.
          </div>
        `;
      }

      slotsContainer.innerHTML = html;

      // Eventos de selección de slot
      slotsContainer.querySelectorAll('.time-slot-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          slotsContainer.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          timeInput.value = btn.dataset.time;
          hideAlert();
        });
      });
    } catch (err) {
      slotsContainer.innerHTML = '<p style="color:red; text-align:center;">Error al comprobar disponibilidad. Inténtalo de nuevo.</p>';
    }
  }

  function showAlert(msg) {
    formAlert.textContent = msg;
    formAlert.style.display = 'block';
  }

  function hideAlert() {
    formAlert.textContent = '';
    formAlert.style.display = 'none';
  }

  dateInput.addEventListener('change', checkAvailability);
  partySelect.addEventListener('change', checkAvailability);

  // Inicializar captcha y disponibilidad
  loadCaptcha();
  checkAvailability();

  // Envío del formulario de reserva
  form.addEventListener('submit', async e => {
    e.preventDefault();
    hideAlert();

    const name = document.getElementById('resName').value.trim();
    const phone = document.getElementById('resPhone').value.trim();
    const email = document.getElementById('resEmail').value.trim();
    const date = dateInput.value;
    const time = timeInput.value;
    const party = partySelect.value;
    const notes = document.getElementById('resNotes').value.trim();
    const answer = captchaAnswer.value.trim();
    const token = captchaToken.value;
    const trap = document.getElementById('resTrap')?.value;

    if (!time) {
      showAlert('Por favor, selecciona una de las horas disponibles para tu reserva.');
      slotsContainer.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (!name || name.length < 2) {
      showAlert('Por favor introduce tu nombre y apellidos.');
      return;
    }

    if (!phone || phone.length < 7) {
      showAlert('Por favor introduce un teléfono móvil o fijo de contacto.');
      return;
    }

    if (!email || !email.includes('@')) {
      showAlert('Por favor introduce un email válido para recibir el justificante de la reserva.');
      return;
    }

    if (!answer) {
      showAlert('Por favor responde a la pregunta de seguridad anti-spam.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳ Confirmando reserva...</span>';

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email,
          date,
          time,
          party_size: party,
          notes,
          captcha_answer: answer,
          captcha_token: token,
          website_trap: trap
        })
      });

      const resData = await response.json();

      if (!response.ok) {
        showAlert(resData.error || 'Ocurrió un error al procesar tu reserva.');
        loadCaptcha(); // Refrescar captcha
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Confirmar Reserva de Mesa</span>';
        return;
      }

      // Éxito: Ocultar formulario y mostrar confirmación
      form.style.display = 'none';
      successBox.style.display = 'block';

      const res = resData.reservation;
      const cancelUrl = `/cancelar-reserva?token=${res.cancel_token}`;

      successBox.innerHTML = `
        <div class="reservation-success-card">
          <div class="success-check-icon">✓</div>
          <h2 style="font-family:var(--font-serif); font-size:2rem; margin-bottom:0.5rem; color:var(--color-primary);">¡Reserva Confirmada!</h2>
          <p style="color:var(--color-stone); font-size:1.05rem;">Hemos reservado tu mesa en <strong>Restaurante Tarca Luis</strong>.</p>
          
          <div class="res-code-highlight">
            Localizador: ${res.code}
          </div>

          <table class="res-summary-table">
            <tr><td>Nombre:</td><td><strong>${res.customer_name}</strong></td></tr>
            <tr><td>Fecha:</td><td><strong>${res.reservation_date}</strong></td></tr>
            <tr><td>Hora:</td><td><strong>${res.reservation_time} h</strong></td></tr>
            <tr><td>Comensales:</td><td><strong>${res.party_size} persona(s)</strong></td></tr>
            <tr><td>Mesa Asignada:</td><td><strong>${res.table_name || 'Comedor'}</strong></td></tr>
            <tr><td>Email:</td><td>${res.customer_email}</td></tr>
            <tr><td>Teléfono:</td><td>${phone}</td></tr>
            ${res.notes ? `<tr><td>Observaciones:</td><td>${res.notes}</td></tr>` : ''}
          </table>

          <p style="font-size:0.9rem; color:var(--color-text-muted); margin-bottom:1.5rem;">
            Hemos enviado un correo de confirmación con los datos y el enlace de cancelación a <strong>${res.customer_email}</strong>.
          </p>

          <div style="display:flex; justify-content:center; gap:1rem; flex-wrap:wrap;">
            <a href="${cancelUrl}" class="btn btn-outline btn-sm">Gestionar / Cancelar Reserva</a>
            <button onclick="window.print()" class="btn btn-primary btn-sm">Imprimir Comprobante</button>
            <button onclick="location.reload()" class="btn btn-secondary btn-sm" style="color:var(--color-stone); border-color:#ccc;">Hacer Otra Reserva</button>
          </div>
        </div>
      `;

      successBox.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      showAlert('Error de conexión con el servidor. Por favor verifica tu conexión o llámanos por teléfono.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Confirmar Reserva de Mesa</span>';
    }
  });
});
