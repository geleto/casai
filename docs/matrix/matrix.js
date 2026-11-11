/**
 * Example catalog for current and explicitly marked planned Casai APIs.
 * No UI or model execution.
 *
 * One selected choice per group, or none. activeOptions supplies the initial
 * selection; callers own subsequent state. requires maps group IDs to allowed
 * choices (OR within a group, AND between groups), or an array of alternative
 * requirement maps. excludes lists conflicting choices. The same rules drive
 * visibility, selection updates and rendering.
 *
 * await render('LLMAgent', ['withTemplate', 'asTool'], {
 *   readText: url => readFile(url, 'utf8'), // Node; browsers default to fetch.
 * });
 *
 * Renderers are JavaScript; generated, copyable examples are TypeScript.
 * .cat/.cas files are ordinary source text, reused inline and when loaded.
 * render() returns { id, component, activeOptions, status, explanations, files }.
 * Planned selections also return a notice and include it in the code comments.
 * A component's planned note uses the same requires rules as choices.
 * Each file has { name, language, code }; save all files in one directory.
 * Names stay stable across toggles; the derived id identifies the selection.
 * Use visibleGroups() to show applicable choices and selectOption() to update
 * a valid selection, replacing siblings and clearing dependents when required.
 * render() validates selections; toggles only apply the selection rules.
 * An empty source group uses the component's default source mode.
 *
 * Add groups, rules and notices to the component's catalog entry; the shared
 * selection code has no component-specific behavior. Handle new choices in
 * the component's JS renderer.
 * Keep existing scenario, names and source order stable when options change.
 * Check the displayed code with npm run test:matrix (no provider calls).
 * Each audio family shares one renderer across complete and streaming modes.
 * Streaming choices use today's Streaming* factories until the API migration
 * in docs/streaming-modifiers-plan.md lands. Complete Translator is planned.
 */
import { exampleId, sourceMode, sourceKind } from './shared.js';
import sdkDocs from './reference/sdk-docs.js';

// Literal imports and asset URLs let bundlers discover the renderer/resources.
// Keep this execution registry private; the exported catalog remains plain data.
const renderers = {
  'Config.js': () => import('./Config.js'),
  'Context.js': () => import('./Context.js'),
  'Template.js': () => import('./Template.js'),
  'Script.js': () => import('./Script.js'),
  'Function.js': () => import('./Function.js'),
  'LLMAgent.js': () => import('./LLMAgent.js'),
  'Decision.js': () => import('./Decision.js'),
  'Embedder.js': () => import('./Embedder.js'),
  'Reranker.js': () => import('./Reranker.js'),
  'ImageGenerator.js': () => import('./ImageGenerator.js'),
  'Transcriber.js': () => import('./Transcriber.js'),
  'SpeechGenerator.js': () => import('./SpeechGenerator.js'),
  'Translator.js': () => import('./Translator.js'),
  'VoiceSessionSetup.js': () => import('./VoiceSessionSetup.js'),
};
const resourceURLs = {
  'Template.cat': new URL('./Template.cat', import.meta.url),
  'Script.cas': new URL('./Script.cas', import.meta.url),
  'LLMAgent.cat': new URL('./LLMAgent.cat', import.meta.url),
  'LLMAgent.cas': new URL('./LLMAgent.cas', import.meta.url),
  'Decision.cat': new URL('./Decision.cat', import.meta.url),
  'Decision.cas': new URL('./Decision.cas', import.meta.url),
  'Embedder.cat': new URL('./Embedder.cat', import.meta.url),
  'Embedder.cas': new URL('./Embedder.cas', import.meta.url),
  'Reranker.cat': new URL('./Reranker.cat', import.meta.url),
  'Reranker.cas': new URL('./Reranker.cas', import.meta.url),
  'ImageGenerator.cat': new URL('./ImageGenerator.cat', import.meta.url),
  'ImageGenerator.cas': new URL('./ImageGenerator.cas', import.meta.url),
  'Transcriber.cas': new URL('./Transcriber.cas', import.meta.url),
  'SpeechGenerator.cat': new URL('./SpeechGenerator.cat', import.meta.url),
  'SpeechGenerator.cas': new URL('./SpeechGenerator.cas', import.meta.url),
  'Translator.cas': new URL('./Translator.cas', import.meta.url),
  'VoiceSessionSetup.cat': new URL('./VoiceSessionSetup.cat', import.meta.url),
  'VoiceSessionSetup.cas': new URL('./VoiceSessionSetup.cas', import.meta.url),
};

