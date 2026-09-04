import {readFile} from 'node:fs/promises';
import {createLayerLock} from '../work/layerlock-core.mjs';

const argon = await readFile(new URL('../vendor/hash-wasm-argon2-4.12.0.umd.min.js', import.meta.url), 'utf8');
const compression = await readFile(new URL('../vendor/fflate-0.8.2.umd.js', import.meta.url), 'utf8');
globalThis.__LayerLockArgon2VendorSource = argon;
for (const [name, source] of [['hashwasm',argon],['fflate',compression]]) {
  const module = {exports:{}};
  new Function('module','exports',source)(module,module.exports);
  globalThis[name] = module.exports;
}
globalThis.window = globalThis;
globalThis.MutationObserver ||= class {observe(){}};
export const core = createLayerLock(false);
