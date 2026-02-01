/**
 * Canvas state logic: stroke history and redo stack for a single room.
 * Single source of truth for committed strokes and undo/redo.
 */

let nextStrokeId = 1;

function createDrawingState() {
  const strokeHistory = [];
  const redoStack = [];

  return {
    getState() {
      return { strokeHistory: [...strokeHistory], redoStackLength: redoStack.length };
    },

    addStroke(stroke, userId) {
      const committed = {
        ...stroke,
        id: String(nextStrokeId++),
        userId,
        timestamp: Date.now(),
      };
      strokeHistory.push(committed);
      redoStack.length = 0;
      return committed;
    },

    undo() {
      if (strokeHistory.length === 0) return null;
      const removed = strokeHistory.pop();
      redoStack.push(removed);
      return removed;
    },

    redo() {
      if (redoStack.length === 0) return null;
      const restored = redoStack.pop();
      strokeHistory.push(restored);
      return restored;
    },
  };
}

module.exports = { createDrawingState };
