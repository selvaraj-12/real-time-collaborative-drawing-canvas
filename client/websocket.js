export const socket = io();

export function initSocket(h) {
  socket.on("STATE_SYNC", h.onStateSync);
  socket.on("DRAW_START", h.onDrawStart);
  socket.on("DRAW_PROGRESS", h.onDrawProgress);
  socket.on("UNDO_APPLIED", h.onUndo);
  socket.on("REDO_APPLIED", h.onRedo);
  socket.on("USERS_UPDATE", h.onUsersUpdate);
}
