'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const PALETTES = {
  dark: [
    null,
    '#4dd0e1', // I - cyan
    '#ffd54f', // O - yellow
    '#ba68c8', // T - purple
    '#81c784', // S - green
    '#e57373', // Z - red
    '#90caf9', // J - light blue
    '#ffb74d', // L - orange
  ],
  // Tonos más saturados para mantener contraste sobre fondo claro
  light: [
    null,
    '#00acc1', // I - cyan
    '#f9a825', // O - yellow
    '#8e24aa', // T - purple
    '#43a047', // S - green
    '#e53935', // Z - red
    '#1e88e5', // J - blue
    '#fb8c00', // L - orange
  ],
};
const GHOST_ALPHA = { dark: 0.2, light: 0.35 };

const NEON_PALETTE = [
  null,
  '#00f0ff', // I
  '#fff200', // O
  '#d500f9', // T
  '#39ff14', // S
  '#ff1744', // Z
  '#2979ff', // J
  '#ff9100', // L
];

const PASTEL_PALETTE = [
  null,
  '#a8e6ef', // I
  '#fff1a8', // O
  '#d9b8f0', // T
  '#b5ead7', // S
  '#ffb3ba', // Z
  '#b5d0ff', // J
  '#ffd6a5', // L
];

// Variante con más contraste para fondo claro
const PASTEL_LIGHT_PALETTE = [
  null,
  '#6fc9d6', // I
  '#f2d24f', // O
  '#c08ee6', // T
  '#7fd3ae', // S
  '#f08c97', // Z
  '#84aef0', // J
  '#f2b36d', // L
];

let theme = 'dark';
let skin = 'retro';
let COLORS = PALETTES.dark;
let gridColor = '#22222e';
let ghostAlpha = GHOST_ALPHA.dark;

// Ruta de rectángulo redondeado manual (sin depender de roundRect)
function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + w - r, y);
  context.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  context.lineTo(x + w, y + h - r);
  context.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  context.lineTo(x + r, y + h);
  context.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  context.lineTo(x, y + r);
  context.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  context.closePath();
}

// Cada skin define paleta, color de grilla, alpha del ghost y su drawBlock.
// Las skins son independientes del tema claro/oscuro (solo Retro usa las paletas por tema).
const SKINS = {
  retro: {
    palette: t => PALETTES[t],
    grid: () => getComputedStyle(document.documentElement).getPropertyValue('--grid').trim(),
    ghost: t => GHOST_ALPHA[t],
    drawBlock(context, x, y, color, size) {
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    },
  },
  neon: {
    palette: () => NEON_PALETTE,
    grid: () => '#1c1c24',
    ghost: () => 0.35,
    drawBlock(context, x, y, color, size, alpha) {
      const px = x * size + 2, py = y * size + 2, s = size - 4;
      context.strokeStyle = color;
      context.lineWidth = 2;
      // Sin glow para el ghost (más barato)
      if (alpha >= 1) {
        context.shadowColor = color;
        context.shadowBlur = 8;
      }
      context.fillStyle = color;
      context.globalAlpha = alpha * 0.35;
      context.fillRect(px, py, s, s);
      context.globalAlpha = alpha;
      context.strokeRect(px, py, s, s);
      context.shadowBlur = 0; // evita que el glow se filtre a otros dibujos
      context.shadowColor = 'transparent';
    },
  },
  pastel: {
    palette: t => (t === 'light' ? PASTEL_LIGHT_PALETTE : PASTEL_PALETTE),
    grid: t => (t === 'light' ? '#ece8f3' : '#25252f'),
    ghost: t => (t === 'light' ? 0.5 : 0.3),
    drawBlock(context, x, y, color, size) {
      const px = x * size + 1, py = y * size + 1, s = size - 2;
      roundedRectPath(context, px, py, s, s, size * 0.3);
      context.fillStyle = color;
      context.fill();
      // brillo suave
      roundedRectPath(context, px + 3, py + 3, s - 6, s * 0.3, size * 0.12);
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fill();
    },
  },
  pixel: {
    palette: t => PALETTES[t],
    grid: t => (t === 'light' ? '#dfe2ec' : '#1d1d28'),
    ghost: t => GHOST_ALPHA[t],
    drawBlock(context, x, y, color, size) {
      const px = x * size, py = y * size;
      const u = Math.max(1, Math.floor(size / 6)); // tamaño del "píxel"
      context.fillStyle = color;
      context.fillRect(px, py, size, size);
      // sombra (abajo/derecha) y luz (arriba/izquierda)
      context.fillStyle = 'rgba(0,0,0,0.3)';
      context.fillRect(px, py + size - u, size, u);
      context.fillRect(px + size - u, py, u, size);
      context.fillStyle = 'rgba(255,255,255,0.4)';
      context.fillRect(px, py, size - u, u);
      context.fillRect(px, py, u, size - u);
      // patrón de tablero de ajedrez interior
      context.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 1; i < 5; i++)
        for (let j = 1; j < 5; j++)
          if ((i + j) % 2 === 0) context.fillRect(px + i * u, py + j * u, u, u);
    },
  },
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.save();
  context.globalAlpha = alpha ?? 1;
  SKINS[skin].drawBlock(context, x, y, COLORS[colorIndex], size, alpha ?? 1);
  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, ghostAlpha);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // Si el selector de skin conserva el foco, soltarlo para que las teclas no lo cambien
  if (document.activeElement === skinSelect) skinSelect.blur();
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

// Recalcula paleta, grilla y ghost según tema + skin activos
function refreshStyle() {
  const s = SKINS[skin];
  COLORS = s.palette(theme);
  gridColor = s.grid(theme);
  ghostAlpha = s.ghost(theme);
  // En pausa/game over el loop no corre: redibujar manualmente
  if (current) {
    draw();
    drawNext();
  }
}

function applyTheme(name, persist) {
  theme = name === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  themeBtn.textContent = theme === 'light' ? '☾ Oscuro' : '☀ Claro';
  if (persist) {
    try { localStorage.setItem('theme', theme); } catch (e) {}
  }
  refreshStyle();
}

function applySkin(name, persist) {
  skin = SKINS[name] ? name : 'retro';
  document.documentElement.dataset.skin = skin;
  skinSelect.value = skin;
  if (persist) {
    try { localStorage.setItem('skin', skin); } catch (e) {}
  }
  refreshStyle();
}

themeBtn.addEventListener('click', () => {
  applyTheme(theme === 'light' ? 'dark' : 'light', true);
  themeBtn.blur(); // evita que Espacio (caída) reactive el botón
});

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value, true);
  skinSelect.blur(); // evita que flechas/Espacio cambien la selección en juego
});

restartBtn.addEventListener('click', init);

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
let savedSkin = null;
try { savedSkin = localStorage.getItem('skin'); } catch (e) {}
applyTheme(savedTheme, false);
applySkin(savedSkin, false);
init();
