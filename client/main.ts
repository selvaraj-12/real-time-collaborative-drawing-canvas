/**
 * App startup logic – DOM, login, toolbar, canvas, wire canvas + websocket.
 */

import {
  drawAllStrokes,
  drawLiveStroke,
  drawCursor,
  type Stroke,
  type Point,
  type Tool,
} from './canvas';
import {
  connectSocket,
  emitSetUsername,
  emitStrokeCommit,
  emitStrokeProgress,
  emitCursor,
  emitUndo,
  emitRedo,
  type User,
  type CursorPosition,
} from './websocket';

const COLORS = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#46f0f0', '#f032e6', '#000000', '#808080',
];
const STROKE_WIDTHS = [2, 4, 8, 12, 20];
const CURSOR_THROTTLE_MS = 50;
const PROGRESS_BATCH_POINTS = 5;
const PROGRESS_BATCH_MS = 80;

// State
let userId: string | null = null;
let username: string | null = null;
let strokeHistory: Stroke[] = [];
let redoStack: Stroke[] = [];
let users: User[] = [];
const liveStrokes = new Map<string, { points: Point[]; tool: Tool; color: string; width: number; canvasWidth?: number; canvasHeight?: number }>();
const cursors = new Map<string, CursorPosition>();
let tool: Tool = 'brush';
let color = COLORS[0];
let strokeWidth = 8;

let canvasBg: HTMLCanvasElement;
let canvasFg: HTMLCanvasElement;
let container: HTMLElement;
let canvasSize = { w: 800, h: 600 };
let isDrawing = false;
let currentPoints: Point[] = [];
let cursorThrottleLast = 0;
let progressBatchTimer: ReturnType<typeof setInterval> | null = null;

function getCanvasPoint(e: MouseEvent): Point | null {
  const rect = canvasFg.getBoundingClientRect();
  const scaleX = canvasFg.width / rect.width;
  const scaleY = canvasFg.height / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function redrawBackground(): void {
  const ctx = canvasBg.getContext('2d');
  if (!ctx) return;
  canvasBg.width = canvasSize.w;
  canvasBg.height = canvasSize.h;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);
  drawAllStrokes(ctx, strokeHistory, canvasSize.w, canvasSize.h);
}

function redrawForeground(): void {
  const ctx = canvasFg.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvasFg.width, canvasFg.height);

  liveStrokes.forEach(({ points, tool: t, color: c, width: w, canvasWidth, canvasHeight }) => {
    const scale = canvasWidth != null && canvasHeight != null && canvasSize.w && canvasSize.h;
    const pts = scale ? points.map((p) => ({ x: (p.x / canvasWidth!) * canvasSize.w, y: (p.y / canvasHeight!) * canvasSize.h })) : points;
    const width = scale ? w * (canvasSize.w / canvasWidth!) : w;
    drawLiveStroke(ctx, pts, t, c, width);
  });

  if (isDrawing && currentPoints.length > 0) {
    drawLiveStroke(ctx, currentPoints, tool, color, strokeWidth);
  }

  cursors.forEach((cur) => {
    if (cur.userId === userId) return;
    const cx = cur.canvasWidth != null && cur.canvasHeight != null && canvasSize.w && canvasSize.h
      ? (cur.x / cur.canvasWidth) * canvasSize.w
      : cur.x;
    const cy = cur.canvasHeight != null && cur.canvasWidth != null && canvasSize.w && canvasSize.h
      ? (cur.y / cur.canvasHeight) * canvasSize.h
      : cur.y;
    drawCursor(ctx, cx, cy, cur.color, cur.name);
  });
}

function flushProgress(): void {
  if (currentPoints.length > 0) {
    emitStrokeProgress(currentPoints, tool, color, strokeWidth, canvasSize.w, canvasSize.h);
  }
  if (progressBatchTimer) {
    clearInterval(progressBatchTimer);
    progressBatchTimer = null;
  }
}

