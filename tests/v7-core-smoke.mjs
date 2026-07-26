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
globalThis.window = globalThis;
globalThis.MutationObserver = class MutationObserver {
  observe() {}
};

const scriptMatch = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .find(match => match[1].includes("const SLOT_VERSION = 7"));
assert(scriptMatch, "inline application script not found");

const hook = '    $("tabMake").addEventListener("click", () => switchTab("make"));';
assert(scriptMatch[1].includes(hook), "test hook moved; update the smoke test");

const exposed = `
    globalThis.LayerLockCore = {
      SLOT_VERSION, PACK_VERSION, ENVELOPE_VERSION, KDF_ID, KDF_NAME, HKDF_HASH,
      KEY_CONTEXT, KDF_PROFILES, FEC_PROFILES, randomBytes, bytesToHex, crc32,
      deriveKey, deriveDomainBytes, argon2idRaw, argon2WorkerSource,
      validateKdfParams, kdfProfileIndex, kdfProfileFromIndex,
      passwordPolicyIssue, passwordIdentity,
      encryptSlot, decryptSlot, encodePack, decodePack, encodeEnvelope,
      decodeEnvelope, decodeBody, encryptContainer, decryptContainer, makeSvg,
      makeCompactBytes, parseCompactBytes, makeCompactText, parseCompactText
    };
    return;
`;

const instrumented = scriptMatch[1].replace(hook, exposed + hook);
new Function(instrumented)();

const core = globalThis.LayerLockCore;
assert(core, "core functions were not exposed");
assert.equal(core.SLOT_VERSION, 7);
assert.equal(core.PACK_VERSION, 7);
assert.equal(core.ENVELOPE_VERSION, 4);
assert.equal(core.KDF_ID, 4);

const compactSvg = core.makeSvg({
  moduleWidth: 3,
  moduleHeight: 2,
  moduleData: new Uint8Array([0, 0, 255, 255, 0, 255]),
  scale: 4
});
assert.match(compactSvg, /<path fill="#000000" d="M0 0h2v1H0zM1 1h1v1H1z"\/>/);
assert.doesNotMatch(compactSvg, /<rect x=/);

const compactSource = new Uint8Array([0, 1, 2, 3, 127, 128, 254, 255]);
const compactText = core.makeCompactText(compactSource, "enhanced");
assert.match(compactText, /^LAYERLOCK-COMPACT\/2\n[A-Za-z0-9_-]+\n$/);
const restoredCompact = core.parseCompactText(compactText);
assert.equal(restoredCompact.fecKey, "enhanced");
assert.deepEqual(restoredCompact.containerBytes, compactSource);
const compactBytes = core.makeCompactBytes(compactSource, "maximum");
const restoredRaw = core.parseCompactBytes(compactBytes);
assert.equal(restoredRaw.fecKey, "maximum");
assert.deepEqual(restoredRaw.containerBytes, compactSource);
const compactLines = compactText.trim().split("\n");
const damageIndex = Math.floor(compactLines[1].length / 2);
compactLines[1] = `${compactLines[1].slice(0, damageIndex)}${compactLines[1][damageIndex] === "A" ? "B" : "A"}${compactLines[1].slice(damageIndex + 1)}`;
assert.throws(() => core.parseCompactText(compactLines.join("\n")), /Контрольная сумма|Структура/);

const kdf = core.KDF_PROFILES.fast;
assert.equal(core.kdfProfileIndex(kdf), 0);
assert.equal(core.kdfProfileIndex(core.KDF_PROFILES.ultra), 3);
assert.equal(core.kdfProfileFromIndex(3).iterations, 6);
assert.deepEqual(core.kdfProfileFromIndex(0), {
  memory: kdf.memory,
  iterations: kdf.iterations,
  parallelism: kdf.parallelism,
  label: kdf.label
});

const vaultId = core.randomBytes(16);
const slotId = core.randomBytes(8);
const saltA = await core.deriveDomainBytes("slot-salt", vaultId, slotId, 16);
const saltB = await core.deriveDomainBytes("slot-salt", vaultId, slotId, 16);
const nonce = await core.deriveDomainBytes("slot-nonce", vaultId, slotId, 12);
assert.deepEqual(saltA, saltB, "domain derivation must be deterministic");
assert.notDeepEqual(saltA.subarray(0, 12), nonce, "salt and nonce domains must be separated");

