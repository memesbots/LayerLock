import {mkdir,writeFile} from 'node:fs/promises';
import {core} from '../tests/load-core.mjs';
if (!process.argv.includes('--write-public-fixtures')) throw Error('Fixtures must only be regenerated deliberately.');
const fixtures = [];
for (const profile of Object.keys(core.KDF_PROFILES)) {
  const kdf = core.KDF_PROFILES[profile];
  const vaultId = core.randomBytes(16);
  const master = 'public reference master passphrase';
  const keyFileHex = profile === 'normal' ? '71'.repeat(32) : null;
  const digest = keyFileHex ? new Uint8Array(await crypto.subtle.digest('SHA-256', Buffer.from(keyFileHex,'hex'))) : null;
  const notes = profile === 'fast' ? ['Exact whitespace:  a  b\n\tline two\n', 'Unicode: Привет 世界 🔐 e\u0301'] : ['Public recovery reference: '+profile];
  const layers = notes.map((text,i) => ({password:`public layer ${i+1} reference phrase`,text:text.normalize('NFKC')}));
  const context = {vaultId,packVersion:core.PACK_VERSION,kdf};
  const slots = [];
  for (const layer of layers) slots.push(await core.encryptSlot(layer.password,layer.text,context,kdf));
  const envelope = await core.encryptContainer(master,core.encodePack(slots),vaultId,kdf,digest);
  fixtures.push({profile,master,keyFileHex,layers,rawBase64:Buffer.from(core.makeCompactBytes(envelope)).toString('base64')});
}
await mkdir('tests/fixtures',{recursive:true});
await writeFile('tests/fixtures/v7-public.json',JSON.stringify({warning:'PUBLIC TEST DATA. NOT SECRETS. Never use these passwords or key files.',fixtures},null,2)+'\n');
