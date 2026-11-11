import assert from 'node:assert/strict';
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Same linked-folder resolution used by a workspace/file dependency in the UI repo.
export async function checkPackage(root, destination) {
  const manifest = JSON.parse(await readFile(new URL('docs/matrix/package.json', root), 'utf8'));
  assert.equal(manifest.name, '@casai/matrix');
  assert.equal(manifest.private, true);
  assert.equal(manifest.dependencies, undefined, 'The documentation package requires no runtime or SDK install');
  await mkdir(new URL('node_modules/@casai/', destination), { recursive: true });
  await symlink(fileURLToPath(new URL('docs/matrix/', root)), fileURLToPath(new URL('node_modules/@casai/matrix', destination)), 'junction');
  const consumer = new URL('_package.mjs', destination);
  await writeFile(consumer, `import assert from 'node:assert/strict';
import { components, render } from '@casai/matrix';
import { describe } from '@casai/matrix/reference';
assert.equal(components.length, 14);
const example = await render('LLMAgent', ['loadTemplate']);
assert(example.files.some(file => file.name === 'LLMAgent.cat'));
assert(describe('LLMAgent').config.properties.telemetry.details.variants[0].properties.length);
`);
  execFileSync(process.execPath, [fileURLToPath(consumer)], { cwd: destination, stdio: 'inherit' });
  console.log('Checked linked documentation package exports and resources.');
}
