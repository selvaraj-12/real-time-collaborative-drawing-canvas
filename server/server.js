const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { getRoom } = require("./rooms");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("client"));

io.on("connection", (socket) => {
  let roomId = "default";

  socket.on("JOIN_ROOM", ({ room, username }) => {
    roomId = room || "default";
    socket.join(roomId);

    const roomData = getRoom(roomId);
    roomData.users[socket.id] = username;

    socket.emit("STATE_SYNC", roomData.state.getState());
    io.to(roomId).emit("USERS_UPDATE", roomData.users);
  });

  socket.on("DRAW_START", (cmd) => {
    const roomData = getRoom(roomId);
    roomData.state.add(cmd);
    socket.to(roomId).emit("DRAW_START", cmd);
  });

  socket.on("DRAW_PROGRESS", (data) => {
    socket.to(roomId).emit("DRAW_PROGRESS", data);
  });

  socket.on("UNDO", () => {
    const roomData = getRoom(roomId);
    if (roomData.state.undo()) {
      io.to(roomId).emit("UNDO_APPLIED");
    }
  });

  socket.on("REDO", () => {
    const roomData = getRoom(roomId);
    const cmd = roomData.state.redo();
    if (cmd) {
      io.to(roomId).emit("REDO_APPLIED", cmd);
    }
  });

  socket.on("disconnect", () => {
    const roomData = getRoom(roomId);
    delete roomData.users[socket.id];
    io.to(roomId).emit("USERS_UPDATE", roomData.users);
  });
});

server.listen(3000, () =>
  console.log("Server running at http://localhost:3000")
);
