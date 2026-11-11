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
import { exampleId } from './shared.js';

const choices = {
  asTool: ['As a tool', 'Lets an AI agent or workflow call this component using declared input fields.'],
  asStream: ['Stream results', 'Returns the live AI SDK result so you can consume output as it arrives.'],
  useTools: ['Use tools', 'Registers tools that this component can call from its model, workflow or input preparer.'],
  run: ['Named .run() call', 'Calls this component with named inputs. For an asTool component, demonstrates direct invocation rather than a host agent calling it.'],
  prepareSession: ['Session configuration', 'Prepares instructions and tool definitions without opening a provider session.'],
  webRTC: ['WebRTC session', 'Answers a browser SDP offer using a model that supports WebRTC setup.'],
  structured: ['Structured output', 'Returns an object matching a declared schema instead of plain text.'],
  batch: ['Several texts', 'Embeds an array of texts in one call and returns one vector per text.'],
  topN: ['Top matches only', 'Returns the two most relevant documents from the supplied list.'],
  referenceImage: ['Reference image', 'Uses an existing image to guide generation or editing. Requires a model supporting image input.'],
  mask: ['Edit mask', 'Supplies a mask with the reference image. Mask conventions depend on the selected model.'],
  count: ['Several images', 'Requests three variations of the same scene.'],
  voice: ['Select voice', 'Passes a voice supported by the selected speech model.'],
  textStream: ['Streamed text input', 'Feeds text in chunks while the model produces speech. A live application can supply an async iterable instead.'],
  messages: ['Message history', 'Supplies previous conversation messages and returns the updated history. Earlier messages are not rendered again.'],
  resume: ['Approval and resume()', 'Pauses a tool call for an application approval decision, then resumes the same turn without rendering another prompt.'],
  withTemplate: ['Inline template', 'Builds input with an inline Cascada template using Nunjucks syntax.'],
  withScript: ['Inline script', 'Runs inline Cascada code to prepare input or orchestrate the workflow.'],
  withFunction: ['JavaScript function', 'Prepares input with a JavaScript function that can await application services.'],
  loadTemplate: ['Template file', 'Loads the same template from the accompanying .cat file.'],
  loadScript: ['Script file', 'Loads the same script from the accompanying .cas file.'],
};
const textSources = ['withTemplate', 'withScript', 'withFunction', 'loadTemplate', 'loadScript'];
const audioSources = ['withScript', 'withFunction', 'loadScript'];
const choice = (id, rules = {}) => ({ id, name: choices[id][0], description: choices[id][1], ...rules });
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
  name, file: `${name}.js`, description, activeOptions: [], resources: [], groups: [], ...details,
});

export const components = [
  component('Config', 'Shares settings such as context and tools between components. It does not run a task.', {
    groups: [tools()],
  }),
  component('Context', 'An object containing application values and private helpers available to a component. Declared input fields can be supplied by the caller.'),
  component('Template', 'Turns data into text using the same template syntax as Nunjucks, including variables, loops, conditions and macros. It needs no AI model.', {
    resources: ['Template.cat'],
    groups: [tool(), source(['withTemplate', 'loadTemplate']), tools(workflowTools), invocation()],
  }),
  component('Script', 'Orchestrates the workflow and implements its logic in Cascada. Independent operations run concurrently, at the same time.', {
    resources: ['Script.cas'],
    groups: [tool(), source(['withScript', 'loadScript']), tools(workflowTools), invocation()],
  }),
  component('Function', 'Runs JavaScript or TypeScript logic as a component, with shared context and input validation.', {
    groups: [tool(), tools(workflowTools), invocation()],
  }),
  component('LLMAgent', 'Works through tasks using an AI language model. It can answer questions and call tools to take action.', {
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
  component('Decision', 'Uses an AI model to choose a category, answer yes or no, assign a score or locate something in an image.', {
    resources: ['Decision.cat', 'Decision.cas'], experimental,
    groups: [tool(), source(textSources), preparerTools(textSources), invocation()],
  }),
  component('Embedder', 'Turns text into numerical vectors that represent its meaning, for search and similarity.', {
    resources: ['Embedder.cat', 'Embedder.cas'],
    groups: [
      tool(), source(textSources), preparerTools(textSources), invocation(),
      group('batch', 'Input size', ['batch'], { requires: { source: [null, 'withScript', 'withFunction', 'loadScript'] } }),
    ],
  }),
  component('Reranker', 'Sorts supplied documents by relevance to a query and selects the best matches.', {
    resources: ['Reranker.cat', 'Reranker.cas'],
    groups: [
      tool(), source(textSources), preparerTools(textSources), invocation(),
      group('limit', 'Result count', ['topN']),
    ],
  }),
  component('ImageGenerator', 'Creates or edits images using a text description and supported reference images or masks.', {
    resources: ['ImageGenerator.cat', 'ImageGenerator.cas'],
    groups: [
      tool(), source(textSources), preparerTools(textSources), invocation(),
      group('media', 'Image input', ['referenceImage']),
      group('mask', 'Editing', ['mask'], { requires: { media: ['referenceImage'] } }),
      group('count', 'Result count', ['count']),
    ],
  }),
  component('Transcriber', 'Turns speech into text, from a recording or a raw-audio stream.', {
    resources: ['Transcriber.cas'],
    groups: [
      tool({ requires: [{ stream: [null] }, { source: audioSources }] }),
      stream({ requires: [{ tool: [null] }, { source: audioSources }], experimental,
        description: 'Produces transcript events from raw audio. Tool callers receive the completed transcript.' }),
      source(audioSources), preparerTools(audioSources), invocation(),
    ],
  }),
  component('SpeechGenerator', 'Turns text into speech, returning a recording or audio chunks.', {
    resources: ['SpeechGenerator.cat', 'SpeechGenerator.cas'],
    groups: [
      tool({ excludes: ['asStream'] }),
      stream({ excludes: ['asTool'], experimental, description: 'Returns speech in audio chunks from a supporting model.' }),
      source(textSources), preparerTools(textSources), invocation(),
      group('voice', 'Voice', ['voice']),
      group('inputDelivery', 'Text input', ['textStream'], { requires: { stream: ['asStream'], source: [null] } }),
    ],
  }),
  component('Translator', 'Translates speech into target-language audio and text, with a completed result or incremental events.', {
    resources: ['Translator.cas'], experimental,
    planned: {
      requires: { stream: [null] },
      description: 'Planned API: complete Translator is not implemented yet. See docs/streaming-modifiers-plan.md.',
    },
    groups: [stream({ excludes: ['asTool'] }), source(audioSources), preparerTools(audioSources), invocation()],
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
  const resources = Object.fromEntries(await Promise.all(item.resources.map(async file => [file, await readText(new URL(file, import.meta.url))])));
  const module = await import(new URL(item.file, import.meta.url).href);
  const example = module.default(options, resources);
  const notice = item.planned && enabled(item, item.planned, options) ? item.planned.description : undefined;
  return { ...example, id: exampleId(name, options), component: name, activeOptions: options,
    status: notice ? 'planned' : 'implemented', ...(notice ? { notice } : {}),
    files: example.files.map((file, index) => index === 0 && notice ? { ...file, code: `// ${notice}\n${file.code}` } : file),
    explanations: allChoices(item).filter(option => options.includes(option.id)).map(option => option.description) };
}
