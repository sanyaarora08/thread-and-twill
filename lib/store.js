'use strict';
const fs = require('fs');
const path = require('path');

// A simple order log: one JSON object per line. On hosts where the disk is wiped
// on every deploy, treat the Razorpay dashboard as the permanent record and set
// DATA_DIR to a persistent disk if you want this file to survive.
function createStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'orders.jsonl');
  return {
    file,
    append(entry) {
      const line = JSON.stringify(Object.assign({ at: new Date().toISOString() }, entry)) + '\n';
      fs.appendFile(file, line, (err) => {
        if (err) console.error('Could not write order log:', err.message);
      });
    }
  };
}

module.exports = { createStore };
