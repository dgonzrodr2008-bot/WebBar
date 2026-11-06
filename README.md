# 🍽️ Restaurante Tarca Luis — La Palma (Islas Canarias)

Aplicación web profesional completa para el restaurante **"Tarca Luis"**, ubicado en Los Llanos de Aridane (Isla de La Palma, Islas Canarias, España).

El sistema incluye dos partes integradas:
1. **Web pública para clientes:** Portada con atmósfera canaria y brasas, carta interactiva con categorías y alérgenos, galería con visor ampliado (lightbox), historia del local ("Sobre Nosotros"), contacto con horarios dinámicos y mapa de Google Maps, y un motor de reservas inteligente con asignación de mesa en tiempo real y cancelación en 1 clic.
2. **Panel de administración privado (CMS):** Acceso seguro con usuario y contraseña donde el propietario puede editar mesas, reservas, horarios semanales, festivos, fotos, platos de la carta, datos de contacto y plantillas de correo **sin tocar ni una sola línea de código**.

---

## 🛠️ Tecnologías Elegidas y Arquitectura

Para garantizar máxima velocidad, robustez, facilidad de despliegue y cero problemas de compilación de dependencias externas:

- **Backend:** Node.js (v20+ / v22+ / v24+) utilizando la biblioteca estándar:
  - `node:sqlite`: Base de datos SQLite relacional nativa y ultrarrápida (`data/restaurante.db`).
  - `node:crypto`: Hashing de contraseñas de alta seguridad con PBKDF2/SHA-512 (100.000 iteraciones), salting criptográfico y tokens de sesión únicos.
  - `node:http`: Servidor HTTP rápido con enrutador REST, cabeceras seguras y soporte CORS.
- **Frontend Público:** HTML5 semántico, CSS3 moderno con paleta cálida canaria (piedra volcánica `#211C19`, terracota/almagre `#C85A32`, madera de tea, ocre `#E5A84B` y verde monteverde `#2D5A43`). Mobile-First responsive y datos estructurados Schema.org `Restaurant` para SEO.
- **Panel Admin CMS:** Interfaz reactiva SPA (Single Page Application) sin recarga, con notificaciones Toast, modales accesibles y previsualización de imágenes.
- **Optimización de imágenes:** Compresión y redimensionado automático en el navegador mediante Canvas antes del envío (reduce fotos de 10 MB de móvil a ~120 KB en formato WebP optimizado) y almacenamiento seguro en servidor.
- **Base de Datos:** SQLite persistente con claves foráneas, índices y migraciones automáticas.

---

## 📁 Estructura del Proyecto

```
restaurante-tarca-luis/
├── server.js               # Servidor HTTP nativo, enrutador y APIs
├── package.json            # Metadatos y scripts de inicio
├── README.md               # Documentación y manual de usuario
├── start.bat               # Inicio rápido con doble clic en Windows
├── start.ps1               # Inicio en PowerShell
├── data/
│   └── restaurante.db      # Base de datos SQLite persistente
├── src/
│   ├── db.js               # Conexión SQLite y esquema de tablas relacional
│   ├── seed.js             # Sembrado de datos iniciales auténticos de La Palma
│   ├── auth.js             # Seguridad criptográfica, contraseñas y sesiones
│   ├── reservation-engine.js # Lógica de turnos, aforos y asignación óptima de mesa
│   ├── email-service.js    # Plantillas de correo, alertas y simulación/auditoría
│   ├── image-handler.js    # Manejo seguro y almacenamiento de imágenes
│   └── routes/
│       ├── public-routes.js# Endpoints públicos (carta, disponibilidad, reserva, cancelar)
│       └── admin-routes.js # Endpoints privados CMS con autenticación
├── scripts/
│   └── generate-assets.js  # Generador de gráficos gastronómicos vectoriales
└── public/
    ├── index.html          # Web pública del restaurante (SEO & Schema.org)
    ├── cancelar.html       # Página de cancelación de reservas con token único
    ├── css/
    │   ├── style.css       # Estilos web pública (paleta cálida canaria)
    │   └── lightbox.css    # Visor modal de fotos ampliado
    ├── js/
    │   ├── main.js         # Lógica interactiva pública (carta, horarios, galería)
    │   └── reservas.js     # Motor del asistente de reservas y anti-spam
    ├── assets/
    │   └── img/            # Imágenes del restaurante, platos y terraza
    ├── uploads/            # Fotos subidas por el administrador desde el panel
    └── admin/
        ├── index.html      # Panel de administración completo
        ├── login.html      # Pantalla de inicio de sesión seguro
        ├── css/
        │   └── admin.css   # Estilos del panel de control CMS
        └── js/
            └── admin.js    # Lógica reactiva SPA del backoffice
```

