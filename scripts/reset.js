'use strict';
// Puts the demo data back: npm run reset  (runs this with --demo)
// The real system's data (data/db.json) is never touched by this script.
const store = require('../src/store');

store.reset();
console.log(`Demo data restored in ${store.FILE}`);
console.log('If the demo server is running, restart it (Ctrl+C, then npm run demo) or use "Reset demo data" on the Township page.');
