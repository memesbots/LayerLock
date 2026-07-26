import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "outputs/sigil-vault.html");
const distPath = resolve(root, "dist/index.html");
const checksumPath = resolve(root, "RELEASE.sha256");

let html = await readFile(sourcePath, "utf8");
const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => `'sha256-${createHash("sha256").update(match[1], "utf8").digest("base64")}'`);

if (!hashes.length) throw new Error("No inline scripts found");
const scriptPolicy = `script-src ${[...new Set(hashes)].join(" ")} 'wasm-unsafe-eval' blob:;`;
if (!/script-src\s+[^;]*;/i.test(html)) throw new Error("CSP script-src directive not found");
html = html.replace(/script-src\s+[^;]*;/i, scriptPolicy);

await mkdir(resolve(root, "dist"), { recursive: true });
await writeFile(sourcePath, html);
await writeFile(distPath, html);
const digest = createHash("sha256").update(html, "utf8").digest("hex");
await writeFile(checksumPath, `${digest}  dist/index.html\n`);
console.log(`Prepared release ${digest}`);
