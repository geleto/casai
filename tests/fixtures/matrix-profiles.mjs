import assert from 'node:assert/strict';
import { components, getControls, render, validateOptions } from '../../docs/matrix/matrix.js';
import { createMatrix, matrixProfiles } from '../../docs/matrix/profiles.js';

export async function checkProfiles() {
  const full = createMatrix('full');
  const simple = createMatrix('simple');
  assert.deepEqual(full.components, components, 'Full catalog remains unchanged');
  assert.deepEqual(simple.components.map(item => item.name), components.filter(item => ['configuration', 'component'].includes(item.kind)).map(item => item.name));
  assert.equal(simple.components[0].name, 'Config');
  assert.throws(() => createMatrix('missing'), /Unknown matrix profile/);
  assert.throws(() => simple.getControls('Context'), /Unknown simple matrix component/);
  assert.throws(() => simple.render('LLMAgent', ['resume']), /unavailable in the simple matrix/);
  assert.deepEqual(simple.normalizeOptions('LLMAgent', ['withTemplate', 'useTools', 'messages', 'run', 'unknown']), {
    activeOptions: ['withTemplate', 'useTools'], dropped: ['messages', 'run', 'unknown'],
  });
  const allowed = new Set(matrixProfiles.simple.choices);
  let count = 0;
  for (const component of simple.components) {
    for (const group of component.groups) for (const choice of group.choices) assert.ok(allowed.has(choice.id));
    const seen = new Set([component.activeOptions.join(',')]);
    const pending = [component.activeOptions];
    for (const options of pending) {
      count++;
      assert.deepEqual(validateOptions(component.name, options), options);
      assert.deepEqual(simple.normalizeOptions(component.name, options), { activeOptions: options, dropped: [] });
      assert.deepEqual(full.getControls(component.name, options), getControls(component.name, options));
      assert.deepEqual(await simple.render(component.name, options), await render(component.name, options), 'Both profiles render the same canonical example');
      for (const section of simple.getControls(component.name, options, { unavailable: 'include' })) {
        const choices = section.id === 'source' ? section.control?.choices ?? [] : section.groups.flatMap(group => group.choices);
        if (section.id === 'source') {
          assert.equal(section.control.loads.available, false);
          assert.equal(section.control.loads.transition, null);
        } else for (const choice of choices) assert.ok(allowed.has(choice.id));
        for (const choice of choices) {
          if (!choice.transition) continue;
          const next = choice.transition.activeOptions;
          assert.ok(next.every(id => allowed.has(id)), `${component.name}: transitions cannot introduce hidden choices`);
          const key = next.join(',');
          if (!seen.has(key)) { seen.add(key); pending.push(next); }
        }
      }
    }
  }
  assert.ok(count > 100, 'Exercise combinations, not only default examples');
  console.log(`Verified full/simple matrix profiles across ${count} reachable simplified examples.`);
}