---

## 🚀 Cómo Poner en Marcha la Aplicación

### Opción 1: En Windows con un solo clic
Haz doble clic sobre el archivo **`start.bat`** (o ejecuta `./start.ps1` en PowerShell).

### Opción 2: Desde la terminal con Node.js
```bash
# 1. Entrar en la carpeta del proyecto
cd restaurante-tarca-luis

# 2. Iniciar el servidor (siembra la base de datos automáticamente si está vacía)
node server.js
# o bien:
npm start
```

*(Si utilizas el entorno Antigravity CLI también puedes ejecutar `agy-node server.js`).*

---

## 🌐 Direcciones de Acceso

Una vez arrancado el servidor:

| Sección | Dirección URL |
| :--- | :--- |
| **Web Pública para Clientes** | `http://localhost:3000` |
| **Panel de Administración CMS** | `http://localhost:3000/admin` |
| **Página de Cancelación de Reserva** | `http://localhost:3000/cancelar-reserva?token=...` |

### 🔐 Credenciales de Acceso al Panel de Administración

- **Usuario:** `admin`
- **Contraseña:** `admin1234`

*(Por seguridad, puedes cambiar esta contraseña en cualquier momento desde la pestaña **Seguridad & Acceso** dentro del panel).*

---

## 📖 Manual de Uso del Panel de Administración

Todo el contenido se edita visualmente en el panel sin modificar código:

### 1. ¿Cómo cambiar o añadir Mesas?
1. Inicia sesión en `http://localhost:3000/admin` y haz clic en la pestaña **🪑 Mesas & Zonas**.
2. Verás el listado de todas las mesas con su capacidad mínima/máxima y zona (Interior, Terraza Jardín, Porche).
3. **Crear mesa:** Pulsa el botón **`➕ Crear Nueva Mesa`**, escribe el nombre (ej. *Terraza 5*), capacidad mínima (ej. 2), capacidad máxima (ej. 6) y selecciona la zona. Pulsa **Guardar Mesa**.
4. **Modificar mesa:** Pulsa el botón **`✏️ Editar`** en cualquier fila para ajustar capacidad o desactivarla temporalmente si está rota o reservada para un evento especial.
5. El motor de reservas asignará automáticamente a los clientes la mesa que mejor se ajuste a su grupo.

### 2. ¿Cómo cambiar Fotos y la Imagen de Portada (Hero)?
1. Entra a la pestaña **🖼️ Galería & Portada**.
2. **Subir una nueva foto:** Pulsa **`📤 Subir Foto a la Galería`**, selecciona la imagen de tu ordenador o móvil (se comprimirá automáticamente sin perder calidad), ponle un título y categoría.
3. **Cambiar la foto principal de la portada:** En cualquier foto de la galería, pulsa el botón **`⭐ Poner en Portada`**. ¡La portada de la web se actualizará al instante con esa foto!
4. También puedes cambiarla directamente desde la pestaña **⚙️ Datos Restaurante** subiendo un archivo en el campo *Imagen Principal de Portada*.

### 3. ¿Cómo cambiar la Dirección, Teléfono, Horarios y Textos?
1. Ve a la pestaña **⚙️ Datos Restaurante**.
2. Puedes modificar:
   - Nombre del restaurante y lema.
   - Dirección física, municipio y código postal.
   - Teléfono de reservas y email de contacto.
   - Email donde el restaurante recibe los avisos de nuevas reservas.
   - Código del mapa de Google Maps (Iframe).
   - Enlaces a redes sociales (Instagram, Facebook, TripAdvisor).
   - Título y textos de la sección "Sobre Nosotros" (historia, cocina de leña, tradición palmera).
3. Pulsa **`💾 Guardar Todos los Cambios`** y la web pública reflejará los cambios de inmediato.

