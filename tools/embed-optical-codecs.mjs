import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const htmlPath = resolve(root, "outputs/sigil-vault.html");
const zxingPath = resolve(root, "vendor/zxing-wasm-full.iife.js");
const wasmPath = resolve(root, "vendor/zxing_full.wasm");
const begin = "<!-- BEGIN LAYERLOCK OPTICAL CODECS -->";
const end = "<!-- END LAYERLOCK OPTICAL CODECS -->";

let html = await readFile(htmlPath, "utf8");
const zxing = await readFile(zxingPath, "utf8");
const wasm = (await readFile(wasmPath)).toString("base64");
const block = `${begin}
  <script id="opticalVendorSource">
  /* zxing-wasm is bundled locally. See vendor license. */
  globalThis.LAYERLOCK_ZXING_WASM_BASE64 = "${wasm}";
  ${zxing}
  </script>
  ${end}`;

const start = html.indexOf(begin);
const finish = html.indexOf(end);
if (start >= 0 && finish > start) {
  html = `${html.slice(0, start)}${block}${html.slice(finish + end.length)}`;
} else {
  const marker = "  <script id=\"argon2VendorSource\">";
  if (!html.includes(marker)) throw new Error("Argon2 vendor marker not found");
  html = html.replace(marker, () => `${block}\n${marker}`);
}
await writeFile(htmlPath, html);
