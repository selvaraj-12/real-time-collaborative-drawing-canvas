# Architecture

## Overview

Real-time collaborative drawing canvas: multiple users draw on a shared canvas with global undo/redo, live cursors, and username display. Raw HTML Canvas API only; no drawing libraries.

## Folder Structure

```
collaborative-canvas/
├── client/
│   ├── index.html          # Entry HTML
│   ├── style.css           # Styles
│   ├── canvas.ts           # Canvas drawing logic (raw Canvas API)
│   ├── websocket.ts        # WebSocket client (Socket.io)
│   └── main.ts             # App startup, DOM, wiring
├── server/
│   ├── server.js           # Express + Socket.io server
│   ├── rooms.js            # Room handling (users, per-room state)
│   └── drawing-state.js    # Canvas state (stroke history, undo/redo)
├── package.json
├── README.md
└── ARCHITECTURE.md
```

## Client

### canvas.ts

- **Responsibility**: All drawing using the raw HTML Canvas API.
- **Exports**: Types (`Point`, `Stroke`, `Tool`), `drawStroke`, `drawAllStrokes`, `drawLiveStroke`, `drawCursor`.
- **Details**:
  - Smooth paths via `quadraticCurveTo` between points.
  - Brush vs eraser via `globalCompositeOperation = 'destination-out'`.
  - Single-point strokes drawn as circles; multi-point as smooth paths.
  - No external drawing libraries.

### websocket.ts

- **Responsibility**: Socket.io connection and event handling.
- **Exports**: `connectSocket(callbacks)`, `emitSetUsername`, `emitStrokeCommit`, `emitStrokeProgress`, `emitCursor`, `emitUndo`, `emitRedo`.
- **Events**:
  - **In**: `init`, `user_joined`, `user_left`, `user_updated`, `stroke_commit`, `stroke_progress`, `cursor`, `undo`, `redo`.
  - **Out**: `set_username`, `stroke_commit`, `stroke_progress`, `cursor`, `undo`, `redo`.
- **Details**: Throttling for cursor and batching for stroke progress are done in `main.ts`; this module only sends/receives.

### main.ts

- **Responsibility**: App startup, DOM (login, toolbar, canvas), and wiring between canvas and websocket.
- **Flow**:
  1. Connect socket → show “Connecting…”.
  2. On `init` → show login screen; store `userId`, `users`, `strokeHistory`.
  3. User submits username → emit `set_username`, show main UI (toolbar + canvas).
  4. Canvas: two layers (background = committed strokes, foreground = live strokes + cursors). Pointer events collect points; on pointer up commit stroke and emit; during draw emit batched progress.
  5. Socket events update local `strokeHistory`, `liveStrokes`, `cursors`, `users`, `redoStack` and trigger redraws.
- **Details**: Cursor throttled (e.g. 50 ms). Stroke progress batched (e.g. every 5 points + 80 ms timer). Coordinates scaled using sender’s canvas size so cursors and live strokes look correct across different window sizes.

## Server

### server.js

- **Responsibility**: Express HTTP server, Socket.io setup, static file serving, and wiring socket events to room + drawing state.
- **Flow**: On connection → `joinRoom(socket.id)` → send `init` (users, stroke history) → broadcast `user_joined` → register handlers for `stroke_commit`, `stroke_progress`, `set_username`, `cursor`, `undo`, `redo`, `disconnect`. All drawing/room state delegated to `rooms.js` and `drawing-state.js`.

### rooms.js

- **Responsibility**: Room handling — one room per logical canvas; users and drawing state per room.
- **Exports**: `getOrCreateRoom(roomId)`, `joinRoom(socketId, roomId)`, `leaveRoom(socketId, roomId)`, `setUsername(socketId, name, roomId)`, `getRoomUsers(roomId)`.
- **Details**: Default room `'default'`. Each room has a `users` Map (socketId → `{ id, color, name }`) and a `drawingState` from `drawing-state.js`. User colors assigned from a fixed palette.

### drawing-state.js

- **Responsibility**: Canvas state for a single room — committed strokes and redo stack.
- **Exports**: `createDrawingState()` returning an object with:
  - `getState()` → `{ strokeHistory, redoStackLength }`
  - `addStroke(stroke, userId)` → committed stroke (id, timestamp set); clears redo.
  - `undo()` → removes last stroke, pushes to redo, returns removed stroke.
  - `redo()` → pops from redo, pushes to history, returns restored stroke.
- **Details**: Single source of truth for stroke order. New stroke clears redo. No OT/CRDT; strict order of operations.

## Data Flow

### Drawing

1. User draws → client collects points → on pointer up: `emitStrokeCommit(stroke)`.
2. Server: `stroke_commit` → `drawingState.addStroke()` → broadcast `stroke_commit` to all.
3. All clients (including sender): append to `strokeHistory`, redraw background layer.

### Live stroke (see while drawing)

1. While drawing, client periodically emits `stroke_progress` (batched points + canvas size).
2. Server: `stroke_progress` → broadcast (no persistence).
3. Other clients: update `liveStrokes` by userId, redraw foreground; on `stroke_commit` remove that userId from `liveStrokes`.

### Global undo/redo

1. Any client: `emitUndo()` / `emitRedo()`.
2. Server: `undo` → `drawingState.undo()` → broadcast `undo` with `strokeId`; `redo` → `drawingState.redo()` → broadcast `redo` with restored stroke.
3. All clients: update local `strokeHistory` and `redoStack`, redraw.

### Cursors

1. Client: throttled `emitCursor(x, y, canvasWidth, canvasHeight)`.
2. Server: broadcast `cursor` with user info and coordinates.
3. Other clients: store by socketId, scale to local canvas size, draw on foreground.

## Conflict Handling

- Strokes are **immutable** and **totally ordered**. No pixel-level conflict: overlapping draws are separate strokes; order is determined by commit order. “Last stroke on top” is consistent for everyone.

## Tech Stack

- **Client**: TypeScript, Vite (build), Socket.io-client, raw Canvas API.
- **Server**: Node.js, Express, Socket.io.
