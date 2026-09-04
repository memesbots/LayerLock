import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {core} from './load-core.mjs';
const {fixtures} = JSON.parse(await readFile(new URL('./fixtures/v7-public.json',import.meta.url),'utf8'));
for (const fixture of fixtures) {
  const compact = core.parseCompactBytes(new Uint8Array(Buffer.from(fixture.rawBase64,'base64')));
  const body = core.decodeBody(compact.containerBytes);
  const digest = fixture.keyFileHex ? new Uint8Array(await crypto.subtle.digest('SHA-256',Buffer.from(fixture.keyFileHex,'hex'))) : null;
  const pack = await core.decryptContainer(fixture.master,body.envelope,digest);
  const context = {vaultId:pack.u,packVersion:pack.v,kdf:pack.q};
  assert.equal(pack.p.length,fixture.layers.length);
  for(let i=0;i<fixture.layers.length;i++) {
    assert.equal(await core.decryptSlot(fixture.layers[i].password,pack.p[i],context,pack.q),fixture.layers[i].text);
  }
  const estimate = await core.measureCapacity(fixture.layers.map(layer=>layer.text));
  assert.equal(estimate.containerBytes,compact.containerBytes.length,'capacity estimate must include exact framing');
  assert.equal(estimate.rawFileBytes,Buffer.from(fixture.rawBase64,'base64').length);
}
// Cancelling a KDF must reject its continuation, including the non-Worker fallback.
const fixture = fixtures[0];
const body = core.decodeBody(core.parseCompactBytes(new Uint8Array(Buffer.from(fixture.rawBase64,'base64'))).containerBytes);
const originalArgon = globalThis.hashwasm.argon2id;
let release;
globalThis.hashwasm.argon2id = () => new Promise(resolve=> { release=()=>resolve(new Uint8Array(32).fill(7)); });
const pending = core.decryptContainer(fixture.master,body.envelope);
while(!release) await new Promise(resolve=>setTimeout(resolve,1));
core.cancelOperations();
release();
await assert.rejects(pending,{name:'AbortError'});
globalThis.hashwasm.argon2id = originalArgon;
console.log(`Recovery: ${fixtures.length} fixed public fixtures, all KDF profiles, Unicode, key-file, exact capacity, cancellation OK`);
