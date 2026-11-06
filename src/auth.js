/**
 * src/auth.js - Autenticación y seguridad criptográfica nativa (node:crypto)
 */
const crypto = require('node:crypto');
const { db } = require('./db.js');

// Configuración de Hashing con PBKDF2 (SHA-512, 100.000 iteraciones)
const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = 'sha512';

function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, storedHash, storedSalt) {
  const hash = crypto.pbkdf2Sync(password, storedSalt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

// Crear sesión para un usuario
function createSession(userId, durationDays = 7) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  const stmt = db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(token, userId, expiresAt);

  return { token, expiresAt };
}

// Validar token de sesión
function verifySession(token) {
  if (!token) return null;

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    SELECT s.id as session_id, s.token, s.expires_at, u.id as user_id, u.username, u.name, u.email, u.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > ?
  `);

  const session = stmt.get(token, now);
  return session || null;
}

// Cerrar sesión
function deleteSession(token) {
  if (!token) return false;
  const stmt = db.prepare('DELETE FROM sessions WHERE token = ?');
  stmt.run(token);
  return true;
}

// Limpiar sesiones caducadas
function cleanupExpiredSessions() {
  const now = new Date().toISOString();
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
}

// Parsear cookies desde la cabecera HTTP
function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });

  return list;
}

// Obtener usuario autenticado desde la petición HTTP (Cookie o Bearer header)
function getAuthenticatedUser(req) {
  let token = null;

  // 1. Revisar Authorization Header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2. Revisar Cookie tl_session
  if (!token && req.headers['cookie']) {
    const cookies = parseCookies(req.headers['cookie']);
    token = cookies['tl_session'];
  }

  if (!token) return null;

  return verifySession(token);
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  verifySession,
  deleteSession,
  cleanupExpiredSessions,
  parseCookies,
  getAuthenticatedUser
};
