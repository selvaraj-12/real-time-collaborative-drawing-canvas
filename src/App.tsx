import React, { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { DrawingCanvas } from './DrawingCanvas';
import type { Stroke, User, CursorPosition } from './types';

const COLORS = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#46f0f0', '#f032e6', '#000000', '#808080',
];

const STROKE_WIDTHS = [2, 4, 8, 12, 20];

function LoginForm({ onJoin }: { onJoin: (name: string) => void }) {
  const [value, setValue] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onJoin(value);
  };
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Your username"
        maxLength={32}
        autoFocus
        style={{
          width: '100%',
          padding: '12px 14px',
          marginBottom: 16,
          fontSize: 16,
          border: '1px solid #0f3460',
          borderRadius: 6,
          background: '#0f3460',
          color: '#fff',
          outline: 'none',
        }}
      />
      <button type="submit" style={btnStyle} disabled={!value.trim()}>
        Join
      </button>
    </form>
  );
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [myColor, setMyColor] = useState(COLORS[0]);
  const [users, setUsers] = useState<User[]>([]);
  const [strokeHistory, setStrokeHistory] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [liveStrokes, setLiveStrokes] = useState<
    Map<string, { points: { x: number; y: number }[]; tool: Stroke['tool']; color: string; width: number }>
  >(new Map());
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const [tool, setTool] = useState<Stroke['tool']>('brush');
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(8);
  const cursorThrottleRef = useRef(0);
  const CURSOR_THROTTLE_MS = 50;

  useEffect(() => {
    const s = io(window.location.origin, { transports: ['websocket', 'polling'] });
    setSocket(s);

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    s.on('init', (data: {
      userId: string;
      color: string;
      users: User[];
      strokeHistory: Stroke[];
    }) => {
      setUserId(data.userId);
      setMyColor(data.color);
      setUsers(data.users);
      setStrokeHistory(data.strokeHistory);
    });

    s.on('user_joined', (user: User) => {
      setUsers((prev) => {
        if (prev.some((u) => u.socketId === user.socketId)) return prev;
        return [...prev, user];
      });
    });

    s.on('user_updated', (data: { socketId: string; userId: string; name: string }) => {
      setUsers((prev) =>
        prev.map((u) => (u.socketId === data.socketId ? { ...u, name: data.name } : u))
      );
    });

    s.on('user_left', (data: { socketId: string; userId: string }) => {
      setUsers((prev) => prev.filter((u) => u.socketId !== data.socketId));
      setCursors((prev) => {
        const next = new Map(prev);
        next.delete(data.socketId);
        return next;
      });
      if (data.userId) {
        setLiveStrokes((prev) => {
          const next = new Map(prev);
          next.delete(data.userId);
          return next;
        });
      }
    });

    s.on('stroke_commit', (stroke: Stroke) => {
      setStrokeHistory((prev) => [...prev, stroke]);
      setRedoStack([]);
      setLiveStrokes((prev) => {
        const next = new Map(prev);
        if (stroke.userId) next.delete(stroke.userId);
        return next;
      });
    });

    s.on('stroke_progress', (data: {
      userId: string;
      color: string;
      points: { x: number; y: number }[];
      tool: Stroke['tool'];
      width: number;
      canvasWidth?: number;
      canvasHeight?: number;
    }) => {
      if (!data.points.length) {
        setLiveStrokes((prev) => {
          const next = new Map(prev);
          next.delete(data.userId);
          return next;
        });
        return;
      }
      setLiveStrokes((prev) => {
        const next = new Map(prev);
        next.set(data.userId, {
          points: data.points,
          tool: data.tool,
          color: data.color,
          width: data.width,
          canvasWidth: data.canvasWidth,
          canvasHeight: data.canvasHeight,
        });
        return next;
      });
    });

    s.on('cursor', (data: CursorPosition & { socketId: string; canvasWidth?: number; canvasHeight?: number }) => {
      setCursors((prev) => {
        const next = new Map(prev);
        next.set(data.socketId, {
          x: data.x,
          y: data.y,
          canvasWidth: data.canvasWidth,
          canvasHeight: data.canvasHeight,
          socketId: data.socketId,
          userId: data.userId,
          color: data.color,
          name: data.name,
        });
        return next;
      });
    });

    s.on('undo', (data: { strokeId: string }) => {
      setStrokeHistory((prev) => {
        const removed = prev.find((s) => s.id === data.strokeId);
        if (removed) setRedoStack((r) => [...r, removed]);
        return prev.filter((s) => s.id !== data.strokeId);
      });
    });

    s.on('redo', (data: { stroke: Stroke }) => {
      setStrokeHistory((prev) => [...prev, data.stroke]);
      setRedoStack((prev) => prev.slice(0, -1));
    });

    return () => {
      s.disconnect();
    };
  }, []);

  const handleStrokeCommit = useCallback(
    (stroke: Omit<Stroke, 'id' | 'userId' | 'timestamp'>) => {
      socket?.emit('stroke_commit', stroke);
    },
    [socket]
  );

  const handleStrokeProgress = useCallback(
    (points: { x: number; y: number }[], t: Stroke['tool'], c: string, w: number, canvasW: number, canvasH: number) => {
      socket?.emit('stroke_progress', { points, tool: t, color: c, width: w, canvasWidth: canvasW, canvasHeight: canvasH });
    },
    [socket]
  );

  const handleCursor = useCallback(
    (x: number, y: number, canvasWidth: number, canvasHeight: number) => {
      const now = Date.now();
      if (now - cursorThrottleRef.current < CURSOR_THROTTLE_MS) return;
      cursorThrottleRef.current = now;
      socket?.emit('cursor', { x, y, canvasWidth, canvasHeight });
    },
    [socket]
  );

  const handleUndo = useCallback(() => {
    socket?.emit('undo');
  }, [socket]);

  const handleRedo = useCallback(() => {
    socket?.emit('redo');
  }, [socket]);

  const handleJoin = useCallback(
    (name: string) => {
      const trimmed = name.trim().slice(0, 32);
      if (!trimmed || !socket) return;
      setUsername(trimmed);
      socket.emit('set_username', trimmed);
    },
    [socket]
  );

  // Connecting: wait for socket and init
  if (!connected || userId == null) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a2e',
          color: '#aaa',
        }}
      >
        Connecting…
      </div>
    );
  }

  // Login screen: enter username before joining the canvas
  if (username == null) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a2e',
        }}
      >
        <div
          style={{
            background: '#16213e',
            padding: 32,
            borderRadius: 12,
            border: '1px solid #0f3460',
            width: '100%',
            maxWidth: 360,
          }}
        >
          <h2 style={{ margin: '0 0 8px', fontSize: '1.5rem' }}>Join the canvas</h2>
          <p style={{ margin: '0 0 24px', color: '#aaa', fontSize: 14 }}>
            Enter a display name to start drawing with others.
          </p>
          <LoginForm onJoin={handleJoin} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header
        style={{
          padding: '12px 20px',
          background: '#16213e',
          borderBottom: '1px solid #0f3460',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
          Collaborative Canvas
        </h1>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: connected ? '#3cb44b' : '#e6194b',
            boxShadow: connected ? '0 0 8px #3cb44b' : 'none',
          }}
          title={connected ? 'Connected' : 'Disconnected'}
        />
        <span style={{ fontSize: 14, color: '#aaa' }}>
          {connected ? 'Connected' : 'Connecting…'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            type="button"
            onClick={handleUndo}
            disabled={!connected || strokeHistory.length === 0}
            style={btnStyle}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!connected || redoStack.length === 0}
            style={btnStyle}
          >
            Redo
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <aside
          style={{
            width: 220,
            padding: 16,
            background: '#16213e',
            borderRight: '1px solid #0f3460',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <section>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: '#aaa' }}>
              Tool
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setTool('brush')}
                style={{
                  ...btnStyle,
                  background: tool === 'brush' ? '#4363d8' : '#0f3460',
                }}
              >
                Brush
              </button>
              <button
                type="button"
                onClick={() => setTool('eraser')}
                style={{
                  ...btnStyle,
                  background: tool === 'eraser' ? '#4363d8' : '#0f3460',
                }}
              >
                Eraser
              </button>
            </div>
          </section>
          <section>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: '#aaa' }}>
              Color
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: c,
                    border: color === c ? '3px solid #fff' : '1px solid #444',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </section>
          <section>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: '#aaa' }}>
              Stroke width
            </label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setStrokeWidth(w)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: strokeWidth === w ? '#4363d8' : '#0f3460',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  {w}
                </button>
              ))}
            </div>
          </section>
          <section style={{ marginTop: 'auto' }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: '#aaa' }}>
              Online ({users.length})
            </label>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {users.map((u) => (
                <li
                  key={u.socketId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 0',
                    fontSize: 14,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: u.color,
                    }}
                  />
                  <span style={{ color: u.id === userId ? '#fff' : '#ccc' }}>
                    {u.name}
                    {u.id === userId ? ' (you)' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <main style={{ flex: 1, padding: 24, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <DrawingCanvas
            strokeHistory={strokeHistory}
            liveStrokes={liveStrokes}
            cursors={cursors}
            currentTool={tool}
            currentColor={color}
            currentWidth={strokeWidth}
            userId={userId}
            onStrokeCommit={handleStrokeCommit}
            onStrokeProgress={handleStrokeProgress}
            onCursor={handleCursor}
          />
        </main>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '8px 14px',
  background: '#0f3460',
  border: 'none',
  borderRadius: 6,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
};
