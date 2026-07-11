import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../outputs/sigil-vault.html", import.meta.url), "utf8");
const vendor = await readFile(new URL("../vendor/zxing-wasm-full.iife.js", import.meta.url), "utf8");

if (!html.includes('connect-src \'none\'')) throw new Error("CSP connect-src 'none' is missing");
if (!html.includes('id="languageToggle"')) throw new Error("Language switch is missing");
if (!html.includes('let savedLanguage = "en";')) throw new Error("English is not the default language");
if (/https?:\/\/(?:fastly\.)?jsdelivr\.net/i.test(html + vendor)) {
  throw new Error("ZXing network fallback is present");
}

const scripts = [...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)];
const app = scripts.at(-1)?.[1] || "";
const i18nStart = app.indexOf("const EN_TEXT");
const i18nEnd = app.indexOf("const SLOT_VERSION");
if (i18nStart < 0 || i18nEnd < 0) throw new Error("Localization block not found");

const context = { console };
vm.createContext(context);
vm.runInContext(`
  class MutationObserver { constructor() {} }
  class Element {}
  const Node = {};
  const document = {};
  ${app.slice(i18nStart, i18nEnd)}
  globalThis.translate = translateForLanguage;
`, context);

const cases = new Map([
  ["Создать", "Create"],
  ["Слой 4", "Layer 4"],
  ["Слой 2: пароли не совпадают.", "Layer 2: passwords do not match."],
  ["Надежный · ~96 бит", "Strong · ~96 bits"],
  ["Контейнер найден за 302 мс. Введите мастер-ключ.", "Container found in 302 ms. Enter the master key."],
  ["Усиленная защита · стандартное восстановление · Aztec", "Hardened protection · standard recovery · Aztec"],
  ["Настройки: усиленная защита паролей, повышенное восстановление, Aztec", "Settings: hardened password protection, enhanced recovery, Aztec"]
]);

for (const [source, expected] of cases) {
  const actual = context.translate(source, "en");
  if (actual !== expected) throw new Error(`Translation mismatch for "${source}": "${actual}"`);
}

const markup = html
  .slice(0, html.indexOf("<!-- BEGIN LAYERLOCK OPTICAL CODECS -->"))
  .replace(/<style[\s\S]*?<\/style>/g, "");
const staticStrings = [];
for (const match of markup.matchAll(/>([^<>]+)</g)) {
  const value = match[1].trim();
  if (/[А-Яа-яЁё]/.test(value)) staticStrings.push(value);
}
for (const match of markup.matchAll(/(?:aria-label|title|placeholder)="([^"]*[А-Яа-яЁё][^"]*)"/g)) {
  staticStrings.push(match[1]);
}
const untranslated = [...new Set(staticStrings.filter(value => context.translate(value, "en") === value))];
if (untranslated.length) throw new Error(`Untranslated static strings:\n${untranslated.join("\n")}`);

console.log(`LayerLock i18n/security: OK; ${new Set(staticStrings).size} static strings, ${cases.size} dynamic cases`);
