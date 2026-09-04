'use strict';
const assert = require('assert');
const { applyTableBounce } = require('./table-bounce.js');

const close = (actual, expected, tolerance = 1e-9) => assert(
  Math.abs(actual - expected) <= tolerance,
  `expected ${actual} to be within ${tolerance} of ${expected}`
);

const result = applyTableBounce(
  { x: 6, y: .8, z: -3 },
  { x: -12, y: 85, z: 4 },
  .02
);
assert.strictEqual(result.contactMode, 'sliding');
close(result.restitution, .92);
close(result.alpha, .33207944157219577);
close(result.velocity.x, 4.541717385042023);
close(result.velocity.y, .6253096342010864);
close(result.velocity.z, 2.821404668363574);
close(result.omega.x, -24.45087112257603);
close(result.omega.y, 188.9804033283614);
close(result.omega.z, 1.5557886203432134);

// Rotating the complete incoming state around the table normal must rotate the
// fitted local-frame result by the same amount.
const quarterTurn = applyTableBounce(
  { x: -.8, y: 6, z: -3 },
  { x: -85, y: -12, z: 4 },
  .02
);
close(quarterTurn.velocity.x, -result.velocity.y);
close(quarterTurn.velocity.y, result.velocity.x);
close(quarterTurn.velocity.z, result.velocity.z);
close(quarterTurn.omega.x, -result.omega.y);
close(quarterTurn.omega.y, result.omega.x);
close(quarterTurn.omega.z, result.omega.z);

console.log('PASS published table-bounce transform and local-frame rotation');
