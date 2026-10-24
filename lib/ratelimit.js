'use strict';

// Small in-memory limiter: at most `max` requests per `windowMs` for each key.
function createLimiter(max, windowMs) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
  }, windowMs);
  timer.unref();
  return function allow(key) {
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    return entry.count <= max;
  };
}

module.exports = { createLimiter };
