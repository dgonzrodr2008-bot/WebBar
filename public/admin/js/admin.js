/**
 * public/admin/js/admin.js - Controlador SPA completo del Panel de Administración
 */

// Utilidad para notificaciones Toast
function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '⚠️'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Comprimir imagen en el navegador antes de enviarla
function optimizeAndReadImage(file, maxDimension = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const optimizedDataUrl = canvas.toDataURL('image/webp', quality);
        resolve({ dataUrl: optimizedDataUrl, filename: file.name });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verificar sesión activa
  let currentUser = null;
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = '/admin/login.html';
      return;
    }
    const data = await res.json();
    currentUser = data.user;
    document.getElementById('topbarUserName').textContent = currentUser.name || currentUser.username;
    document.getElementById('userAvatarLetter').textContent = (currentUser.name || currentUser.username)[0].toUpperCase();
  } catch (err) {
    window.location.href = '/admin/login.html';
    return;
  }

  // Cerrar sesión
  document.getElementById('btnLogout').addEventListener('click', async e => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('tl_token');
    window.location.href = '/admin/login.html';
  });

  // Toggle sidebar móvil
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  const sidebar = document.getElementById('adminSidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
  }

  // 2. Navegación por pestañas
  const navLinks = document.querySelectorAll('.sidebar-link[data-tab]');
  const panes = document.querySelectorAll('.admin-tab-pane');
  const topbarTitle = document.getElementById('topbarTitle');

  function switchTab(tabId) {
    navLinks.forEach(l => l.classList.remove('active'));
    panes.forEach(p => p.classList.remove('active'));

    const activeLink = document.querySelector(`.sidebar-link[data-tab="${tabId}"]`);
    const activePane = document.getElementById(`tab-${tabId}`);

    if (activeLink) activeLink.classList.add('active');
    if (activePane) activePane.classList.add('active');

    if (activeLink && topbarTitle) {
      topbarTitle.textContent = activeLink.textContent.trim().replace(/^[\p{Emoji}\s]+/u, '');
    }

    if (sidebar) sidebar.classList.remove('open');

    // Cargas según pestaña
    if (tabId === 'dashboard') loadDashboard();
    if (tabId === 'reservas') loadReservations();
    if (tabId === 'mesas') loadTables();
    if (tabId === 'horarios') loadSchedules();
    if (tabId === 'carta') loadMenu();
    if (tabId === 'galeria') loadGallery();
    if (tabId === 'ajustes') loadSettings();
    if (tabId === 'emails') loadEmailSettings();
    if (tabId === 'usuarios') loadUsers();
  }

  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      switchTab(link.dataset.tab);
    });
  });

  // Modal genérico helper
  function openModal(modalId) {
    document.getElementById(modalId)?.classList.add('active');
  }
  function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
  }

  document.querySelectorAll('.modal-close-btn, .btn-modal-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    });
  });

  // ==========================================
  // 1. DASHBOARD
  // ==========================================
  async function loadDashboard() {
    try {
      const res = await fetch('/api/admin/dashboard');
      const data = await res.json();
      const s = data.stats;

      document.getElementById('metricTodayTotal').textContent = s.totalToday;
      document.getElementById('metricTodayDiners').textContent = s.comensalesToday;
      document.getElementById('metricConfirmed').textContent = s.countConfirmed;
      document.getElementById('metricPending').textContent = s.countPending;

      // Tabla hoy
      const tbody = document.getElementById('dashboardTodayTable');
      if (data.todayBookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:#888;">No hay reservas para hoy.</td></tr>';
      } else {
        tbody.innerHTML = data.todayBookings
          .map(
            r => `
            <tr>
              <td><strong>${r.reservation_time} h</strong></td>
              <td>${r.customer_name}<br><small style="color:#888;">${r.customer_phone}</small></td>
              <td><strong>${r.party_size}</strong> pers.</td>
              <td>${r.table_name || 'Sin asignar'}</td>
              <td><span class="badge badge-${r.status}">${r.status}</span></td>
              <td>
                <div class="btn-group">
                  ${r.status === 'pendiente' ? `<button class="btn btn-sm btn-success" onclick="updateResStatus(${r.id}, 'confirmada')">Confirmar</button>` : ''}
                  ${r.status !== 'cancelada' ? `<button class="btn btn-sm btn-danger" onclick="updateResStatus(${r.id}, 'cancelada')">Cancelar</button>` : ''}
                </div>
              </td>
            </tr>
          `
          )
          .join('');
      }

      // Próximas reservas
      const upTbody = document.getElementById('dashboardUpcomingTable');
      if (data.upcoming.length === 0) {
        upTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:#888;">No hay reservas próximas registradas.</td></tr>';
      } else {
        upTbody.innerHTML = data.upcoming
          .map(
            r => `
            <tr>
              <td><strong>${r.reservation_date}</strong></td>
              <td>${r.reservation_time} h</td>
              <td>${r.customer_name}</td>
              <td>${r.party_size} pers.</td>
              <td><span class="badge badge-${r.status}">${r.status}</span></td>
            </tr>
          `
          )
          .join('');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // ==========================================
  // 2. GESTIÓN DE RESERVAS
  // ==========================================
  async function loadReservations() {
    const date = document.getElementById('filterResDate').value;
    const status = document.getElementById('filterResStatus').value;
    const search = document.getElementById('filterResSearch').value;

    let url = `/api/admin/reservations?date=${encodeURIComponent(date)}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const tbody = document.getElementById('reservationsTableBody');

      if (!data.reservations || data.reservations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:#888;">No se han encontrado reservas con los filtros aplicados.</td></tr>';
        return;
      }

      tbody.innerHTML = data.reservations
        .map(
          r => `
          <tr>
            <td><code style="font-weight:bold; color:var(--color-primary);">${r.code}</code></td>
            <td><strong>${r.reservation_date}</strong><br><small>${r.reservation_time} h</small></td>
            <td>
              <strong>${r.customer_name}</strong><br>
              <small>📞 ${r.customer_phone}</small><br>
              <small>✉️ ${r.customer_email}</small>
            </td>
            <td><strong>${r.party_size}</strong></td>
            <td>${r.table_name ? `<span class="badge badge-zone-${r.table_zone}">${r.table_name}</span>` : '<span style="color:#888;">Sin mesa</span>'}</td>
            <td><span class="badge badge-${r.status}">${r.status}</span></td>
            <td style="max-width:200px; font-size:0.82rem; color:#666;">${r.notes || '-'}</td>
            <td>
              <div class="btn-group">
                ${r.status === 'pendiente' ? `<button class="btn btn-sm btn-success" title="Confirmar" onclick="window.updateResStatus(${r.id}, 'confirmada')">✓</button>` : ''}
                ${r.status !== 'cancelada' ? `<button class="btn btn-sm btn-danger" title="Cancelar" onclick="window.updateResStatus(${r.id}, 'cancelada')">✕</button>` : ''}
                ${r.status !== 'no_presentado' ? `<button class="btn btn-sm btn-secondary" title="No se presentó" onclick="window.updateResStatus(${r.id}, 'no_presentado')">👻</button>` : ''}
                <button class="btn btn-sm btn-outline-danger" title="Eliminar" onclick="window.deleteReservation(${r.id})">🗑️</button>
              </div>
            </td>
          </tr>
        `
        )
        .join('');
    } catch (err) {
      console.error(err);
    }
  }

  // Filtros de reservas
  document.getElementById('filterResDate')?.addEventListener('change', loadReservations);
  document.getElementById('filterResStatus')?.addEventListener('change', loadReservations);
  document.getElementById('filterResSearch')?.addEventListener('input', () => {
    clearTimeout(window._searchTimer);
    window._searchTimer = setTimeout(loadReservations, 300);
  });

  // Actualizar estado de reserva
  window.updateResStatus = async function (id, newStatus) {
    try {
      const res = await fetch(`/api/admin/reservations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        showToast(`Reserva marcada como ${newStatus}.`);
        loadDashboard();
        loadReservations();
      }
    } catch (err) {
      showToast('Error al actualizar reserva', 'error');
    }
  };

  window.deleteReservation = async function (id) {
    if (!confirm('¿Seguro que deseas eliminar definitivamente esta reserva del sistema?')) return;
    try {
      const res = await fetch(`/api/admin/reservations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Reserva eliminada.');
        loadReservations();
        loadDashboard();
      }
    } catch (err) {
      showToast('Error al eliminar', 'error');
    }
  };

  // Modal Nueva Reserva Manual (Por teléfono)
  const btnNewManualRes = document.getElementById('btnNewManualRes');
  if (btnNewManualRes) {
    btnNewManualRes.addEventListener('click', async () => {
      // Cargar lista de mesas activas en el select
      const resTables = await fetch('/api/admin/tables');
      const dataTables = await resTables.json();
      const selTable = document.getElementById('manualResTable');
      selTable.innerHTML = '<option value="">Asignación automática óptima</option>' +
        dataTables.tables.map(t => `<option value="${t.id}">${t.name} (${t.min_capacity}-${t.max_capacity} pers. / ${t.zone})</option>`).join('');

      document.getElementById('manualResDate').value = new Date().toISOString().split('T')[0];
      openModal('modalNewReservation');
    });
  }

  document.getElementById('formNewReservation')?.addEventListener('submit', async e => {
    e.preventDefault();
    const body = {
      name: document.getElementById('manualResName').value,
      phone: document.getElementById('manualResPhone').value,
      email: document.getElementById('manualResEmail').value || 'telefono@tarcaluis.es',
      date: document.getElementById('manualResDate').value,
      time: document.getElementById('manualResTime').value,
      party_size: document.getElementById('manualResParty').value,
      table_id: document.getElementById('manualResTable').value || null,
      notes: document.getElementById('manualResNotes').value,
      source: 'telefono',
      status: 'confirmada'
    };

    try {
      const res = await fetch('/api/admin/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Reserva manual creada (Código: ${data.reservation.code})`);
        closeModal('modalNewReservation');
        document.getElementById('formNewReservation').reset();
        loadReservations();
        loadDashboard();
      } else {
        alert(data.error || 'No se pudo crear la reserva.');
      }
    } catch (err) {
      showToast('Error de conexión', 'error');
    }
  });

  // ==========================================
  // 3. GESTIÓN DE MESAS
  // ==========================================
  let allTablesCache = [];

  async function loadTables() {
    try {
      const res = await fetch('/api/admin/tables');
      const data = await res.json();
      allTablesCache = data.tables || [];

      const tbody = document.getElementById('tablesTableBody');
      if (allTablesCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem;">No hay mesas registradas.</td></tr>';
        return;
      }

      tbody.innerHTML = allTablesCache
        .map(
          t => `
          <tr>
            <td><strong>#${t.id}</strong></td>
            <td><strong>${t.name}</strong></td>
            <td><span class="badge badge-zone-${t.zone}">${t.zone.toUpperCase()}</span></td>
            <td>${t.min_capacity} a <strong>${t.max_capacity}</strong> personas</td>
            <td>
              <span class="badge ${t.is_active ? 'badge-confirmada' : 'badge-cancelada'}">
                ${t.is_active ? 'Activa' : 'Inactiva'}
              </span>
            </td>
            <td><small style="color:#666;">${t.notes || '-'}</small></td>
            <td>
              <div class="btn-group">
                <button class="btn btn-sm btn-secondary" onclick="window.editTable(${t.id})">✏️ Editar</button>
                <button class="btn btn-sm btn-outline-danger" onclick="window.deleteTable(${t.id})">🗑️</button>
              </div>
            </td>
          </tr>
        `
        )
        .join('');
    } catch (err) {
      console.error(err);
    }
  }

  document.getElementById('btnNewTable')?.addEventListener('click', () => {
    document.getElementById('formTable').reset();
    document.getElementById('tableEditId').value = '';
    document.getElementById('modalTableTitle').textContent = 'Nueva Mesa';
    openModal('modalTable');
  });

  window.editTable = function (id) {
    const table = allTablesCache.find(t => t.id === id);
    if (!table) return;

    document.getElementById('tableEditId').value = table.id;
    document.getElementById('tableName').value = table.name;
    document.getElementById('tableMin').value = table.min_capacity;
    document.getElementById('tableMax').value = table.max_capacity;
    document.getElementById('tableZone').value = table.zone;
    document.getElementById('tableActive').value = table.is_active;
    document.getElementById('tableNotes').value = table.notes || '';
    document.getElementById('modalTableTitle').textContent = `Editar Mesa: ${table.name}`;
    openModal('modalTable');
  };

  document.getElementById('formTable')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('tableEditId').value;
    const body = {
      name: document.getElementById('tableName').value,
      min_capacity: document.getElementById('tableMin').value,
      max_capacity: document.getElementById('tableMax').value,
      zone: document.getElementById('tableZone').value,
      is_active: document.getElementById('tableActive').value,
      notes: document.getElementById('tableNotes').value
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admin/tables/${id}` : '/api/admin/tables';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        showToast(id ? 'Mesa actualizada.' : 'Nueva mesa creada.');
        closeModal('modalTable');
        loadTables();
      }
    } catch (err) {
      showToast('Error al guardar mesa', 'error');
    }
  });

  window.deleteTable = async function (id) {
    if (!confirm('¿Seguro que deseas eliminar esta mesa?')) return;
    try {
      const res = await fetch(`/api/admin/tables/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Mesa eliminada.');
        loadTables();
      }
    } catch (err) {
      showToast('Error al eliminar mesa', 'error');
    }
  };

  // ==========================================
  // 4. HORARIOS Y FESTIVOS
  // ==========================================
  async function loadSchedules() {
    try {
      const res = await fetch('/api/admin/schedules');
      const data = await res.json();

      const tbody = document.getElementById('schedulesTableBody');
      tbody.innerHTML = data.schedules
        .map(
          s => `
          <tr data-day="${s.day_of_week}">
            <td><strong>${s.day_name}</strong></td>
            <td>
              <select class="form-control sched-open" style="width:110px;">
                <option value="1" ${s.is_open ? 'selected' : ''}>Abierto</option>
                <option value="0" ${!s.is_open ? 'selected' : ''}>Cerrado</option>
              </select>
            </td>
            <td>
              <div style="display:flex; align-items:center; gap:0.35rem;">
                <input type="time" class="form-control sched-l-start" value="${s.lunch_start || '13:00'}" style="width:110px;">
                <span>a</span>
                <input type="time" class="form-control sched-l-end" value="${s.lunch_end || '16:30'}" style="width:110px;">
              </div>
            </td>
            <td>
              <div style="display:flex; align-items:center; gap:0.35rem;">
                <input type="time" class="form-control sched-d-start" value="${s.dinner_start || '19:30'}" style="width:110px;">
                <span>a</span>
                <input type="time" class="form-control sched-d-end" value="${s.dinner_end || '23:00'}" style="width:110px;">
              </div>
            </td>
          </tr>
        `
        )
        .join('');

      // Festivos / Días cerrados
      const holidayBody = document.getElementById('closedDatesTableBody');
      if (data.closedDates.length === 0) {
        holidayBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:1.25rem; color:#888;">No hay días festivos configurados.</td></tr>';
      } else {
        holidayBody.innerHTML = data.closedDates
          .map(
            cd => `
            <tr>
              <td><strong>${cd.date}</strong></td>
              <td>${cd.reason}</td>
              <td style="text-align:right;">
                <button class="btn btn-sm btn-outline-danger" onclick="window.deleteClosedDate(${cd.id})">Eliminar</button>
              </td>
            </tr>
          `
          )
          .join('');
      }

      // Parámetros de servicio
      const resSettings = await fetch('/api/admin/settings');
      const settingsData = await resSettings.json();
      const st = settingsData.settings;
      if (st) {
        document.getElementById('settingDuration').value = st.reservation_slot_duration_minutes || '90';
        document.getElementById('settingMinAdvance').value = st.reservation_min_advance_hours || '2';
        document.getElementById('settingMaxAdvance').value = st.reservation_max_advance_days || '60';
        document.getElementById('settingMaxParty').value = st.reservations_max_party || '12';
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Guardar horarios semanales
  document.getElementById('btnSaveSchedules')?.addEventListener('click', async () => {
    const rows = document.querySelectorAll('#schedulesTableBody tr');
    const schedules = [];

    rows.forEach(r => {
      const day = parseInt(r.dataset.day, 10);
      const isOpen = r.querySelector('.sched-open').value === '1';
      const lStart = r.querySelector('.sched-l-start').value;
      const lEnd = r.querySelector('.sched-l-end').value;
      const dStart = r.querySelector('.sched-d-start').value;
      const dEnd = r.querySelector('.sched-d-end').value;

      schedules.push({
        day_of_week: day,
        is_open: isOpen,
        lunch_start: isOpen ? lStart : null,
        lunch_end: isOpen ? lEnd : null,
        dinner_start: isOpen ? dStart : null,
        dinner_end: isOpen ? dEnd : null
      });
    });

    try {
      const res = await fetch('/api/admin/schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules })
      });
      if (res.ok) {
        showToast('Horarios semanales guardados correctamente.');
      }
    } catch (err) {
      showToast('Error al guardar horarios', 'error');
    }
  });

  // Guardar parámetros de servicio
  document.getElementById('btnSaveBookingRules')?.addEventListener('click', async () => {
    const payload = {
      reservation_slot_duration_minutes: document.getElementById('settingDuration').value,
      reservation_min_advance_hours: document.getElementById('settingMinAdvance').value,
      reservation_max_advance_days: document.getElementById('settingMaxAdvance').value,
      reservations_max_party: document.getElementById('settingMaxParty').value
    };

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Parámetros de reservas actualizados.');
      }
    } catch (err) {
      showToast('Error al guardar parámetros', 'error');
    }
  });

  // Añadir día festivo cerrado
  document.getElementById('formAddClosedDate')?.addEventListener('submit', async e => {
    e.preventDefault();
    const date = document.getElementById('newClosedDate').value;
    const reason = document.getElementById('newClosedReason').value;

    try {
      const res = await fetch('/api/admin/closed-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, reason })
      });
      if (res.ok) {
        showToast('Día festivo registrado.');
        document.getElementById('newClosedDate').value = '';
        document.getElementById('newClosedReason').value = '';
        loadSchedules();
      }
    } catch (err) {
      showToast('Error al guardar día festivo', 'error');
    }
  });

  window.deleteClosedDate = async function (id) {
    if (!confirm('¿Eliminar este día cerrado?')) return;
    try {
      const res = await fetch(`/api/admin/closed-dates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Día eliminado.');
        loadSchedules();
      }
    } catch (err) {
      showToast('Error al eliminar', 'error');
    }
  };

  // ==========================================
  // 5. CARTA Y MENÚ
  // ==========================================
  let menuCategoriesCache = [];
  let menuDishesCache = [];

  async function loadMenu() {
    try {
      const res = await fetch('/api/admin/menu');
      const data = await res.json();
      menuCategoriesCache = data.categories || [];
      menuDishesCache = data.dishes || [];

      // Categorías
      const catList = document.getElementById('adminCategoriesList');
      catList.innerHTML = menuCategoriesCache
        .map(
          c => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; background:#faf7f2; border:1px solid #e6dfd5; border-radius:6px; margin-bottom:0.5rem;">
            <div>
              <strong>${c.name}</strong> <small style="color:#888;">(Orden: ${c.display_order})</small>
            </div>
            <div class="btn-group">
              <button class="btn btn-sm btn-secondary" onclick="window.editCategory(${c.id})">✏️</button>
              <button class="btn btn-sm btn-outline-danger" onclick="window.deleteCategory(${c.id})">🗑️</button>
            </div>
          </div>
        `
        )
        .join('');

      // Rellenar select de categorías para platos
      const filterCatSel = document.getElementById('filterDishCategory');
      const formCatSel = document.getElementById('dishCategory');

      const options = menuCategoriesCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      filterCatSel.innerHTML = '<option value="all">Todas las categorías</option>' + options;
      formCatSel.innerHTML = options;

      renderDishesAdmin();
    } catch (err) {
      console.error(err);
    }
  }

  function renderDishesAdmin() {
    const catFilter = document.getElementById('filterDishCategory').value;
    const filtered = catFilter === 'all' ? menuDishesCache : menuDishesCache.filter(d => String(d.category_id) === String(catFilter));

    const tbody = document.getElementById('dishesTableBody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem;">No hay platos registrados en esta categoría.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered
      .map(d => {
        const cat = menuCategoriesCache.find(c => c.id === d.category_id);
        return `
          <tr>
            <td style="width:60px;">
              <img src="${d.photo_url || '/assets/img/hero.jpg'}" style="width:50px; height:50px; border-radius:6px; object-fit:cover;">
            </td>
            <td>
              <strong>${d.name}</strong>
              ${d.is_featured ? ' <span class="badge badge-confirmada" style="font-size:0.65rem;">⭐ Destacado</span>' : ''}
              <br><small style="color:#666;">${d.description || ''}</small>
            </td>
            <td>${cat ? cat.name : '-'}</td>
            <td><strong>${d.price.toFixed(2)} €</strong></td>
            <td><small style="color:#666;">${d.allergens || 'Ninguno'}</small></td>
            <td>
              <button class="btn btn-sm ${d.is_available ? 'btn-success' : 'btn-secondary'}" onclick="window.toggleDishAvailable(${d.id})">
                ${d.is_available ? 'Disponible' : 'Agotado'}
              </button>
            </td>
            <td>
              <div class="btn-group">
                <button class="btn btn-sm btn-secondary" onclick="window.editDish(${d.id})">✏️</button>
                <button class="btn btn-sm btn-outline-danger" onclick="window.deleteDish(${d.id})">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  document.getElementById('filterDishCategory')?.addEventListener('change', renderDishesAdmin);

  // Toggle disponibilidad de plato
  window.toggleDishAvailable = async function (id) {
    try {
      const res = await fetch(`/api/admin/dishes/${id}/toggle`, { method: 'POST' });
      if (res.ok) {
        showToast('Disponibilidad actualizada.');
        loadMenu();
      }
    } catch (err) {
      showToast('Error al cambiar disponibilidad', 'error');
    }
  };

  // Crear plato
  document.getElementById('btnNewDish')?.addEventListener('click', () => {
    document.getElementById('formDish').reset();
    document.getElementById('dishEditId').value = '';
    document.getElementById('dishPhotoPreview').src = '';
    document.getElementById('dishPhotoPreviewWrap').style.display = 'none';
    document.querySelectorAll('.allergen-checkbox').forEach(cb => (cb.checked = false));
    document.getElementById('modalDishTitle').textContent = 'Nuevo Plato para la Carta';
    openModal('modalDish');
  });

  window.editDish = function (id) {
    const d = menuDishesCache.find(item => item.id === id);
    if (!d) return;

    document.getElementById('dishEditId').value = d.id;
    document.getElementById('dishName').value = d.name;
    document.getElementById('dishCategory').value = d.category_id;
    document.getElementById('dishPrice').value = d.price;
    document.getElementById('dishDesc').value = d.description || '';
    document.getElementById('dishPhotoUrl').value = d.photo_url || '';
    document.getElementById('dishOrder').value = d.display_order || 0;
    document.getElementById('dishFeatured').checked = Boolean(d.is_featured);

    if (d.photo_url) {
      document.getElementById('dishPhotoPreview').src = d.photo_url;
      document.getElementById('dishPhotoPreviewWrap').style.display = 'block';
    } else {
      document.getElementById('dishPhotoPreviewWrap').style.display = 'none';
    }

    const allergensList = (d.allergens || '').split(',').map(s => s.trim().toLowerCase());
    document.querySelectorAll('.allergen-checkbox').forEach(cb => {
      cb.checked = allergensList.includes(cb.value);
    });

    document.getElementById('modalDishTitle').textContent = `Editar Plato: ${d.name}`;
    openModal('modalDish');
  };

  // Subida de imagen para plato con compresión en cliente
  document.getElementById('dishPhotoFile')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const { dataUrl, filename } = await optimizeAndReadImage(file, 900, 0.85);
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, filename })
      });
      const data = await res.json();
      if (res.ok && data.url) {
        document.getElementById('dishPhotoUrl').value = data.url;
        document.getElementById('dishPhotoPreview').src = data.url;
        document.getElementById('dishPhotoPreviewWrap').style.display = 'block';
        showToast('Foto del plato optimizada y subida.');
      }
    } catch (err) {
      showToast('Error al subir imagen', 'error');
    }
  });

  document.getElementById('formDish')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('dishEditId').value;

    const allergens = Array.from(document.querySelectorAll('.allergen-checkbox:checked'))
      .map(cb => cb.value)
      .join(',');

    const body = {
      name: document.getElementById('dishName').value,
      category_id: document.getElementById('dishCategory').value,
      price: document.getElementById('dishPrice').value,
      description: document.getElementById('dishDesc').value,
      photo_url: document.getElementById('dishPhotoUrl').value,
      allergens,
      display_order: document.getElementById('dishOrder').value,
      is_featured: document.getElementById('dishFeatured').checked ? 1 : 0
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admin/dishes/${id}` : '/api/admin/dishes';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        showToast(id ? 'Plato actualizado.' : 'Plato añadido a la carta.');
        closeModal('modalDish');
        loadMenu();
      }
    } catch (err) {
      showToast('Error al guardar plato', 'error');
    }
  });

  window.deleteDish = async function (id) {
    if (!confirm('¿Seguro que deseas eliminar este plato de la carta?')) return;
    try {
      const res = await fetch(`/api/admin/dishes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Plato eliminado de la carta.');
        loadMenu();
      }
    } catch (err) {
      showToast('Error al eliminar plato', 'error');
    }
  };

  // Crear/Editar Categoría
  document.getElementById('btnNewCategory')?.addEventListener('click', () => {
    const name = prompt('Nombre de la nueva categoría (Ej. Vinos de la Tierra):');
    if (!name || !name.trim()) return;

    fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() })
    }).then(() => {
      showToast('Categoría creada.');
      loadMenu();
    });
  });

  window.editCategory = function (id) {
    const cat = menuCategoriesCache.find(c => c.id === id);
    if (!cat) return;
    const newName = prompt('Nuevo nombre de categoría:', cat.name);
    if (!newName || !newName.trim()) return;

    fetch(`/api/admin/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), description: cat.description, display_order: cat.display_order, is_active: 1 })
    }).then(() => {
      showToast('Categoría renombrada.');
      loadMenu();
    });
  };

  window.deleteCategory = function (id) {
    if (!confirm('¿Eliminar esta categoría y todos sus platos asociados?')) return;
    fetch(`/api/admin/categories/${id}`, { method: 'DELETE' }).then(() => {
      showToast('Categoría eliminada.');
      loadMenu();
    });
  };

  // ==========================================
  // 6. GALERÍA Y FOTO DE PORTADA
  // ==========================================
  async function loadGallery() {
    try {
      const res = await fetch('/api/admin/gallery');
      const data = await res.json();
      const grid = document.getElementById('adminGalleryGrid');

      if (!data.gallery || data.gallery.length === 0) {
        grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:3rem; color:#888;">No hay fotos en la galería.</p>';
        return;
      }

      grid.innerHTML = data.gallery
        .map(
          g => `
          <div style="background:#fff; border:1px solid #e6dfd5; border-radius:10px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.06); display:flex; flex-direction:column;">
            <div style="position:relative; height:180px; background:#111;">
              <img src="${g.image_url}" style="width:100%; height:100%; object-fit:cover;">
              ${g.is_hero ? '<span style="position:absolute; top:8px; left:8px; background:var(--color-primary); color:#fff; font-size:0.75rem; font-weight:bold; padding:0.25rem 0.65rem; border-radius:999px;">⭐ Foto Portada Actual</span>' : ''}
            </div>
            <div style="padding:1rem; flex-grow:1; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <strong style="display:block; font-size:0.95rem; margin-bottom:0.25rem;">${g.title}</strong>
                <span class="badge badge-zone-interior" style="font-size:0.7rem;">${g.category}</span>
              </div>
              <div style="margin-top:1rem; display:flex; gap:0.5rem; justify-content:space-between;">
                ${!g.is_hero ? `<button class="btn btn-sm btn-secondary" onclick="window.setAsHeroPhoto(${g.id})">⭐ Poner en Portada</button>` : '<span></span>'}
                <button class="btn btn-sm btn-outline-danger" onclick="window.deleteGalleryPhoto(${g.id})">🗑️</button>
              </div>
            </div>
          </div>
        `
        )
        .join('');
    } catch (err) {
      console.error(err);
    }
  }

  // Poner como foto principal de la portada (Hero)
  window.setAsHeroPhoto = async function (id) {
    try {
      const res = await fetch(`/api/admin/gallery/${id}/set-hero`, { method: 'POST' });
      if (res.ok) {
        showToast('Foto establecida como imagen principal de la portada.');
        loadGallery();
      }
    } catch (err) {
      showToast('Error al fijar foto de portada', 'error');
    }
  };

  window.deleteGalleryPhoto = async function (id) {
    if (!confirm('¿Eliminar esta foto de la galería?')) return;
    try {
      const res = await fetch(`/api/admin/gallery/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Foto eliminada.');
        loadGallery();
      }
    } catch (err) {
      showToast('Error al eliminar foto', 'error');
    }
  };

  // Subir nueva foto a la galería
  document.getElementById('btnUploadGalleryPhoto')?.addEventListener('click', () => {
    document.getElementById('formGalleryUpload').reset();
    document.getElementById('galleryPreviewWrap').style.display = 'none';
    openModal('modalGalleryUpload');
  });

  document.getElementById('galleryPhotoFile')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const { dataUrl, filename } = await optimizeAndReadImage(file, 1600, 0.85);
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, filename })
      });
      const data = await res.json();
      if (res.ok && data.url) {
        document.getElementById('galleryPhotoUrl').value = data.url;
        document.getElementById('galleryPreviewImg').src = data.url;
        document.getElementById('galleryPreviewWrap').style.display = 'block';
        showToast('Imagen subida con éxito.');
      }
    } catch (err) {
      showToast('Error al subir imagen', 'error');
    }
  });

  document.getElementById('formGalleryUpload')?.addEventListener('submit', async e => {
    e.preventDefault();
    const title = document.getElementById('galleryPhotoTitle').value;
    const category = document.getElementById('galleryPhotoCategory').value;
    const imageUrl = document.getElementById('galleryPhotoUrl').value;
    const isHero = document.getElementById('galleryPhotoIsHero').checked;

    if (!imageUrl) {
      alert('Por favor selecciona una foto para subir.');
      return;
    }

    try {
      const res = await fetch('/api/admin/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          category,
          image_url: imageUrl,
          is_hero: isHero ? 1 : 0
        })
      });

      if (res.ok) {
        showToast('Foto agregada a la galería.');
        closeModal('modalGalleryUpload');
        loadGallery();
      }
    } catch (err) {
      showToast('Error al guardar foto en galería', 'error');
    }
  });

  // ==========================================
  // 7. DATOS DEL RESTAURANTE Y TEXTOS
  // ==========================================
  async function loadSettings() {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      const s = data.settings;

      if (!s) return;

      document.getElementById('setRestName').value = s.restaurant_name || '';
      document.getElementById('setTagline').value = s.tagline || '';
      document.getElementById('setHeroSubtitle').value = s.hero_subtitle || '';
      document.getElementById('setAddress').value = s.address || '';
      document.getElementById('setCity').value = s.city || '';
      document.getElementById('setPostalCode').value = s.postal_code || '';
      document.getElementById('setPhone').value = s.phone || '';
      document.getElementById('setEmail').value = s.email || '';
      document.getElementById('setAdminEmail').value = s.admin_notification_email || '';
      document.getElementById('setHeroImageUrl').value = s.hero_image || '';
      document.getElementById('setMapsIframe').value = s.google_maps_iframe || '';
      document.getElementById('setInstagram').value = s.instagram_url || '';
      document.getElementById('setFacebook').value = s.facebook_url || '';
      document.getElementById('setTripadvisor').value = s.tripadvisor_url || '';
      document.getElementById('setAboutTitle').value = s.about_title || '';
      document.getElementById('setAboutStory').value = s.about_story || '';

      // Interruptor de reservas online
      document.getElementById('setResEnabled').value = s.reservations_enabled || '1';
      document.getElementById('setResDisabledMsg').value = s.reservations_disabled_message || '';
    } catch (err) {
      console.error(err);
    }
  }

  // Subir imagen directa de portada en ajustes
  document.getElementById('btnUploadHeroSetting')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const { dataUrl, filename } = await optimizeAndReadImage(file, 1800, 0.85);
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, filename })
      });
      const data = await res.json();
      if (res.ok && data.url) {
        document.getElementById('setHeroImageUrl').value = data.url;
        showToast('Foto de portada actualizada. Pulsa "Guardar Cambios" para confirmar.');
      }
    } catch (err) {
      showToast('Error al subir imagen', 'error');
    }
  });

  document.getElementById('formRestaurantSettings')?.addEventListener('submit', async e => {
    e.preventDefault();

    const payload = {
      restaurant_name: document.getElementById('setRestName').value,
      tagline: document.getElementById('setTagline').value,
      hero_subtitle: document.getElementById('setHeroSubtitle').value,
      address: document.getElementById('setAddress').value,
      city: document.getElementById('setCity').value,
      postal_code: document.getElementById('setPostalCode').value,
      phone: document.getElementById('setPhone').value,
      email: document.getElementById('setEmail').value,
      admin_notification_email: document.getElementById('setAdminEmail').value,
      hero_image: document.getElementById('setHeroImageUrl').value,
      google_maps_iframe: document.getElementById('setMapsIframe').value,
      instagram_url: document.getElementById('setInstagram').value,
      facebook_url: document.getElementById('setFacebook').value,
      tripadvisor_url: document.getElementById('setTripadvisor').value,
      about_title: document.getElementById('setAboutTitle').value,
      about_story: document.getElementById('setAboutStory').value,
      reservations_enabled: document.getElementById('setResEnabled').value,
      reservations_disabled_message: document.getElementById('setResDisabledMsg').value
    };

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('Todos los datos del restaurante se han guardado con éxito.');
      }
    } catch (err) {
      showToast('Error al guardar datos', 'error');
    }
  });

  // ==========================================
  // 8. PLANTILLAS DE EMAIL Y AUDITORÍA
  // ==========================================
  async function loadEmailSettings() {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      const s = data.settings;

      if (s) {
        document.getElementById('emailConfirmSubject').value = s.email_confirm_subject || '';
        document.getElementById('emailConfirmBody').value = s.email_confirm_body || '';
        document.getElementById('emailCancelSubject').value = s.email_cancel_subject || '';
        document.getElementById('emailCancelBody').value = s.email_cancel_body || '';
      }

      // Cargar logs
      const logRes = await fetch('/api/admin/emails');
      const logData = await logRes.json();
      const logTbody = document.getElementById('emailLogsTableBody');

      if (!logData.logs || logData.logs.length === 0) {
        logTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:#888;">No hay registros de emails enviados todavía.</td></tr>';
      } else {
        logTbody.innerHTML = logData.logs
          .map(
            l => `
            <tr>
              <td><strong>${l.created_at}</strong></td>
              <td>${l.recipient}</td>
              <td><span class="badge badge-confirmada">${l.email_type}</span></td>
              <td>${l.subject}</td>
              <td><span class="badge badge-confirmada">${l.status}</span></td>
            </tr>
          `
          )
          .join('');
      }
    } catch (err) {
      console.error(err);
    }
  }

  document.getElementById('formEmailTemplates')?.addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      email_confirm_subject: document.getElementById('emailConfirmSubject').value,
      email_confirm_body: document.getElementById('emailConfirmBody').value,
      email_cancel_subject: document.getElementById('emailCancelSubject').value,
      email_cancel_body: document.getElementById('emailCancelBody').value
    };

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Plantillas de email actualizadas correctamente.');
      }
    } catch (err) {
      showToast('Error al guardar plantillas', 'error');
    }
  });

  // Enviar email de prueba
  document.getElementById('btnTestEmail')?.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/admin/emails/test', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message);
        loadEmailSettings();
      }
    } catch (err) {
      showToast('Error al enviar email de prueba', 'error');
    }
  });

  // ==========================================
  // 9. USUARIOS Y SEGURIDAD
  // ==========================================
  async function loadUsers() {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      const tbody = document.getElementById('usersTableBody');

      tbody.innerHTML = data.users
        .map(
          u => `
          <tr>
            <td><strong>#${u.id}</strong></td>
            <td><strong>${u.username}</strong></td>
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td><span class="badge badge-confirmada">${u.role}</span></td>
            <td><small style="color:#888;">${u.created_at}</small></td>
          </tr>
        `
        )
        .join('');
    } catch (err) {
      console.error(err);
    }
  }

  // Cambiar contraseña
  document.getElementById('formChangePassword')?.addEventListener('submit', async e => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword !== confirmPassword) {
      alert('La confirmación de la nueva contraseña no coincide.');
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast('Contraseña actualizada con éxito.');
        document.getElementById('formChangePassword').reset();
      } else {
        alert(data.error || 'No se pudo cambiar la contraseña.');
      }
    } catch (err) {
      showToast('Error de conexión', 'error');
    }
  });

  // Crear nuevo usuario admin
  document.getElementById('formCreateUser')?.addEventListener('submit', async e => {
    e.preventDefault();
    const body = {
      username: document.getElementById('newUsername').value,
      password: document.getElementById('newPasswordUser').value,
      name: document.getElementById('newNameUser').value,
      email: document.getElementById('newEmailUser').value,
      role: document.getElementById('newRoleUser').value
    };

    try {
      const res = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast('Nuevo administrador creado con éxito.');
        document.getElementById('formCreateUser').reset();
        loadUsers();
      } else {
        alert(data.error || 'Error al crear usuario.');
      }
    } catch (err) {
      showToast('Error de conexión', 'error');
    }
  });

  // Inicializar en la pestaña Dashboard
  switchTab('dashboard');
});
