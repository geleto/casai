export const sourceModes = {
  text: { name: 'Direct input', value: 'direct' },
  'text-name': { name: 'Loaded text', value: 'resource' },
  'async-template': { name: 'Template', value: 'template' },
  'async-template-name': { name: 'Loaded template', value: 'resource' },
  'async-script': { name: 'Script', value: 'script' },
  'async-script-name': { name: 'Loaded script', value: 'resource' },
  function: { name: 'Function', value: 'function' },
};

// Explain the authored value before explaining what Casai does with it. The
// same mode prose feeds the input overview, property description and mode list.
export function sourceDocumentation(mode, definition, spec) {
  const property = '`' + definition.main + '`';
  const context = '`context`';
  const file = `The ${property} value is a file name passed to the configured ${'`loader`'}.`;
  const template = `Casai fills in the template variables from the ${context} object. For example, ${'`Hello {{ name }}`'} with ${'`context: { name: "Ada" }`'} produces ${'`Hello Ada`'}.`;
  const scriptResult = spec.coded ? 'The script’s return value is the component’s result.' : `The script’s return value supplies ${property}.`;
  const descriptions = {
    text: spec.sourceDescriptions?.text ?? `The ${property} value supplied to the component.`,
    'text-name': spec.sourceDescriptions?.['text-name'],
    'async-template': `Cascada Template text whose variables come from the ${context} object.`,
    'async-template-name': `The name of a Cascada Template file rendered using ${context}.`,
    'async-script': spec.coded ? 'Cascada Script code with variables from the context object.' : `Cascada Script code that calculates ${property} using ${context}.`,
    'async-script-name': spec.coded ? 'The name of a Cascada Script file.' : `The name of a Cascada Script file that calculates ${property}.`,
    function: `A JavaScript function that calculates ${property} from ${context}.`,
  };
  const explanations = {
    text: descriptions.text,
    'text-name': `${descriptions['text-name']} ${file}`,
    'async-template': `The ${property} value contains Cascada Template text. ${template}${spec.templateNotes ? ' ' + spec.templateNotes : ''}`,
    'async-template-name': `${file} The file contains Cascada Template text. ${template}`,
    'async-script': `The ${property} value is Cascada Script code. Fields of the ${context} object are available as variables. ${scriptResult}`,
    'async-script-name': `${file} Casai runs the loaded Cascada Script with fields of ${context} available as variables. ${scriptResult}`,
    function: `The ${property} value is a JavaScript function. Casai passes it the ${context} object and uses its return value as ${property}. The function may be asynchronous.`,
  };
  return { description: spec.sourceDescriptions?.[mode] ?? descriptions[mode], explanation: explanations[mode] };
}