### 4. ¿Cómo configurar Horarios y Días Festivos?
1. Ve a la pestaña **🕒 Horarios & Festivos**.
2. **Horarios semanales:** Para cada día (Lunes a Domingo), marca si está *Abierto* o *Cerrado*, e introduce las horas de inicio y fin para el **Turno de Almuerzo** (ej. 13:00 a 16:30) y **Turno de Cena** (ej. 19:30 a 23:00). Pulsa **Guardar Horarios Semanales**.
3. **Días cerrados especiales:** En el formulario inferior, elige una fecha en el calendario (ej. festivo local o vacaciones del personal), escribe el motivo y pulsa **`Añadir Fecha Cerrada`**. El sistema bloqueará automáticamente las reservas para ese día.
4. **Duración de reserva y antelación:** Puedes definir cuánto tiempo dura cada comida (ej. 90 min) y cuántas horas de antelación mínima se exigen para reservas del mismo día.

### 5. ¿Cómo gestionar la Carta, Precios y Alérgenos?
1. Ve a la pestaña **📜 Carta & Alérgenos**.
2. **Categorías:** Crea o renombra categorías (Entrantes, Carnes, Pescados, Postres, Vinos).
3. **Añadir o editar platos:** Pulsa **`➕ Nuevo Plato`** o pulsa **`✏️`** en uno existente. Podrás cambiar el nombre, precio, descripción, foto y marcar con casillas los **14 alérgenos oficiales de la Unión Europea** (Gluten, Lácteos, Huevos, Pescado, Frutos secos, etc.).
4. **Producto agotado:** En la columna *Disponibilidad*, pulsa el botón verde **`Disponible`** para pasarlo a gris **`Agotado`** en 1 clic. El plato desaparecerá de la carta de los clientes hasta que vuelva a estar disponible, sin necesidad de borrarlo.

### 6. ¿Cómo se gestionan las Reservas y Cancelaciones?
1. Ve a la pestaña **📅 Reservas**.
2. Puedes filtrar por **Fecha** (Solo hoy, Próximas o Histórico), por **Estado** (Confirmada, Pendiente, Cancelada, No se presentó) o buscar por nombre o teléfono.
3. Para cada reserva puedes cambiar su estado rápidamente con los botones de acción.
4. **Reserva manual (por teléfono):** Si un cliente llama por teléfono o entra al local, pulsa **`➕ Nueva Reserva Manual`**, introduce sus datos y el sistema le asignará una mesa libre.
5. **Cancelación por parte del cliente:** En el correo de confirmación, el cliente recibe un enlace único (`/cancelar-reserva?token=...`). Al hacer clic, puede ver los datos de su reserva y pulsar un botón para cancelarla. La mesa se libera al instante para otros clientes y el restaurante recibe un aviso en el registro.

---

## 🌍 Guía de Despliegue en Hosting (Paso a Paso)

Puedes publicar la aplicación en cualquier servidor con soporte para Node.js:

### Opción A: Despliegue en PaaS Cloud gratuito/económico (Render, Railway, Fly.io)
1. Sube el código a un repositorio de GitHub (o GitLab).
2. Entra en **[Render.com](https://render.com)** o **[Railway.app](https://railway.app)**.
3. Crea un nuevo **Web Service** conectado a tu repositorio.
4. Configura los parámetros:
   - **Environment:** Node
   - **Build Command:** *(dejar vacío o `node -v`)*
   - **Start Command:** `node server.js`
5. *(Opcional)* En Render o Railway añade un *Persistent Disk* montado en `/data` si deseas persistir la base de datos entre reinicios de contenedor.

### Opción B: Despliegue en un VPS propio (Ubuntu / Debian con Nginx y PM2)
1. Conéctate a tu servidor por SSH e instala Node.js:
   ```bash
   sudo apt update
   sudo apt install -y nodejs npm nginx
   sudo npm install -g pm2
   ```
2. Clona o sube los archivos a `/var/www/tarcaluis`:
   ```bash
   cd /var/www/tarcaluis
   ```
3. Inicia la aplicación con PM2 para que se mantenga viva siempre:
   ```bash
   pm2 start server.js --name "tarcaluis"
   pm2 startup
   pm2 save
   ```
4. Configura Nginx como proxy inverso hacia el puerto 3000 y activa SSL gratuito con Let's Encrypt (`certbot --nginx -d tudominio.com`).

---

## 📝 Licencia y Créditos
Desarrollado con pasión para el **Restaurante Tarca Luis**, honrando la rica tradición gastronómica de la **Isla Bonita (La Palma, Islas Canarias)**.
