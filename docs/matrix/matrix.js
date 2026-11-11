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
 * await render('LLMAgent', ['withTemplate', 'asTool']);
 *
 * Renderers are JavaScript; generated, copyable examples are TypeScript.
 * .cat/.cas files are canonical text; generated resources.js embeds them for
 * portable rendering without fetch or bundler asset configuration.
 * render() returns { id, component, activeOptions, status, explanations, files }.
 * Planned selections also return a notice and include it in the code comments.
 * A component's planned note uses the same requires rules as choices.
 * Each file has { name, language, code }; save all files in one directory.
 * Names stay stable across toggles; the derived id identifies the selection.
 * Use getControls() for UI controls and selectOption() to update
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
import bundledResources from './resources.js';
import metadata from './reference/metadata.js';

export const versions = metadata.versions;
export const repository = metadata.repository;
// The publishing build supplies its pinned Casai commit. Do not bake moving HEAD
// into generated data, which would become stale after every documentation commit.
export function sourceUrl(source, revision) {
  if (!source) return null;
  if (source.url) return source.url;
  return revision ? `${repository}/blob/${encodeURIComponent(revision)}/${source.path}` : null;
}

// Literal imports let bundlers discover every renderer.
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
const referenceChoices = ['asTool', 'asStream', ...textSources, 'prepareSession', 'webRTC'];
const choice = (id, rules = {}) => ({ id, name: choices[id][0], description: choices[id][1], properties: choices[id][2] ?? [], affectsReference: referenceChoices.includes(id), ...rules });
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
  activeOptions: [], resources: [], groups: [], sourceDefault: 'default', ...details,
});

