export type Tool = 'brush' | 'eraser';

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id?: string;
  userId?: string;
  tool: Tool;
  points: Point[];
  color: string;
  width: number;
  timestamp?: number;
}

export interface User {
  id: string;
  color: string;
  name: string;
  socketId: string;
}

export interface CursorPosition {
  x: number;
  y: number;
  /** Source canvas size for scaling to our canvas */
  canvasWidth?: number;
  canvasHeight?: number;
  socketId: string;
  userId: string;
  color: string;
  name: string;
}
