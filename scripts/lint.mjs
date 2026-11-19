// Cache the whole successful check, not individual files: imported type changes affect typed lint.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const targets = ['src', 'tests', 'docs/matrix', 'scripts'];
const codeFile = /\.(?:[cm]?[jt]sx?|json)$/;
const ignoredDirectories = new Set(['.git', '.cache', 'coverage', 'logs']);

export async function lintFingerprint(root) {
  const hash = createHash('sha256'), visited = new Set(), files = [];
  const add = value => hash.update(JSON.stringify(value) + '\n');
  add([process.versions, process.platform, process.arch, process.execArgv, targets]);
  add(Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(?:NODE_OPTIONS|NODE_PATH|CI|DEBUG|TSESTREE_.*|ESLINT_.*)$/.test(name))));
  function visit(path, kind) {
    if (!kind && !existsSync(path)) { add(['missing', path]); return; }
    // Dirents already identify ordinary children. Resolve only roots and links, not every file.
    const real = kind ? path : realpathSync(path);
    add([path, real]); // Retargeting an npm link also invalidates the check.
    if (visited.has(real)) return;
    visited.add(real);
    if (kind === 'directory' || !kind && statSync(real).isDirectory()) {
      for (const entry of readdirSync(real, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
        if (ignoredDirectories.has(entry.name)) continue;
        if (entry.isDirectory()) visit(join(real, entry.name), 'directory');
        else if (entry.isSymbolicLink()) visit(join(real, entry.name));
        else if (codeFile.test(entry.name)) visit(join(real, entry.name), 'file');
      }
      if (path !== real) {
        // Linked packages may resolve dependencies from their real location's ancestors.
        for (let parent = dirname(real); parent !== dirname(parent); parent = dirname(parent)) {
          const modules = join(parent, 'node_modules');
          if (existsSync(modules)) visit(modules);
        }
      }
    } else if (codeFile.test(path) || codeFile.test(real)) {
      files.push(real);
    }
  }
  // Include compiler inputs, emitted declarations, generated guide types and installed tool/dependency code.
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    if (entry.isFile() && codeFile.test(entry.name)) visit(join(root, entry.name));
  }
  for (const directory of [...targets, 'dist', '.cache/readme2', 'node_modules']) visit(join(root, directory));
  // Read in bounded parallel batches; hashing thousands of files one at a time is costly on Windows.
  for (let start = 0; start < files.length; start += 32) {
    const batch = files.slice(start, start + 32);
    const contents = await Promise.all(batch.map(file => readFile(file)));
    for (let i = 0; i < batch.length; i++) { add([batch[i], contents[i].length]); hash.update(contents[i]); }
  }
  return { key: hash.digest('hex'), files: files.length };
}

export async function lint(root, args = []) {
  const started = performance.now();
  const fresh = args.includes('--fresh');
  const forwarded = args.filter(arg => arg !== '--fresh');
  const cacheable = forwarded.length === 0 && !process.env.TIMING;
  const cacheFile = join(root, 'node_modules/.cache/casai/lint.json');
  const before = cacheable ? await lintFingerprint(root) : undefined;
  let previous;
  try { previous = JSON.parse(readFileSync(cacheFile, 'utf8')); } catch { /* First run or discarded cache. */ }
  if (!fresh && before && previous?.key === before.key) {
    process.stdout.write(previous.stdout); process.stderr.write(previous.stderr);
    console.log(`Full lint unchanged: reused successful check after hashing ${before.files} inputs (${((performance.now() - started) / 1000).toFixed(1)}s).`);
    return 0;
  }
  console.log('Running all lint rules and files.');
  const result = spawnSync(process.execPath, [...process.execArgv, join(root, 'node_modules/eslint/bin/eslint.js'), ...targets, ...forwarded], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
  if (result.error) throw result.error;
  if (result.status !== 0) return result.status ?? 1;
  if (before) {
    if ((await lintFingerprint(root)).key !== before.key) {
      console.error('Lint inputs changed during the check. Rerun on the settled files; no successful result was cached.');
      return 1;
    }
    mkdirSync(dirname(cacheFile), { recursive: true });
    writeFileSync(cacheFile, JSON.stringify({ key: before.key, stdout: result.stdout, stderr: result.stderr }));
  }
  console.log(`Full lint passed (${((performance.now() - started) / 1000).toFixed(1)}s).`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await lint(fileURLToPath(new URL('../', import.meta.url)), process.argv.slice(2));
}
