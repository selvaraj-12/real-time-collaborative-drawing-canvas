/**
 * WebSocket client – Socket.io connection and event handling.
 */

import type { Stroke } from './canvas.js';

export interface User {
  id: string;
  color: string;
  name: string;
  socketId: string;
}

export interface CursorPosition {
  x: number;
  y: number;
  canvasWidth?: number;
  canvasHeight?: number;
  socketId: string;
  userId: string;
  color: string;
  name: string;
}

export type InitPayload = {
  userId: string;
  color: string;
  users: User[];
  strokeHistory: Stroke[];
};

export type StrokeProgressPayload = {
  userId: string;
  color: string;
  points: { x: number; y: number }[];
  tool: Stroke['tool'];
  width: number;
  canvasWidth?: number;
  canvasHeight?: number;
};

export interface WebSocketCallbacks {
  onConnect: () => void;
  onDisconnect: () => void;
  onInit: (data: InitPayload) => void;
  onUserJoined: (user: User) => void;
  onUserLeft: (data: { socketId: string; userId: string }) => void;
  onUserUpdated: (data: { socketId: string; userId: string; name: string }) => void;
  onStrokeCommit: (stroke: Stroke) => void;
  onStrokeProgress: (data: StrokeProgressPayload) => void;
  onCursor: (data: CursorPosition) => void;
  onUndo: (data: { strokeId: string }) => void;
  onRedo: (data: { stroke: Stroke }) => void;
}

import { io } from 'socket.io-client';

type Socket = ReturnType<typeof io>;
let socket: Socket | null = null;

export function connectSocket(callbacks: WebSocketCallbacks): void {
  socket = io(window.location.origin, { transports: ['websocket', 'polling'] });

  socket.on('connect', () => callbacks.onConnect());
  socket.on('disconnect', () => callbacks.onDisconnect());

  socket.on('init', (data: InitPayload) => callbacks.onInit(data));
  socket.on('user_joined', (user: User) => callbacks.onUserJoined(user));
  socket.on('user_left', (data: { socketId: string; userId: string }) => callbacks.onUserLeft(data));
  socket.on('user_updated', (data: { socketId: string; userId: string; name: string }) =>
    callbacks.onUserUpdated(data)
  );
  socket.on('stroke_commit', (stroke: Stroke) => callbacks.onStrokeCommit(stroke));
  socket.on('stroke_progress', (data: StrokeProgressPayload) => callbacks.onStrokeProgress(data));
  socket.on('cursor', (data: CursorPosition) => callbacks.onCursor(data));
  socket.on('undo', (data: { strokeId: string }) => callbacks.onUndo(data));
  socket.on('redo', (data: { stroke: Stroke }) => callbacks.onRedo(data));
}

export function emitSetUsername(name: string): void {
  socket?.emit('set_username', name);
}

export function emitStrokeCommit(stroke: Omit<Stroke, 'id' | 'userId' | 'timestamp'>): void {
  socket?.emit('stroke_commit', stroke);
}

export function emitStrokeProgress(
  points: { x: number; y: number }[],
  tool: Stroke['tool'],
  color: string,
  width: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  socket?.emit('stroke_progress', {
    points,
    tool,
    color,
    width,
    canvasWidth,
    canvasHeight,
  });
}

export function emitCursor(
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  socket?.emit('cursor', { x, y, canvasWidth, canvasHeight });
}

export function emitUndo(): void {
  socket?.emit('undo');
}

export function emitRedo(): void {
  socket?.emit('redo');
}

export function isConnected(): boolean {
  return socket?.connected ?? false;
}
