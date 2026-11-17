/**
 * Example catalog for the documented Casai API.
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
 * .cat/.cas/.txt files are canonical text; generated resources.js embeds them for
 * portable rendering without fetch or bundler asset configuration.
 * render() returns { id, component, activeOptions, explanations, files }.
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
 * Audio streaming uses source-first .asStream modifiers.
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
  'VoiceAgentBackend.js': () => import('./VoiceAgentBackend.js'),
  'VoiceAgentClient.js': () => import('./VoiceAgentClient.js'),
  'VideoGenerator.js': () => import('./VideoGenerator.js'),
};

// Keep upstream wording and provenance alongside concise, action-first summaries.
// The reference and homepage share these descriptions; longer details stay below.
const sdk = (operation, shortDescription) => ({
  shortDescription: shortDescription ?? sdkDocs[operation].description,
  shortDescriptionSource: { operation, ...sdkDocs[operation], reuse: shortDescription ? 'adapted' : 'verbatim' },
});
// Longer explanations adapt the matching installed SDK guides to Casai.
const sdkGuide = page => ({
  package: 'ai', version: versions.ai,
  path: `node_modules/ai/docs/03-ai-sdk-core/${page}.mdx`,
  url: `https://unpkg.com/ai@${versions.ai}/docs/03-ai-sdk-core/${page}.mdx`,
  documentation: `https://ai-sdk.dev/docs/ai-sdk-core/${page.replace(/^\d+-/, '')}`,
});

const choices = {
  asTool: { name: 'As a tool', shortDescription: 'Let other components call it with declared [inputs](property:inputSchema).', description: 'The .asTool modifier lets an AI agent or workflow call this component using declared input fields.', properties: ['inputSchema', 'toolContextSchema', 'description', 'toModelOutput', 'strict', 'inputExamples'] },
  asStream: { name: 'Stream results', shortDescription: 'Streaming data.', description: 'The .asStream modifier returns the live AI SDK result so you can consume output as it arrives.', properties: ['inputAudioFormat', 'outputFormat', 'outputAudioFormat', 'onChunk', 'onError', 'onAbort', 'streamRetries'] },
  useTools: { name: 'Use tools', shortDescription: 'Call registered [tools](property:tools).', description: 'Registers tools that this component can call from its model, workflow or input preparer.', properties: ['tools', 'toolsContext', 'toolChoice', 'stopWhen'] },
  run: { name: '.run() call', shortDescription: 'Use named inputs.', description: 'Calls this component with named inputs. For an asTool component, demonstrates direct invocation rather than a host agent calling it.' },
  prepareSession: { name: 'Session configuration', shortDescription: 'Prepare [instructions](property:instructions) and [tools](property:tools).', description: 'Prepares instructions and tool definitions without opening a provider session.' },
  webRTC: { name: 'WebRTC session', shortDescription: 'Set up a browser voice connection.', description: 'Answers a browser SDP offer using a model that supports WebRTC setup.' },
  structured: { name: 'Structured output', shortDescription: 'Return an object matching a [schema](property:output).', description: 'Returns an object matching a declared schema.', properties: ['output'] },
  batch: { name: 'Several texts', shortDescription: 'Embed several [texts](property:input) in one call.', description: 'Embeds an array of texts in one call and returns one vector per text.', properties: ['input', 'maxParallelCalls'] },
  topN: { name: 'Top matches only', shortDescription: 'Return the [two best matches](property:topN).', description: 'Returns the two most relevant documents from the supplied list.', properties: ['topN'] },
  referenceImage: { name: 'Reference image', shortDescription: 'Guide generation with an [image](property:images).', description: 'Uses an existing image to guide generation or editing. Requires a model supporting image input.', properties: ['images'] },
  mask: { name: 'Edit mask', shortDescription: 'Mark the [area to edit](property:mask).', description: 'Supplies a mask with the reference image. Mask conventions depend on the selected model.', properties: ['mask'] },
  count: { name: 'Several images', shortDescription: 'Generate [three variations](property:n).', description: 'Requests three variations of the same scene.', properties: ['n'] },
  voice: { name: 'Select voice', shortDescription: 'Choose a supported [voice](property:voice).', description: 'Passes a voice supported by the selected speech model.', properties: ['voice'] },
  textStream: { name: 'Streamed text input', shortDescription: 'Speak while [text](property:text) is arriving.', description: 'Feeds text in chunks while the model produces speech.', properties: ['text'] },
  audioStream: { name: 'Raw audio input', shortDescription: 'Supply raw samples with their [format](property:inputAudioFormat).', description: 'Uses raw audio with native streaming transcription. The example supplies a fresh stream, or configured bytes for a tool. Ordinary calls await the completed transcript.', properties: ['audio', 'inputAudioFormat'] },
  nativeStream: { name: 'Native streaming format', shortDescription: 'Select a native [audio format](property:outputFormat).', description: 'An object outputFormat selects native streaming speech. Ordinary calls and tools collect its output; .asStream returns the live result.', properties: ['outputFormat'] },
  messages: { name: 'Message history', shortDescription: 'Continue an earlier [conversation](property:messageHistory).', description: 'Supplies previous conversation messages and returns the updated history.', properties: ['messageHistory'] },
  resume: { name: 'Approval and resume()', shortDescription: '[Approve a tool call](property:toolApproval), then continue.', description: 'Pauses a tool call for approval, then resumes the conversation.', properties: ['messageHistory', 'toolApproval'] },
  withTemplate: { name: 'Inline template', description: 'The input text is a Cascada Template; the context object supplies its variables.' },
  withAudio: { name: 'Direct audio', description: 'Explicitly selects ordinary supplied-audio input, replacing inherited preparation.' },
  withText: { name: 'Text', description: 'Explicitly selects direct text input for the inheriting component.' },
  withScript: { name: 'Inline script', description: 'Runs a Cascada Script to prepare input or coordinate workflow steps.' },
  withFunction: { name: 'JavaScript function', description: 'Prepares input with a JavaScript function that can await application services.' },
  loadTemplate: { name: 'Template file', description: 'Loads a Cascada Template from the accompanying .cat file.', properties: ['loader'] },
  loadScript: { name: 'Script file', description: 'Loads a Cascada Script from the accompanying .cas file.', properties: ['loader'] },
  loadText: { name: 'Text file', description: 'Reads text from the accompanying .txt file.', properties: ['loader'] },
  loadAudio: { name: 'Prepare media', description: 'FFmpeg opens a path/URL or supplied encoded bytes/byte stream, selects audio, and converts it to the model input format. Requires an installed node-av build; no loader setting is needed.', properties: ['mediaSettings', 'inputAudioFormat'] },
};
const textSources = ['withTemplate', 'withScript', 'withFunction', 'loadText', 'loadTemplate', 'loadScript'];
const audioSources = ['withAudio', 'withScript', 'withFunction', 'loadScript', 'loadAudio'];
const referenceChoices = ['asTool', 'asStream', 'withAudio', 'withText', ...textSources, 'loadAudio', 'prepareSession', 'webRTC'];
const choice = (id, rules = {}) => ({ id, properties: [], ...choices[id], affectsReference: referenceChoices.includes(id), ...rules });
const group = (id, name, ids, rules = {}) => ({ id, name, optional: true, choices: ids.map(value => choice(value, rules)) });

// Shared group definitions only supply labels and choices; entries supply rules.
const tool = rules => group('tool', 'Expose as a tool', ['asTool'], rules);
const stream = rules => group('stream', 'Result delivery', ['asStream'], rules);
const source = ids => group('source', 'Input preparation', ids);
const tools = rules => group('tools', 'Call other tools', ['useTools'], rules);
const invocation = (ids = ['run']) => ({ ...group('invocation', 'Invocation', ids), choices: ids.map(id => choice(id,
  id === 'run' ? { defaultControl: { name: 'Shorthand call', shortDescription: 'Use [`component(input)`](method:call) instead of [`component.run({...})`](method:run?option=run).', description: 'Use component(input). Turn off to show component.run({ ... }) with named inputs. Tool examples show an agent or workflow calling the tool; .run() calls it directly.' } } : {})) });
const workflowTools = { shortDescription: 'Call registered [tools](property:tools) from code.', description: 'Makes registered tools available as functions inside this component.' };
const preparerTools = sources => tools({
  requires: { source: sources.filter(id => !['loadText', 'loadAudio', 'withAudio'].includes(id)) },
  shortDescription: 'Call [tools](property:tools) to prepare input.',
  description: 'Lets the template, script or function call registered tools to build the input.',
});
const experimental = 'Uses an experimental AI SDK operation.';

const component = (name, shortDescription, details = {}) => ({
  name, kind: 'component', file: `${name}.js`, ...(typeof shortDescription === 'string' ? { shortDescription } : shortDescription),
  activeOptions: [], resources: [], groups: [], sourceDefault: 'default', descriptionSources: [], ...details,
  workInProgress: details.kind === 'concept' ? [] : (details.workInProgress ?? []),
});

export const components = [
  component('Config', 'Share models, tools and defaults across components.', {
    description: 'Define common settings once and pass them as a parent when creating components. For example, several agents can share a model and tools, while each supplies its own instructions. A child inherits omitted settings and can replace individual values. Context and tool maps merge by key.\n\nConfig supports the same source selectors as components, followed by compatible .asTool or .asStream modifiers. For example, Config.withTemplate.asTool selects template preparation and tool mode for its consuming component. Plain Config preserves an inherited mode without selecting a default.\n\nA Config is a reusable settings object; it does not execute a task. It may leave settings incomplete until a component is created. The combined settings must fit that component, so unrelated options from different component types cannot be mixed. All modes are selected through modifiers; promptType, streaming and asTool are not configuration properties.',
    kind: 'configuration', sourceDefault: null, resources: ['Config.cat', 'Config.cas', 'Config.txt'],
    groups: [
      tool({ excludes: ['asStream'], shortDescription: 'Expose inheriting components as tools.', description: 'The inheriting component becomes a tool and must meet its tool requirements.' }),
      stream({ excludes: ['asTool'], description: 'The inheriting component must support streaming. Streaming and tool mode cannot be combined.' }),
      source(['withText', 'withAudio', ...textSources, 'loadAudio']), tools({ excludes: ['loadAudio', 'withAudio'] }),
    ],
  }),
  component('Context', 'An object containing application values and private helpers available to a component. Declared input fields can be supplied by the caller.', {
    kind: 'concept',
    description: 'Context gives a component the values and services it needs to work: a customer name, order details, a database client or a helper function. Templates read these values by name; scripts and functions can use them to prepare input or perform work.\n\nFields declared in inputSchema are public inputs. Their configured values act as defaults, and supplied input can override them before validation. Other configured fields remain private dependencies that callers and AI tool arguments cannot replace. Context is an ordinary application object, not a component you construct or run.',
  }),
  component('Template', 'Build prompts and other text from your data with Cascada Template.', {
    description: 'Combine a reusable text layout with values from context to create prompts, messages, reports or other text. Cascada uses the same template syntax as Nunjucks: insert values with {{ name }}, repeat content with loops, choose sections with conditions and reuse blocks with macros. Rendering itself needs no AI model.\n\nA template returns the completed string. It can call context helpers or registered tools, and Cascada can resolve independent expressions concurrently. Keep the source inline or load the same template from a .cat resource.',
    resources: ['Template.cat'], inlineResource: 'Template.cat', sourceDefault: 'template',
    groups: [tool(), source(['withTemplate', 'loadTemplate']), tools(workflowTools), invocation()],
  }),
  component('Script', 'Run workflows in CascadaScript, with automatic concurrency.', {
    description: 'Use Script as the orchestrator for a workflow: read application data, call components or tools, make decisions and combine their results. Its Cascada code implements the logic, while the components it calls perform the individual tasks. Independent operations run concurrently, so unrelated lookups can proceed at the same time.\n\nA script returns the value you choose, such as text, an object or a list. An optional schema validates the result. Keep the code inline or load a .cas resource. Use ! to sequence operations whose side effects must happen in order.',
    resources: ['Script.cas'], inlineResource: 'Script.cas', sourceDefault: 'script',
    groups: [tool(), source(['withScript', 'loadScript']), tools(workflowTools), invocation()],
  }),
  component('Function', 'Use your JavaScript or TypeScript logic as a reusable component.', {
    description: 'Wrap application logic in a reusable component with an execute function. Use it for calculations, database lookups, service calls or any task best expressed in JavaScript or TypeScript. The function receives prepared context containing validated public input, configured private dependencies and any registered tool helpers.\n\nThe implementation can return a value directly or await asynchronous work. Casai returns that value, applying an output schema when one is configured. Expose the function as a tool when an AI agent should be able to call it with declared arguments.',
    groups: [tool(), tools(workflowTools), invocation()],
  }),
  component('LLMAgent', sdk('generateText', 'Generate text or structured answers, and call tools with a language model.'), {
    description: 'Generate answers, summaries, drafts or structured data from a prompt using an AI language model. Supply instructions and content directly, or prepare them with a template, script or function. An output specification can request an object or another supported structured result. Registered tools let the model retrieve information and perform tasks; configure the stopping condition when it should continue across several model and tool steps.\n\nThe completed result includes the generated output and native SDK metadata. Casai also returns messageHistory for later turns. Use resume() to continue a conversation paused for tool approval without preparing the prompt again.',
    descriptionSources: [sdkGuide('05-generating-text')],
    resources: ['LLMAgent.cat', 'LLMAgent.cas', 'LLMAgent.txt'],
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
  component('Decision', sdk('experimental_decide', 'Classify content, make choices, assign scores or locate objects in images.'), {
    description: 'Evaluate the same content against one or more named questions using a decision model. Each question defines the kind of answer you need: a choice from categories, a boolean, a score or a box locating something in an image. This is useful for routing support requests, classifying content or checking several conditions in one call.\n\nThe content can be text, structured data or supported combinations of text and files. The result contains answers under their question names, together with native metadata. Supported question types and media depend on the selected model.',
    descriptionSources: [sdkGuide('32-decisions')],
    resources: ['Decision.cat', 'Decision.cas', 'Decision.txt'], experimental,
    groups: [tool(), source(textSources), preparerTools(textSources), invocation()],
  }),
  component('Embedder', sdk('embed', 'Turn one or more texts into numerical vectors for similarity search.'), {
    description: 'Represent text as a vector of numbers so your application can compare meaning rather than just matching words. Embeddings are useful for semantic search, finding related documents, clustering text and preparing content for retrieval before an AI model answers a question.\n\nPass one string to receive one embedding, or an array of strings to receive embeddings in the same order. Casai selects the corresponding AI SDK operation and preserves its result and metadata. Your application can store the vectors and compare them using a similarity function or a vector database.',
    descriptionSources: [sdkGuide('30-embeddings')],
    resources: ['Embedder.cat', 'Embedder.cas', 'Embedder.txt'],
    groups: [
      tool(), source(textSources), preparerTools(textSources), invocation(),
      group('batch', 'Input size', ['batch'], { requires: { source: [null, 'withScript', 'withFunction', 'loadScript'] } }),
    ],
  }),
  component('Reranker', sdk('rerank', 'Rank documents by how well they match a query.'), {
    description: 'Improve search relevance by reordering candidate documents according to how well they answer a query. Reranking models evaluate the relationship between the query and each document. Use this after an initial search to choose the most useful passages for a reader or for an AI model to use in its answer.\n\nSupply the query and candidate documents, with an optional topN limit. The result contains relevance scores, original indexes and documents in ranked order. Documents can be text or supported structured objects. Reranker ranks the candidates you supply; it does not search a data store itself.',
    descriptionSources: [sdkGuide('31-reranking')],
    resources: ['Reranker.cat', 'Reranker.cas', 'Reranker.txt'],
    groups: [
      tool(), source(textSources), preparerTools(textSources), invocation(),
      group('limit', 'Result count', ['topN']),
    ],
  }),
  component('ImageGenerator', sdk('generateImage', 'Generate or edit images from prompts and reference images.'), {
    description: 'Create images from a description using an image model. Use it for illustrations, product scenes, visual concepts or variations of an idea. Models that support image input can also use reference images, and supported editing models can use a mask to identify an area to change.\n\nRequest one image or several and choose supported settings such as size or aspect ratio. The result provides generated files as bytes or base64, together with native metadata. Available sizes, formats, reference-image behavior and editing capabilities depend on the selected model.',
    descriptionSources: [sdkGuide('35-image-generation')],
    resources: ['ImageGenerator.cat', 'ImageGenerator.cas', 'ImageGenerator.txt'],
    groups: [
      tool(), source(textSources), preparerTools(textSources), invocation(),
      group('media', 'Image input', ['referenceImage']),
      group('mask', 'Editing', ['mask'], { requires: { media: ['referenceImage'] } }),
      group('count', 'Result count', ['count']),
    ],
  }),
  component('Transcriber', sdk('transcribe', 'Turn recorded or streaming audio into text.'), {
    description: 'Turn a recorded conversation, voice note or other audio into text. Supply encoded audio bytes without inputAudioFormat for native file transcription, or raw bytes/a fresh stream with inputAudioFormat for native streaming transcription. Ordinary calls await the completed result in either case.\n\nSelect .asStream for live transcript events. Use .loadsAudio for a file path, URL, encoded bytes or byte stream: FFmpeg selects and prepares its audio, including audio inside video. Use .withAudio to reset inherited preparation. Set the target inputAudioFormat when the model does not expose its requirements. Supported operations and formats belong to the model.',
    descriptionSources: [sdkGuide('36-transcription'), sdkDocs.experimental_streamTranscribe.source],
    resources: ['Transcriber.cas'], sourceDefault: 'audio',
    groups: [
      tool({ excludes: ['asStream'] }),
      stream({ excludes: ['asTool'], experimental,
        description: 'Returns native transcript events and final promises from raw audio. Requires native streaming support.' }),
      source(audioSources), preparerTools(audioSources), invocation(),
      group('inputDelivery', 'Audio input', ['audioStream'], { requires: { source: [null, 'withScript', 'withFunction', 'loadScript'] } }),
    ],
  }),
  component('SpeechGenerator', sdk('generateSpeech', 'Turn text into speech.'), {
    description: 'Turn written text into spoken audio using a speech model. Use it for narration, spoken notifications, accessibility features or a voice response in an application. Choose a voice and audio format supported by the selected provider.\n\nOrdinary calls return a generated audio file with bytes, base64 data and metadata. Select .asStream when playback should begin before generation finishes. Both forms accept a complete text string or text arriving gradually, such as a language model response. Incremental text requires a model with streaming support, even when the call returns a completed audio file.',
    descriptionSources: [sdkGuide('37-speech'), sdkDocs.experimental_streamSpeech.source],
    resources: ['SpeechGenerator.cat', 'SpeechGenerator.cas', 'SpeechGenerator.txt'],
    groups: [
      tool({ excludes: ['asStream'] }),
      stream({ excludes: ['asTool'], experimental, description: 'Returns speech in audio chunks from a supporting model.' }),
      source(textSources), preparerTools(textSources), invocation(),
      group('voice', 'Voice', ['voice']),
      group('inputDelivery', 'Text input', ['textStream'], { requires: { source: [null] } }),
      group('nativeOperation', 'Speech operation', ['nativeStream']),
    ],
  }),
  component('Translator', sdk('experimental_streamTranslate', 'Translate speech into audio and text in another language.'), {
    description: 'Translate spoken content into audio and text in another language using a speech translation model. Ordinary calls and tools collect one native execution into audio bytes, final source text, translated text and metadata. Select .asStream for incremental events.\n\nSupply raw audio bytes or a fresh stream with its inputAudioFormat and targetLanguage. Use .loadsAudio for a media path/URL, encoded bytes or byte stream, including audio tracks inside video. Use .withAudio to reset inherited preparation. Input conversion uses the resolved model target; supply it explicitly when model requirements are unknown. For written-text translation, use LLMAgent with translation instructions.',
    descriptionSources: [sdkDocs.experimental_streamTranslate.source],
    resources: ['Translator.cas'], experimental, sourceDefault: 'audio',
    groups: [tool({ excludes: ['asStream'] }), stream({ excludes: ['asTool'] }), source(audioSources), preparerTools(audioSources), invocation()],
  }),
  component('VideoGenerator', sdk('experimental_generateVideo', 'Generate videos from text or images.'), {
    description: 'Generate video clips from text or an image prompt, with provider-supported reference media and generation settings. Configure a reusable component, prepare its prompt with a template, script or function, and call it from JavaScript or Cascada Script.\n\nOrdinary calls return the native completed video result. The AI SDK owns asynchronous provider jobs, polling, webhook completion, retries and downloads. Each call is independent; configuration contains no job state. This component has no .asStream modifier. Tool forms return file payloads; the calling model must support the video file type or the application must supply a suitable toModelOutput mapping.',
    descriptionSources: [sdkDocs.experimental_generateVideo.source],
    resources: ['VideoGenerator.cat', 'VideoGenerator.cas', 'VideoGenerator.txt'], experimental,
    workInProgress: ['Work in progress: VideoGenerator component and native video generation integration.'],
    groups: [tool(), source(textSources), preparerTools(textSources),
      { ...group('count', 'Video count', ['count']), choices: [choice('count', { name: 'Several videos', shortDescription: 'Generate [two clips](property:n).', description: 'Requests two clips for the same prompt.' })] },
      invocation()],
  }),
  component('VoiceAgentClient', 'Create and control voice conversations in the browser.', {
    description: 'Create independent browser voice sessions from a stateless reusable component. Pass the returned handle between browser Cascada scripts or application callbacks. Each call returns a disconnected session; connect explicitly to start the conversation. Use native microphone, playback, text, audio and tool controls, and subscribe to snapshots to update any framework or plain JavaScript UI.\n\nImport from casai/client. Your application routes pair with VoiceAgentBackend for session setup and private tools, keeping provider API keys and tool executors on the server. Native token, WebRTC and relay options retain their provider and browser restrictions. Share explicitly public typed preferences when useful; do not pass backend configuration to the browser.',
    sourceDefault: null, experimental: 'Uses the experimental AI SDK realtime session interface.',
    workInProgress: ['Work in progress: VoiceAgentClient browser entry, session factory and state subscriptions.'],
    groups: [{ ...invocation(), choices: [choice('run', {
      description: 'Create a disconnected session through client.run(settings?), with optional native session-setting overrides.',
      shortDescription: 'Create a session with [`client.run(settings?)`](method:run?option=run).',
      defaultControl: { name: 'Shorthand call', shortDescription: 'Create a session with [`client()`](method:call).', description: 'Create a disconnected session from configured settings. Turn off to show client.run().' },
    })] }],
  }),
  component('VoiceAgentBackend', 'Set up realtime voice sessions and execute their tool calls on the server.', {
    description: 'Set up the server side of a realtime voice conversation with an AI model and execute its tool calls. Configure the model, instructions and tools, then use the setup method supported by the provider: create a short-lived client secret, prepare session configuration or answer a browser WebRTC offer. The browser handles audio capture and playback; your application owns network connections and the conversation lifecycle.\n\nWhen the session supports tools, executeTool validates and runs a registered tool with the incoming call information and trusted server context. Those tools can access private application data and server services.\n\nKeep provider API keys and tool executors on the server. For direct provider connections, the browser receives a short-lived session credential or a WebRTC setup response. Your application server authenticates users and authorizes session creation and tool calls. A session credential authenticates the provider connection; it does not replace these application access checks.',
    descriptionSources: [sdkGuide('36-realtime')],
    resources: ['VoiceAgentBackend.cat', 'VoiceAgentBackend.cas', 'VoiceAgentBackend.txt'], experimental,
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
  { id: 'default', name: 'Direct input', inline: null, loaded: 'loadText' },
  { id: 'audio', name: 'Audio', inline: 'withAudio', loaded: 'loadAudio' },
  { id: 'text', name: 'Text', inline: 'withText', loaded: 'loadText' },
  { id: 'template', name: 'Template', inline: 'withTemplate', loaded: 'loadTemplate' },
  { id: 'script', name: 'Script', inline: 'withScript', loaded: 'loadScript' },
  { id: 'function', name: 'Function', inline: 'withFunction', loaded: null },
];
function sourceState(name, selected) {
  const component = getComponent(name);
  const group = component.groups.find(group => group.id === 'source');
  if (!group) return null;
  const kinds = sourceKinds.filter(kind => kind.inline === null ? component.sourceDefault === kind.id || kind.id === 'audio' && group.choices.some(choice => choice.id === kind.loaded) : group.choices.some(choice => choice.id === kind.inline));
  const current = kinds.find(kind => selected.includes(kind.inline) || kind.loaded && selected.includes(kind.loaded)) ?? kinds.find(kind => kind.id === component.sourceDefault);
  return { id: 'source', name: 'Source', kind: current?.id ?? null, affectsReference: true,
    choices: kinds.map(kind => ({ id: kind.id, name: kind.id === 'default' && group.choices.some(choice => choice.id === 'loadText') ? 'Text' : kind.name,
      description: group.choices.find(choice => choice.id === kind.inline)?.description
        ?? (kind.id === 'audio' ? component.sourceDefault === 'audio' ? 'Supply audio data directly, or enable Load media for a file path or URL.' : choices.loadAudio.description : 'Use the supplied input.') })),
    loads: { id: 'loads', name: current?.id === 'audio' ? 'Load media' : 'Load from file', active: Boolean(current?.loaded && selected.includes(current.loaded)), available: Boolean(current?.loaded && group.choices.some(choice => choice.id === current.loaded)),
      shortDescription: current?.id === 'audio' ? 'Read a file or URL using [mediaSettings](property:mediaSettings).' : 'Use the configured [loader](property:loader).',
      description: current?.id === 'audio' ? 'FFmpeg opens the file or URL and prepares its selected audio. Install node-av; no loader configuration is needed.' : 'Read the source file using the configured loader.' },
    modifier: sourceMode(selected)?.replace(/^load/, 'loads') ?? null,
    description: 'The source property keeps its name; this choice changes how its value is interpreted.',
  };
}
export function selectSource(name, selected, kind) {
  const control = sourceState(name, selected);
  const current = sourceMode(selected);
  if (control && kind === null && getComponent(name).sourceDefault === null) return current ? selectOption(name, selected, current, false) : [...selected];
  if (!control?.choices.some(choice => choice.id === kind)) throw new Error(`Unsupported ${name} source: ${kind}`);
  const choice = sourceKinds.find(choice => choice.id === kind);
  const group = getComponent(name).groups.find(group => group.id === 'source');
  const loaded = control.loads.active && group.choices.some(option => option.id === choice.loaded);
  if (!loaded && kind === getComponent(name).sourceDefault) return current ? selectOption(name, selected, current, false) : [...selected];
  return selectOption(name, selected, loaded || choice.inline === null ? choice.loaded : choice.inline);
}
export function setLoads(name, selected, active) {
  const control = sourceState(name, selected);
  if (!control?.loads.available) throw new Error(`Loading is unavailable for the selected ${name} source`);
  const choice = sourceKinds.find(choice => choice.id === control.kind);
  if (!active && choice.inline === null) return selectOption(name, selected, choice.loaded, false);
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
    choices: control.choices.map(choice => ({ ...choice, transition: transition(selected, () => selectSource(name, selected,
      getComponent(name).sourceDefault === null && control.kind === choice.id ? null : choice.id)) })),
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
  const groups = component.groups.map(group => ({ ...group, choices: group.choices.map(choice => {
    const current = group.choices.find(option => selected.includes(option.id));
    // A defaultControl presents the group's default as the checked state.
    // Unchecking selects this choice; checking clears the group's selection.
    return { ...choice, ...choice.defaultControl,
      active: choice.defaultControl ? !current : selected.includes(choice.id), available: enabled(component, choice, selected),
      unavailableReasons: unavailableReasons(component, choice, selected),
      transition: transition(selected, () => choice.defaultControl && current
        ? selectOption(name, selected, current.id, false)
        : selectOption(name, selected, choice.id, !selected.includes(choice.id))),
    };
  }).filter(choice => unavailable === 'include' || choice.available) })).filter(group => unavailable === 'include' || group.choices.length);
  return infoSections.filter(section => section.id !== 'summary').map(section => ({ id: section.id, name: section.name,
    ...(section.id === 'source' ? { control: getSourceControl(name, selected) } : { groups: groups.filter(group => section.groups ? section.groups.includes(group.id) : !grouped.includes(group.id)) }),
  }));
}
export function referenceSelection(name, selected = getComponent(name).activeOptions) {
  const component = getComponent(name);
  const defaultSource = sourceKinds.find(kind => kind.id === component.sourceDefault)?.inline;
  const options = validateOptions(name, selected).filter(id => id !== defaultSource && allChoices(component).find(choice => choice.id === id).affectsReference);
  return { component: name, id: exampleId(name, options), activeOptions: options };
}

/** Finite, deduplicated API forms for static publishers; excludes teaching choices. */
export function referenceSelections(name) {
  const names = name === undefined ? components.map(component => component.name) : [getComponent(name).name];
  return names.flatMap(component => {
    const initial = referenceSelection(component);
    const selections = new Map([[initial.id, initial]]);
    const pending = [initial];
    for (const selection of pending) {
      const transitions = getControls(component, selection.activeOptions, { unavailable: 'include' }).flatMap(section =>
        section.id === 'source'
          ? section.control ? [...section.control.choices, section.control.loads].map(choice => choice.transition) : []
          : section.groups.flatMap(group => group.choices.filter(choice => choice.affectsReference).map(choice => choice.transition)));
      for (const transition of transitions.filter(Boolean)) {
        const next = referenceSelection(component, transition.activeOptions);
        if (!selections.has(next.id)) {
          selections.set(next.id, next);
          pending.push(next);
        }
      }
    }
    return [...selections.values()];
  });
}

export async function render(name, selected, { readText } = {}) {
  const item = getComponent(name);
  const options = validateOptions(name, selected);
  const kind = sourceKind(options);
  const files = kind ? item.resources.filter(file => file.endsWith(`.${kind}`)) : !sourceMode(options) && item.inlineResource ? [item.inlineResource] : [];
  const resources = Object.fromEntries(await Promise.all(files.map(async file => [file, readText ? await readText(new URL(`./${file}`, import.meta.url)) : bundledResources[file]])));
  const module = await renderers[item.file]();
  const example = module.default(options, resources);
  return { ...example, id: exampleId(name, options), component: name, activeOptions: options, workInProgress: item.workInProgress,
    explanations: [...item.workInProgress, ...allChoices(item).filter(option => options.includes(option.id)).map(option => option.description)] };
}
