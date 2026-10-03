const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// mobile/ is built as its own standalone Docker image, so it needs its own
// physical copy of core.js alongside its index.html/game.js — but that copy
// must never silently drift from the root one. If this test fails, copy
// core.js over mobile/core.js again.
test('mobile/core.js is byte-identical to the root core.js', () => {
  const root = fs.readFileSync(path.join(__dirname, '..', 'core.js'), 'utf8');
  const mobile = fs.readFileSync(path.join(__dirname, '..', 'mobile', 'core.js'), 'utf8');
  assert.equal(mobile, root);
});
