import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function updateResources(root, check = false) {
  const directory = new URL('docs/matrix/', root);
  const names = (await readdir(directory)).filter(name => /\.(cat|cas|txt)$/.test(name)).sort();
  const resources = Object.fromEntries(await Promise.all(names.map(async name => [name, await readFile(new URL(name, directory), 'utf8')])));
  const output = '// Generated from canonical .cat/.cas/.txt files. Run npm run docs:matrix after editing them.\nexport default ' + JSON.stringify(resources, null, 2) + ';\n';
  const destination = new URL('resources.js', directory);
  if (check) assert.equal(await readFile(destination, 'utf8'), output, 'Matrix resources changed. Run npm run docs:matrix.');
  else await writeFile(destination, output);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await updateResources(new URL('../', import.meta.url), process.argv.includes('--check'));
