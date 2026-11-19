import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { lint, lintFingerprint } from '../../scripts/lint.mjs';

const temporary = [];
function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'casai-checks-'));
  temporary.push(root);
  return root;
}
function put(root, file, content) {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content);
  return path;
}
after(() => {
  for (const root of temporary) {
    assert.equal(dirname(realpathSync(root)), realpathSync(tmpdir()));
    assert(root.split(/[\\/]/).at(-1).startsWith('casai-checks-'));
    rmSync(root, { recursive: true, force: true });
  }
});

test('lint fingerprints include imported types, configuration, installed code, additions and real npm-link contents', async () => {
  const root = workspace(), linked = join(root, 'linked-engine');
  put(root, 'src/main.ts', 'export const value = 1;');
  put(root, 'node_modules/upstream/index.d.ts', 'export type Value = string;');
  put(root, 'node_modules/eslint/index.js', 'export const version = 1;');
  put(root, 'tsconfig.json', '{}');
  put(root, 'dist/index.d.ts', 'export declare const value: 1;');
  put(root, '.cache/readme2/example.ts', 'export {};');
  put(linked, 'src/types.d.ts', 'export type Value = string;');
  symlinkSync(linked, join(root, 'node_modules/cascada-engine'), 'junction');
  const original = (await lintFingerprint(root)).key;
  assert.equal((await lintFingerprint(root)).key, original);
  for (const file of ['src/main.ts', 'node_modules/upstream/index.d.ts', 'node_modules/eslint/index.js',
    'tsconfig.json', 'dist/index.d.ts', '.cache/readme2/example.ts', 'linked-engine/src/types.d.ts']) {
    const path = join(root, file), content = readFileSync(path, 'utf8'), before = statSync(path);
    writeFileSync(path, content.replace(/./, '_')); // Same length and restored timestamp: content must still invalidate.
    utimesSync(path, before.atime, before.mtime);
    assert.notEqual((await lintFingerprint(root)).key, original, file);
    writeFileSync(path, content);
    assert.equal((await lintFingerprint(root)).key, original, file);
  }
  const added = put(root, 'src/added.d.ts', 'export {};');
  assert.notEqual((await lintFingerprint(root)).key, original);
  rmSync(added);
  assert.equal((await lintFingerprint(root)).key, original);
  put(root, 'node_modules/.cache/unrelated.json', '{}');
  assert.equal((await lintFingerprint(root)).key, original, 'Tool output does not invalidate its own check');
});

test('real typed lint reruns an unchanged consumer after its imported declaration changes; failures are never cached', async () => {
  const root = workspace(), require = createRequire(import.meta.url);
  const cli = pathToFileURL(fileURLToPath(new URL('../../node_modules/eslint/bin/eslint.js', import.meta.url))).href;
  // A tiny project uses the installed linter, without copying its dependencies or modifying this checkout.
  put(root, 'node_modules/eslint/package.json', '{"type":"module"}');
  put(root, 'node_modules/eslint/bin/eslint.js', `import ${JSON.stringify(cli)};`);
  put(root, 'package.json', '{"type":"module"}');
  put(root, 'eslint.config.js', `import tseslint from ${JSON.stringify(pathToFileURL(require.resolve('typescript-eslint')).href)};
export default [{ files: ['**/*.js'], rules: {} }, { files: ['src/**/*.ts'],
  languageOptions: { parser: tseslint.parser, parserOptions: { project: true } },
  plugins: { '@typescript-eslint': tseslint.plugin }, rules: { '@typescript-eslint/no-unsafe-assignment': 'error' } }];`);
  put(root, 'tsconfig.json', '{"compilerOptions":{"strict":true,"moduleResolution":"node"},"include":["src"]}');
  for (const folder of ['tests', 'docs/matrix', 'scripts']) put(root, `${folder}/placeholder.js`, 'export {};');
  put(root, 'node_modules/upstream/package.json', '{"types":"index.d.ts"}');
  const dependency = put(root, 'node_modules/upstream/index.d.ts', 'export declare const upstream: string;');
  const consumer = put(root, 'src/consumer.ts', 'import { upstream } from "upstream"; const value: string = upstream; void value;');
  const source = readFileSync(consumer, 'utf8');
  assert.equal(await lint(root), 0);
  const stamp = join(root, 'node_modules/.cache/casai/lint.json'), saved = readFileSync(stamp, 'utf8');
  assert.equal(await lint(root), 0);
  writeFileSync(dependency, 'export declare const upstream: any;');
  assert.equal(await lint(root), 1, 'Imported any must trigger no-unsafe-assignment in the unchanged consumer');
  assert.equal(await lint(root), 1, 'An unchanged failing check must run again');
  assert.equal(readFileSync(stamp, 'utf8'), saved);
  assert.equal(readFileSync(consumer, 'utf8'), source);
});

test('guide extraction preserves unchanged generated files and their timestamps', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const run = () => {
    const result = spawnSync(process.execPath, ['tests/fixtures/readme2-examples.cjs'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  };
  run();
  const file = join(root, '.cache/readme2/translate-wav-file.ts'), before = statSync(file).mtimeMs;
  run(); assert.equal(statSync(file).mtimeMs, before);
});
