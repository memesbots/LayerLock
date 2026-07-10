import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Worker as NodeWorker } from "node:worker_threads";

const htmlUrl = new URL("../outputs/sigil-vault.html", import.meta.url);
const html = await readFile(htmlUrl, "utf8");
const vendorMatch = html.match(/<script\b[^>]*id="argon2VendorSource"[^>]*>([\s\S]*?)<\/script>/i);
assert(vendorMatch, "inline Argon2 vendor source not found");
globalThis.__LayerLockArgon2VendorSource = vendorMatch[1];
const vendorModule = { exports: {} };
new Function("module", "exports", vendorMatch[1])(vendorModule, vendorModule.exports);
globalThis.hashwasm = vendorModule.exports;
const scriptMatch = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .find(match => match[1].includes('const MAGIC = [0x53, 0x47, 0x56, 0x31]'));
assert(scriptMatch, "inline application script not found");

const hook = '    $("tabMake").addEventListener("click", () => switchTab("make"));';
assert(scriptMatch[1].includes(hook), "test hook moved; update the smoke test");

const exposed = `
    globalThis.LayerLockCore = {
      SLOT_VERSION, PACK_VERSION, ENVELOPE_VERSION, KDF_ID, KDF_NAME, HKDF_HASH,
      KEY_CONTEXT, KDF_PROFILES, FEC_PROFILES, randomBytes, bytesToHex, crc32,
      deriveKey, argon2idRaw, argon2WorkerSource, validateKdfParams, encryptSlot, decryptSlot, encodePack, decodePack, encodeEnvelope,
      decodeEnvelope, decodeBody, encryptContainer, decryptContainer,
      encodePayloadFrame, decodePayloadFrame, selectFecProfile, payloadCapacity,
      scanner2DetectRegions, scanner2WorkerSource, solveLinearSystem, projectiveMapFromUnitSquare
    };
    return;
`;

const instrumented = scriptMatch[1].replace(hook, exposed + hook);
new Function(instrumented)();

const core = globalThis.LayerLockCore;
assert(core, "core functions were not exposed");
assert.equal(core.SLOT_VERSION, 6);
assert.equal(core.PACK_VERSION, 6);
assert.equal(core.ENVELOPE_VERSION, 3);
assert.equal(core.KDF_ID, 3);
assert.equal(core.payloadCapacity(24, 3), 192);

const kdf = core.KDF_PROFILES.fast;
const vaultId = core.randomBytes(16);
const aadContext = { vaultId: core.bytesToHex(vaultId), packVersion: core.PACK_VERSION, kdf };
const slot = await core.encryptSlot("layer-pass", "LayerLock v6: Привет", 128, aadContext, kdf);
assert.equal(await core.decryptSlot("layer-pass", slot, 128, aadContext, kdf), "LayerLock v6: Привет");
await assert.rejects(core.decryptSlot("wrong-pass", slot, 128, aadContext, kdf));

const packBytes = core.encodePack([slot], vaultId, 128, kdf);
const decodedPack = core.decodePack(packBytes);
assert.equal(decodedPack.p.length, 1);
assert.equal(decodedPack.z, 128);
assert.deepEqual(decodedPack.q, {
  memory: kdf.memory,
  iterations: kdf.iterations,
  parallelism: kdf.parallelism
});

const tamperedPack = packBytes.slice();
tamperedPack[9] ^= 1;
assert.throws(() => core.decodePack(tamperedPack), /unsupported KDF profile/);

const envelopeBytes = await core.encryptContainer("master-pass", packBytes, kdf);
const body = core.decodeBody(envelopeBytes);
assert.equal(body.kind, "locked");
const tamperedEnvelope = envelopeBytes.slice();
tamperedEnvelope[9] ^= 1;
assert.throws(() => core.decodeEnvelope(tamperedEnvelope), /unsupported KDF profile/);
const openedPack = await core.decryptContainer("master-pass", body.envelope);
assert.equal(openedPack.p.length, 1);
await assert.rejects(core.decryptContainer("wrong-master", body.envelope));

const salt = core.randomBytes(32);
const iv = core.randomBytes(12);
const plain = new TextEncoder().encode("domain separation");
const slotKey = await core.deriveKey("same-password", salt, core.KEY_CONTEXT.slot, kdf);
const containerKey = await core.deriveKey("same-password", salt, core.KEY_CONTEXT.container, kdf);
const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, slotKey, plain);
await assert.rejects(crypto.subtle.decrypt({ name: "AES-GCM", iv }, containerKey, encrypted));

const argonPassword = new TextEncoder().encode("worker-password");
const argonSalt = Uint8Array.from({ length: 16 }, (_, i) => i + 1);
const expectedArgon = await core.argon2idRaw(argonPassword, argonSalt, kdf);
const argonWorkerSource = `
  const { parentPort } = require("node:worker_threads");
  const self = { postMessage: (message, transfer) => parentPort.postMessage(message, transfer), onmessage: null };
  ${core.argon2WorkerSource()}
  parentPort.on("message", data => self.onmessage({ data }));
`;
const workerArgon = await new Promise((resolve, reject) => {
  const worker = new NodeWorker(argonWorkerSource, { eval: true });
  worker.once("error", reject);
  worker.once("message", message => {
    worker.terminate();
    message.ok ? resolve(new Uint8Array(message.buffer)) : reject(new Error(message.error));
  });
  const password = argonPassword.slice();
  const salt = argonSalt.slice();
  worker.postMessage({ id: 7, passwordBuffer: password.buffer, saltBuffer: salt.buffer, params: kdf }, [password.buffer, salt.buffer]);
});
assert.deepEqual(workerArgon, expectedArgon);