// Keep upstream wording and provenance together. Supply text only for a real
// difference or a family spanning several native operations.
const sdk = (operation, description) => ({
  description: description ?? sdkDocs[operation].description,
  descriptionSource: { operation, ...sdkDocs[operation], reuse: description ? 'adapted' : 'verbatim' },
});

const choices = {
  asTool: ['As a tool', 'Lets an AI agent or workflow call this component using declared input fields.', ['asTool', 'inputSchema', 'toolContextSchema', 'description', 'toModelOutput', 'strict', 'inputExamples']],
  asStream: ['Stream results', 'Returns the live AI SDK result so you can consume output as it arrives.', ['streaming', 'inputAudioFormat', 'outputFormat', 'outputAudioFormat', 'onChunk', 'onError', 'onAbort', 'streamRetries']],
  useTools: ['Use tools', 'Registers tools that this component can call from its model, workflow or input preparer.', ['tools', 'toolsContext', 'toolChoice', 'stopWhen']],
  run: ['Named .run() call', 'Calls this component with named inputs. For an asTool component, demonstrates direct invocation rather than a host agent calling it.'],
  prepareSession: ['Session configuration', 'Prepares instructions and tool definitions without opening a provider session.'],
  webRTC: ['WebRTC session', 'Answers a browser SDP offer using a model that supports WebRTC setup.'],
  structured: ['Structured output', 'Returns an object matching a declared schema instead of plain text.', ['output']],
  batch: ['Several texts', 'Embeds an array of texts in one call and returns one vector per text.', ['input', 'maxParallelCalls']],
  topN: ['Top matches only', 'Returns the two most relevant documents from the supplied list.', ['topN']],
  referenceImage: ['Reference image', 'Uses an existing image to guide generation or editing. Requires a model supporting image input.', ['images']],
  mask: ['Edit mask', 'Supplies a mask with the reference image. Mask conventions depend on the selected model.', ['mask']],
  count: ['Several images', 'Requests three variations of the same scene.', ['n']],
  voice: ['Select voice', 'Passes a voice supported by the selected speech model.', ['voice']],
  textStream: ['Streamed text input', 'Feeds text in chunks while the model produces speech. A live application can supply an async iterable instead.', ['text']],
  messages: ['Message history', 'Supplies previous conversation messages and returns the updated history. Earlier messages are not rendered again.', ['messageHistory']],
  resume: ['Approval and resume()', 'Pauses a tool call for an application approval decision, then resumes the same turn without rendering another prompt.', ['messageHistory', 'toolApproval']],
  withTemplate: ['Inline template', 'Builds input with an inline Cascada template using Nunjucks syntax.'],
  withScript: ['Inline script', 'Runs inline Cascada code to prepare input or orchestrate the workflow.'],
  withFunction: ['JavaScript function', 'Prepares input with a JavaScript function that can await application services.'],
  loadTemplate: ['Template file', 'Loads the same template from the accompanying .cat file.', ['loader']],
  loadScript: ['Script file', 'Loads the same script from the accompanying .cas file.', ['loader']],
};
const textSources = ['withTemplate', 'withScript', 'withFunction', 'loadTemplate', 'loadScript'];
const audioSources = ['withScript', 'withFunction', 'loadScript'];
const choice = (id, rules = {}) => ({ id, name: choices[id][0], description: choices[id][1], properties: choices[id][2] ?? [], ...rules });
const group = (id, name, ids, rules = {}) => ({ id, name, optional: true, choices: ids.map(value => choice(value, rules)) });

// Shared group definitions only supply labels and choices; entries supply rules.
const tool = rules => group('tool', 'Expose as a tool', ['asTool'], rules);
const stream = rules => group('stream', 'Result delivery', ['asStream'], rules);
const source = ids => group('source', 'Input preparation', ids);
const tools = rules => group('tools', 'Call other tools', ['useTools'], rules);
const invocation = (ids = ['run']) => group('invocation', 'Invocation', ids);
const workflowTools = { description: 'Makes registered tools available as functions inside this component.' };
const preparerTools = sources => tools({
  requires: { source: sources },
  description: 'Lets the input preparer call registered tools. The AI model itself does not run a tool-calling loop.',
});
const experimental = 'Uses an experimental AI SDK operation.';

const component = (name, description, details = {}) => ({
  name, file: `${name}.js`, ...(typeof description === 'string' ? { description } : description),
  activeOptions: [], resources: [], groups: [], ...details,
});