const aadContext = { vaultId, packVersion: core.PACK_VERSION, kdf };
const note = "LayerLock v7: Привет";
const slot = await core.encryptSlot("layer-pass", note, aadContext, kdf);
assert.equal(slot.id.length, 8);
assert.equal(await core.decryptSlot("layer-pass", slot, aadContext, kdf), note);
await assert.rejects(core.decryptSlot("wrong-pass", slot, aadContext, kdf));
const tamperedSlot = { ...slot, id: slot.id.slice(), ct: slot.ct.slice() };
tamperedSlot.id[0] ^= 1;
await assert.rejects(core.decryptSlot("layer-pass", tamperedSlot, aadContext, kdf));

const packBytes = core.encodePack([slot]);
const decodedPack = core.decodePack(packBytes, vaultId, kdf);
assert.equal(decodedPack.p.length, 1);
assert.equal(decodedPack.u.length, 16);
assert.deepEqual(decodedPack.q, {
  memory: kdf.memory,
  iterations: kdf.iterations,
  parallelism: kdf.parallelism
});
assert.throws(() => core.encodePack([slot, { ...slot }]), /duplicate slot id/);

const envelopeBytes = await core.encryptContainer("master-pass", packBytes, vaultId, kdf);
const body = core.decodeBody(envelopeBytes);
assert.equal(body.kind, "locked");
assert.equal(body.envelope.id.length, 16);
const compactEnvelope = core.makeCompactBytes(envelopeBytes, "standard");
assert(compactEnvelope.length < 160, `minimal v7 container is unexpectedly large: ${compactEnvelope.length} bytes`);
assert.deepEqual(core.parseCompactBytes(compactEnvelope).containerBytes, envelopeBytes);

const badProfile = envelopeBytes.slice();
badProfile[5] = 0xff;
assert.throws(() => core.decodeEnvelope(badProfile), /unsupported KDF profile/);
const openedPack = await core.decryptContainer("master-pass", body.envelope);
assert.equal(openedPack.p.length, 1);
assert.equal(await core.decryptSlot("layer-pass", openedPack.p[0], {
  vaultId: openedPack.u,
  packVersion: core.PACK_VERSION,
  kdf: openedPack.q
}, openedPack.q), note);
await assert.rejects(core.decryptContainer("wrong-master", body.envelope));

const keyFileDigest = core.randomBytes(32);
const keyFileEnvelopeBytes = await core.encryptContainer("master-pass", packBytes, vaultId, kdf, keyFileDigest);
assert.equal(keyFileEnvelopeBytes.length, envelopeBytes.length, "key-file mode must add zero container bytes");
const keyFileBody = core.decodeBody(keyFileEnvelopeBytes);
await assert.rejects(core.decryptContainer("master-pass", keyFileBody.envelope));
await assert.rejects(core.decryptContainer("master-pass", keyFileBody.envelope, core.randomBytes(32)));
const keyFileOpenedPack = await core.decryptContainer("master-pass", keyFileBody.envelope, keyFileDigest);
assert.equal(keyFileOpenedPack.p.length, 1);

assert.match(core.passwordPolicyIssue("123123", "master"), /16 символов|распространен/);
assert.match(core.passwordPolicyIssue("123456789012", "layer"), /распространен|угадывается/);
assert.equal(core.passwordPolicyIssue("four calm words form a strong layer passphrase", "layer"), "");
assert.equal(core.passwordIdentity("ＡＢＣ  "), "abc");

const tamperedEnvelope = structuredClone(body.envelope);
tamperedEnvelope.ct = body.envelope.ct.slice();
tamperedEnvelope.ct[tamperedEnvelope.ct.length - 1] ^= 1;
await assert.rejects(core.decryptContainer("master-pass", tamperedEnvelope));

const salt = core.randomBytes(16);
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
  const workerSalt = argonSalt.slice();
  worker.postMessage({ id: 7, passwordBuffer: password.buffer, saltBuffer: workerSalt.buffer, params: kdf }, [password.buffer, workerSalt.buffer]);
});
assert.deepEqual(workerArgon, expectedArgon);

console.log(`LayerLock v7 core smoke test: OK (${compactEnvelope.length} compact bytes)`);
