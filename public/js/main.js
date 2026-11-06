/**
 * public/js/main.js - Lógica interactiva de la web pública de Tarca Luis
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Menú móvil hamburguesa
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const navLinks = document.getElementById('navLinks');
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });

    // Cerrar al pulsar un enlace
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }

  // 2. Cargar datos generales del restaurante (/api/info)
  async function loadRestaurantInfo() {
    try {
      const res = await fetch('/api/info');
      const data = await res.json();
      const r = data.restaurant;

      if (!r) return;

      // Inyectar textos
      document.querySelectorAll('.js-rest-name').forEach(el => (el.textContent = r.restaurant_name || 'Tarca Luis'));
      document.querySelectorAll('.js-rest-tagline').forEach(el => (el.textContent = r.tagline || 'Auténtica Cocina Canaria'));
      document.querySelectorAll('.js-rest-address').forEach(el => (el.textContent = r.address || 'Los Llanos de Aridane, La Palma'));
      document.querySelectorAll('.js-rest-phone').forEach(el => {
        el.textContent = r.phone || '+34 922 40 12 34';
        if (el.tagName === 'A') el.href = `tel:${(r.phone || '').replace(/\s+/g, '')}`;
      });
      document.querySelectorAll('.js-rest-email').forEach(el => {
        el.textContent = r.email || 'info@tarcaluis.es';
        if (el.tagName === 'A') el.href = `mailto:${r.email || ''}`;
      });

      // Hero image
      if (r.hero_image) {
        const heroBg = document.getElementById('heroBgImage');
        if (heroBg) heroBg.src = r.hero_image;
      }

      // Hero subtitle
      const heroSub = document.getElementById('heroSubtitle');
      if (heroSub && r.hero_subtitle) heroSub.textContent = r.hero_subtitle;

      // Sobre Nosotros
      const aboutTitle = document.getElementById('aboutStoryTitle');
      if (aboutTitle && r.about_title) aboutTitle.textContent = r.about_title;

      const aboutText = document.getElementById('aboutStoryText');
      if (aboutText && r.about_story) {
        aboutText.innerHTML = r.about_story
          .split('\n\n')
          .map(p => `<p>${p}</p>`)
          .join('');
      }

      // Mapa interactivo
      const mapBox = document.getElementById('googleMapContainer');
      if (mapBox && r.google_maps_iframe) {
        mapBox.innerHTML = r.google_maps_iframe;
      }

      // Redes sociales
      if (r.instagram_url) {
        document.querySelectorAll('.js-social-instagram').forEach(a => (a.href = r.instagram_url));
      }
      if (r.facebook_url) {
        document.querySelectorAll('.js-social-facebook').forEach(a => (a.href = r.facebook_url));
      }
      if (r.tripadvisor_url) {
        document.querySelectorAll('.js-social-tripadvisor').forEach(a => (a.href = r.tripadvisor_url));
      }

      // Horario de hoy y tabla semanal
      renderSchedules(data.schedules, data.todaySchedule);
    } catch (err) {
      console.error('Error cargando info restaurante:', err);
    }
  }

  // Renderizar tabla de horarios
  function renderSchedules(schedules, todaySchedule) {
    if (!schedules) return;

    // Indicador rápido en la barra superior
    const statusPill = document.getElementById('topTodayStatus');
    if (statusPill && todaySchedule) {
      if (todaySchedule.is_open) {
        statusPill.innerHTML = `
          <span class="pulse-dot"></span>
          <span>Abierto hoy: ${todaySchedule.lunch_start} - ${todaySchedule.lunch_end} / ${todaySchedule.dinner_start} - ${todaySchedule.dinner_end}</span>
        `;
      } else {
        statusPill.innerHTML = `
          <span style="width:7px; height:7px; background:#e74c3c; border-radius:50%; display:inline-block;"></span>
          <span>Cerrado hoy por descanso semanal</span>
        `;
      }
    }

    // Tabla de horarios semanal en sección contacto
    const scheduleBody = document.getElementById('scheduleTableBody');
    if (scheduleBody) {
      const todayNum = new Date().getDay();
      let rowsHtml = '';

      schedules.forEach(s => {
        const isToday = s.day_of_week === todayNum;
        const rowClass = isToday ? 'class="today-row"' : '';
        const todayBadge = isToday ? ' <strong style="color:var(--color-primary);">(Hoy)</strong>' : '';

        let hoursStr = 'Cerrado';
        if (s.is_open) {
          hoursStr = `${s.lunch_start} - ${s.lunch_end}  |  ${s.dinner_start} - ${s.dinner_end}`;
        }

        rowsHtml += `
          <tr ${rowClass}>
            <td><strong>${s.day_name}</strong>${todayBadge}</td>
            <td style="text-align:right;">${hoursStr}</td>
          </tr>
        `;
      });

      scheduleBody.innerHTML = rowsHtml;
    }
  }

  // 3. Cargar Carta y Menú (/api/menu)
  let allDishesData = [];

  async function loadMenu() {
    try {
      const res = await fetch('/api/menu');
      const data = await res.json();
      allDishesData = data.allDishes || [];

      // Renderizar pestañas de categorías
      const catTabs = document.getElementById('categoryTabs');
      if (catTabs && data.categories) {
        let tabsHtml = `<button class="cat-tab-btn active" data-category="all">✨ Todos los Platos</button>`;
        data.categories.forEach(cat => {
          tabsHtml += `<button class="cat-tab-btn" data-category="${cat.id}">${cat.name}</button>`;
        });
        catTabs.innerHTML = tabsHtml;

        // Eventos en pestañas
        catTabs.querySelectorAll('.cat-tab-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            catTabs.querySelectorAll('.cat-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderDishes(btn.dataset.category);
          });
        });
      }

      // Render inicial con todos los platos
      renderDishes('all');
    } catch (err) {
      console.error('Error cargando carta:', err);
    }
  }

  // Diccionario de iconos y nombres de alérgenos UE
  const ALLERGEN_LABELS = {
    gluten: { name: 'Gluten', icon: '🌾' },
    lacteos: { name: 'Lácteos', icon: '🥛' },
    huevos: { name: 'Huevos', icon: '🥚' },
    pescado: { name: 'Pescado', icon: '🐟' },
    crustaceos: { name: 'Crustáceos', icon: '🦐' },
    moluscos: { name: 'Moluscos', icon: '🦪' },
    frutos_secos: { name: 'Frutos de cáscara', icon: '🥜' },
    cacahuetes: { name: 'Cacahuetes', icon: '🥜' },
    soja: { name: 'Soja', icon: '🌱' },
    apio: { name: 'Apio', icon: '🥬' },
    mostaza: { name: 'Mostaza', icon: '🟡' },
    sesamo: { name: 'Sésamo', icon: '⚪' },
    sulfitos: { name: 'Sulfitos', icon: '🍷' },
    altramuces: { name: 'Altramuces', icon: '🌼' }
  };

  function renderDishes(catId) {
    const grid = document.getElementById('dishesGrid');
    if (!grid) return;

    const filtered = catId === 'all' ? allDishesData : allDishesData.filter(d => String(d.category_id) === String(catId));

    if (filtered.length === 0) {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding:3rem; color:var(--color-text-muted);">No hay platos en esta categoría actualmente.</p>';
      return;
    }

    grid.innerHTML = filtered
      .map(dish => {
        // Alérgenos chips
        let allergensHtml = '';
        if (dish.allergens) {
          const list = dish.allergens.split(',').map(s => s.trim().toLowerCase());
          allergensHtml = list
            .filter(a => ALLERGEN_LABELS[a])
            .map(a => `<span class="allergen-chip" title="${ALLERGEN_LABELS[a].name}">${ALLERGEN_LABELS[a].icon} ${ALLERGEN_LABELS[a].name}</span>`)
            .join('');
        }

        const featuredBadge = dish.is_featured ? `<span class="dish-featured-badge">⭐ Especialidad</span>` : '';

        return `
          <article class="dish-card">
            <div class="dish-image-wrap">
              <img src="${dish.photo_url || '/assets/img/hero.jpg'}" alt="${dish.name}" loading="lazy">
              ${featuredBadge}
              <span class="dish-price-badge">${dish.price.toFixed(2)} €</span>
            </div>
            <div class="dish-body">
              <h3 class="dish-title">${dish.name}</h3>
              <p class="dish-desc">${dish.description || ''}</p>
              <div class="dish-footer">
                <div class="allergens-list">
                  ${allergensHtml || '<span style="font-size:0.75rem; color:#888;">Sin alérgenos declarados</span>'}
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  // 4. Galería y Visor Modal Lightbox
  let galleryPhotos = [];
  let currentLightboxIdx = 0;

  const modal = document.getElementById('lightboxModal');
  const modalImg = document.getElementById('lightboxImg');
  const modalCaption = document.getElementById('lightboxCaption');
  const btnClose = document.getElementById('lightboxClose');
  const btnPrev = document.getElementById('lightboxPrev');
  const btnNext = document.getElementById('lightboxNext');

  async function loadGallery() {
    try {
      const res = await fetch('/api/gallery');
      const data = await res.json();
      galleryPhotos = data.photos || [];

      const grid = document.getElementById('galleryGrid');
      if (!grid) return;

      grid.innerHTML = galleryPhotos
        .map(
          (p, idx) => `
          <div class="gallery-item" data-idx="${idx}">
            <img src="${p.image_url}" alt="${p.title}" loading="lazy">
            <div class="gallery-overlay">
              <span class="gallery-badge">${p.category}</span>
              <h4 class="gallery-title">${p.title}</h4>
            </div>
          </div>
        `
        )
        .join('');

      // Clics para abrir modal
      grid.querySelectorAll('.gallery-item').forEach(item => {
        item.addEventListener('click', () => {
          openLightbox(parseInt(item.dataset.idx, 10));
        });
      });
    } catch (err) {
      console.error('Error cargando galería:', err);
    }
  }

  function openLightbox(idx) {
    if (!galleryPhotos[idx]) return;
    currentLightboxIdx = idx;
    modalImg.src = galleryPhotos[idx].image_url;
    modalCaption.textContent = galleryPhotos[idx].title;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  function nextPhoto() {
    currentLightboxIdx = (currentLightboxIdx + 1) % galleryPhotos.length;
    openLightbox(currentLightboxIdx);
  }

  function prevPhoto() {
    currentLightboxIdx = (currentLightboxIdx - 1 + galleryPhotos.length) % galleryPhotos.length;
    openLightbox(currentLightboxIdx);
  }

  if (btnClose) btnClose.addEventListener('click', closeLightbox);
  if (btnNext) btnNext.addEventListener('click', nextPhoto);
  if (btnPrev) btnPrev.addEventListener('click', prevPhoto);

  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeLightbox();
    });
  }

  document.addEventListener('keydown', e => {
    if (!modal || !modal.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') nextPhoto();
    if (e.key === 'ArrowLeft') prevPhoto();
  });

  // Ejecutar cargas iniciales
  loadRestaurantInfo();
  loadMenu();
  loadGallery();
});
