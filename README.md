# Real-Time Collaborative Drawing Canvas

A multi-user drawing app with **real-time sync**, **global undo/redo**, and **user presence**. Built with the **raw HTML Canvas API** (no drawing libraries), TypeScript, Node.js, and Socket.io.

## Folder structure

```
collaborative-canvas/
├── client/
│   ├── index.html       # Entry HTML
│   ├── style.css        # Styles
│   ├── canvas.ts        # Canvas drawing logic (raw Canvas API)
│   ├── websocket.ts     # WebSocket client (Socket.io)
│   └── main.ts          # App startup, DOM, wiring
├── server/
│   ├── server.js        # Express + Socket.io server
│   ├── rooms.js         # Room handling (users, per-room state)
│   └── drawing-state.js # Canvas state (stroke history, undo/redo)
├── package.json
├── README.md
└── ARCHITECTURE.md      # Mandatory architecture doc
```

## Features

- **Username login**: Enter a display name to join; your name is shown to others and on cursors.
- **Drawing tools**: Brush, Eraser, multiple colors, adjustable stroke width
- **Real-time synchronization**: See others’ strokes **while they draw** (batched progress + final commit)
- **User indicators**: Other users’ cursors and names on the canvas; cursor positions scale across different window sizes
- **Conflict handling**: Strokes are ordered; overlapping draws from multiple users appear as separate strokes in sequence
- **Global undo/redo**: One shared history; any user can undo/redo any stroke
- **User management**: Online user list with a unique color per user

## Tech stack

- **Client**: TypeScript, Vite, raw Canvas API, Socket.io-client
- **Server**: Node.js, Express, Socket.io

## Run locally

```bash
npm install
npm run dev
```

- Backend: http://localhost:3000  
- Frontend: http://localhost:5173 (proxies `/socket.io` to the server)

Open multiple tabs/windows to test collaboration.

See **ARCHITECTURE.md** for detailed architecture and data flow.
