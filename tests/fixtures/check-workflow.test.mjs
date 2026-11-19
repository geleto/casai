import assert from 'node:assert/strict';
import { test } from 'node:test';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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
