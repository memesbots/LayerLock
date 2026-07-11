import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const { createCanvas } = require("@napi-rs/canvas");

const source = new Uint8Array([0, 1, 2, 3, 31, 32, 127, 128, 254, 255, ...new TextEncoder().encode("LayerLock optical")]);
const equal = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
const productHtml = await readFile(new URL("../outputs/sigil-vault.html", import.meta.url), "utf8");
vm.runInThisContext(await readFile(new URL("../vendor/zxing-wasm-full.iife.js", import.meta.url), "utf8"));
const wasmBinary = new Uint8Array(await readFile(new URL("../vendor/zxing_full.wasm", import.meta.url)));
await globalThis.ZXingWASM.prepareZXingModule({ overrides: { wasmBinary }, fireImmediately: true });
const aztec = await globalThis.ZXingWASM.writeBarcode(source, {
  format: "Aztec",
  scale: 6,
  addQuietZones: true,
  options: "ecLevel=33%"
});
if (aztec.error || !aztec.image) throw new Error(aztec.error || "Aztec writer failed");
const results = await globalThis.ZXingWASM.readBarcodes(aztec.image, {
  formats: ["Aztec"],
  tryHarder: true,
  maxNumberOfSymbols: 1
});
if (!equal(source, results[0]?.bytes || [])) throw new Error("Aztec binary round-trip failed");
const aztecScale = 7;
const aztecCanvas = createCanvas(aztec.symbol.width * aztecScale, aztec.symbol.height * aztecScale);
const aztecContext = aztecCanvas.getContext("2d");
for (let y = 0; y < aztec.symbol.height; y++) {
  for (let x = 0; x < aztec.symbol.width; x++) {
    aztecContext.fillStyle = aztec.symbol.data[y * aztec.symbol.width + x] < 128 ? "#000" : "#fff";
    aztecContext.fillRect(x * aztecScale, y * aztecScale, aztecScale, aztecScale);
  }
}
const renderedAztec = await globalThis.ZXingWASM.readBarcodes(new Blob([aztecCanvas.toBuffer("image/png")]), {
  formats: ["Aztec"],
  tryHarder: true,
  maxNumberOfSymbols: 1
});
if (!equal(source, renderedAztec[0]?.bytes || [])) throw new Error("Rendered Aztec round-trip failed");

console.log(`LayerLock optical codec: OK; Aztec ${aztec.symbol.width}x${aztec.symbol.height}`);