export const components = [
  component('Config', 'Shares settings such as context and tools between components. It does not run a task.', {
    groups: [tools()],
  }),
  component('Context', 'An object containing application values and private helpers available to a component. Declared input fields can be supplied by the caller.'),
  component('Template', 'Turns data into text using the same template syntax as Nunjucks, including variables, loops, conditions and macros. It needs no AI model.', {
    resources: ['Template.cat'], inlineResource: 'Template.cat',
    groups: [tool(), source(['withTemplate', 'loadTemplate']), tools(workflowTools), invocation()],
  }),
  component('Script', 'Orchestrates the workflow and implements its logic in Cascada. Independent operations run concurrently, at the same time.', {
    resources: ['Script.cas'], inlineResource: 'Script.cas',
    groups: [tool(), source(['withScript', 'loadScript']), tools(workflowTools), invocation()],
  }),
  component('Function', 'Runs JavaScript or TypeScript logic as a component, with shared context and input validation.', {
    groups: [tool(), tools(workflowTools), invocation()],
  }),
  component('LLMAgent', sdk('generateText'), {
    resources: ['LLMAgent.cat', 'LLMAgent.cas'],
    groups: [
      tool({ excludes: ['asStream', 'messages', 'resume'] }),
      stream({ excludes: ['asTool'] }),
      source(textSources), tools(), invocation(),
      { id: 'conversation', name: 'Conversation', description: 'Start a new turn with history, or continue a turn paused for tool approval.', optional: true, choices: [
        choice('messages', { excludes: ['asTool'] }),
        choice('resume', { requires: { tools: ['useTools'] }, excludes: ['asTool'] }),
      ] },
      group('output', 'Result format', ['structured']),
    ],
  }),
  component('Decision', sdk('experimental_decide', 'Uses an AI model to choose a category, answer yes or no, assign a score or locate something in an image.'), {
    resources: ['Decision.cat', 'Decision.cas'], experimental,
    groups: [tool(), source(textSources), preparerTools(textSources), invocation()],
  }),
  component('Embedder', sdk('embed', 'Generates embeddings for one or more texts using an embedding model. Embeddings are numerical vectors used to find similar content.'), {
    resources: ['Embedder.cat', 'Embedder.cas'],
    groups: [
      tool(), source(textSources), preparerTools(textSources), invocation(),
      group('batch', 'Input size', ['batch'], { requires: { source: [null, 'withScript', 'withFunction', 'loadScript'] } }),
    ],
  }),
  component('Reranker', sdk('rerank'), {
    resources: ['Reranker.cat', 'Reranker.cas'],
    groups: [
      tool(), source(textSources), preparerTools(textSources), invocation(),
      group('limit', 'Result count', ['topN']),
    ],
  }),
  component('ImageGenerator', sdk('generateImage'), {
    resources: ['ImageGenerator.cat', 'ImageGenerator.cas'],
    groups: [
      tool(), source(textSources), preparerTools(textSources), invocation(),
      group('media', 'Image input', ['referenceImage']),
      group('mask', 'Editing', ['mask'], { requires: { media: ['referenceImage'] } }),
      group('count', 'Result count', ['count']),
    ],
  }),
  component('Transcriber', sdk('transcribe', 'Generates a transcript from an audio file or a raw-audio stream.'), {
    resources: ['Transcriber.cas'],
    groups: [
      tool({ requires: [{ stream: [null] }, { source: audioSources }] }),
      stream({ requires: [{ tool: [null] }, { source: audioSources }], experimental,
        description: 'Produces transcript events from raw audio. Tool callers receive the completed transcript.' }),
      source(audioSources), preparerTools(audioSources), invocation(),
    ],
  }),
  component('SpeechGenerator', sdk('generateSpeech'), {
    resources: ['SpeechGenerator.cat', 'SpeechGenerator.cas'],
    groups: [
      tool({ excludes: ['asStream'] }),
      stream({ excludes: ['asTool'], experimental, description: 'Returns speech in audio chunks from a supporting model.' }),
      source(textSources), preparerTools(textSources), invocation(),
      group('voice', 'Voice', ['voice']),
      group('inputDelivery', 'Text input', ['textStream'], { requires: { stream: ['asStream'], source: [null] } }),
    ],
  }),
  component('Translator', sdk('experimental_streamTranslate', 'Translates speech into target-language audio and text, with a completed result or incremental events.'), {
    resources: ['Translator.cas'], experimental,
    planned: {
      requires: { stream: [null] },
      description: 'Planned API: complete Translator is not implemented yet. See docs/streaming-modifiers-plan.md.',
    },
    groups: [stream(), source(audioSources), preparerTools(audioSources), invocation()],
  }),
  component('VoiceSessionSetup', 'Prepares a browser voice session and exposes server-side tool execution. The application owns transport and authentication.', {
    resources: ['VoiceSessionSetup.cat', 'VoiceSessionSetup.cas'], experimental,
    groups: [
      source(textSources),
      tools({ description: 'Adds tools to the voice session and shows the server adapter for executing incoming tool calls. Requires a model with session-tool support.' }),
      invocation(['run', 'prepareSession', 'webRTC']),
    ],
  }),
];

