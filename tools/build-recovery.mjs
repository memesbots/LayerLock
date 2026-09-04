import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const module={exports:{}};
new Function('module','exports',await readFile(resolve(root,'vendor/fflate-0.8.2.umd.js'),'utf8'))(module,module.exports);
const files={};
for (const [name,path] of [
  ['LayerLock.html','dist/index.html'],
  ['RECOVERY.md','docs/RECOVERY.md'],
  ['FORMAT.md','docs/LAYERLOCK_FORMAT_V7.md'],
  ['SECURITY.md','docs/SECURITY.md'],
  ['v7-public.json','tests/fixtures/v7-public.json'],
  ['THIRD_PARTY_NOTICES.md','docs/THIRD_PARTY_NOTICES.md'],
  ['zxing.LICENSE','vendor/zxing-wasm.LICENSE'],
  ['fflate.LICENSE','vendor/fflate.LICENSE'],
  ['hash-wasm.LICENSE','vendor/hash-wasm.LICENSE']
]) files[name]=[new Uint8Array(await readFile(resolve(root,path))),{mtime:new Date(2026,0,1)}];
const digest=createHash('sha256').update(files['LayerLock.html'][0]).digest('hex');
files['RELEASE.sha256']=[new TextEncoder().encode(`${digest}  LayerLock.html\n`),{mtime:new Date(2026,0,1)}];
const zip=module.exports.zipSync(files,{level:9});
await mkdir(resolve(root,'dist/offline'),{recursive:true});
await writeFile(resolve(root,'dist/offline/LayerLock-recovery.zip'),zip);
const zipDigest=createHash('sha256').update(zip).digest('hex');
await writeFile(resolve(root,'dist/offline/SHA256SUMS'),`${zipDigest}  LayerLock-recovery.zip\n${digest}  ../index.html\n`);
console.log(`Recovery archive: ${zip.length} bytes, ${zipDigest}`);
