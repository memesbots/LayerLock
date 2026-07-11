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
globalThis.MutationObserver = class MutationObserver {
  constructor() {}
  observe() {}
};
const scriptMatch = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .find(match => match[1].includes('const SLOT_VERSION = 6'));
assert(scriptMatch, "inline application script not found");

const hook = '    $("tabMake").addEventListener("click", () => switchTab("make"));';
assert(scriptMatch[1].includes(hook), "test hook moved; update the smoke test");

const exposed = `
    globalThis.LayerLockCore = {
      SLOT_VERSION, PACK_VERSION, ENVELOPE_VERSION, KDF_ID, KDF_NAME, HKDF_HASH,
      KEY_CONTEXT, KDF_PROFILES, FEC_PROFILES, randomBytes, bytesToHex, crc32,
      deriveKey, argon2idRaw, argon2WorkerSource, validateKdfParams, encryptSlot, decryptSlot, encodePack, decodePack, encodeEnvelope,
      decodeEnvelope, decodeBody, encryptContainer, decryptContainer,
      encodePayloadFrame, decodePayloadFrame, selectFecProfile
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

console.log("LayerLock v6 core smoke test: OK");
