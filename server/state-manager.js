function createStateManager() {
  let commands = [];
  let undone = [];

  return {
    add(cmd) {
      commands.push(cmd);
      undone = [];
    },
    undo() {
      if (!commands.length) return null;
      const c = commands.pop();
      undone.push(c);
      return c;
    },
    redo() {
      if (!undone.length) return null;
      const c = undone.pop();
      commands.push(c);
      return c;
    },
    getState() {
      return commands;
    }
  };
}

module.exports = { createStateManager };
