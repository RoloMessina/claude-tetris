'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (gris metálico)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (hueco central)
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
const themeToggle = document.getElementById('theme-toggle');

const THEME_KEY = 'tetris-theme';
let gridColor = '#22222e';
let highlightColor = 'rgba(255,255,255,0.12)';

let startLevel = 1;
let gameStartLevel = 1;
let resumeGuardUntil = 0;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
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

function intervalForLevel(lv) {
  return Math.max(100, 1000 - (lv - 1) * 90);
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
    level = Math.max(gameStartLevel, Math.floor(lines / 10) + 1);
    dropInterval = intervalForLevel(level);
    updateHUD();
    combo++;
    if (combo > maxComboGame) maxComboGame = combo;
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
  context.fillStyle = highlightColor;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

// Círculo oscuro en el centro de la tuerca (solo visual)
function drawNutHole(context, x, y, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.beginPath();
  context.arc(x * size + size / 2, y * size + size / 2, size * 0.32, 0, Math.PI * 2);
  context.fillStyle = '#0f0f17';
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = '#78909c';
  context.stroke();
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
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
  if (current.type === 8) drawNutHole(ctx, current.x + 1, gy + 1, BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  if (current.type === 8) drawNutHole(ctx, current.x + 1, current.y + 1, BLOCK);
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
  if (next.type === 8) drawNutHole(nextCtx, offX + 1, offY + 1, NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  showGameOverRecords();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    hidePauseMenu();
    resumeGuardUntil = performance.now() + 150;
    cancelAnimationFrame(animId);
    lastTime = performance.now();
    dropAccum = 0;
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showPauseMenu();
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
  if (gameOver) return; // endGame() pudo ejecutarse dentro de este frame
  animId = requestAnimationFrame(loop);
}

function init() {
  resetRecordsState(); // records: guarda pendiente como "Anónimo", reinicia combo
  board = createBoard();
  score = 0;
  lines = 0;
  gameStartLevel = startLevel;
  level = gameStartLevel;
  paused = false;
  gameOver = false;
  dropInterval = intervalForLevel(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  hidePauseMenu();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (recordsKeyIntercept(e)) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    // Esc cierra el desplegable del select: no debe reanudar
    if (e.repeat) return;
    togglePause();
    return;
  }
  if (paused) { blockPausedKeys(e); return; }
  if (gameOver || performance.now() < resumeGuardUntil) return;
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

restartBtn.addEventListener('click', init);

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignorar */ }
  themeToggle.setAttribute('aria-checked', String(theme === 'light'));
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
  highlightColor = theme === 'light' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
  // repintar también en pausa / game over (no hay frame activo)
  if (board && current && next) { draw(); drawNext(); }
  else drawEmptyBoard();
}

function loadTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; }
}

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // evita que Space/Enter vuelvan a activar el switch
});

// ==== Records ====
const RECORDS_KEY = 'tetris-records';
const MAX_TOP = 5;
const NAME_MAX = 12;

const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const startRecordsTable = document.getElementById('start-records-table');
const startStats = document.getElementById('start-stats');
const goRecords = document.getElementById('go-records');
const goRecordsTable = document.getElementById('go-records-table');
const goStats = document.getElementById('go-stats');
const nameForm = document.getElementById('name-form');
const playerNameInput = document.getElementById('player-name');

let combo = 0;
let maxComboGame = 0;
let pendingEntry = null; // { score, lines, level, date, idx } si entra en el top y falta el nombre
let resetTimer = null;

function emptyRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!raw || typeof raw !== 'object') return emptyRecords();
    const top = Array.isArray(raw.top) ? raw.top
      .filter(t => t && typeof t === 'object' && Number.isFinite(t.score))
      .map(t => ({
        name: String(t.name ?? '').slice(0, NAME_MAX) || 'Anónimo',
        score: t.score,
        lines: Number.isFinite(t.lines) ? t.lines : 0,
        level: Number.isFinite(t.level) ? t.level : 1,
        date: String(t.date ?? ''),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_TOP) : [];
    return {
      top,
      bestCombo: Number.isFinite(raw.bestCombo) ? raw.bestCombo : 0,
      maxLines: Number.isFinite(raw.maxLines) ? raw.maxLines : 0,
    };
  } catch (e) { return emptyRecords(); }
}

function saveRecords(rec) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(rec)); } catch (e) { /* ignorar */ }
}

function cleanName(raw) {
  return String(raw).trim().slice(0, NAME_MAX) || 'Anónimo';
}

// Posición donde entraría una puntuación (los empates quedan por debajo); -1 si no entra
function recordIndex(top, sc) {
  if (sc <= 0) return -1;
  let idx = top.findIndex(t => t.score < sc);
  if (idx === -1) idx = top.length;
  return idx < MAX_TOP ? idx : -1;
}

function makeCell(tag, text, cls) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (cls) el.className = cls;
  return el;
}

function renderTable(container, top, highlightIdx) {
  container.replaceChildren();
  if (!top.length) {
    container.appendChild(makeCell('p', 'Aún no hay records', 'records-empty'));
    return;
  }
  const table = document.createElement('table');
  table.className = 'records-table';
  const head = table.createTHead().insertRow();
  head.append(makeCell('th', '#'), makeCell('th', 'NOMBRE'),
    makeCell('th', 'PUNTOS', 'num'), makeCell('th', 'LÍN.', 'num'));
  const body = table.createTBody();
  top.forEach((t, i) => {
    const tr = body.insertRow();
    if (i === highlightIdx) tr.className = 'record-new';
    tr.append(makeCell('td', String(i + 1)), makeCell('td', t.name),
      makeCell('td', t.score.toLocaleString(), 'num'), makeCell('td', String(t.lines), 'num'));
  });
  container.appendChild(table);
}

