export const sourceModes = {
  text: { name: 'Direct input', value: 'direct' },
  'text-name': { name: 'Loaded text', value: 'resource' },
  'audio-resource': { name: 'Loaded audio', value: 'media' },
  'async-template': { name: 'Template', value: 'template' },
  'async-template-name': { name: 'Loaded template', value: 'resource' },
  'async-script': { name: 'Script', value: 'script' },
  'async-script-name': { name: 'Loaded script', value: 'resource' },
  function: { name: 'Function', value: 'function' },
};

// Config selects interpretation for a future component; it has no input of its own.
export const configSourceForms = [
  ...[
    ['withAudio', 'text', 'The receiving component uses supplied audio directly, replacing inherited media or source preparation.'],
    ['withText', 'text', 'The receiving component uses its primary input directly.'],
    ['withTemplate', 'async-template', 'The receiving component renders its primary input as a Cascada Template, using variables from context.'],
    ['withScript', 'async-script', 'The receiving component runs its primary input as a Cascada Script, using variables from context.'],
    ['withFunction', 'function', 'The receiving component calls the function supplied as its primary input, passing context. The function may be asynchronous.'],
    ['loadsText', 'text-name', 'The receiving component loads its primary input from a text file using loader.'],
    ['loadsTemplate', 'async-template-name', 'The receiving component loads a Cascada Template using loader and renders it using context.'],
    ['loadsScript', 'async-script-name', 'The receiving component loads a Cascada Script using loader and runs it using context.'],
    ['loadsAudio', 'audio-resource', 'FFmpeg opens the audio path/URL or supplied encoded bytes/byte stream, selects a track and prepares audio for the receiving model. Requires node-av; no loader setting is used.'],
  ].map(([modifier, mode, description]) => ({ modifier, mode, ...sourceModes[mode], description,
    explanation: `${description} This explicit selection replaces an inherited source mode. ${mode === 'audio-resource' ? 'The media location and input settings may be supplied by the completed component.' : 'The source value and any required loader may be supplied by the completed component.'}` })),
].map(form => ({ ...form, toolSupported: true, applicable: true }));

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
    'audio-resource': 'A file path, URL string/object, encoded Uint8Array/ArrayBuffer or ReadableStream<Uint8Array> containing media to prepare for the model.',
    'async-template': `Cascada Template text whose variables come from the ${context} object.`,
    'async-template-name': `The name of a Cascada Template file rendered using ${context}.`,
    'async-script': spec.coded ? 'Cascada Script code with variables from the context object.' : `Cascada Script code that calculates ${property} using ${context}.`,
    'async-script-name': spec.coded ? 'The name of a Cascada Script file.' : `The name of a Cascada Script file that calculates ${property}.`,
    function: `A JavaScript function that calculates ${property} from ${context}.`,
  };
  const explanations = {
    text: descriptions.text,
    'text-name': `${descriptions['text-name']} ${file}`,
    'audio-resource': 'The audio value supplies a local/remote media reference or encoded bytes/byte stream, including video with an audio track. FFmpeg/node-av opens it and prepares the selected audio. mediaSettings describes the source; inputAudioFormat describes the raw model target. Encoded-file transcription instead requires a configured file target describing accepted formats and limits. No loader configuration is needed. Relative paths resolve against the process working directory. Each path/URL call opens afresh; finite bytes can be reused, while supplied streams remain single-use. The .asTool form requires configured audio, including inheritance, and model arguments cannot replace that source. Declared context fields remain data. Trusted application calls retain explicit source overrides; dynamic native resources use an explicit Function/Script workflow. Native byte inputs deny nested protocol opens by default, with an explicit trusted mediaSettings.options.protocol_whitelist override.',
    'async-template': `The ${property} value contains Cascada Template text. ${template}${spec.templateNotes ? ' ' + spec.templateNotes : ''}`,
    'async-template-name': `${file} The file contains Cascada Template text. ${template}`,
    'async-script': `The ${property} value is Cascada Script code. Fields of the ${context} object are available as variables. ${scriptResult}`,
    'async-script-name': `${file} Casai runs the loaded Cascada Script with fields of ${context} available as variables. ${scriptResult}`,
    function: `The ${property} value is a JavaScript function. Casai passes it the ${context} object and uses its return value as ${property}. The function may be asynchronous. It runs once per invocation. Where the operation accepts streamed input, it can return a fresh stream, directly or through a promise; Casai does not collect that input before dispatch. Output delivery is selected separately with .asStream. Other operations retain their native input requirements.`,
  };
  return { description: spec.sourceDescriptions?.[mode] ?? descriptions[mode], explanation: explanations[mode] };
}
