/**
 * Express + WebSocket server. Wires Socket.io to rooms and drawing-state.
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { joinRoom, leaveRoom, setUsername, getRoomUsers } = require('./rooms.js');

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const DEFAULT_ROOM = 'default';

io.on('connection', (socket) => {
  const { room, userId, color, name } = joinRoom(socket.id, DEFAULT_ROOM);
  const drawingState = room.drawingState;

  socket.emit('init', {
    userId,
    color,
    users: getRoomUsers(DEFAULT_ROOM),
    strokeHistory: drawingState.getState().strokeHistory,
  });

  socket.broadcast.emit('user_joined', {
    id: userId,
    color,
    name,
    socketId: socket.id,
  });

  socket.on('stroke_commit', (stroke) => {
    const committed = drawingState.addStroke(stroke, userId);
    io.emit('stroke_commit', committed);
  });

  socket.on('stroke_progress', (data) => {
    const user = room.users.get(socket.id);
    socket.broadcast.emit('stroke_progress', {
      ...data,
      userId,
      color: user ? user.color : color,
    });
  });

  socket.on('set_username', (newName) => {
    const user = setUsername(socket.id, newName, DEFAULT_ROOM);
    if (user) {
      io.emit('user_updated', {
        socketId: socket.id,
        userId: user.id,
        name: user.name,
      });
    }
  });

  socket.on('cursor', (pos) => {
    const user = room.users.get(socket.id);
    socket.broadcast.emit('cursor', {
      userId,
      color,
      name: user ? user.name : name,
      socketId: socket.id,
      ...pos,
    });
  });

  socket.on('undo', () => {
    const removed = drawingState.undo();
    if (removed) {
      io.emit('undo', { strokeId: removed.id, undoneBy: userId });
    }
  });

  socket.on('redo', () => {
    const restored = drawingState.redo();
    if (restored) {
      io.emit('redo', { stroke: restored });
    }
  });

  socket.on('disconnect', () => {
    const user = leaveRoom(socket.id, DEFAULT_ROOM);
    if (user) {
      io.emit('user_left', { socketId: socket.id, userId: user.id });
    }
  });
});

app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