export const components = [
  component('Config', 'Shares settings such as context and tools between components. It does not run a task.', {
    groups: [tools()],
  }),
  component('Context', 'An object containing application values and private helpers available to a component. Declared input fields can be supplied by the caller.'),
  component('Template', 'Turns data into text using the same template syntax as Nunjucks, including variables, loops, conditions and macros. It needs no AI model.', {
    resources: ['Template.cat'], inlineResource: 'Template.cat', sourceDefault: 'template',
    groups: [tool(), source(['withTemplate', 'loadTemplate']), tools(workflowTools), invocation()],
  }),
  component('Script', 'Orchestrates the workflow and implements its logic in Cascada. Independent operations run concurrently, at the same time.', {
    resources: ['Script.cas'], inlineResource: 'Script.cas', sourceDefault: 'script',
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
      description: 'Planned API: complete Translator is not implemented yet. Select streaming translation for the available API.',
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

function prune(item, selected) {
  const next = [...selected];
  for (;;) {
    const invalid = allChoices(item).find(option => next.includes(option.id) && !enabled(item, option, next));
    if (!invalid) return orderedOptions(item, next);
    next.splice(next.indexOf(invalid.id), 1);
  }
}

// External URL/storage input only. Strict authoring/rendering still rejects errors.
export function normalizeOptions(name, input = getComponent(name).activeOptions) {
  const item = getComponent(name);
  const chosen = item.groups.flatMap(group => input.filter(id => group.choices.some(choice => choice.id === id)).slice(-1));
  const activeOptions = prune(item, chosen);
  return { activeOptions, dropped: [...new Set(input)].filter(id => !activeOptions.includes(id)) };
}

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
  const owner = item.groups.find(entry => entry.choices.some(option => option.id === id));
  if (!owner) throw new Error(`Unsupported ${name} option: ${id}`);
  let next = selected.filter(value => value !== id && (!active || !owner.choices.some(option => option.id === value)));
  if (active) {
    const option = owner.choices.find(entry => entry.id === id);
    next = next.filter(value => !option.excludes?.includes(value));
    if (!enabled(item, option, next)) throw new Error(`Unmet requirements: ${id}`);
    next.push(id);
  }
  return prune(item, next);
}

export const infoSections = [
  { id: 'summary', name: 'Component' },
  { id: 'variants', name: 'Variants', groups: ['tool', 'stream'] },
  { id: 'source', name: 'Source', groups: ['source'] },
  { id: 'features', name: 'Capabilities and features' },
  { id: 'invocation', name: 'Invocation', groups: ['invocation', 'conversation'] },
];
const sourceKinds = [
  { id: 'default', name: 'Default', inline: null, loaded: null },
  { id: 'template', name: 'Template', inline: 'withTemplate', loaded: 'loadTemplate' },
  { id: 'script', name: 'Script', inline: 'withScript', loaded: 'loadScript' },
  { id: 'function', name: 'Function', inline: 'withFunction', loaded: null },
];
function sourceState(name, selected) {
  const component = getComponent(name);
  const group = component.groups.find(group => group.id === 'source');
  if (!group) return null;
  const kinds = sourceKinds.filter(kind => kind.id === 'default' ? component.sourceDefault === 'default' : group.choices.some(choice => choice.id === kind.inline));
  const current = kinds.find(kind => selected.includes(kind.inline) || kind.loaded && selected.includes(kind.loaded)) ?? kinds.find(kind => kind.id === component.sourceDefault);
  return { id: 'source', name: 'Source', kind: current.id, affectsReference: true,
    choices: kinds.map(kind => ({ id: kind.id, name: kind.name, description: group.choices.find(choice => choice.id === kind.inline)?.description ?? 'Use the native operation input without rendering it.' })),
    loads: { id: 'loads', name: 'Loads', active: Boolean(current.loaded && selected.includes(current.loaded)), available: Boolean(current.loaded && group.choices.some(choice => choice.id === current.loaded)), description: 'Load this source from a resource using the configured loader.' },
    modifier: sourceMode(selected)?.replace(/^load/, 'loads') ?? null,
    description: 'The source property keeps its name; this choice changes how its value is interpreted.',
  };
}
export function selectSource(name, selected, kind) {
  const control = sourceState(name, selected);
  if (!control?.choices.some(choice => choice.id === kind)) throw new Error(`Unsupported ${name} source: ${kind}`);
  const choice = sourceKinds.find(choice => choice.id === kind);
  const current = sourceMode(selected);
  if (kind === 'default' || kind === getComponent(name).sourceDefault && !control.loads.active) return current ? selectOption(name, selected, current, false) : [...selected];
  return selectOption(name, selected, control.loads.active && choice.loaded ? choice.loaded : choice.inline);
}
export function setLoads(name, selected, active) {
  const control = sourceState(name, selected);
  if (!control?.loads.available) throw new Error(`Loading is unavailable for the selected ${name} source`);
  const choice = sourceKinds.find(choice => choice.id === control.kind);
  if (!active && control.kind === getComponent(name).sourceDefault) return selectOption(name, selected, choice.loaded, false);
  return selectOption(name, selected, active ? choice.loaded : choice.inline);
}
function transition(selected, action) {
  try {
    const activeOptions = action();
    return { activeOptions, cleared: selected.filter(id => !activeOptions.includes(id)), added: activeOptions.filter(id => !selected.includes(id)) };
  } catch { return null; }
}
export function getSourceControl(name, selected = getComponent(name).activeOptions) {
  const control = sourceState(name, selected);
  return control && { ...control,
    choices: control.choices.map(choice => ({ ...choice, transition: transition(selected, () => selectSource(name, selected, choice.id)) })),
    loads: { ...control.loads, transition: control.loads.available ? transition(selected, () => setLoads(name, selected, !control.loads.active)) : null },
  };
}
function unavailableReasons(component, choice, selected) {
  if (enabled(component, choice, selected)) return [];
  const names = ids => ids.map(id => allChoices(component).find(choice => choice.id === id).name).join(', ');
  const conflicts = choice.excludes?.filter(id => selected.includes(id)) ?? [];
  const reasons = conflicts.length ? [`Conflicts with: ${names(conflicts)}.`] : [];
  const alternatives = Array.isArray(choice.requires) ? choice.requires : [choice.requires ?? {}];
  if (!enabled(component, { requires: choice.requires }, selected)) {
    reasons.push('Requires ' + alternatives.map(rule => Object.entries(rule).map(([groupId, allowed]) => allowed.map(id => id === null ? `no selection in ${component.groups.find(group => group.id === groupId).name}` : names([id])).join(' or ')).join('; and ')).join('; alternatively, ') + '.');
  }
  return reasons;
}
// Official UI control model. The raw catalog/visibleGroups retain canonical IDs.
export function getControls(name, selected = getComponent(name).activeOptions, { unavailable = 'hide' } = {}) {
  const component = getComponent(name);
  const grouped = infoSections.flatMap(section => section.groups ?? []);
  const groups = component.groups.map(group => ({ ...group, choices: group.choices.map(choice => ({ ...choice,
    active: selected.includes(choice.id), available: enabled(component, choice, selected),
    unavailableReasons: unavailableReasons(component, choice, selected),
    transition: transition(selected, () => selectOption(name, selected, choice.id, !selected.includes(choice.id))),
  })).filter(choice => unavailable === 'include' || choice.available) })).filter(group => unavailable === 'include' || group.choices.length);
  return infoSections.filter(section => section.id !== 'summary').map(section => ({ id: section.id, name: section.name,
    ...(section.id === 'source' ? { control: getSourceControl(name, selected) } : { groups: groups.filter(group => section.groups ? section.groups.includes(group.id) : !grouped.includes(group.id)) }),
  }));
}
export function referenceSelection(name, selected = getComponent(name).activeOptions) {
  const component = getComponent(name);
  const defaultSource = sourceKinds.find(kind => kind.id === component.sourceDefault).inline;
  const options = validateOptions(name, selected).filter(id => id !== defaultSource && allChoices(component).find(choice => choice.id === id).affectsReference);
  return { component: name, id: exampleId(name, options), activeOptions: options };
}

export async function render(name, selected, { readText } = {}) {
  const item = getComponent(name);
  const options = validateOptions(name, selected);
  const kind = sourceKind(options);
  const files = kind ? item.resources.filter(file => file.endsWith(`.${kind}`)) : !sourceMode(options) && item.inlineResource ? [item.inlineResource] : [];
  const resources = Object.fromEntries(await Promise.all(files.map(async file => [file, readText ? await readText(new URL(`./${file}`, import.meta.url)) : bundledResources[file]])));
  const module = await renderers[item.file]();
  const example = module.default(options, resources);
  const notice = item.planned && enabled(item, item.planned, options) ? item.planned.description : undefined;
  return { ...example, id: exampleId(name, options), component: name, activeOptions: options,
    status: notice ? 'planned' : 'implemented', ...(notice ? { notice } : {}),
    files: example.files.map((file, index) => index === 0 && notice ? { ...file, code: `// ${notice}\n${file.code}` } : file),
    explanations: allChoices(item).filter(option => options.includes(option.id)).map(option => option.description) };
}
