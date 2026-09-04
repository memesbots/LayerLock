import assert from 'node:assert/strict';
import {core} from './load-core.mjs';

const gate = core.createCameraHintGate();
assert(gate('ready', 1, 0, true));
// Unstable frame measurements must not flicker or repeatedly rewrite live text.
for (let t = 50; t <= 4000; t += 50) {
  assert.equal(gate(t % 100 ? 'dark' : 'ready', t % 100 ? 0 : 1, t), false);
}
assert.equal(gate('dark', 0, 4100), false);
assert.equal(gate('dark', 0, 4900), false);
assert.equal(gate('dark', 0, 5000), true);
assert.equal(gate('dark', 0, 5100), false);
assert.equal(gate('blur', 0, 5200), false);
assert.equal(gate('blur', 0, 6200), false, 'current hint must remain readable for two seconds');
assert.equal(gate('blur', 0, 7000), true);
assert.equal(gate('found', 3, 7001, true), true, 'successful detection must be immediate');
assert.equal(gate('found', 3, 7002, true), false);
assert.equal(core.createCameraHintGate()('ready', 1, 0, true), true, 'new camera sessions must reset the gate');
console.log('Camera hints: no frame spam, stable conditions only, 2s hold, immediate success OK');
