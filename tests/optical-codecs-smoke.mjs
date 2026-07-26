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

async function assertDecodes(canvas, label) {
  const decoded = await globalThis.ZXingWASM.readBarcodes(new Blob([canvas.toBuffer("image/png")]), {
    formats: ["Aztec"],
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    maxNumberOfSymbols: 1
  });
  if (!equal(source, decoded[0]?.bytes || [])) throw new Error(`${label} did not decode`);
}

for (const quarterTurns of [1, 2, 3]) {
  const rotated = createCanvas(aztecCanvas.width, aztecCanvas.height);
  const context = rotated.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, rotated.width, rotated.height);
  context.translate(rotated.width / 2, rotated.height / 2);
  context.rotate(quarterTurns * Math.PI / 2);
  context.drawImage(aztecCanvas, -aztecCanvas.width / 2, -aztecCanvas.height / 2);
  await assertDecodes(rotated, `${quarterTurns * 90}-degree rotation`);
}

const screenshot = createCanvas(aztecCanvas.width + 320, aztecCanvas.height + 220);
const screenshotContext = screenshot.getContext("2d");
screenshotContext.fillStyle = "#fff";
screenshotContext.fillRect(0, 0, screenshot.width, screenshot.height);
screenshotContext.drawImage(aztecCanvas, 160, 110);
await assertDecodes(screenshot, "white screenshot background");

const reduced = createCanvas(Math.round(aztecCanvas.width * 0.72), Math.round(aztecCanvas.height * 0.72));
const reducedContext = reduced.getContext("2d");
reducedContext.imageSmoothingEnabled = true;
reducedContext.drawImage(aztecCanvas, 0, 0, reduced.width, reduced.height);
await assertDecodes(reduced, "downscaled symbol");

console.log(`LayerLock optical codec: OK; Aztec ${aztec.symbol.width}x${aztec.symbol.height}; rotation, white background and downscale passed`);