function corruptChunks(frame, count) {
  const damaged = frame.slice();
  const view = new DataView(damaged.buffer, damaged.byteOffset, damaged.byteLength);
  const chunkSize = view.getUint16(5, false);
  const dataChunks = view.getUint16(11, false);
  const parityChunks = damaged[13];
  const totalChunks = dataChunks + parityChunks;
  const interleavedOffset = 18 + totalChunks * 4;
  for (let chunk = 0; chunk < count; chunk++) {
    for (let byte = 0; byte < chunkSize; byte++) damaged[interleavedOffset + byte * totalChunks + chunk] ^= 0xff;
  }
  return { damaged, dataChunks, parityChunks };
}

for (const profile of Object.values(core.FEC_PROFILES)) {
  const fecFrame = core.encodePayloadFrame(envelopeBytes, profile);
  assert.deepEqual(core.decodePayloadFrame(fecFrame, core.crc32(envelopeBytes)), envelopeBytes);
  const parsed = corruptChunks(fecFrame, fecFrame[13]);
  assert(parsed.parityChunks < parsed.dataChunks, "test payload must contain more data than parity chunks");
  assert.deepEqual(core.decodePayloadFrame(parsed.damaged, core.crc32(envelopeBytes)), envelopeBytes);
  const beyondCapacity = corruptChunks(fecFrame, parsed.parityChunks + 1);
  assert.equal(core.decodePayloadFrame(beyondCapacity.damaged, core.crc32(envelopeBytes)), null);
}

const wrapSource = html.slice(html.indexOf("function wrapPayload"), html.indexOf("function unwrapPayload"));
assert(!wrapSource.includes("encodePayloadFrame("), "wrapPayload must not rebuild the FEC frame");

const scanWidth = 640, scanHeight = 400;
const scanPixels = new Uint8ClampedArray(scanWidth * scanHeight * 4);
for (let y = 0; y < scanHeight; y++) {
  for (let x = 0; x < scanWidth; x++) {
    const inCode = x >= 380 && x < 580 && y >= 90 && y < 290;
    const uiEdge = y < 48 || (x < 210 && y % 42 < 5) || (x > 250 && x < 350 && y > 90 && y % 54 < 4);
    const value = inCode
      ? (((Math.floor((x - 380) / 6) + Math.floor((y - 90) / 6)) & 1) ? 245 : 10)
      : (uiEdge ? 45 : 150);
    const p = (y * scanWidth + x) * 4;
    scanPixels[p] = scanPixels[p + 1] = scanPixels[p + 2] = value;
    scanPixels[p + 3] = 255;
  }
}
const located = core.scanner2DetectRegions(scanWidth, scanHeight, scanPixels, scanWidth, scanHeight);
assert(located.regions.some(region => {
  const cx = region.sx + region.side / 2;
  const cy = region.sy + region.side / 2;
  return Math.abs(cx - 480) < 70 && Math.abs(cy - 190) < 70 && region.side > 150;
}), "Scanner 2 did not locate a synthetic visual container");
new Function(core.scanner2WorkerSource());
const nodeWorkerSource = `
  const { parentPort } = require("node:worker_threads");
  const self = { postMessage: message => parentPort.postMessage(message), onmessage: null };
  ${core.scanner2WorkerSource()}
  parentPort.on("message", data => self.onmessage({ data }));
`;
const workerResult = await new Promise((resolve, reject) => {
  const worker = new NodeWorker(nodeWorkerSource, { eval: true });
  worker.once("error", reject);
  worker.once("message", message => {
    worker.terminate();
    resolve(message);
  });
  const transferred = scanPixels.slice();
  worker.postMessage({
    id: 1,
    width: scanWidth,
    height: scanHeight,
    sourceWidth: scanWidth,
    sourceHeight: scanHeight,
    buffer: transferred.buffer
  }, [transferred.buffer]);
});
assert.equal(workerResult.ok, true);
assert(workerResult.result.regions.length > 0, "Scanner 2 worker returned no candidates");
const quad = [{ x: 20, y: 30 }, { x: 330, y: 15 }, { x: 350, y: 280 }, { x: 5, y: 300 }];
const map = core.projectiveMapFromUnitSquare(quad);
assert(map, "Scanner 3 homography could not be solved");
function project(u, v) {
  const [a, b, c, d, e, f, g, h] = map;
  const denominator = g * u + h * v + 1;
  return { x: (a * u + b * v + c) / denominator, y: (d * u + e * v + f) / denominator };
}
for (const [index, uv] of [[0, [0, 0]], [1, [1, 0]], [2, [1, 1]], [3, [0, 1]]]) {
  const mapped = project(...uv);
  assert(Math.abs(mapped.x - quad[index].x) < 1e-6);
  assert(Math.abs(mapped.y - quad[index].y) < 1e-6);
}

console.log(`LayerLock v6 core smoke test: OK; Scanner 2 locator ${located.elapsed} ms`);
