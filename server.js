/**
 * server.js - Servidor HTTP principal para Restaurante Tarca Luis
 * Creado con la biblioteca estándar de Node.js (Sin dependencias externas)
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const { initSchema } = require('./src/db.js');
const { seedDatabase } = require('./src/seed.js');
const { handlePublicApi } = require('./src/routes/public-routes.js');
const { handleAdminApi } = require('./src/routes/admin-routes.js');

// Directorio raíz de estáticos
const PUBLIC_DIR = path.join(__dirname, 'public');

// Mapa de tipos MIME
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

// Servir un archivo estático de forma segura (previniendo path traversal)
function serveStaticFile(res, filePath) {
  const normalizedPath = path.normalize(filePath);

  // Asegurar que el archivo está dentro de PUBLIC_DIR
  if (!normalizedPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('Acceso denegado.');
    return;
  }

  fs.stat(normalizedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="utf-8"><title>404 - Página no encontrada</title></head>
        <body style="font-family:sans-serif; text-align:center; padding:50px; background:#faf7f2; color:#333;">
          <h1 style="color:#c85a32;">404 - No encontrado</h1>
          <p>La página o archivo solicitado no existe en el Restaurante Tarca Luis.</p>
          <a href="/" style="color:#c85a32; font-weight:bold;">Volver a la portada</a>
        </body>
        </html>
      `);
      return;
    }

    const ext = path.extname(normalizedPath).toLowerCase();
    let contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Si el archivo contiene SVG (para assets vectoriales de alta definición)
    if (ext === '.jpg' || ext === '.png' || ext === '.svg') {
      try {
        const headerBuf = Buffer.alloc(30);
        const fd = fs.openSync(normalizedPath, 'r');
        fs.readSync(fd, headerBuf, 0, 30, 0);
        fs.closeSync(fd);
        if (headerBuf.toString('utf8').includes('<svg')) {
          contentType = 'image/svg+xml';
        }
      } catch (e) {}
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
    });

    const readStream = fs.createReadStream(normalizedPath);
    readStream.pipe(res);
  });
}

// Leer cuerpo JSON de la petición
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk;
      // Límite de 12 MB para soportar fotos en base64
      if (bodyData.length > 12 * 1024 * 1024) {
        req.destroy();
        reject(new Error('El tamaño de la petición excede el límite permitido.'));
      }
    });
    req.on('end', () => {
      if (!bodyData) return resolve({});
      try {
        const parsed = JSON.parse(bodyData);
        resolve(parsed);
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', err => reject(err));
  });
}

// Enviar respuesta JSON estándar
function sendJsonResponse(res, status, data, extraHeaders = {}) {
  const json = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Content-Length': Buffer.byteLength(json),
    ...extraHeaders
  });
  res.end(json);
}

// Crear el servidor HTTP
const server = http.createServer(async (req, res) => {
  // Cabeceras CORS básicas
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const host = req.headers['host'] || 'localhost:3000';
  const url = new URL(req.url, `http://${host}`);
  const pathname = url.pathname;

  try {
    // 1. Manejo de APIs
    if (pathname.startsWith('/api/')) {
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await parseRequestBody(req) : {};

      // Rutas de administración y autenticación
      let apiResult = await handleAdminApi(req, res, url, body);
      if (apiResult) {
        sendJsonResponse(res, apiResult.status, apiResult.data, apiResult.headers || {});
        return;
      }

      // Rutas públicas
      apiResult = await handlePublicApi(req, res, url, body);
      if (apiResult) {
        sendJsonResponse(res, apiResult.status, apiResult.data, apiResult.headers || {});
        return;
      }

      sendJsonResponse(res, 404, { error: 'Endpoint API no encontrado.' });
      return;
    }

    // 2. Enrutamiento de páginas principales
    if (pathname === '/' || pathname === '/index.html') {
      serveStaticFile(res, path.join(PUBLIC_DIR, 'index.html'));
      return;
    }

    if (pathname === '/cancelar-reserva' || pathname === '/cancelar') {
      serveStaticFile(res, path.join(PUBLIC_DIR, 'cancelar.html'));
      return;
    }

    if (pathname === '/admin' || pathname === '/admin/') {
      serveStaticFile(res, path.join(PUBLIC_DIR, 'admin', 'index.html'));
      return;
    }

    if (pathname === '/admin/login' || pathname === '/admin/login.html') {
      serveStaticFile(res, path.join(PUBLIC_DIR, 'admin', 'login.html'));
      return;
    }

    // 3. Servir archivos estáticos dentro de /public
    const requestedPath = path.join(PUBLIC_DIR, pathname);
    serveStaticFile(res, requestedPath);
  } catch (err) {
    console.error('Error interno del servidor:', err);
    sendJsonResponse(res, 500, { error: 'Error interno del servidor.', details: err.message });
  }
});

// Inicialización de la base de datos y arranque
async function startServer() {
  try {
    initSchema();
    seedDatabase();

    const PORT = parseInt(process.env.PORT, 10) || 3000;

    server.listen(PORT, () => {
      console.log('================================================================');
      console.log('  RESTAURANTE TARCA LUIS - LA PALMA (ISLAS CANARIAS, ESPAÑA)');
      console.log('================================================================');
      console.log(`  🌐 Web Pública:         http://localhost:${PORT}`);
      console.log(`  🛡️ Panel Admin CMS:     http://localhost:${PORT}/admin`);
      console.log(`  👤 Usuario Admin:       admin`);
      console.log(`  🔑 Contraseña Admin:    admin1234`);
      console.log(`  📅 Cancelación cliente: http://localhost:${PORT}/cancelar-reserva`);
      console.log('================================================================');
    });

    server.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        const nextPort = PORT + 1;
        console.warn(`Puerto ${PORT} en uso, intentando en http://localhost:${nextPort}...`);
        server.listen(nextPort);
      } else {
        console.error('Error fatal al arrancar servidor:', err);
      }
    });
  } catch (err) {
    console.error('Error en inicialización:', err);
  }
}

startServer();

module.exports = server;
