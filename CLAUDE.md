# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Tetris en JavaScript vanilla + HTML5 Canvas. Sin `package.json`, sin build, sin linter, sin tests. La documentación (README.md) está en español.

## Ejecutar

Abrir `index.html` directamente, o servir estáticamente:

```powershell
python -m http.server 8000   # luego http://localhost:8000
```

## Arquitectura

Tres archivos: `index.html` (DOM + dos canvas), `style.css`, `game.js` (toda la lógica, script clásico con `'use strict'`, estado en variables globales de módulo).

- `game.js` toma los elementos del DOM por `id` (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`, `theme-toggle`); si se renombra un id en `index.html`, hay que actualizarlo aquí.
- El tablero es una matriz `ROWS × COLS` de enteros: `0` vacío, `1–7` índice en `COLORS`/`PIECES` (el índice 0 de ambos arrays es `null`). El número dentro de cada matriz de `PIECES` coincide con su índice.
- Ciclo de vida: `init()` reinicia todo el estado y arranca `requestAnimationFrame(loop)`. `loop` acumula `dropAccum` y baja la pieza al superar `dropInterval`; `lockPiece()` = `merge` → `clearLines` → `spawn`. `spawn()` llama a `endGame()` si la nueva pieza colisiona. Pausa y game over cancelan el frame con `cancelAnimationFrame(animId)`.
- Puntuación/nivel viven en `clearLines()` (tabla `LINE_SCORES` × nivel; nivel = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`). Soft drop suma 1 por fila y hard drop 2 por celda.
- Rotación: `rotateCW` + wall kicks simples en `tryRotate` (offsets horizontales `[0,-1,1,-2,2]`).

- Records (bloque `// ==== Records ====` en `game.js`, antes de las llamadas finales): el juego ya NO arranca solo; al cargar se pinta el tablero vacío (`drawEmptyBoard`) bajo `#start-screen` (clase `.overlay`) y `Jugar`/Enter llama a `startGame()` → `init()`. `localStorage` key `tetris-records` = `{ top:[{name,score,lines,level,date}] (máx 5, desc), bestCombo, maxLines }`, con lectura tolerante a JSON corrupto. `combo`/`maxComboGame` se actualizan en `clearLines()`; `endGame()` llama a `showGameOverRecords()` (actualiza bestCombo/maxLines y muestra `#player-name` si entra en el top). Si no se guarda el nombre, `init()` (vía `resetRecordsState`) lo guarda como "Anónimo". El keydown global delega primero en `recordsKeyIntercept` (ignora INPUT/SELECT/TEXTAREA y bloquea controles en la pantalla de inicio). Nombres siempre con `textContent`. Ids usados por el bloque: `start-screen`, `play-btn`, `reset-records-btn`, `start-records-table`, `start-stats`, `go-records`, `go-records-table`, `go-stats`, `name-form`, `player-name`. "Combo" = nº de bloqueos consecutivos que limpian línea.

## Notas

- Tema claro/oscuro: los colores viven en variables CSS (`:root` = oscuro, `[data-theme="light"]` = claro). `applyTheme()` en `game.js` fija `data-theme`, guarda en `localStorage` (`tetris-theme`), actualiza `gridColor`/`highlightColor` del canvas y repinta (también en pausa/game over). Por defecto: oscuro.
- Skins (bloque `// ==== Skins ====` en `game.js`): objeto `SKINS` (`retro`, `neon`, `pastel`, `pixel`) con `colors`, `drawBlock` y opcionalmente `boardBg`/`gridColor`/`nutHole`. `drawBlock()` global delega en `activeSkin`; `applySkin(name)` guarda en `localStorage` (`tetris-skin`), llama a `syncSkinCanvas()` (fondo/grid; `applyTheme` también la invoca) y repinta. Selector `<select id="skin-select">`; el keydown global ignora eventos de SELECT/INPUT. Ortogonal al tema claro/oscuro (Neon fuerza fondo negro).
- Si se cambia `COLS`, `ROWS` o `BLOCK`, ajustar `width`/`height` del `<canvas id="board">` en `index.html` (`COLS*BLOCK` × `ROWS*BLOCK`). El canvas `next` usa un tamaño de bloque fijo (`NB = 30`) en `drawNext`.
- El README menciona la ruta `03-tetris/` y "~300 líneas" en la estructura; es solo descriptivo.
- Menú de pausa: bloque `// ==== Menú de pausa ====` en `game.js` (ids `pause-menu`, `pause-resume`, `pause-restart`, `pause-controls-btn`, `pause-controls`, `start-level`). P/Escape llaman a `togglePause()`, que muestra/oculta `#pause-menu` (`#overlay` es solo game over). Con `paused` el keydown solo atiende P/Escape (el resto pasa por `blockPausedKeys`, que evita scroll salvo en select/botones; Esc se ignora dentro del select); al reanudar `resumeGuardUntil` ignora teclas de juego ~150 ms y se resetea `dropAccum`. `startLevel` (localStorage `tetris-start-level`) `init()` lo copia a `gameStartLevel`, que usa `clearLines()` (`level = max(gameStartLevel, floor(lines/10)+1)`).
