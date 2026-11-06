/**
 * scripts/generate-assets.js - Generador de ilustraciones vectoriales gastronómicas para Tarca Luis
 */
const fs = require('node:fs');
const path = require('node:path');

const IMG_DIR = path.join(__dirname, '..', 'public', 'assets', 'img');
if (!fs.existsSync(IMG_DIR)) {
  fs.mkdirSync(IMG_DIR, { recursive: true });
}

const IMAGES = [
  {
    name: 'hero',
    title: 'Restaurante Tarca Luis',
    subtitle: 'La Palma • Cocina Canaria Tradicional & Brasas',
    bg1: '#1f1b18',
    bg2: '#3d2b24',
    icon: '🔥',
    accent: '#c85a32'
  },
  {
    name: 'papas-arrugadas',
    title: 'Papas Arrugadas',
    subtitle: 'Dúo de Mojos Rojo Picón & Verde Cilantro',
    bg1: '#362819',
    bg2: '#573f27',
    icon: '🥔',
    accent: '#d9653b'
  },
  {
    name: 'queso-asado',
    title: 'Queso Palmero Asado',
    subtitle: 'D.O. Ahumado a la Brasa con Miel & Mojo',
    bg1: '#402a1b',
    bg2: '#694126',
    icon: '🧀',
    accent: '#e5a84b'
  },
  {
    name: 'croquetas',
    title: 'Croquetas de Puchero',
    subtitle: 'Carne desmigada al estilo de La Palma',
    bg1: '#3a2b1f',
    bg2: '#5a422e',
    icon: '🧆',
    accent: '#e5a84b'
  },
  {
    name: 'escaldon-gofio',
    title: 'Escaldón de Gofio',
    subtitle: 'Gofio de millo, caldo rico & chicharrones',
    bg1: '#382d24',
    bg2: '#5c4839',
    icon: '🥣',
    accent: '#c49a6c'
  },
  {
    name: 'ensalada-palmera',
    title: 'Ensalada Palmera',
    subtitle: 'Aguacate de Puntagorda & queso de cabra',
    bg1: '#1f3322',
    bg2: '#2d4d33',
    icon: '🥗',
    accent: '#79a86e'
  },
  {
    name: 'carne-cabra',
    title: 'Carne de Cabra Estofada',
    subtitle: 'Receta centenaria a fuego lento con vino insular',
    bg1: '#381c19',
    bg2: '#572520',
    icon: '🥘',
    accent: '#b83b28'
  },
  {
    name: 'chuleton-brasa',
    title: 'Chuletón a la Brasa',
    subtitle: 'Maduración 45 días con sal marina de Fuencaliente',
    bg1: '#261614',
    bg2: '#47221e',
    icon: '🥩',
    accent: '#e65239'
  },
  {
    name: 'solomillo-higos',
    title: 'Solomillo con Higos',
    subtitle: 'Reducción de higos palmeros & batata asada',
    bg1: '#331d24',
    bg2: '#542938',
    icon: '🍖',
    accent: '#d46584'
  },
  {
    name: 'secreto-iberico',
    title: 'Secreto a la Lumbre',
    subtitle: 'Pimientos asados & mojo de almendras',
    bg1: '#2d1b17',
    bg2: '#4a2c26',
    icon: '🥓',
    accent: '#e8724d'
  },
  {
    name: 'cherne-espalda',
    title: 'Cherne Fresco del Litoral',
    subtitle: 'Pesca de Tazacorte a la espalda con ajo confitado',
    bg1: '#192b38',
    bg2: '#27475c',
    icon: '🐟',
    accent: '#5dade2'
  },
  {
    name: 'pulpo-brasa',
    title: 'Pulpo a la Brasa',
    subtitle: 'Pata entera sobre puré de batata de jable',
    bg1: '#291d2c',
    bg2: '#4a2a52',
    icon: '🐙',
    accent: '#af7ac5'
  },
  {
    name: 'calamares-fritos',
    title: 'Calamares Saharianos',
    subtitle: 'Fritura crujiente con alioli suave casero',
    bg1: '#2b261b',
    bg2: '#473d2a',
    icon: '🦑',
    accent: '#f4d03f'
  },
  {
    name: 'principe-alberto',
    title: 'Príncipe Alberto Tradicional',
    subtitle: 'La joya repostera de La Palma con chocolate y almendra',
    bg1: '#211714',
    bg2: '#3d251e',
    icon: '🍫',
    accent: '#e59866'
  },
  {
    name: 'bienmesabe',
    title: 'Bienmesabe Palmero',
    subtitle: 'Almendra del norte, yema tostada y helado mantecado',
    bg1: '#362b1b',
    bg2: '#574328',
    icon: '🍨',
    accent: '#f5b041'
  },
  {
    name: 'quesillo',
    title: 'Quesillo Canario',
    subtitle: 'Con caramelo oscuro al ron miel de caña',
    bg1: '#382a17',
    bg2: '#59401f',
    icon: '🍮',
    accent: '#f39c12'
  },
  {
    name: 'mousse-gofio',
    title: 'Mousse de Gofio',
    subtitle: 'Espuma ligera con miel de la cumbre',
    bg1: '#2e251e',
    bg2: '#4f3c30',
    icon: '🧁',
    accent: '#d4ac0d'
  },
  {
    name: 'vino-blanco',
    title: 'Malvasía Aromática Seca',
    subtitle: 'Vino D.O. La Palma • Ceniza volcánica',
    bg1: '#212918',
    bg2: '#394726',
    icon: '🍾',
    accent: '#a9dfbf'
  },
  {
    name: 'vino-tinto',
    title: 'Listán Negro Barrica',
    subtitle: 'Vino D.O. La Palma • Carácter volcánico',
    bg1: '#29131a',
    bg2: '#4a1b2a',
    icon: '🍷',
    accent: '#c0392b'
  },
  {
    name: 'vino-tea',
    title: 'Vino de Tea de La Palma',
    subtitle: 'Crianza histórica en barricas de pino canario',
    bg1: '#301c14',
    bg2: '#522b1c',
    icon: '🍇',
    accent: '#d35400'
  },
  {
    name: 'cerveza-canaria',
    title: 'Dorada Especial',
    subtitle: 'Cerveza de barril helada',
    bg1: '#2d2613',
    bg2: '#4d401e',
    icon: '🍺',
    accent: '#f1c40f'
  },
  {
    name: 'galeria-comedor',
    title: 'Comedor de Madera de Tea',
    subtitle: 'Vigas centenarias y muros de piedra volcánica',
    bg1: '#292019',
    bg2: '#473528',
    icon: '🏛️',
    accent: '#c85a32'
  },
  {
    name: 'galeria-terraza',
    title: 'Terraza Jardín de Palmeras',
    subtitle: 'Comidas al aire libre con el clima templado palmero',
    bg1: '#1b291d',
    bg2: '#2b472e',
    icon: '🌴',
    accent: '#52be80'
  },
  {
    name: 'galeria-brasas',
    title: 'El Rincón de las Brasas',
    subtitle: 'Leña de monteverde y sarmiento palmero',
    bg1: '#2b1510',
    bg2: '#4f2117',
    icon: '♨️',
    accent: '#e74c3c'
  },
  {
    name: 'galeria-porche',
    title: 'Porche Tradicional Palmero',
    subtitle: 'Balcón canario y atardeceres mágicos',
    bg1: '#261e1b',
    bg2: '#45332c',
    icon: '🏡',
    accent: '#e5a84b'
  }
];

