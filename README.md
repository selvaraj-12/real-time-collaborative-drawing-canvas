# Real-Time Collaborative Drawing Canvas

A multi-user drawing app with **real-time sync**, **global undo/redo**, and **user presence**. Built with the **raw HTML Canvas API** (no drawing libraries), React, Node.js, and Socket.io.

## Features

- **Drawing tools**: Brush, Eraser, multiple colors, adjustable stroke width
- **Real-time synchronization**: See others’ strokes **while they draw** (batched progress + final commit)
- **User indicators**: Other users’ cursors and names on the canvas; cursor positions scale across different window sizes
- **Conflict handling**: Strokes are ordered; overlapping draws from multiple users appear as separate strokes in sequence (no pixel-level conflict)
- **Global undo/redo**: One shared history; any user can undo/redo any stroke so everyone sees the same canvas state
- **User management**: Online user list with a unique color per user

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, raw Canvas API
- **Backend**: Node.js, Express, Socket.io

## Run locally

```bash
npm install
npm run dev
```

- Backend: http://localhost:3000  
- Frontend: http://localhost:5173 (proxies `/socket.io` to the server)

Open multiple tabs/windows to test collaboration.

## Architecture

### Canvas

- **Background layer**: Committed strokes only; redrawn when history or canvas size changes.
- **Foreground layer**: Live strokes (yours + others’) and remote cursors; redrawn on input and socket updates.
- **Drawing**: Smooth paths via `quadraticCurveTo`; points batched and sent every 5 points and ~80 ms for real-time feel.

### Real-time sync

- **Commit**: On pointer up, the full stroke is sent as `stroke_commit`; server appends to history and broadcasts; all clients add to local history.
- **Progress**: While drawing, batched points are sent as `stroke_progress` with canvas dimensions; others scale and draw the same path live; cleared on commit.
- **Cursors**: Throttled `cursor` events with `(x, y, canvasWidth, canvasHeight)` so receivers can scale to their own canvas size.

### State and global undo/redo

- **Server**: Single source of truth: `strokeHistory[]` and `redoStack[]`. New stroke → push to history, clear redo. Undo → pop from history, push to redo. Redo → pop from redo, push to history. All changes broadcast.
- **Clients**: Apply the same updates from events; local redo stack is kept in sync so the Redo button reflects availability. Everyone ends up with the same ordered stroke list and canvas.

### Conflict handling

- No OT/CRDT: strokes are immutable and totally ordered. Concurrent draws become multiple strokes in sequence; overlapping area is simply “last stroke on top,” which is consistent for all users.
