import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {core} from './load-core.mjs';

const htmlUrl = new URL("../outputs/sigil-vault.html", import.meta.url);
const html = await readFile(htmlUrl, "utf8");

const kdf = core.KDF_PROFILES.fast;
const vaultId = core.randomBytes(16);
const context = { vaultId, packVersion: core.PACK_VERSION, kdf };
const slotA = await core.encryptSlot("layer-audit-passphrase", "same plaintext", context, kdf);
const slotB = await core.encryptSlot("layer-audit-passphrase", "same plaintext", context, kdf);
assert.notDeepEqual(slotA.id, slotB.id, "slot IDs must be unique");
assert.notDeepEqual(slotA.ct, slotB.ct, "equal secrets must not produce equal ciphertext");

const pack = core.encodePack([slotA]);
const envelopeBytes = await core.encryptContainer("master-audit-passphrase", pack, vaultId, kdf);
const opened = core.decodeBody(envelopeBytes).envelope;
assert.equal((await core.decryptContainer("master-audit-passphrase", opened)).p.length, 1);

const profileTamper = envelopeBytes.slice();
profileTamper[5] = 1;
await assert.rejects(core.decryptContainer("master-audit-passphrase", core.decodeBody(profileTamper).envelope));

const idTamper = envelopeBytes.slice();
idTamper[6] ^= 1;
await assert.rejects(core.decryptContainer("master-audit-passphrase", core.decodeBody(idTamper).envelope));

const ciphertextTamper = envelopeBytes.slice();
ciphertextTamper[ciphertextTamper.length - 1] ^= 1;
await assert.rejects(core.decryptContainer("master-audit-passphrase", core.decodeBody(ciphertextTamper).envelope));

const trailing = new Uint8Array(envelopeBytes.length + 1);
trailing.set(envelopeBytes);
assert.throws(() => core.decodeBody(trailing), /bad envelope/);

const weakHumanPassword = "PasswordPassword1!";
const weakEstimate = core.passwordScore(weakHumanPassword);
assert.match(core.passwordPolicyIssue(weakHumanPassword, "layer"), /распространен|угадывается/);
assert.equal(weakEstimate.cls, "easy", "predictable password must be rated weak");

const compressibleText = "A".repeat(1024 * 1024);
const compressed = await core.encodeNoteText(compressibleText);
assert.notEqual(compressed.flag, 3, "repetitive text should be compressed");
assert(compressed.bytes.length < 5000, "test payload should have a high expansion ratio");
const lengthBytes = [];
core.writeVarUint(lengthBytes, compressed.rawLength);
const framed = new Uint8Array(lengthBytes.length + compressed.bytes.length);
framed.set(lengthBytes);
framed.set(compressed.bytes, lengthBytes.length);

const decompressionDescriptor = Object.getOwnPropertyDescriptor(globalThis, "DecompressionStream");
delete globalThis.DecompressionStream;
const fallbackText = await core.decodeNoteText(compressed.flag, framed);
assert.equal(fallbackText, compressibleText, "embedded fallback must decode the exact plaintext");
const expansionBomb = globalThis.fflate.gzipSync(new TextEncoder().encode("B".repeat(2 * 1024 * 1024)));
await assert.rejects(core.decompress(expansionBomb, "gzip", 1024 * 1024), /безопасный лимит/);
if (decompressionDescriptor) Object.defineProperty(globalThis, "DecompressionStream", decompressionDescriptor);
else delete globalThis.DecompressionStream;

const oversizedCore = new Uint8Array(8 * 1024 * 1024);
oversizedCore.set([0x4c, 0x4c, 0x45, 0x34]);
assert.throws(() => core.makeCompactBytes(oversizedCore, "standard"), /безопасный лимит/);
assert.throws(() => core.parseCompactBytes(new Uint8Array(core.MAX_CONTAINER_BYTES + 33)), /безопасный лимит/);
assert.throws(() => core.decodeBody(new Uint8Array(core.MAX_CONTAINER_BYTES + 1)), /bad body/);
assert.throws(() => core.parseCompactBytes(Uint8Array.from([
  0x4c, 0x4c, 0x43, 0x32, 1, 0x81, 0x00, 0x00, 0, 0, 0, 0
])), /bad varint/);

const pngHeader = new Uint8Array(24);
pngHeader.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pngView = new DataView(pngHeader.buffer);
pngView.setUint32(16, 100000, false);
pngView.setUint32(20, 100000, false);
const dimensions = await core.readRasterDimensions(new Blob([pngHeader], { type: "image/png" }));
assert.deepEqual(dimensions, { width: 100000, height: 100000 });
assert.throws(() => core.validateImageDimensions(dimensions.width, dimensions.height), /слишком большое/);

assert(!html.includes("External master-key file:"), "settings report leaks key-file use");
assert(!html.includes("`Layers: ${state.lastLayerCount}`"), "settings report leaks exact layer count");

console.log(JSON.stringify({
  cryptoTamperChecks: "passed",
  equalSecretCiphertextsDiffer: true,
  passwordEstimator: { password: weakHumanPassword, label: weakEstimate.label },
  decompressionExpansion: `${compressed.bytes.length} -> ${compressibleText.length} bytes`,
  decompressionLimit: "enforced",
  compactPayloadLimit: "enforced",
  imageBombLimit: "enforced",
  generatedKeyFileConfirmation: "covered by browser-flow"
}, null, 2));
