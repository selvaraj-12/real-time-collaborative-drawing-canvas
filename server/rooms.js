const { createStateManager } = require("./state-manager");

const rooms = {};

function getRoom(id) {
  if (!rooms[id]) {
    rooms[id] = {
      state: createStateManager(),
      users: {}
    };
  }
  return rooms[id];
}

module.exports = { getRoom };
