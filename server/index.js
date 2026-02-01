/**
 * Real-time collaborative drawing server
 * - Maintains canonical stroke history for global undo/redo
 * - Broadcasts strokes, cursor positions, and user presence
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// User colors (distinct, good for drawing)
const USER_COLORS = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
  '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
  '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080',
];

// Server state: single source of truth for all clients
const strokeHistory = [];      // Committed strokes in order (the canvas)
const redoStack = [];          // Strokes that were undone (for redo)
const users = new Map();       // socketId -> { id, color, name }

let nextUserId = 1;
let nextStrokeId = 1;

function getNextColor() {
  const used = new Set([...users.values()].map(u => u.color));
  for (const c of USER_COLORS) {
    if (!used.has(c)) return c;
  }
  return '#' + Math.floor(Math.random() * 16777215).toString(16);
}

io.on('connection', (socket) => {
  const userId = String(nextUserId++);
  const color = getNextColor();
  const name = `User ${userId}`;
  users.set(socket.id, { id: userId, color, name });

  // Send full state to new user
  socket.emit('init', {
    userId,
    color,
    users: [...users.entries()].map(([sid, u]) => ({
      id: u.id,
      color: u.color,
      name: u.name,
      socketId: sid,
    })),
    strokeHistory: [...strokeHistory],
  });

  // Tell everyone a new user joined
  socket.broadcast.emit('user_joined', {
    id: userId,
    color,
    name,
    socketId: socket.id,
  });

  // New stroke (committed) – add to history, clear redo, broadcast
  socket.on('stroke_commit', (stroke) => {
    const committed = {
      ...stroke,
      id: String(nextStrokeId++),
      userId,
      timestamp: Date.now(),
    };
    strokeHistory.push(committed);
    redoStack.length = 0;
    io.emit('stroke_commit', committed);
  });

  // Live stroke points (while user is drawing) – broadcast only, no persistence
  socket.on('stroke_progress', (data) => {
    socket.broadcast.emit('stroke_progress', { ...data, userId, color: users.get(socket.id).color });
  });

  // Set display name (username) – update and broadcast so everyone sees it
  socket.on('set_username', (newName) => {
    const user = users.get(socket.id);
    if (!user) return;
    const trimmed = String(newName || '').trim().slice(0, 32) || user.name;
    user.name = trimmed;
    io.emit('user_updated', { socketId: socket.id, userId: user.id, name: user.name });
  });

  // Cursor position – broadcast to others (throttled by client; includes canvas size for scaling)
  socket.on('cursor', (pos) => {
    const user = users.get(socket.id);
    socket.broadcast.emit('cursor', { userId, color, name: user ? user.name : name, socketId: socket.id, ...pos });
  });

  // Global undo: remove last stroke from history, push to redo stack
  socket.on('undo', () => {
    if (strokeHistory.length === 0) return;
    const removed = strokeHistory.pop();
    redoStack.push(removed);
    io.emit('undo', { strokeId: removed.id, undoneBy: userId });
  });

  // Global redo: pop from redo stack, push back to history
  socket.on('redo', () => {
    if (redoStack.length === 0) return;
    const restored = redoStack.pop();
    strokeHistory.push(restored);
    io.emit('redo', { stroke: restored });
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    users.delete(socket.id);
    if (user) {
      io.emit('user_left', { socketId: socket.id, userId: user.id });
    }
  });
});

// Serve static frontend in production
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