function generateSvg({ title, subtitle, bg1, bg2, icon, accent }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}" />
      <stop offset="100%" stop-color="${bg2}" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35" />
      <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
    </radialGradient>
    <pattern id="canaryPattern" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 0 20 L 20 0 L 40 20 L 20 40 Z" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
    </pattern>
  </defs>

  <!-- Fondo degradado -->
  <rect width="800" height="520" fill="url(#bgGrad)" />
  <rect width="800" height="520" fill="url(#canaryPattern)" />
  <circle cx="400" cy="210" r="240" fill="url(#glow)" />

  <!-- Marco decorativo -->
  <rect x="25" y="25" width="750" height="470" rx="16" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
  <rect x="35" y="35" width="730" height="450" rx="12" fill="none" stroke="${accent}" stroke-opacity="0.3" stroke-width="1" stroke-dasharray="8 6" />

  <!-- Emblema / Icono central -->
  <g transform="translate(400, 195)">
    <circle r="72" fill="rgba(0,0,0,0.35)" stroke="${accent}" stroke-width="2.5" />
    <circle r="60" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
    <text font-family="'Segoe UI Emoji', 'Apple Color Emoji', sans-serif" font-size="64" text-anchor="middle" dominant-baseline="central">${icon}</text>
  </g>

  <!-- Sello La Palma -->
  <g transform="translate(400, 75)">
    <rect x="-110" y="-14" width="220" height="28" rx="14" fill="rgba(0,0,0,0.4)" stroke="${accent}" stroke-width="1" />
    <text font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" letter-spacing="2.5" fill="#f5ede3" text-anchor="middle" dominant-baseline="central">TARCA LUIS • LA PALMA</text>
  </g>

  <!-- Título y subtítulo -->
  <text x="400" y="340" font-family="Georgia, 'Times New Roman', serif" font-size="30" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">${title}</text>
  <text x="400" y="380" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" fill="#e0d5c8" text-anchor="middle" letter-spacing="0.3">${subtitle}</text>

  <!-- Detalle decorativo inferior -->
  <line x1="320" y1="415" x2="480" y2="415" stroke="${accent}" stroke-width="2" stroke-linecap="round" />
  <circle cx="400" cy="415" r="4" fill="${accent}" />
</svg>`;
}

for (const img of IMAGES) {
  const svgContent = generateSvg(img);
  // Guardar tanto .svg como .jpg para máxima compatibilidad con las URLs de seed.js
  const svgPath = path.join(IMG_DIR, `${img.name}.svg`);
  const jpgPath = path.join(IMG_DIR, `${img.name}.jpg`);

  fs.writeFileSync(svgPath, svgContent);
  fs.writeFileSync(jpgPath, svgContent); // Servido con Content-Type inteligente
}

console.log(`✓ Generadas ${IMAGES.length} imágenes gastronómicas vectoriales en ${IMG_DIR}`);
