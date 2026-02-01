/**
 * Canvas drawing logic – raw HTML Canvas API only.
 * Smooth paths (quadraticCurveTo), layers, efficient redraw.
 */

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

const BACKGROUND = '#ffffff';

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  _canvasWidth: number,
  _canvasHeight: number
): void {
  const { points, tool, color, width } = stroke;
  if (points.length < 2) {
    if (points.length === 1) drawPoint(ctx, points[0], tool, color, width);
    return;
  }

  ctx.save();
  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.strokeStyle = color;
  }
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    ctx.quadraticCurveTo(p0.x, p0.y, mid.x, mid.y);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
  ctx.restore();
}

function drawPoint(
  ctx: CanvasRenderingContext2D,
  point: Point,
  tool: Tool,
  color: string,
  width: number
): void {
  ctx.save();
  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.fillStyle = color;
  }
  ctx.beginPath();
  ctx.arc(point.x, point.y, width / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawAllStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  width: number,
  height: number
): void {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);
  for (const stroke of strokes) {
    drawStroke(ctx, stroke, width, height);
  }
}

export function drawLiveStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  tool: Tool,
  color: string,
  width: number
): void {
  if (points.length === 0) return;
  if (points.length === 1) {
    drawPoint(ctx, points[0], tool, color, width);
    return;
  }
  const stroke: Stroke = { tool, points, color, width };
  drawStroke(ctx, stroke, 0, 0);
}

export function drawCursor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  name: string
): void {
  const size = 12;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - size);
  ctx.lineTo(x + size * 0.6, y - size * 0.7);
  ctx.lineTo(x + size * 0.4, y - size * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.font = '12px system-ui';
  ctx.fillStyle = color;
  ctx.fillText(name, x + size, y - size);
  ctx.restore();
}