function commitCurrentStroke(): void {
  if (currentPoints.length < 1) return;
  emitStrokeCommit({ tool, points: currentPoints, color, width: strokeWidth });
  emitStrokeProgress([], tool, color, strokeWidth, canvasSize.w, canvasSize.h);
  currentPoints = [];
  redrawForeground();
}

function setupCanvas(): void {
  const ro = new ResizeObserver((entries) => {
    const { width, height } = entries[0].contentRect;
    canvasSize.w = Math.max(100, Math.floor(width));
    canvasSize.h = Math.max(100, Math.floor(height));
    redrawBackground();
    redrawForeground();
  });
  ro.observe(container);
  const rect = container.getBoundingClientRect();
  canvasSize.w = Math.max(100, Math.floor(rect.width));
  canvasSize.h = Math.max(100, Math.floor(rect.height));
  redrawBackground();
  redrawForeground();

  canvasFg.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const p = getCanvasPoint(e as unknown as MouseEvent);
    if (!p) return;
    isDrawing = true;
    currentPoints = [p];
    redrawForeground();
  });

  canvasFg.addEventListener('pointermove', (e) => {
    const p = getCanvasPoint(e as unknown as MouseEvent);
    if (!p) return;
    const now = Date.now();
    if (now - cursorThrottleLast >= CURSOR_THROTTLE_MS) {
      cursorThrottleLast = now;
      emitCursor(p.x, p.y, canvasSize.w, canvasSize.h);
    }
    if (!isDrawing) return;
    currentPoints.push(p);
    redrawForeground();
    if (currentPoints.length % PROGRESS_BATCH_POINTS === 0) {
      emitStrokeProgress(currentPoints, tool, color, strokeWidth, canvasSize.w, canvasSize.h);
      if (!progressBatchTimer) {
        progressBatchTimer = setInterval(flushProgress, PROGRESS_BATCH_MS);
      }
    }
  });

  canvasFg.addEventListener('pointerup', () => {
    if (progressBatchTimer) {
      clearInterval(progressBatchTimer);
      progressBatchTimer = null;
    }
    if (!isDrawing) return;
    flushProgress();
    commitCurrentStroke();
    isDrawing = false;
  });

  canvasFg.addEventListener('pointerleave', () => {
    if (progressBatchTimer) {
      clearInterval(progressBatchTimer);
      progressBatchTimer = null;
    }
    if (isDrawing) {
      flushProgress();
      commitCurrentStroke();
      isDrawing = false;
    }
  });
}

function renderUserList(): void {
  const list = document.getElementById('user-list')!;
  const count = document.getElementById('user-count')!;
  count.textContent = String(users.length);
  list.innerHTML = users
    .map(
      (u) =>
        `<li><span class="user-dot" style="background:${u.color}"></span><span>${escapeHtml(u.name)}${u.id === userId ? ' (you)' : ''}</span></li>`
    )
    .join('');
}

