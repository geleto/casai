import { components, getControls, normalizeOptions, render, validateOptions } from './matrix.js';

// Presentation policy only. Both profiles use the same examples and API rules.
// New choices belong to the full reference until explicitly selected here.
export const matrixProfiles = {
  full: { kinds: ['component', 'configuration', 'concept'], choices: null },
  simple: {
    kinds: ['configuration', 'component'],
    choices: [
      'asTool', 'asStream', 'useTools', 'structured', 'batch', 'topN',
      'referenceImage', 'count', 'voice',
      'withText', 'withAudio', 'withTemplate', 'withScript', 'withFunction',
    ],
  },
};

/** A curated view of the canonical catalog, with closed selection transitions. */
export function createMatrix(profile = 'full') {
  const policy = matrixProfiles[profile];
  if (!policy) throw new Error(`Unknown matrix profile: ${profile}`);
  const allows = id => policy.choices === null || policy.choices.includes(id);
  const catalog = components.filter(component => policy.kinds.includes(component.kind)).map(component => ({
    ...component,
    activeOptions: normalizeOptions(component.name, component.activeOptions.filter(allows)).activeOptions,
    groups: component.groups.map(group => ({ ...group, choices: group.choices.filter(choice => allows(choice.id)) }))
      .filter(group => group.choices.length),
  }));
  const component = name => {
    const found = catalog.find(item => item.name === name);
    if (!found) throw new Error(`Unknown ${profile} matrix component: ${name}`);
    return found;
  };
  const validate = (name, selected = component(name).activeOptions) => {
    component(name);
    for (const id of selected) if (!allows(id)) throw new Error(`Option ${id} is unavailable in the ${profile} matrix`);
    return validateOptions(name, selected);
  };
  const visibleTransition = choice => choice.transition && choice.transition.activeOptions.every(allows);
  return {
    profile,
    components: catalog,
    normalizeOptions(name, input = component(name).activeOptions) {
      component(name);
      const { activeOptions } = normalizeOptions(name, input.filter(allows));
      return { activeOptions, dropped: [...new Set(input)].filter(id => !activeOptions.includes(id)) };
    },
    getControls(name, selected = component(name).activeOptions, options) {
      const controls = getControls(name, validate(name, selected), options);
      if (profile === 'full') return controls;
      return controls.map(section => section.id === 'source' ? {
        ...section,
        control: section.control && {
          ...section.control,
          choices: section.control.choices.filter(visibleTransition),
          loads: { ...section.control.loads, available: false, transition: null },
        },
      } : {
        ...section,
        groups: section.groups.map(group => ({
          ...group,
          choices: group.choices.filter(choice => allows(choice.id) && (choice.active || visibleTransition(choice))),
        })).filter(group => group.choices.length),
      }).filter(section => section.id === 'source' ? section.control : section.groups.length);
    },
    render(name, selected = component(name).activeOptions, options) {
      return render(name, validate(name, selected), options);
    },
  };
}
