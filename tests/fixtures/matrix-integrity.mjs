// Authoring checks, not extra validation in the consumer's selection loop.
import assert from 'node:assert/strict';

export function checkIntegrity(catalog, reference, api, common, own, concepts) {
  const shape = name => { if (name != null) assert(api.shapes[name], `Unknown reference shape: ${name}`); };
  const rules = (component, item) => {
    for (const rule of Array.isArray(item.requires) ? item.requires : [item.requires ?? {}]) {
      for (const [id, allowed] of Object.entries(rule)) {
        const group = component.groups.find(group => group.id === id);
        assert(group, `${component.name}: unknown group ${id}`);
        for (const choice of allowed) assert(choice === null || group.choices.some(item => item.id === choice), `${component.name}.${id}: unknown choice ${choice}`);
      }
    }
    for (const id of item.excludes ?? []) assert(component.groups.some(group => group.choices.some(choice => choice.id === id)), `${component.name}: unknown exclusion ${id}`);
  };
  assert.deepEqual(Object.keys(reference).sort(), catalog.map(component => component.name).sort());
  for (const component of catalog) {
    if (component.inlineResource) assert(component.resources.includes(component.inlineResource), `${component.name}: unknown default resource`);
    const groups = component.groups.map(group => group.id);
    const choices = component.groups.flatMap(group => group.choices);
    assert.equal(new Set(groups).size, groups.length, `${component.name}: duplicate group`);
    assert.equal(new Set(choices.map(choice => choice.id)).size, choices.length, `${component.name}: duplicate choice`);
    for (const choice of choices) rules(component, choice);
    if (component.planned) rules(component, component.planned);
    const base = reference[component.name];
    for (const spec of [base, ...(base.variants ?? [])]) {
      rules(component, spec);
      for (const name of spec.propertyShapes ?? []) shape(name);
      shape(spec.nativeDocs); shape(spec.runShape);
      for (const name of spec.resultShapes ?? (spec.result ? [spec.result] : [])) shape(`${name}_result`);
      for (const id of spec.concepts ?? []) assert(concepts[id], `Unknown matrix concept: ${id}`);
      for (const method of spec.methods ?? []) { rules(component, method); shape(method.shape); shape(method.resultShape); }
    }
  }
  for (const [owner, entries] of Object.entries(own)) {
    shape(`${owner}_config`);
    const names = api.shapes[`${owner}_config`].map(id => api.properties[id].name);
    for (const name of Object.keys(entries)) assert(names.includes(name), `Unused local property: ${owner}.${name}`);
  }
  for (const entry of [...Object.values(common), ...Object.values(own).flatMap(Object.values)]) { shape(entry.nativeDocs); shape(entry.nested); }
}
