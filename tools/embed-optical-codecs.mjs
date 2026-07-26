import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const htmlPath = resolve(root, "outputs/sigil-vault.html");
const zxingPath = resolve(root, "vendor/zxing-wasm-full.iife.js");
const wasmPath = resolve(root, "vendor/zxing_full.wasm");
const argonPath = resolve(root, "vendor/hash-wasm-argon2-4.12.0.umd.min.js");
const fflatePath = resolve(root, "vendor/fflate-0.8.2.umd.js");
const begin = "<!-- BEGIN LAYERLOCK OPTICAL CODECS -->";
const end = "<!-- END LAYERLOCK OPTICAL CODECS -->";
const compressionBegin = "<!-- BEGIN LAYERLOCK COMPRESSION CODEC -->";
const compressionEnd = "<!-- END LAYERLOCK COMPRESSION CODEC -->";

const EXPECTED_SHA256 = {
  zxing: "5b056986d7030b23b940a7a0decf4e7f28e905aa0616c6af0d31753b20ef8631",
  wasm: "f516b088ccd90e353c2bedf7e19d69ce323264ddc288e20a5258a1eae69148ba",
  argon: "dcec617a2e1b700fa132d1583a186cb70611113395e869f2dd6cc82b415d3094",
  fflate: "c3b34f2e9f5e74d4d7d64e01cac7a0c01954c6c406414d42185c7b53d6875ddf"
};

function verifyFile(name, bytes) {
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== EXPECTED_SHA256[name]) {
    throw new Error(`${name} vendor checksum mismatch: ${actual}`);
  }
}

function replaceBlock(source, startMarker, endMarker, block, fallbackMarker) {
  const start = source.indexOf(startMarker);
  const finish = source.indexOf(endMarker);
  if (start >= 0 && finish > start) {
    return `${source.slice(0, start)}${block}${source.slice(finish + endMarker.length)}`;
  }
  if (!source.includes(fallbackMarker)) throw new Error(`Embed marker not found: ${fallbackMarker}`);
  return source.replace(fallbackMarker, `${block}\n${fallbackMarker}`);
}

let html = await readFile(htmlPath, "utf8");
const zxingBytes = await readFile(zxingPath);
const wasmBytes = await readFile(wasmPath);
const argonBytes = await readFile(argonPath);
const fflateBytes = await readFile(fflatePath);
verifyFile("zxing", zxingBytes);
verifyFile("wasm", wasmBytes);
verifyFile("argon", argonBytes);
verifyFile("fflate", fflateBytes);
const zxing = zxingBytes.toString("utf8");
const wasm = wasmBytes.toString("base64");
const argon = argonBytes.toString("utf8");
const fflate = fflateBytes.toString("utf8");
const block = `${begin}
  <script id="opticalVendorSource">
  /* zxing-wasm 3.1.0 is bundled locally. See vendor/zxing-wasm.LICENSE. */
  globalThis.LAYERLOCK_ZXING_WASM_BASE64 = "${wasm}";
  ${zxing}
  </script>
  ${end}`;
const compressionBlock = `${compressionBegin}
  <script id="compressionVendorSource">
  /* fflate 0.8.2 is bundled locally. See vendor/fflate.LICENSE. */
  ${fflate}
  </script>
  ${compressionEnd}`;

html = replaceBlock(html, begin, end, block, "  <script id=\"argon2VendorSource\">");
html = replaceBlock(html, compressionBegin, compressionEnd, compressionBlock, "  <script id=\"argon2VendorSource\">");
html = html.replace(
  /  <script id="argon2VendorSource">[\s\S]*?<\/script>/,
  `  <script id="argon2VendorSource">${argon}</script>`
);
await writeFile(htmlPath, html);
