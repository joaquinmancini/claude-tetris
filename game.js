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

let theme = 'dark';
let COLORS = PALETTES.dark;
let gridColor = '#22222e';

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
const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const recordsOverWrap = document.getElementById('records-over-wrap');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let started = false; // false mientras se muestra la pantalla de inicio
let combo = 0, maxCombo = 0; // piezas consecutivas que limpian líneas

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
    combo++;
    if (combo > maxCombo) maxCombo = combo;
  } else {
    combo = 0;
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
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
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
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, GHOST_ALPHA[theme]);

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

// ---- Records (localStorage) ----
const MAX_RECORDS = 5;

function loadRecords() {
  const data = { top: [], bestCombo: 0, maxLines: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem('records'));
    if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.top)) {
        data.top = raw.top
          .filter(r => r && Number.isFinite(r.score))
          .map(r => ({
            name: String(r.name || 'Anónimo').slice(0, 12),
            score: r.score,
            lines: Number.isFinite(r.lines) ? r.lines : 0,
            combo: Number.isFinite(r.combo) ? r.combo : 0,
            date: String(r.date || ''),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_RECORDS);
      }
      if (Number.isFinite(raw.bestCombo)) data.bestCombo = raw.bestCombo;
      if (Number.isFinite(raw.maxLines)) data.maxLines = raw.maxLines;
    }
  } catch (e) {}
  return data;
}

function saveRecords(data) {
  try { localStorage.setItem('records', JSON.stringify(data)); } catch (e) {}
}

function qualifies(data, pts) {
  return pts > 0 && (data.top.length < MAX_RECORDS || pts > data.top[data.top.length - 1].score);
}

// Pinta la tabla y las estadísticas (nombres siempre con textContent)
function renderRecords(tableId, statsId, highlight) {
  const data = loadRecords();
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.textContent = '';
  if (!data.top.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'empty';
    td.textContent = 'Sin records todavía';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
  let marked = false;
  data.top.forEach((rec, i) => {
    const tr = document.createElement('tr');
    if (!marked && highlight && rec.date === highlight.date && rec.name === highlight.name &&
        rec.score === highlight.score && rec.lines === highlight.lines) {
      tr.className = 'highlight';
      marked = true;
    }
    [i + 1, rec.name, rec.score.toLocaleString(), `${rec.lines} L`].forEach(v => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  document.getElementById(statsId).textContent =
    `Mejor combo: ${data.bestCombo} · Líneas máx.: ${data.maxLines}`;
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  const data = loadRecords();
  const entra = qualifies(data, score);
  data.bestCombo = Math.max(data.bestCombo, maxCombo);
  data.maxLines = Math.max(data.maxLines, lines);
  saveRecords(data);

  nameForm.classList.toggle('hidden', !entra);
  nameInput.value = '';
  renderRecords('records-over', 'records-stats-over', null);
  recordsOverWrap.classList.remove('hidden');
  overlay.classList.remove('hidden');
  // Foco diferido: evita que teclas aún presionadas caigan en el campo
  if (entra) setTimeout(() => { if (gameOver) nameInput.focus(); }, 500);
}

function saveCurrentRecord() {
  const data = loadRecords();
  if (!qualifies(data, score)) return;
  const rec = {
    name: nameInput.value.trim().slice(0, 12) || 'Anónimo',
    score,
    lines,
    combo: maxCombo,
    date: new Date().toISOString().slice(0, 10),
  };
  data.top.push(rec);
  data.top.sort((a, b) => b.score - a.score);
  data.top = data.top.slice(0, MAX_RECORDS);
  saveRecords(data);
  nameForm.classList.add('hidden');
  renderRecords('records-over', 'records-stats-over', rec);
  restartBtn.focus();
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

function resetState() {
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
  combo = 0;
  maxCombo = 0;
  spawn();
  updateHUD();
}

function init() {
  resetState();
  started = true;
  startOverlay.classList.add('hidden');
  overlay.classList.add('hidden');
  recordsOverWrap.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // Escribir el nombre no debe disparar acciones de juego
  if (e.target instanceof HTMLInputElement) return;
  if (!started) {
    if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) init();
    return;
  }
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

function applyTheme(name, persist) {
  theme = name === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  COLORS = PALETTES[theme];
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  themeBtn.textContent = theme === 'light' ? '☾ Oscuro' : '☀ Claro';
  if (persist) {
    try { localStorage.setItem('theme', theme); } catch (e) {}
  }
  // En pausa/game over el loop no corre: redibujar manualmente
  if (current) {
    draw();
    drawNext();
  }
}

themeBtn.addEventListener('click', () => {
  applyTheme(theme === 'light' ? 'dark' : 'light', true);
  themeBtn.blur(); // evita que Espacio (caída) reactive el botón
});

restartBtn.addEventListener('click', () => {
  // Si el récord quedó sin guardar, se guarda con el nombre actual (o Anónimo)
  if (gameOver && !nameForm.classList.contains('hidden')) saveCurrentRecord();
  init();
  restartBtn.blur();
});

startBtn.addEventListener('click', () => {
  init();
  startBtn.blur();
});

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  saveCurrentRecord();
});

resetRecordsBtn.addEventListener('click', () => {
  if (confirm('¿Borrar todos los records?')) {
    try { localStorage.removeItem('records'); } catch (e) {}
    renderRecords('records-start', 'records-stats-start', null);
  }
  resetRecordsBtn.blur();
});

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
applyTheme(savedTheme, false);
// Pantalla de inicio: estado válido pero sin arrancar el loop
resetState();
draw();
renderRecords('records-start', 'records-stats-start', null);
