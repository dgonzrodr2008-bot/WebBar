/**
 * src/image-handler.js - Manejo y almacenamiento seguro de imágenes optimizadas
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Guardar imagen enviada como base64 / dataUrl (ej: "data:image/jpeg;base64,...")
function saveBase64Image(dataUrl, originalFilename = 'foto.jpg') {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('Datos de imagen no válidos.');
  }

  // Detectar formato
  const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Formato de imagen base64 no reconocido.');
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  // Comprobar tamaño (máximo 8 MB)
  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error('La imagen excede el límite máximo de 8 MB.');
  }

  // Determinar extensión adecuada
  let ext = '.jpg';
  if (mimeType.includes('png')) ext = '.png';
  else if (mimeType.includes('webp')) ext = '.webp';
  else if (mimeType.includes('svg')) ext = '.svg';

  // Sanitizar nombre
  const cleanName = path
    .basename(originalFilename, path.extname(originalFilename))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .substring(0, 30);

  const uniqueId = crypto.randomBytes(6).toString('hex');
  const targetFileName = `${cleanName}-${uniqueId}${ext}`;
  const targetPath = path.join(UPLOADS_DIR, targetFileName);

  fs.writeFileSync(targetPath, buffer);

  return {
    filename: targetFileName,
    url: `/uploads/${targetFileName}`,
    size: buffer.length,
    mimeType
  };
}

module.exports = {
  UPLOADS_DIR,
  saveBase64Image
};
