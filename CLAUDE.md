# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No `package.json`, no build, no tests, no linter. README and UI text are in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python -m http.server 8000`) and visit `http://localhost:8000`.

## Architecture

Three files: `index.html` (DOM + canvases), `style.css`, and `game.js` (all logic, a single global-scope script with `'use strict'`; it grabs DOM elements by ID at load, so IDs in `index.html` must stay in sync with the `getElementById` calls at the top of `game.js`).

Key points in `game.js` that span multiple functions:

- **State** is module-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, ...), all reset in `init()`, which is also the restart button handler.
- **Piece/board encoding**: board cells and piece shape cells hold a color index 1–7 (0 = empty) that indexes both `COLORS` and `PIECES`. Pieces are square matrices rotated via `rotateCW`; `tryRotate` applies simple horizontal wall kicks `[0,-1,1,-2,2]`.
- **Piece lifecycle**: `lockPiece()` → `merge()` → `clearLines()` (updates lines/score/level/`dropInterval`) → `spawn()` (promotes `next`, collision at spawn calls `endGame()`). Both hard drop, soft drop and the gravity tick in `loop()` funnel into `lockPiece()`.
- **Game loop**: `requestAnimationFrame` `loop()` accumulates `dropAccum` against `dropInterval` (`max(100, 1000 - (level-1)*90)`). Pause/game over use `cancelAnimationFrame(animId)`; resuming resets `lastTime` and calls `loop` directly.
- **Rendering**: `draw()` redraws everything each frame (grid, board, ghost via `ghostY()` at alpha 0.2, current piece). `drawNext()` renders to the separate 120×120 `#next-canvas` and is only called from `spawn()`.
- **Canvas size coupling**: `#board` width/height in `index.html` (300×600) must equal `COLS*BLOCK` × `ROWS*BLOCK` in `game.js`.
- **Scoring**: `LINE_SCORES[cleared] * level`; hard drop +2/cell, soft drop +1/row.