function updateUndoRedoButtons(): void {
  const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
  const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;
  if (undoBtn) undoBtn.disabled = strokeHistory.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function showScreen(id: string): void {
  document.getElementById('connecting')!.classList.toggle('hidden', id !== 'connecting');
  document.getElementById('login-screen')!.classList.toggle('hidden', id !== 'login-screen');
  document.getElementById('main')!.classList.toggle('hidden', id !== 'main');
}

function initUI(): void {
  const loginForm = document.getElementById('login-form')! as HTMLFormElement;
  const usernameInput = document.getElementById('username-input')! as HTMLInputElement;

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = usernameInput.value.trim().slice(0, 32);
    if (!name) return;
    username = name;
    emitSetUsername(name);
    showScreen('main');
  });

  document.getElementById('undo-btn')!.addEventListener('click', () => {
    emitUndo();
  });
  document.getElementById('redo-btn')!.addEventListener('click', () => {
    emitRedo();
  });

  document.querySelectorAll('#tool-brush, #tool-eraser').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      tool = i === 0 ? 'brush' : 'eraser';
      document.querySelectorAll('.tool-buttons button').forEach((b, j) => b.classList.toggle('active', j === i));
    });
  });

  const palette = document.getElementById('color-palette')!;
  COLORS.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.style.background = c;
    btn.classList.toggle('active', i === 0);
    btn.addEventListener('click', () => {
      color = c;
      palette.querySelectorAll('button').forEach((b, j) => b.classList.toggle('active', j === i));
    });
    palette.appendChild(btn);
  });

  const widthContainer = document.getElementById('width-buttons')!;
  STROKE_WIDTHS.forEach((w, i) => {
    const btn = document.createElement('button');
    btn.textContent = String(w);
    btn.classList.toggle('active', w === strokeWidth);
    btn.addEventListener('click', () => {
      strokeWidth = w;
      widthContainer.querySelectorAll('button').forEach((b, j) => b.classList.toggle('active', STROKE_WIDTHS[j] === w));
    });
    widthContainer.appendChild(btn);
  });
}

function run(): void {
  container = document.getElementById('canvas-container')!;
  canvasBg = document.getElementById('canvas-bg')! as HTMLCanvasElement;
  canvasFg = document.getElementById('canvas-fg')! as HTMLCanvasElement;

  initUI();

  setupCanvas();

  connectSocket({
    onConnect() {
      document.getElementById('connection-dot')!.classList.remove('disconnected');
      document.getElementById('connection-text')!.textContent = 'Connected';
    },
    onDisconnect() {
      document.getElementById('connection-dot')!.classList.add('disconnected');
      document.getElementById('connection-text')!.textContent = 'Disconnected';
    },
    onInit(data) {
      userId = data.userId;
      users = data.users;
      strokeHistory = data.strokeHistory;
      redoStack = [];
      showScreen('login-screen');
      renderUserList();
      updateUndoRedoButtons();
      redrawBackground();
      redrawForeground();
    },
    onUserJoined(user) {
      if (users.some((u) => u.socketId === user.socketId)) return;
      users = [...users, user];
      renderUserList();
    },
    onUserLeft(data) {
      users = users.filter((u) => u.socketId !== data.socketId);
      cursors.delete(data.socketId);
      liveStrokes.delete(data.userId);
      renderUserList();
      redrawForeground();
    },
    onUserUpdated(data) {
      users = users.map((u) => (u.socketId === data.socketId ? { ...u, name: data.name } : u));
      renderUserList();
    },
    onStrokeCommit(stroke) {
      strokeHistory = [...strokeHistory, stroke];
      redoStack = [];
      liveStrokes.delete(stroke.userId);
      updateUndoRedoButtons();
      redrawBackground();
      redrawForeground();
    },
    onStrokeProgress(data) {
      if (!data.points.length) {
        liveStrokes.delete(data.userId);
      } else {
        liveStrokes.set(data.userId, {
          points: data.points,
          tool: data.tool,
          color: data.color,
          width: data.width,
          canvasWidth: data.canvasWidth,
          canvasHeight: data.canvasHeight,
        });
      }
      redrawForeground();
    },
    onCursor(data) {
      cursors.set(data.socketId, data);
      redrawForeground();
    },
    onUndo(data) {
      const removed = strokeHistory.find((s) => s.id === data.strokeId);
      if (removed) redoStack = [...redoStack, removed];
      strokeHistory = strokeHistory.filter((s) => s.id !== data.strokeId);
      updateUndoRedoButtons();
      redrawBackground();
      redrawForeground();
    },
    onRedo(data) {
      strokeHistory = [...strokeHistory, data.stroke];
      redoStack = redoStack.slice(0, -1);
      updateUndoRedoButtons();
      redrawBackground();
      redrawForeground();
    },
  });

  showScreen('connecting');
}

run();
