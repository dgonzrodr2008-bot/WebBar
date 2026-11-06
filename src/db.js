/**
 * src/db.js - Conexión SQLite y esquema de base de datos para Restaurante Tarca Luis
 * Utiliza el módulo nativo node:sqlite (disponible en Node.js 22.5.0+)
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

// Crear directorio de datos si no existe
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'restaurante.db');
const db = new DatabaseSync(DB_PATH);

// Activar claves foráneas
db.exec('PRAGMA foreign_keys = ON;');

// Inicializar esquema
function initSchema() {
  db.exec(`
    -- Tabla de usuarios administradores
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Tabla de configuración del restaurante (clave-valor)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      description TEXT,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Tabla de mesas
    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      min_capacity INTEGER NOT NULL DEFAULT 1,
      max_capacity INTEGER NOT NULL DEFAULT 4,
      zone TEXT NOT NULL DEFAULT 'interior', -- 'interior', 'terraza', 'porche', 'patio'
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Tabla de horarios semanales (0 = Domingo, 1 = Lunes, ... 6 = Sábado)
    CREATE TABLE IF NOT EXISTS schedules (
      day_of_week INTEGER PRIMARY KEY, -- 0-6
      day_name TEXT NOT NULL,
      is_open INTEGER NOT NULL DEFAULT 1,
      lunch_start TEXT DEFAULT '13:00',
      lunch_end TEXT DEFAULT '16:00',
      dinner_start TEXT DEFAULT '19:30',
      dinner_end TEXT DEFAULT '23:00'
    );

    -- Días cerrados especiales / vacaciones
    CREATE TABLE IF NOT EXISTS closed_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL, -- YYYY-MM-DD
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Categorías de la carta
    CREATE TABLE IF NOT EXISTS menu_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      display_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    -- Platos de la carta
    CREATE TABLE IF NOT EXISTS dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      photo_url TEXT,
      allergens TEXT DEFAULT '', -- JSON array o comas: gluten,lacteos,etc.
      is_available INTEGER DEFAULT 1,
      is_featured INTEGER DEFAULT 0,
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Galería de fotos
    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'general', -- 'local', 'platos', 'ambiente', 'terraza'
      image_url TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      is_hero INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Reservas de mesas
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL, -- ej. TL-2026-X49Z
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      party_size INTEGER NOT NULL,
      reservation_date TEXT NOT NULL, -- YYYY-MM-DD
      reservation_time TEXT NOT NULL, -- HH:MM
      end_time TEXT NOT NULL,         -- HH:MM
      table_id INTEGER REFERENCES restaurant_tables(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'confirmada', 'cancelada', 'no_presentado'
      notes TEXT,
      cancel_token TEXT UNIQUE NOT NULL,
      source TEXT DEFAULT 'web', -- 'web', 'telefono', 'manual'
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Registro y auditoría de emails enviados
    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      email_type TEXT NOT NULL, -- 'confirmacion', 'cancelacion', 'aviso_restaurante'
      status TEXT DEFAULT 'enviado',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Sesiones activas de administradores
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);
}

initSchema();

module.exports = {
  db,
  initSchema
};
