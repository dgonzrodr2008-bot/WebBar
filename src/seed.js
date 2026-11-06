/**
 * src/seed.js - Poblado inicial con datos auténticos de La Palma y configuración completa
 */
const { db, initSchema } = require('./db.js');
const { hashPassword } = require('./auth.js');

function seedDatabase() {
  initSchema();

  console.log('--- Iniciando sembrado de datos para Restaurante Tarca Luis ---');

  // 1. Usuario Administrador por defecto
  const existingAdmin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  if (!existingAdmin) {
    const { hash, salt } = hashPassword('admin1234');
    db.prepare(`
      INSERT INTO users (username, password_hash, salt, name, email, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('admin', hash, salt, 'Luis Tarca', 'admin@tarcaluis.es', 'admin');
    console.log('✓ Usuario admin creado (usuario: admin / pass: admin1234)');
  }

  // 2. Parámetros y textos del Restaurante (Settings)
  const settingsData = [
    ['restaurant_name', 'Restaurante Tarca Luis', 'Nombre comercial del restaurante'],
    ['tagline', 'Auténtica Cocina Canaria, Brasas & Alma Palmera', 'Lema corto'],
    ['hero_subtitle', 'Sabores arraigados en la tierra volcánica de La Palma: carnes a la brasa, papas arrugadas, quesos de la isla y pesca fresca del litoral.', 'Subtítulo de portada'],
    ['address', 'Calle Real 14, 38760 Los Llanos de Aridane, La Palma', 'Dirección física completa'],
    ['city', 'Los Llanos de Aridane', 'Municipio'],
    ['island', 'La Palma (Islas Canarias)', 'Isla y archipiélago'],
    ['postal_code', '38760', 'Código postal'],
    ['phone', '+34 922 40 12 34', 'Teléfono de contacto y reservas telefónicas'],
    ['email', 'info@tarcaluis.es', 'Email público de información'],
    ['admin_notification_email', 'reservas@tarcaluis.es', 'Email donde el restaurante recibe avisos de reservas'],
    ['hero_image', '/assets/img/hero.jpg', 'Imagen principal de la cabecera'],
    ['google_maps_iframe', '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d14006.994247514333!2d-17.9198642!3d28.6583921!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xc682200dc890df3%3A0x8aa868f773ff4d20!2sLos%20Llanos%20de%20Aridane%2C%20Santa%20Cruz%20de%20Tenerife!5e0!3m2!1ses!2ses!4v1700000000000!5m2!1ses!2ses" width="100%" height="380" style="border:0;" allowfullscreen="" loading="lazy"></iframe>', 'Iframe de mapa de Google Maps'],
    ['google_maps_url', 'https://maps.google.com/?q=Los+Llanos+de+Aridane+La+Palma', 'Enlace directo a Google Maps'],
    ['instagram_url', 'https://instagram.com/tarcaluis_lapalma', 'Perfil de Instagram'],
    ['facebook_url', 'https://facebook.com/tarcaluis', 'Página de Facebook'],
    ['tripadvisor_url', 'https://tripadvisor.es/restaurant-tarca-luis-la-palma', 'Ficha de TripAdvisor'],
    ['about_title', 'Tradición, Fuego y Producto Palmero', 'Título sección Sobre Nosotros'],
    ['about_story', 'En el corazón del Valle de Aridane, "Tarca Luis" nació como un homenaje a la cocina de nuestras abuelas palmeras y a la lumbre de las brasas tradicionales. Regentado por la familia Tarca desde hace más de tres décadas, cada plato refleja el respeto absoluto por el producto autóctono: cabrito criado en las cumbres de la isla, verduras ecológicas de las huertas de Puntagorda, el reconocido queso artesanal palmero ahumado con cáscara de almendra y pinocha, y los pescados que cada mañana desembarcan en el Puerto de Tazacorte.\n\nNuestro comedor, con vigas centenarias de madera de tea y muros de piedra volcánica, ofrece un refugio acogedor donde disfrutar de una copa de Malvasía o Listán Negro mientras el aroma a sarmiento inunda el ambiente.', 'Texto de Sobre Nosotros'],
    ['about_cuisine', 'La cocina canaria es un diálogo entre el volcán, los vientos alisios y el océano Atlántico. En Tarca Luis elaboramos a diario nuestros propios mojos (el mojo picón y el mojo verde de cilantro fresco en mortero tradicional), arrugamos las papas bonitas con sal marina virgen de las Salinas de Fuencaliente y asamos al punto perfecto las mejores piezas de carne.', 'Filosofía culinaria'],
    ['reservations_enabled', '1', 'Reservas online activas (1=Sí, 0=No)'],
    ['reservations_disabled_message', 'Actualmente las reservas online están cerradas por aforo completo. Rogamos contactar por teléfono al 922 40 12 34 para consultar huecos de última hora.', 'Mensaje si reservas online desactivadas'],
    ['reservations_max_party', '12', 'Máximo comensales por reserva online'],
    ['reservation_slot_duration_minutes', '90', 'Duración estimada de cada servicio (minutos)'],
    ['reservation_min_advance_hours', '2', 'Antelación mínima requerida para reservar el mismo día (horas)'],
    ['reservation_max_advance_days', '60', 'Antelación máxima permitida (días)'],
    ['email_confirm_subject', '¡Mesa confirmada en {restaurante_nombre}! (Ref: {codigo})', 'Asunto del email de confirmación'],
    ['email_confirm_body', '¡Hola {nombre}!\n\nTu reserva en {restaurante_nombre} ha sido confirmada con éxito.\n\nDetalles de la mesa:\n- Localizador: {codigo}\n- Fecha: {fecha}\n- Hora: {hora}\n- Comensales: {personas} persona(s)\n- Teléfono: {telefono}\n- Observaciones: {notas}\n\nSi necesitas cancelar o cambiar tu reserva, puedes cancelarla en este enlace único:\n{enlace_cancelar}\n\n¡Gracias por visitarnos!\n{restaurante_direccion}\nTel: {restaurante_telefono}', 'Cuerpo del email de confirmación'],
    ['email_cancel_subject', 'Reserva cancelada en {restaurante_nombre} ({codigo})', 'Asunto email cancelación'],
    ['email_cancel_body', 'Hola {nombre},\n\nTe informamos que tu reserva {codigo} para el día {fecha} a las {hora} ha sido cancelada correctamente.\n\nEsperamos verte muy pronto de nuevo por nuestro restaurante.\n\nUn saludo cordial,\nEl equipo de {restaurante_nombre}', 'Cuerpo email cancelación']
  ];

  const stmtSetting = db.prepare(`
    INSERT INTO settings (key, value, description)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET description = excluded.description
  `);

  for (const [key, val, desc] of settingsData) {
    // Si no existe, lo insertamos
    const exists = db.prepare('SELECT key FROM settings WHERE key = ?').get(key);
    if (!exists) {
      stmtSetting.run(key, val, desc);
    }
  }
  console.log('✓ Configuración y textos generales guardados');

  // 3. Mesas del Restaurante
  const countTables = db.prepare('SELECT count(*) as total FROM restaurant_tables').get().total;
  if (countTables === 0) {
    const tables = [
      { name: 'Mesa 1 - Rincón de Tea', min: 1, max: 2, zone: 'interior', notes: 'Mesa íntima junto al arco de tea' },
      { name: 'Mesa 2 - Comedor Principal', min: 2, max: 4, zone: 'interior', notes: 'Mesa central de madera rústica' },
      { name: 'Mesa 3 - Comedor Principal', min: 2, max: 4, zone: 'interior', notes: 'Cerca de las brasas vistas' },
      { name: 'Mesa 4 - Chimenea', min: 4, max: 6, zone: 'interior', notes: 'Mesa familiar junto al fuego rústico' },
      { name: 'Mesa 5 - El Rincón Palmero', min: 4, max: 8, zone: 'interior', notes: 'Mesa amplia para grupos' },
      { name: 'Terraza 1 - Palmeras', min: 1, max: 2, zone: 'terraza', notes: 'Mesa para parejas con vistas al jardín' },
      { name: 'Terraza 2 - Palmeras', min: 2, max: 4, zone: 'terraza', notes: 'Ambiente exterior con toldo natural' },
      { name: 'Terraza 3 - Palmeras', min: 2, max: 4, zone: 'terraza', notes: 'Iluminación cálida nocturna' },
      { name: 'Terraza 4 - Palmeras', min: 4, max: 6, zone: 'terraza', notes: 'Mesa exterior espaciosa' },
      { name: 'Terraza Imperial - Grupos', min: 6, max: 12, zone: 'terraza', notes: 'Mesa grande imperial exterior' },
      { name: 'Porche 1 - Balcón', min: 2, max: 4, zone: 'porche', notes: 'Bajo techado tradicional palmero' },
      { name: 'Porche 2 - Balcón', min: 2, max: 4, zone: 'porche', notes: 'Bajo techado tradicional palmero' }
    ];

    const stmtTable = db.prepare(`
      INSERT INTO restaurant_tables (name, min_capacity, max_capacity, zone, is_active, notes)
      VALUES (?, ?, ?, ?, 1, ?)
    `);

    for (const t of tables) {
      stmtTable.run(t.name, t.min, t.max, t.zone, t.notes);
    }
    console.log(`✓ ${tables.length} mesas configuradas por zonas (interior, terraza, porche)`);
  }

  // 4. Horarios semanales
  const countSchedules = db.prepare('SELECT count(*) as total FROM schedules').get().total;
  if (countSchedules === 0) {
    const weekDays = [
      { day: 0, name: 'Domingo', open: 1, lStart: '13:00', lEnd: '17:00', dStart: '19:30', dEnd: '22:30' },
      { day: 1, name: 'Lunes', open: 0, lStart: null, lEnd: null, dStart: null, dEnd: null }, // Cerrado por descanso
      { day: 2, name: 'Martes', open: 1, lStart: '13:00', lEnd: '16:30', dStart: '19:30', dEnd: '23:00' },
      { day: 3, name: 'Miércoles', open: 1, lStart: '13:00', lEnd: '16:30', dStart: '19:30', dEnd: '23:00' },
      { day: 4, name: 'Jueves', open: 1, lStart: '13:00', lEnd: '16:30', dStart: '19:30', dEnd: '23:00' },
      { day: 5, name: 'Viernes', open: 1, lStart: '13:00', lEnd: '16:30', dStart: '19:30', dEnd: '23:30' },
      { day: 6, name: 'Sábado', open: 1, lStart: '13:00', lEnd: '17:00', dStart: '19:30', dEnd: '23:30' }
    ];

    const stmtSchedule = db.prepare(`
      INSERT INTO schedules (day_of_week, day_name, is_open, lunch_start, lunch_end, dinner_start, dinner_end)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of weekDays) {
      stmtSchedule.run(s.day, s.name, s.open, s.lStart, s.lEnd, s.dStart, s.dEnd);
    }
    console.log('✓ Horarios semanales de servicio (comida y cena) registrados');
  }

  // 5. Categorías de la Carta
  const countCats = db.prepare('SELECT count(*) as total FROM menu_categories').get().total;
  if (countCats === 0) {
    const categories = [
      { name: 'Entrantes & Tapas Palmeras', slug: 'entrantes', desc: 'Sabores tradicionales canarios para compartir y abrir boca', order: 1 },
      { name: 'Carnes a la Brasa & Caldereta', slug: 'carnes', desc: 'Carnes seleccionadas al fuego de carbón vegetal y madera de monteverde', order: 2 },
      { name: 'Pescados Frescos del Litoral', slug: 'pescados', desc: 'Pesca del día llegada directamente del puerto de Tazacorte', order: 3 },
      { name: 'Postres Caseros Tradicionales', slug: 'postres', desc: 'La gran repostería palmera elaborada con recetas familiares', order: 4 },
      { name: 'Vinos de La Palma & Bebidas', slug: 'bebidas', desc: 'Malvasías, Listanes y caldos cultivados en suelo volcánico', order: 5 }
    ];

    const stmtCat = db.prepare(`
      INSERT INTO menu_categories (name, slug, description, display_order, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);

    for (const c of categories) {
      stmtCat.run(c.name, c.slug, c.desc, c.order);
    }
    console.log(`✓ ${categories.length} categorías de carta creadas`);
  }

  // 6. Platos de la Carta
  const countDishes = db.prepare('SELECT count(*) as total FROM dishes').get().total;
  if (countDishes === 0) {
    // Mapear IDs de categorías
    const cats = db.prepare('SELECT id, slug FROM menu_categories').all();
    const catMap = {};
    cats.forEach(c => (catMap[c.slug] = c.id));

    const dishesList = [
      // Entrantes
      {
        cat: 'entrantes',
        name: 'Papas Arrugadas con Dúo de Mojos',
        desc: 'Papas tradicionales cocidas con sal marina virgen de Fuencaliente, acompañadas de mojo rojo picón palmero y mojo verde de cilantro fresco.',
        price: 6.5,
        photo: '/assets/img/papas-arrugadas.jpg',
        allergens: '',
        featured: 1,
        order: 1
      },
      {
        cat: 'entrantes',
        name: 'Queso Palmero D.O. Asado a la Brasa',
        desc: 'Auténtico queso de cabra palmero ahumado, asado sobre brasas de tea y bañado con mojo rojo casero y lágrimas de miel de cumbre.',
        price: 9.8,
        photo: '/assets/img/queso-asado.jpg',
        allergens: 'lacteos',
        featured: 1,
        order: 2
      },
      {
        cat: 'entrantes',
        name: 'Croquetas Caseras de Puchero Palmero',
        desc: 'Cremosas croquetas elaboradas con la carne desmigada de nuestro puchero canario y rebozado crujiente (6 unidades).',
        price: 8.5,
        photo: '/assets/img/croquetas.jpg',
        allergens: 'gluten,lacteos,huevos',
        featured: 0,
        order: 3
      },
      {
        cat: 'entrantes',
        name: 'Escaldón de Gofio de Maíz con Chicharrones',
        desc: 'Gofio tradicional de grano tostado de La Palma escaldado con caldo rico de carne, cebolla roja marinada y mojo picón.',
        price: 7.9,
        photo: '/assets/img/escaldon-gofio.jpg',
        allergens: 'gluten',
        featured: 0,
        order: 4
      },
      {
        cat: 'entrantes',
        name: 'Ensalada Templada de la Huerta Palmera',
        desc: 'Hojas tiernas, aguacate de Puntagorda, tomate aliñado, rulo de cabra caramelizado y vinagreta de miel de caña y nueces.',
        price: 11.5,
        photo: '/assets/img/ensalada-palmera.jpg',
        allergens: 'lacteos,frutos_secos',
        featured: 0,
        order: 5
      },

      // Carnes
      {
        cat: 'carnes',
        name: 'Carne de Cabra Estofada al Estilo Tarca',
        desc: 'Guisada lentamente durante horas en cazuela de barro con vino tinto de la isla, pimientos, hierbas de cumbre y papas de la tierra.',
        price: 15.8,
        photo: '/assets/img/carne-cabra.jpg',
        allergens: 'sulfitos',
        featured: 1,
        order: 1
      },
      {
        cat: 'carnes',
        name: 'Chuleton de Vaca Madurada a la Brasa (1 kg aprox.)',
        desc: 'Carne madurada 45 días, asada a fuego vivo con sal volcánica en escamas y guarnición de pimientos de Padrón y papas fritas rústicas.',
        price: 46.0,
        photo: '/assets/img/chuleton-brasa.jpg',
        allergens: '',
        featured: 1,
        order: 2
      },
      {
        cat: 'carnes',
        name: 'Solomillo de Cerdo con Mojo Dulce de Higos',
        desc: 'Medallones tiernos a la brasa napados con salsa reducida de higos pasados palmeros y puré de batata de jable.',
        price: 16.5,
        photo: '/assets/img/solomillo-higos.jpg',
        allergens: 'sulfitos',
        featured: 0,
        order: 3
      },
      {
        cat: 'carnes',
        name: 'Secreto Ibérico a la Lumbre con Mojo Picón',
        desc: 'Corte jugoso asado en su punto crujiente exterior, acompañado de pimientos asados y papas confitadas al romero.',
        price: 17.5,
        photo: '/assets/img/secreto-iberico.jpg',
        allergens: '',
        featured: 0,
        order: 4
      },

      // Pescados
      {
        cat: 'pescados',
        name: 'Cherne Fresco a la Espalda con Ajo Tostado',
        desc: 'Pieza noble del litoral de Tazacorte marcada a la plancha con sofrito de ajo laminado, guindilla suave, perejil y papas arrugadas.',
        price: 19.5,
        photo: '/assets/img/cherne-espalda.jpg',
        allergens: 'pescado',
        featured: 1,
        order: 1
      },
      {
        cat: 'pescados',
        name: 'Pulpo Crujiente a la Brasa sobre Puré de Batata',
        desc: 'Pata de pulpo entera con el toque ahumado de nuestras brasas, servida sobre suave puré de batata amarilla y emulsión de mojo verde.',
        price: 21.0,
        photo: '/assets/img/pulpo-brasa.jpg',
        allergens: 'moluscos',
        featured: 1,
        order: 2
      },
      {
        cat: 'pescados',
        name: 'Calamares Saharianos Fritos con Alioli Suave',
        desc: 'Tiras tiernas y crujientes de calamar sahariano de costa, acompañadas de alioli artesanal con un toque de limón canario.',
        price: 14.5,
        photo: '/assets/img/calamares-fritos.jpg',
        allergens: 'moluscos,gluten,huevos',
        featured: 0,
        order: 3
      },

      // Postres
      {
        cat: 'postres',
        name: 'Príncipe Alberto Tradicional de La Palma',
        desc: 'La joya dulce de la isla creada por doña Matilde Arroyo: crema densa de chocolate noble, avellanas, almendras tostadas y bizcochos al café.',
        price: 5.8,
        photo: '/assets/img/principe-alberto.jpg',
        allergens: 'lacteos,frutos_secos,gluten,huevos',
        featured: 1,
        order: 1
      },
      {
        cat: 'postres',
        name: 'Bienmesabe Palmero con Helado de Vainilla',
        desc: 'Dulce centenario a base de almendra pelada del norte de la isla, azúcar, yemas de huevo y canela, con helado artesano mantecado.',
        price: 5.5,
        photo: '/assets/img/bienmesabe.jpg',
        allergens: 'frutos_secos,huevos,lacteos',
        featured: 1,
        order: 2
      },
      {
        cat: 'postres',
        name: 'Quesillo Casero con Caramelo de Ron Miel',
        desc: 'Flan denso canario elaborado al baño maría con leche condensada, bañado en caramelo oscuro aromatizado con ron miel de caña.',
        price: 4.8,
        photo: '/assets/img/quesillo.jpg',
        allergens: 'lacteos,huevos',
        featured: 0,
        order: 3
      },
      {
        cat: 'postres',
        name: 'Mousse Ligera de Gofio Palmero',
        desc: 'Espuma delicada de gofio de trigo y millo con virutas de almendra tostada y un hilo de miel de flores silvestres.',
        price: 5.2,
        photo: '/assets/img/mousse-gofio.jpg',
        allergens: 'lacteos,gluten,frutos_secos',
        featured: 0,
        order: 4
      },

      // Bebidas
      {
        cat: 'bebidas',
        name: 'Vino Blanco Seco Malvasía D.O. La Palma',
        desc: 'Cepa autóctona cultivada en ceniza volcánica. Aromas florales cítricos y mineralidad atlántica inconfundible (75 cl).',
        price: 24.0,
        photo: '/assets/img/vino-blanco.jpg',
        allergens: 'sulfitos',
        featured: 1,
        order: 1
      },
      {
        cat: 'bebidas',
        name: 'Vino Tinto Listán Negro D.O. La Palma',
        desc: 'Crianza en barrica con notas a frutos negros maduros, tostados elegantes y fondo especiado volcánico (75 cl).',
        price: 22.0,
        photo: '/assets/img/vino-tinto.jpg',
        allergens: 'sulfitos',
        featured: 0,
        order: 2
      },
      {
        cat: 'bebidas',
        name: 'Vino de Tea Artesanal de La Palma',
        desc: 'Vino tradicional único envejecido en barricas históricas de pino canario (madera de tea), con carácter y personalidad inimitable.',
        price: 18.0,
        photo: '/assets/img/vino-tea.jpg',
        allergens: 'sulfitos',
        featured: 0,
        order: 3
      },
      {
        cat: 'bebidas',
        name: 'Cerveza Dorada Especial de Barril (Copa)',
        desc: 'Cerveza canaria rubia, fresca y bien tirada.',
        price: 2.8,
        photo: '/assets/img/cerveza-canaria.jpg',
        allergens: 'gluten',
        featured: 0,
        order: 4
      }
    ];

    const stmtDish = db.prepare(`
      INSERT INTO dishes (category_id, name, description, price, photo_url, allergens, is_available, is_featured, display_order)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    for (const d of dishesList) {
      const catId = catMap[d.cat];
      if (catId) {
        stmtDish.run(catId, d.name, d.desc, d.price, d.photo, d.allergens, d.featured, d.order);
      }
    }
    console.log(`✓ ${dishesList.length} platos auténticos canarios registrados en la carta`);
  }

  // 7. Galería de Fotos inicial
  const countGallery = db.prepare('SELECT count(*) as total FROM gallery').get().total;
  if (countGallery === 0) {
    const galleryItems = [
      { title: 'Comedor rústico con vigas de tea', cat: 'local', img: '/assets/img/galeria-comedor.jpg', hero: 1, order: 1 },
      { title: 'Papas arrugadas con dúo de mojos', cat: 'platos', img: '/assets/img/papas-arrugadas.jpg', hero: 0, order: 2 },
      { title: 'Terraza jardín entre palmeras canarias', cat: 'terraza', img: '/assets/img/galeria-terraza.jpg', hero: 0, order: 3 },
      { title: 'Brasas de sarmiento y carnes al punto', cat: 'ambiente', img: '/assets/img/galeria-brasas.jpg', hero: 0, order: 4 },
      { title: 'Queso palmero asado con mojo rojo', cat: 'platos', img: '/assets/img/queso-asado.jpg', hero: 0, order: 5 },
      { title: 'Pulpo crujiente con puré de batata', cat: 'platos', img: '/assets/img/pulpo-brasa.jpg', hero: 0, order: 6 },
      { title: 'Príncipe Alberto tradicional', cat: 'platos', img: '/assets/img/principe-alberto.jpg', hero: 0, order: 7 },
      { title: 'Atardecer en el porche palmero', cat: 'ambiente', img: '/assets/img/galeria-porche.jpg', hero: 0, order: 8 }
    ];

    const stmtGal = db.prepare(`
      INSERT INTO gallery (title, category, image_url, display_order, is_hero)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const g of galleryItems) {
      stmtGal.run(g.title, g.cat, g.img, g.order, g.hero);
    }
    console.log(`✓ ${galleryItems.length} imágenes de galería añadidas`);
  }

  // 8. Reservas de muestra para pruebas
  const countRes = db.prepare('SELECT count(*) as total FROM reservations').get().total;
  if (countRes === 0) {
    const sampleReservations = [
      {
        code: 'TL-26-M49X',
        name: 'Elena Morales Santana',
        email: 'elena.morales@ejemplo.com',
        phone: '+34 622 11 22 33',
        party: 4,
        date: new Date().toISOString().split('T')[0],
        time: '14:00',
        endTime: '15:30',
        tableId: 2,
        status: 'confirmada',
        notes: 'Celebración familiar. Rogamos trona para bebé.',
        token: 'token-demo-elena-1234',
        source: 'web'
      },
      {
        code: 'TL-26-B81P',
        name: 'Carlos Schmidt',
        email: 'carlos.schmidt@ejemplo.de',
        phone: '+49 170 9876543',
        party: 2,
        date: new Date().toISOString().split('T')[0],
        time: '20:30',
        endTime: '22:00',
        tableId: 6,
        status: 'confirmada',
        notes: 'Preferencia mesa en terraza. Uno de los comensales es celíaco.',
        token: 'token-demo-carlos-5678',
        source: 'web'
      },
      {
        code: 'TL-26-W30Z',
        name: 'Manuel Pérez Hernández',
        email: 'manuel.perez@ejemplo.com',
        phone: '+34 699 44 55 66',
        party: 6,
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: '14:30',
        endTime: '16:00',
        tableId: 4,
        status: 'pendiente',
        notes: 'Reserva telefónica pendiente de reconfirmar hora exacta.',
        token: 'token-demo-manuel-9012',
        source: 'telefono'
      }
    ];

    const stmtRes = db.prepare(`
      INSERT INTO reservations (
        code, customer_name, customer_email, customer_phone, party_size,
        reservation_date, reservation_time, end_time, table_id,
        status, notes, cancel_token, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const r of sampleReservations) {
      stmtRes.run(
        r.code,
        r.name,
        r.email,
        r.phone,
        r.party,
        r.date,
        r.time,
        r.endTime,
        r.tableId,
        r.status,
        r.notes,
        r.token,
        r.source
      );
    }
    console.log(`✓ ${sampleReservations.length} reservas de prueba creadas`);
  }

  console.log('--- Sembrado de base de datos finalizado con éxito ---');
}

module.exports = {
  seedDatabase
};

if (require.main === module) {
  seedDatabase();
}
