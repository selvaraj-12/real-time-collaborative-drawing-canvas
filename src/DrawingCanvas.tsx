import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { Stroke, Point, CursorPosition } from './types';
import {
  drawAllStrokes,
  drawLiveStroke,
  drawCursor,
} from './canvasUtils';

interface DrawingCanvasProps {
  strokeHistory: Stroke[];
  liveStrokes: Map<string, { points: Point[]; tool: Stroke['tool']; color: string; width: number; canvasWidth?: number; canvasHeight?: number }>;
  cursors: Map<string, CursorPosition>;
  currentTool: Stroke['tool'];
  currentColor: string;
  currentWidth: number;
  userId: string | null;
  onStrokeCommit: (stroke: Omit<Stroke, 'id' | 'userId' | 'timestamp'>) => void;
  onStrokeProgress: (points: Point[], tool: Stroke['tool'], color: string, width: number, canvasW: number, canvasH: number) => void;
  onCursor: (x: number, y: number, canvasWidth: number, canvasHeight: number) => void;
}

export function DrawingCanvas({
  strokeHistory,
  liveStrokes,
  cursors,
  currentTool,
  currentColor,
  currentWidth,
  userId,
  onStrokeCommit,
  onStrokeProgress,
  onCursor,
}: DrawingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<Point[]>([]);
  const [size, setSize] = useState({ w: 800, h: 600 });

  const getCanvasPoint = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    const canvas = fgRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  // Resize and layer setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const w = Math.max(100, Math.floor(width));
      const h = Math.max(100, Math.floor(height));
      setSize({ w, h });
    });
    ro.observe(container);
    const { width, height } = container.getBoundingClientRect();
    setSize({ w: Math.max(100, Math.floor(width)), h: Math.max(100, Math.floor(height)) });
    return () => ro.disconnect();
  }, []);

  // Background layer: committed strokes (efficient redraw on history/size change only)
  useEffect(() => {
    const bg = bgRef.current;
    if (!bg || size.w <= 0 || size.h <= 0) return;
    const ctx = bg.getContext('2d');
    if (!ctx) return;
    bg.width = size.w;
    bg.height = size.h;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size.w, size.h);
    drawAllStrokes(ctx, strokeHistory, size.w, size.h);
  }, [strokeHistory, size]);

  // Foreground: live strokes + cursors (redraw on any change)
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || size.w <= 0 || size.h <= 0) return;
    const ctx = fg.getContext('2d');
    if (!ctx) return;

    fg.width = size.w;
    fg.height = size.h;
    ctx.clearRect(0, 0, size.w, size.h);

    // Draw other users' live strokes (scale if sender sent canvas size)
    liveStrokes.forEach(({ points, tool, color, width, canvasWidth, canvasHeight }) => {
      const scale = canvasWidth != null && canvasHeight != null && size.w && size.h;
      const pts = scale ? points.map((p) => ({ x: (p.x / canvasWidth) * size.w, y: (p.y / canvasHeight) * size.h })) : points;
      const w = scale ? width * (size.w / canvasWidth) : width;
      drawLiveStroke(ctx, pts, tool, color, w);
    });

    // Draw current user's in-progress stroke
    if (isDrawingRef.current && currentPointsRef.current.length > 0) {
      drawLiveStroke(
        ctx,
        currentPointsRef.current,
        currentTool,
        currentColor,
        currentWidth
      );
    }

    // Draw cursors (excluding self), scale from sender's canvas to ours
    cursors.forEach((cur) => {
      if (cur.userId === userId) return;
      const cx = cur.canvasWidth != null && cur.canvasHeight != null && size.w && size.h
        ? (cur.x / cur.canvasWidth) * size.w
        : cur.x;
      const cy = cur.canvasHeight != null && cur.canvasWidth != null && size.w && size.h
        ? (cur.y / cur.canvasHeight) * size.h
        : cur.y;
      drawCursor(ctx, cx, cy, cur.color, cur.name);
    });
  }, [liveStrokes, cursors, currentTool, currentColor, currentWidth, userId, size]);

  // Local drawing state: add point and redraw foreground for current stroke
  const redrawForeground = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const ctx = fg.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, fg.width, fg.height);
    liveStrokes.forEach(({ points, tool, color, width, canvasWidth, canvasHeight }) => {
      const scale = canvasWidth != null && canvasHeight != null && fg.width && fg.height;
      const pts = scale ? points.map((p) => ({ x: (p.x / canvasWidth) * fg.width, y: (p.y / canvasHeight) * fg.height })) : points;
      const w = scale ? width * (fg.width / canvasWidth) : width;
      drawLiveStroke(ctx, pts, tool, color, w);
    });
    if (currentPointsRef.current.length > 0) {
      drawLiveStroke(
        ctx,
        currentPointsRef.current,
        currentTool,
        currentColor,
        currentWidth
      );
    }
    cursors.forEach((cur) => {
      if (cur.userId === userId) return;
      const cx = cur.canvasWidth != null && cur.canvasHeight != null && fg.width && fg.height
        ? (cur.x / cur.canvasWidth) * fg.width
        : cur.x;
      const cy = cur.canvasHeight != null && cur.canvasWidth != null && fg.width && fg.height
        ? (cur.y / cur.canvasHeight) * fg.height
        : cur.y;
      drawCursor(ctx, cx, cy, cur.color, cur.name);
    });
  }, [liveStrokes, cursors, currentTool, currentColor, currentWidth, userId]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const p = getCanvasPoint(e);
      if (!p) return;
      isDrawingRef.current = true;
      currentPointsRef.current = [p];
      redrawForeground();
    },
    [getCanvasPoint, redrawForeground]
  );

  const progressBatchRef = useRef<{ points: Point[]; tool: Stroke['tool']; color: string; width: number } | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const flushProgress = useCallback(() => {
    if (progressBatchRef.current && progressBatchRef.current.points.length > 0) {
      const { points, tool, color, width } = progressBatchRef.current;
      onStrokeProgress(points, tool, color, width, size.w, size.h);
      progressBatchRef.current = null;
    }
  }, [onStrokeProgress, size.w, size.h]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const p = getCanvasPoint(e);
      if (!p) return;
      onCursor(p.x, p.y, size.w, size.h);
      if (!isDrawingRef.current) return;
      currentPointsRef.current.push(p);
      redrawForeground();
      // Batch progress: send every 5 points for real-time feel
      if (currentPointsRef.current.length % 5 === 0) {
        flushProgress();
        progressBatchRef.current = {
          points: [...currentPointsRef.current],
          tool: currentTool,
          color: currentColor,
          width: currentWidth,
        };
        if (!progressTimerRef.current) {
          progressTimerRef.current = setInterval(() => {
            flushProgress();
            if (!progressBatchRef.current?.points.length) {
              if (progressTimerRef.current) {
                clearInterval(progressTimerRef.current);
                progressTimerRef.current = null;
              }
            }
          }, 80);
        }
      }
    },
    [getCanvasPoint, onCursor, redrawForeground, currentTool, currentColor, currentWidth, flushProgress, size]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      flushProgress();
      const p = getCanvasPoint(e);
      if (p) currentPointsRef.current.push(p);
      const points = currentPointsRef.current;
      isDrawingRef.current = false;
      currentPointsRef.current = [];
      progressBatchRef.current = null;
      if (points.length >= 1) {
        onStrokeCommit({
          tool: currentTool,
          points,
          color: currentColor,
          width: currentWidth,
        });
        onStrokeProgress([], currentTool, currentColor, currentWidth, size.w, size.h);
      }
      redrawForeground();
    },
    [getCanvasPoint, currentTool, currentColor, currentWidth, onStrokeCommit, onStrokeProgress, redrawForeground, flushProgress, size]
  );

  const handlePointerLeave = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    flushProgress();
    if (isDrawingRef.current) {
      const points = currentPointsRef.current;
      if (points.length >= 1) {
        onStrokeCommit({
          tool: currentTool,
          points,
          color: currentColor,
          width: currentWidth,
        });
        onStrokeProgress([], currentTool, currentColor, currentWidth, size.w, size.h);
      }
      isDrawingRef.current = false;
      currentPointsRef.current = [];
      progressBatchRef.current = null;
      redrawForeground();
    }
  }, [currentTool, currentColor, currentWidth, onStrokeCommit, onStrokeProgress, redrawForeground, flushProgress, size]);

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 400,
        overflow: 'hidden',
        background: '#2d2d44',
        borderRadius: 8,
      }}
    >
      <canvas
        ref={bgRef}
        width={size.w}
        height={size.h}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
      <canvas
        ref={fgRef}
        width={size.w}
        height={size.h}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          cursor: currentTool === 'eraser' ? 'crosshair' : 'crosshair',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      />
    </div>
  );
}
