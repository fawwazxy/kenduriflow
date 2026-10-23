'use strict';

// Simple rate limits kept in memory: at most `max` requests per `windowMs` for each key.
// Enough for one township server. Stops code guessing, SMS flooding and button spamming.

const buckets = new Map();

function hit(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset <= now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.n += 1;
  if (b.n > max) {
    const mins = Math.max(1, Math.ceil((b.reset - now) / 60000));
    throw Object.assign(new Error(`Too many tries. Please wait ${mins} minute${mins > 1 ? 's' : ''} and try again.`), { status: 429 });
  }
}

// Old buckets are cleared every few minutes.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
}, 5 * 60000).unref();

module.exports = { hit };
