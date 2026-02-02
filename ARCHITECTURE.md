
---

###  `ARCHITECTURE.md` (Final Version)

```markdown
# Architecture

## Overview
- Node.js + Express + Socket.io backend
- HTML Canvas API frontend
- Server maintains **global history** for all actions (strokes, text, clear) for undo/redo
- Clients rebuild canvas from history whenever an update occurs

## Features
- Brush / Eraser / Color Picker
- Auto-text painting along pointer
- Live cursor for each user
- Global Undo / Redo
- Clear All synchronizes for all users
- Multi-user login

## WebSocket Events
| Event           | Description |
|-----------------|-------------|
| `user:join`     | Add new user and broadcast users list |
| `draw`          | Brush/Eraser strokes |
| `text`          | Auto-text painting strokes |
| `undo`          | Remove last action globally |
| `redo`          | Replay last undone action globally |
| `clear`         | Clear canvas globally |
| `cursor:move`   | Broadcast live pointer position to others |

## Undo / Redo Strategy
- All drawing actions are stored in `history[]` on server
- Undo removes the last action and triggers a rebuild
- Redo pushes back the last undone action and triggers a rebuild
- Works globally across users

## Conflict Handling
- Multiple users drawing simultaneously: actions are applied in the order received
- Auto-text uses spacing to reduce overlap

## Performance Decisions
- Only send action data, not full canvas pixels
- Clients redraw from history for undo/redo to stay synchronized
- Cursors updated separately for smooth movement
