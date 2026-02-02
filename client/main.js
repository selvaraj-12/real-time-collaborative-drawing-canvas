import { setupCanvas, drawSegment } from "./canvas.js";
import { socket, initSocket } from "./websocket.js";

const username = prompt("Enter username:") || "Guest";
const room = "default";

socket.emit("JOIN_ROOM", { room, username });

const canvas = document.getElementById("canvas");
const ctx = setupCanvas(canvas);
const usersDiv = document.getElementById("users");

let tool = "pencil";
let color = "#000000";
let size = 4;
let drawing = false;
let last = null;
let history = [];

document.getElementById("pencil").onclick = () => tool = "pencil";
document.getElementById("eraser").onclick = () => tool = "eraser";
document.getElementById("color").oninput = e => color = e.target.value;
document.getElementById("size").oninput = e => size = e.target.value;
document.getElementById("undo").onclick = () => socket.emit("UNDO");
document.getElementById("redo").onclick = () => socket.emit("REDO");

canvas.addEventListener("pointerdown", e => {
  drawing = true;
  last = { x: e.clientX, y: e.clientY };

  const cmd = {
    style: {
      color: tool === "eraser" ? "#ffffff" : color,
      width: size
    },
    points: [last]
  };

  history.push(cmd);
  socket.emit("DRAW_START", cmd);
});

canvas.addEventListener("pointermove", e => {
  if (!drawing) return;
  const p = { x: e.clientX, y: e.clientY };
  drawSegment(ctx, last, p, history.at(-1).style);
  socket.emit("DRAW_PROGRESS", { start: last, end: p, style: history.at(-1).style });
  history.at(-1).points.push(p);
  last = p;
});

canvas.addEventListener("pointerup", () => drawing = false);

initSocket({
  onStateSync(cmds) {
    history = cmds;
    redraw();
  },
  onDrawStart(cmd) {
    history.push(cmd);
  },
  onDrawProgress(d) {
    drawSegment(ctx, d.start, d.end, d.style);
  },
  onUndo() {
    history.pop();
    redraw();
  },
  onRedo(cmd) {
    history.push(cmd);
    redraw();
  },
  onUsersUpdate(users) {
    usersDiv.innerHTML =
      "<b>Users</b><br>" + Object.values(users).join("<br>");
  }
});

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  history.forEach(c => {
    for (let i = 1; i < c.points.length; i++) {
      drawSegment(ctx, c.points[i - 1], c.points[i], c.style);
    }
  });
}
