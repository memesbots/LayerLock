import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createCanvas,ImageData} from '@napi-rs/canvas';
import {core} from './load-core.mjs';
globalThis.document = {createElement(name) {assert.equal(name,'canvas');return createCanvas(1,1);}};
globalThis.ImageData = ImageData;
vm.runInThisContext(await readFile(new URL('../vendor/zxing-wasm-full.iife.js',import.meta.url),'utf8'));
globalThis.LAYERLOCK_ZXING_WASM_BASE64 = (await readFile(new URL('../vendor/zxing_full.wasm',import.meta.url))).toString('base64');
const note = Buffer.from(core.randomBytes(1000)).toString('base64');
const kdf = core.KDF_PROFILES.fast;
const vaultId = core.randomBytes(16);
const context = {vaultId,packVersion:core.PACK_VERSION,kdf};
const slot = await core.encryptSlot('product scanner layer phrase',note,context,kdf);
const envelope = await core.encryptContainer('product scanner master phrase',core.encodePack([slot]),vaultId,kdf);
const render = await core.createAztecRender(envelope,{fecProfile:core.FEC_PROFILES.standard});
const symbol = createCanvas(1,1);
core.renderSigil(symbol,{...render,scale:3});
const timings = [];
for (const [label,width,height,angle,x,y] of [
  ['dense-direct',symbol.width,symbol.height,0,symbol.width/2,symbol.height/2],
  ['4k-white-corner',3840,2160,0,560,430],
  ['6k-native-tiles',6000,4000,0,5100,3000],
  ['4k-rotated',3840,2160,17,2860,1520],
  ['4k-dark',3840,2160,-90,650,1600]
]) {
  const canvas = createCanvas(width,height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle=label==='4k-dark'?'#222':'#fff';ctx.fillRect(0,0,width,height);
  ctx.translate(x,y);ctx.rotate(angle*Math.PI/180);
  const displayed = label === '4k-rotated' ? createCanvas(1,1) : symbol;
  if (displayed !== symbol) core.renderSigil(displayed,{...render,scale:4});
  ctx.drawImage(displayed,-displayed.width/2,-displayed.height/2);
  const decoded = await core.decodePackageFromCanvas(canvas).catch(error=>{error.message=label+': '+error.message;throw error;});
  assert.deepEqual(decoded.body.envelope.ct,core.decodeBody(envelope).envelope.ct,label);
  timings.push({label,milliseconds:Math.round(decoded.scanMs),candidates:decoded.scanCandidates});
  console.log(timings.at(-1));
}
console.log(JSON.stringify({matrix:render.moduleWidth,bytes:envelope.length,productScanner:timings},null,2));
