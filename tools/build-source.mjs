import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sections = ['i18n', 'runtime', 'operations', 'crypto', 'editor', 'transport', 'creation', 'scanner', 'reader', 'capacity'];
let source = 'function createLayerLock(mount) {\n"use strict";\nif (mount === undefined) mount = true;\n';
for (const name of sections) source += await readFile(resolve(root, `src/${name}.js`), 'utf8');
source += await readFile(resolve(root, 'src/api.js'), 'utf8');
source += '\nif (!mount) return api;\n';
source += await readFile(resolve(root, 'src/events.js'), 'utf8');
source += '\nreturn api;\n}\n';
const shell = await readFile(resolve(root, 'src/shell.html'), 'utf8');
if (!process.argv.includes('--core-only')) {
  await writeFile(resolve(root, 'outputs/sigil-vault.html'), shell.replace('<!-- LAYERLOCK APPLICATION -->', () => `<script>\n${source}\ncreateLayerLock();\n</script>`));
}
await mkdir(resolve(root, 'work'), {recursive: true});
await writeFile(resolve(root, 'work/layerlock-core.mjs'), `export ${source}`);
