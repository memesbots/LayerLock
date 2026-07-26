import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = await readFile(resolve(root, "outputs/sigil-vault.html"), "utf8");
const dist = await readFile(resolve(root, "dist/index.html"), "utf8");
assert.equal(output, dist, "output and GitHub Pages artifact differ");

const digest = createHash("sha256").update(dist, "utf8").digest("hex");
const checksum = await readFile(resolve(root, "RELEASE.sha256"), "utf8");
assert.equal(checksum, `${digest}  dist/index.html\n`, "RELEASE.sha256 is stale");

const meta = output.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1] || "";
assert.match(meta, /connect-src 'none'/, "network connections are not blocked");
const scriptDirective = meta.match(/script-src\s+([^;]+);/i)?.[1] || "";
assert(!scriptDirective.includes("'unsafe-inline'"), "script-src still permits unsafe inline code");
for (const match of output.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
  const hash = `'sha256-${createHash("sha256").update(match[1], "utf8").digest("base64")}'`;
  assert(scriptDirective.includes(hash), `CSP is missing ${hash}`);
}

const vendorChecksums = new Map([
  ["vendor/zxing-wasm-full.iife.js", "5b056986d7030b23b940a7a0decf4e7f28e905aa0616c6af0d31753b20ef8631"],
  ["vendor/zxing_full.wasm", "f516b088ccd90e353c2bedf7e19d69ce323264ddc288e20a5258a1eae69148ba"],
  ["vendor/hash-wasm-argon2-4.12.0.umd.min.js", "dcec617a2e1b700fa132d1583a186cb70611113395e869f2dd6cc82b415d3094"],
  ["vendor/fflate-0.8.2.umd.js", "c3b34f2e9f5e74d4d7d64e01cac7a0c01954c6c406414d42185c7b53d6875ddf"]
]);
for (const [file, expected] of vendorChecksums) {
  const actual = createHash("sha256").update(await readFile(resolve(root, file))).digest("hex");
  assert.equal(actual, expected, `${file} checksum mismatch`);
}

assert(!output.includes("cdn.jsdelivr.net"), "a jsDelivr fallback remains in the release");
console.log(`Release verification: OK (${digest})`);