function statsText(rec) {
  return `Mejor combo: ${rec.bestCombo} · Líneas máx.: ${rec.maxLines}`;
}

function renderStartScreen() {
  const rec = loadRecords();
  renderTable(startRecordsTable, rec.top, -1);
  startStats.textContent = statsText(rec);
}

function drawEmptyBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
}

function startGame() {
  startScreen.classList.add('hidden');
  init();
}

function showGameOverRecords() {
  const rec = loadRecords();
  rec.bestCombo = Math.max(rec.bestCombo, maxComboGame);
  rec.maxLines = Math.max(rec.maxLines, lines);
  saveRecords(rec);
  goStats.textContent = statsText(rec);
  const idx = recordIndex(rec.top, score);
  const top = rec.top.slice();
  if (idx >= 0) {
    pendingEntry = { score, lines, level, date: new Date().toISOString().slice(0, 10) };
    top.splice(idx, 0, { name: '(tú)', score, lines });
    top.length = Math.min(top.length, MAX_TOP);
    nameForm.classList.remove('hidden');
    playerNameInput.value = '';
    playerNameInput.focus();
  } else {
    pendingEntry = null;
    nameForm.classList.add('hidden');
  }
  renderTable(goRecordsTable, top, idx);
  goRecords.classList.remove('hidden');
}

// Inserta la entrada pendiente con el nombre dado; devuelve su posición (-1 si no había)
function commitPendingRecord(name) {
  if (!pendingEntry) return -1;
  const rec = loadRecords();
  const entry = pendingEntry;
  entry.name = cleanName(name);
  const idx = recordIndex(rec.top, entry.score);
  pendingEntry = null;
  if (idx < 0) return -1;
  rec.top.splice(idx, 0, entry);
  rec.top.length = Math.min(rec.top.length, MAX_TOP);
  saveRecords(rec);
  return idx;
}

function resetRecordsState() {
  commitPendingRecord('Anónimo');
  combo = 0;
  maxComboGame = 0;
  goRecords.classList.add('hidden');
  nameForm.classList.add('hidden');
}

// Devuelve true si el evento no debe llegar al control del juego
function recordsKeyIntercept(e) {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true;
  if (!startScreen.classList.contains('hidden')) {
    if (e.code === 'Enter' && tag !== 'BUTTON') { e.preventDefault(); startGame(); }
    return true;
  }
  return false;
}

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  const idx = commitPendingRecord(playerNameInput.value);
  renderTable(goRecordsTable, loadRecords().top, idx);
  nameForm.classList.add('hidden');
});

function disarmReset() {
  clearTimeout(resetTimer);
  resetTimer = null;
  resetRecordsBtn.textContent = 'Resetear records';
  resetRecordsBtn.classList.remove('confirm');
}

resetRecordsBtn.addEventListener('click', () => {
  if (resetTimer === null) {
    resetRecordsBtn.textContent = '¿Seguro? Pulsa de nuevo';
    resetRecordsBtn.classList.add('confirm');
    resetTimer = setTimeout(disarmReset, 3000);
    return;
  }
  disarmReset();
  saveRecords(emptyRecords());
  renderStartScreen();
});

playBtn.addEventListener('click', startGame);

// ==== Menú de pausa ====
const START_LEVEL_KEY = 'tetris-start-level';
const pauseMenu = document.getElementById('pause-menu');
const pauseResumeBtn = document.getElementById('pause-resume');
const pauseRestartBtn = document.getElementById('pause-restart');
const pauseControlsBtn = document.getElementById('pause-controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelSelect = document.getElementById('start-level');

function loadStartLevel() {
  try {
    const n = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
    return n >= 1 && n <= 10 ? n : 1;
  } catch (e) { return 1; }
}

function showPauseMenu() {
  startLevelSelect.value = String(startLevel);
  pauseMenu.classList.remove('hidden');
}

function hidePauseMenu() {
  pauseMenu.classList.add('hidden');
  pauseControls.classList.add('hidden');
  pauseControlsBtn.setAttribute('aria-expanded', 'false');
}

// Con el menú abierto: evita scroll y movimiento; las flechas del select siguen funcionando
function blockPausedKeys(e) {
  const t = e.target;
  if (t && (t.tagName === 'SELECT' || t.tagName === 'BUTTON')) return;
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
}

for (let i = 1; i <= 10; i++) startLevelSelect.add(new Option('Nivel ' + i, String(i)));
startLevel = loadStartLevel();

startLevelSelect.addEventListener('change', () => {
  startLevel = parseInt(startLevelSelect.value, 10);
  try { localStorage.setItem(START_LEVEL_KEY, String(startLevel)); } catch (e) { /* ignorar */ }
  startLevelSelect.blur();
});
pauseResumeBtn.addEventListener('click', () => { pauseResumeBtn.blur(); togglePause(); });
pauseRestartBtn.addEventListener('click', () => { pauseRestartBtn.blur(); init(); });
pauseControlsBtn.addEventListener('click', () => {
  const open = pauseControls.classList.toggle('hidden') === false;
  pauseControlsBtn.setAttribute('aria-expanded', String(open));
  pauseControlsBtn.blur();
});
// ==== Fin Menú de pausa ====

applyTheme(loadTheme());
renderStartScreen();
drawEmptyBoard();