export function getComponent(name) {
  const item = components.find(entry => entry.name === name);
  if (!item) throw new Error(`Unknown matrix component: ${name}`);
  return item;
}

function enabled(item, option, selected) {
  const alternatives = Array.isArray(option.requires) ? option.requires : [option.requires ?? {}];
  return !option.excludes?.some(id => selected.includes(id)) &&
    alternatives.some(requirements => Object.entries(requirements).every(([groupId, allowed]) => {
      const current = item.groups.find(entry => entry.id === groupId)?.choices.find(entry => selected.includes(entry.id))?.id;
      return allowed.includes(current ?? null);
    }));
}

// Documentation uses the same selection predicates, with its own applicability data.
export { enabled as matchesOptions };

export function visibleGroups(name, selected = getComponent(name).activeOptions) {
  const item = getComponent(name);
  return item.groups.map(entry => ({ ...entry, choices: entry.choices.filter(option => enabled(item, option, selected)) }))
    .filter(entry => entry.choices.length);
}

const allChoices = item => item.groups.flatMap(entry => entry.choices);
const orderedOptions = (item, selected) => allChoices(item).filter(option => selected.includes(option.id)).map(option => option.id);

export function validateOptions(name, selected = getComponent(name).activeOptions) {
  const item = getComponent(name);
  const all = allChoices(item);
  for (const id of selected) if (!all.some(option => option.id === id)) throw new Error(`Unsupported ${name} option: ${id}`);
  if (new Set(selected).size !== selected.length) throw new Error('Repeated option');
  for (const entry of item.groups) if (entry.choices.filter(option => selected.includes(option.id)).length > 1) throw new Error(`Choose at most one ${entry.id} option`);
  for (const option of all.filter(entry => selected.includes(entry.id))) if (!enabled(item, option, selected)) throw new Error(`Unmet requirements or conflict: ${option.id}`);
  return orderedOptions(item, selected);
}

// Start with a valid selection. Replace siblings and clear obsolete dependents.
export function selectOption(name, selected, id, active = true) {
  const item = getComponent(name);
  const all = allChoices(item);
  const owner = item.groups.find(entry => entry.choices.some(option => option.id === id));
  if (!owner) throw new Error(`Unsupported ${name} option: ${id}`);
  let next = selected.filter(value => value !== id && (!active || !owner.choices.some(option => option.id === value)));
  if (active) {
    const option = owner.choices.find(entry => entry.id === id);
    next = next.filter(value => !option.excludes?.includes(value));
    if (!enabled(item, option, next)) throw new Error(`Unmet requirements: ${id}`);
    next.push(id);
  }
  for (;;) {
    // Clear one dependent at a time in catalog order, then recheck the rest.
    const invalid = all.find(option => next.includes(option.id) && !enabled(item, option, next));
    if (!invalid) return orderedOptions(item, next);
    next = next.filter(value => value !== invalid.id);
  }
}

export async function render(name, selected, { readText = async url => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load ${url}: ${response.status}`);
  return response.text();
} } = {}) {
  const item = getComponent(name);
  const options = validateOptions(name, selected);
  const kind = sourceKind(options);
  const files = kind ? item.resources.filter(file => file.endsWith(`.${kind}`)) : !sourceMode(options) && item.inlineResource ? [item.inlineResource] : [];
  const resources = Object.fromEntries(await Promise.all(files.map(async file => [file, await readText(resourceURLs[file])])));
  const module = await renderers[item.file]();
  const example = module.default(options, resources);
  const notice = item.planned && enabled(item, item.planned, options) ? item.planned.description : undefined;
  return { ...example, id: exampleId(name, options), component: name, activeOptions: options,
    status: notice ? 'planned' : 'implemented', ...(notice ? { notice } : {}),
    files: example.files.map((file, index) => index === 0 && notice ? { ...file, code: `// ${notice}\n${file.code}` } : file),
    explanations: allChoices(item).filter(option => options.includes(option.id)).map(option => option.description) };
}
