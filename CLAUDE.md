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

- `game.js` toma los elementos del DOM por `id` (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`); si se renombra un id en `index.html`, hay que actualizarlo aquí.
- El tablero es una matriz `ROWS × COLS` de enteros: `0` vacío, `1–7` índice en `COLORS`/`PIECES` (el índice 0 de ambos arrays es `null`). El número dentro de cada matriz de `PIECES` coincide con su índice.
- Ciclo de vida: `init()` reinicia todo el estado y arranca `requestAnimationFrame(loop)`. `loop` acumula `dropAccum` y baja la pieza al superar `dropInterval`; `lockPiece()` = `merge` → `clearLines` → `spawn`. `spawn()` llama a `endGame()` si la nueva pieza colisiona. Pausa y game over cancelan el frame con `cancelAnimationFrame(animId)`.
- Puntuación/nivel viven en `clearLines()` (tabla `LINE_SCORES` × nivel; nivel = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`). Soft drop suma 1 por fila y hard drop 2 por celda.
- Rotación: `rotateCW` + wall kicks simples en `tryRotate` (offsets horizontales `[0,-1,1,-2,2]`).

## Notas

- Si se cambia `COLS`, `ROWS` o `BLOCK`, ajustar `width`/`height` del `<canvas id="board">` en `index.html` (`COLS*BLOCK` × `ROWS*BLOCK`). El canvas `next` usa un tamaño de bloque fijo (`NB = 30`) en `drawNext`.
- El README menciona la ruta `03-tetris/` y "~300 líneas" en la estructura; es solo descriptivo.
