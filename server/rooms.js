/**
 * Room handling: one room per canvas, users and drawing state per room.
 */

const { createDrawingState } = require('./drawing-state.js');

const USER_COLORS = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
  '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
  '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080',
];

const rooms = new Map();
let nextUserId = 1;

function getNextColor(usersMap) {
  const used = new Set([...usersMap.values()].map((u) => u.color));
  for (const c of USER_COLORS) {
    if (!used.has(c)) return c;
  }
  return '#' + Math.floor(Math.random() * 16777215).toString(16);
}

function getOrCreateRoom(roomId = 'default') {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      users: new Map(),
      drawingState: createDrawingState(),
    });
  }
  return rooms.get(roomId);
}

function joinRoom(socketId, roomId = 'default') {
  const room = getOrCreateRoom(roomId);
  const userId = String(nextUserId++);
  const color = getNextColor(room.users);
  const name = `User ${userId}`;
  room.users.set(socketId, { id: userId, color, name });
  return { room, userId, color, name };
}

function leaveRoom(socketId, roomId = 'default') {
  const room = rooms.get(roomId);
  if (!room) return null;
  const user = room.users.get(socketId);
  room.users.delete(socketId);
  return user;
}

function setUsername(socketId, newName, roomId = 'default') {
  const room = rooms.get(roomId);
  if (!room) return null;
  const user = room.users.get(socketId);
  if (!user) return null;
  const trimmed = String(newName || '').trim().slice(0, 32) || user.name;
  user.name = trimmed;
  return user;
}

function getRoomUsers(roomId = 'default') {
  const room = rooms.get(roomId);
  if (!room) return [];
  return [...room.users.entries()].map(([sid, u]) => ({
    id: u.id,
    color: u.color,
    name: u.name,
    socketId: sid,
  }));
}

module.exports = {
  getOrCreateRoom,
  joinRoom,
  leaveRoom,
  setUsername,
  getRoomUsers,
};
