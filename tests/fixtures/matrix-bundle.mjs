// Exercise the same portable modules after a browser-targeted bundle, without UI.
import assert from 'node:assert/strict';
import { copyFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { describe } from '../../docs/matrix/reference.js';

export async function checkBundle(examples) {
  const root = new URL('../../', import.meta.url);
  const output = new URL('.cache/matrix/_bundle/', root);
  const bundle = await build({
    entryPoints: ['matrix', 'reference'].map(name => fileURLToPath(new URL(`docs/matrix/${name}.js`, root))),
    bundle: true, splitting: true, platform: 'browser', format: 'esm',
    outdir: fileURLToPath(output), metafile: true, logLevel: 'silent',
  });
  assert(Object.keys(bundle.metafile.inputs).every(path => path.replaceAll('\\', '/').startsWith('docs/matrix/')), 'Documentation bundles must not import runtime or SDK code');
  const matrix = await import(new URL('matrix.js', output));
  const reference = await import(new URL('reference.js', output));
  // esbuild leaves new URL assets in place. Asset-aware bundlers may emit them;
  // other consumers copy them beside the generated module, as documented.
  for (const file of matrix.components.flatMap(component => component.resources)) {
    await copyFile(new URL(`docs/matrix/${file}`, root), new URL(file, output));
  }
  for (const example of examples) {
    const expected = { ...example };
    delete expected.url;
    assert.deepEqual(await matrix.render(example.component, example.activeOptions, { readText: url => readFile(url, 'utf8') }), expected);
    assert.deepEqual(reference.describe(example.component, example.activeOptions), describe(example.component, example.activeOptions));
  }
  console.log(`Checked browser bundle imports, resources and reference output for ${examples.length} selections.`);
}
