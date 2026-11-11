// Documentation choices describe API contracts, independently of example constraints.
const native = (operation, result, details = {}) => ({ operation, result, ...details });
const nativeContext = { options: { description: 'Application input for Casai context validation. Required exactly when configured public defaults do not satisfy inputSchema.' } };
const historyResult = [{ name: 'messageHistory', type: 'ModelMessage[]', description: 'Original conversation plus native response messages. This is the only result property added by Casai.' }];
const streamedHistoryResult = [{ name: 'messageHistory', type: 'Promise<ModelMessage[]>', description: 'Resolves to the original conversation plus native response messages, independently of output parsing. It shares the same execution.' }];
const recordedAudio = 'Uint8Array | ArrayBuffer | ReadableStream<string | Uint8Array>';
export const componentReference = {
  Config: {
    kind: 'configuration', input: 'A partial configuration and an optional compatible parent.',
    resultSummary: 'A reusable configuration object. It performs no model or workflow execution.',
    concepts: ['inheritance', 'configuration', 'schemas'],
    propertyShapes: ['Template_config'], omit: ['template', 'promptType'],
    fragment: true,
    methods: [
      { name: 'Config', signature: 'Config(settings, parent?)', description: 'Creates a reusable fragment. Missing required settings are checked on the eventual component; the merged settings must fit one compatible component shape.' },
      { name: 'config', signature: 'fragment.config', description: 'The resolved reusable fragment. Pass the fragment as a parent; treat captured configuration as immutable.' },
    ],
  },
  Context: {
    propertyShapes: [],
    kind: 'concept', input: 'An application object containing public defaults and private dependencies.',
    resultSummary: 'Context is data passed to a component, not a factory or callable component.',
    concepts: ['context', 'schemas', 'effects', 'tools'],
    relatedProperties: ['context', 'inputSchema', 'toolContextSchema', 'toolsContext', '_toolOptions'],
    methods: [],
  },
  Template: {
    input: 'A Cascada template and application context.', resultSummary: 'A completed string.',
    resultDescription: 'Renders Nunjucks-style variables, loops, conditions and macros. Independent expressions may run concurrently. Template streaming is not implemented.',
    toolResult: 'The rendered string.', concepts: ['sources', 'context', 'effects', 'inheritance', 'tools'],
    call: 'template(context?) or template(source, context?)', coded: true,
  },
  Script: {
    input: 'A Cascada script and application context.', resultSummary: 'The returned value, parsed by schema when supplied.',
    resultDescription: 'Script implements workflow logic. Independent operations run concurrently. A returned JavaScript iterable can use streamSchema or textStreamSchema; native Cascada stream channels are not exposed here.',
    toolResult: 'The parsed return value. A declared finite root stream is collected into a string or array.',
    concepts: ['sources', 'context', 'effects', 'streams', 'inheritance', 'tools'], call: 'script(context?) or script(source, context?)', coded: true,
  },
  Function: {
    input: 'Parsed application input plus configured private dependencies.', resultSummary: 'The JavaScript return value, awaited and parsed by schema when supplied.',
    resultDescription: 'execute receives one prepared context object, including registered helpers and _toolOptions. It may be synchronous, asynchronous, or return a schema-declared stream.',
    toolResult: 'The parsed return value; declared finite streams are collected for tool execution.',
    concepts: ['context', 'schemas', 'streams', 'effects', 'inheritance', 'tools'], call: 'fn(context?)', coded: true, fixedImplementation: true,
  },
  LLMAgent: {
    ...native('generateText', 'LLMAgent'), input: 'New prompt content, application context and optional literal conversation history.',
    resultSummary: 'The native SDK result with parsed output and Casai messageHistory.',
    resultDescription: 'output is text unless an SDK Output specification selects another value. Casai adds messageHistory; other result fields and methods retain native behavior. Output validity does not prove that every tool task finished.',
    toolResult: 'The completed parsed output. Paused, unfinished or stop-condition-cut-off inner workflows fail tool execution. Ordinary calls on the tool still return the native result.',
    concepts: ['context', 'sources', 'history', 'hooks', 'steps', 'tools', 'inheritance', 'errors'],
    call: 'agent(prompt?, context?, messageHistory?)', contextPositional: true, positional: ['messageHistory'],
    runShape: 'AgentRun', nativeDocs: 'StreamSettings',
    additionalResults: historyResult,
    variants: [{ requires: { stream: ['asStream'] }, operation: 'streamText', summaryOperation: 'streamText', result: 'LLMAgentStream', streamModifier: true,
      resultSummary: 'A live SDK result; consume its streams and await final output and history.',
      resultDescription: 'textStream, partialOutputStream, elementStream and execution events share one native execution. Partial values do not establish whole-result validity. messageHistory resolves independently of output parsing.',
      additionalResults: streamedHistoryResult }],
    methods: [
      { name: 'id', kind: 'property', signature: 'agent.id', description: 'The configured SDK Agent ID, or undefined.', requires: { tool: [null] } },
      { name: 'version', kind: 'property', signature: 'agent.version', description: 'The native Agent protocol marker: agent-v1.', requires: { tool: [null] } },
      { name: 'tools', kind: 'property', signature: 'agent.tools', description: 'The prepared native tool registry used by Agent integrations.', requires: { tool: [null] } },
      { name: 'resume', signature: 'agent.resume(history, { context?, approve?, ...overrides }?)', description: 'Continues a saved conversation without preparing another source. It also supports provider pauses and deferred results; tools are needed only for the approval example. Supply required raw context and any per-call overrides again.', properties: ['history', 'approve'], settings: 'run', omit: ['prompt', 'messageHistory'], requires: { tool: [null] } },
      { name: 'generate', signature: 'agent.generate({ prompt? | messages?, options?, ...settings })', description: 'Runs the native SDK Agent generation method. Content is literal: source loading/rendering is skipped. options supplies application input and still passes through Casai context validation and hooks.', shape: 'NativeGenerate', argumentOverrides: nativeContext, resultShape: 'LLMAgent_result', additionalProperties: historyResult, requires: { tool: [null] } },
      { name: 'stream', signature: 'agent.stream({ prompt? | messages?, options?, ...settings })', description: 'Runs the native streaming Agent method, even when ordinary calls use generation. It shares the same validated context and hooks and skips source preparation.', shape: 'NativeStream', argumentOverrides: nativeContext, resultShape: 'LLMAgentStream_result', additionalProperties: streamedHistoryResult, requires: { tool: [null] } },
    ],
  },
  Decision: {
    ...native('experimental_decide', 'Decision'), input: 'A state and configured named questions.',
    resultSummary: 'Typed answers and native decision metadata.',
    resultDescription: 'Question definitions select classification, boolean, score or spatial answers. The actual question types and supported state parts belong to the selected model.',
    toolResult: 'The answers object.', concepts: ['sources', 'context', 'tools', 'inheritance'], call: 'decide(state) or decide(context)',
  },
  Embedder: {
    ...native('embed / embedMany', 'Embedder'), input: 'One text or an array of texts.', resultSummary: 'One embedding or a list of embeddings, plus native metadata.',
    resultDescription: 'A string selects embed and returns embedding. An array selects embedMany and returns embeddings. Source preparation does not select the operation; its resulting input does.',
    resultShapes: ['Embedder', 'EmbedderBatch'], toolResult: 'The vector or array of vectors.',
    concepts: ['sources', 'context', 'tools', 'inheritance'], call: 'embed(input) or embed(context)',
  },
  Reranker: {
    ...native('rerank', 'Reranker'), input: 'A query, candidate documents and optional result limit.', resultSummary: 'Native ranking entries with original indexes, documents and relevance scores.',
    toolResult: 'The ranking entries.', concepts: ['sources', 'context', 'tools', 'inheritance'],
    call: 'rank(query, documents?, topN?) or rank(context, documents?, topN?)', positional: ['documents', 'topN'],
  },
  ImageGenerator: {
    ...native('generateImage', 'ImageGenerator'), input: 'Text or a native image prompt, with optional reference images, mask and count.',
    resultSummary: 'Generated images and the native generation metadata.', toolResult: 'Files as { mediaType, base64 }[]. The model receives image content unless toModelOutput changes the projection.',
    concepts: ['sources', 'context', 'image-media', 'tools', 'inheritance'],
    call: 'draw(text?, images?, mask?, n?) or draw(context, images?, mask?, n?)', positional: ['images', 'mask', 'n'],
  },
  Transcriber: {
    ...native('transcribe', 'Transcriber'), input: 'A recording as encoded data or a URL.', resultSummary: 'Transcript text, segments, language, duration and native metadata.',
    toolResult: 'Only text, segments, language and durationInSeconds; the model receives transcript text.',
    concepts: ['sources', 'context', 'audio', 'tools', 'inheritance'], call: 'transcribe(audio) or transcribe(context)',
    variants: [{ requires: { stream: ['asStream'] }, factory: 'StreamingTranscriber', types: 'StreamingTranscriber', activeOptions: ['asStream'],
      summaryOperation: 'experimental_streamTranscribe', ...native('experimental_streamTranscribe', 'StreamingTranscriber'),
      input: 'A fresh raw-audio stream and its input format.',
      resultSummary: 'Native transcription events and final transcript promises.',
      resultDescription: 'Ordinary calls return the live result. Prepared tool execution opens bounded audio and returns the completed transcript. For whole recordings prefer complete Transcriber.',
      call: 'transcribe(audio, inputAudioFormat?) or transcribe(context, inputAudioFormat?)', positional: ['inputAudioFormat'],
    }],
  },
  SpeechGenerator: {
    ...native('generateSpeech', 'SpeechGenerator'), input: 'A complete text string and optional voice.', resultSummary: 'A generated audio file and native metadata.',
    toolResult: 'A file as { mediaType, base64 }; the model receives a short confirmation.',
    concepts: ['sources', 'context', 'audio', 'tools', 'inheritance'], call: 'speak(text, voice?) or speak(context, voice?)', positional: ['voice'],
    variants: [{ requires: { stream: ['asStream'] }, factory: 'StreamingSpeechGenerator', types: 'StreamingSpeechGenerator', activeOptions: ['asStream'],
      summaryOperation: 'experimental_streamSpeech', ...native('experimental_streamSpeech', 'StreamingSpeechGenerator'), input: 'A text string, iterable or stream of text deltas/parts; optional voice.',
      resultSummary: 'Live audio events and final native metadata.',
      resultDescription: 'outputFormat is a native audio-format object, not the complete operation’s format string. Suitable script/function preparers may return streamed text even though the example uses direct text input.',
    }],
  },
  Translator: {
    ...native('experimental_streamTranslate (one execution, collected)', null), types: 'StreamingTranslator',
    status: 'planned', input: 'Finite prerecorded raw audio bytes or a stream that ends, its format and target language.',
    resultSummary: 'Planned: completed audio bytes, final source/translated text and native final metadata.',
    resultDescription: 'The planned complete adapter consumes one native fullStream before reading final values. It collects audio as Uint8Array and preserves native error/completion semantics. It adds no errors array and infers no media type.',
    concepts: ['sources', 'context', 'audio', 'translation', 'inheritance'],
    call: 'translate(audio, inputAudioFormat?, targetLanguage?) or translate(context, inputAudioFormat?, targetLanguage?)', positional: ['inputAudioFormat', 'targetLanguage'],
    inputTypes: { direct: recordedAudio, prepared: recordedAudio },
    overrides: { audio: { description: 'Planned finite recorded input. A stream must end. Bytes are raw audio matching inputAudioFormat; encoded containers require explicit preparation.' } },
    omit: ['includeRawChunks'],
    additionalResults: [
      { name: 'audio', type: 'Uint8Array', description: 'Collected translated audio bytes. Empty on a native text-only success; no media type is inferred.' },
      { name: 'sourceText', type: 'string', description: 'The authoritative final source text from the same native execution.' },
      { name: 'translationText', type: 'string', description: 'The authoritative final translated text.' },
      ...['durationInSeconds', 'usage', 'warnings', 'response', 'providerMetadata'].map(name => ({ name, type: `Awaited<Experimental_StreamTranslationResult['${name}']>`, description: 'The resolved native final field, without a second execution or a new result contract.' })),
    ],
    variants: [{ requires: { stream: ['asStream'] }, factory: 'StreamingTranslator', status: 'implemented', activeOptions: ['asStream'], omit: [], overrides: {}, inputTypes: {}, additionalResults: [],
      summaryOperation: 'experimental_streamTranslate', ...native('experimental_streamTranslate', 'StreamingTranslator'), input: 'A fresh raw-audio stream, its format and a target language.',
      resultSummary: 'Live translated audio/text events and native final promises.',
      resultDescription: 'Use one consumer of fullStream. Reading a final promise first can consume the underlying stream. Current input is a native stream; finite-byte admission is planned.',
    }],
  },
  VoiceSessionSetup: {
    ...native('doCreateClientSecret', 'VoiceSessionSetup'), input: 'Server-owned instructions, model, session preferences and optional tools.',
    resultSummary: 'Client-secret information plus prepared tool definitions.',
    resultDescription: 'Ordinary calls and run create a client secret where the model supports it. Token, WebRTC and Live capabilities differ by provider. The application owns transport, authentication and matching server context.',
    concepts: ['sources', 'context', 'voice-session', 'tools', 'inheritance'], call: 'setup(instructions?) or setup(context)', preparedSourceRequired: true,
    variants: [
      { requires: { invocation: ['prepareSession'] }, operation: 'prepareSessionConfig', result: 'VoiceSessionConfig',
        resultSummary: 'Prepared native session configuration, including instructions and tool definitions.',
        resultDescription: 'Returns session configuration without opening a provider session. Empty tool definitions are omitted. The application supplies it to the supported session transport.',
      },
      { requires: { invocation: ['webRTC'] }, operation: 'doCreateWebRTCSession', result: 'VoiceWebRTC',
        input: 'A browser SDP offer, server-owned instructions, session preferences and optional tools.',
        resultSummary: 'The native WebRTC session result, including the SDP answer.',
        resultDescription: 'Pass the returned SDP answer to the browser peer connection. The provider owns the result fields and capability errors; the application owns transport and authentication.',
      },
    ],
    methods: [
      { name: 'prepareSessionConfig', signature: 'setup.prepareSessionConfig(settings?)', description: 'Prepares instructions and tool definitions without opening a provider session. Empty tool definitions are omitted.', settings: 'run', omit: ['expiresAfterSeconds'], resultShape: 'SessionConfig' },
      { name: 'createWebRTCSession', signature: 'setup.createWebRTCSession({ sdp, ...settings })', description: 'Answers a browser SDP offer using the configured model. Unsupported providers retain their native error.', settings: 'run', omit: ['expiresAfterSeconds'], properties: ['sdp'], resultShape: 'VoiceWebRTC_result' },
      { name: 'executeTool', signature: 'setup.executeTool({ toolCallId, toolName, args }, { toolsContext?, abortSignal? }?)', description: 'Validates and executes a registered tool with the real call metadata. Returns the tool execution value without language-model toModelOutput formatting. Applications own HTTP transport and map undefined results to JSON null.', properties: ['toolCallId', 'toolName', 'args', 'toolsContext', 'abortSignal'] },
    ],
  },
};

export const sourceKinds = [
  { id: 'default', name: 'Default', inline: null, loaded: null },
  { id: 'template', name: 'Template', inline: 'withTemplate', loaded: 'loadTemplate' },
  { id: 'script', name: 'Script', inline: 'withScript', loaded: 'loadScript' },
  { id: 'function', name: 'Function', inline: 'withFunction', loaded: null },
];

export const sourceModes = {
  text: { name: 'Direct input', value: 'direct', description: 'Use the native operation input without rendering it.' },
  'text-name': { name: 'Loaded text', value: 'resource', description: 'Load a text resource and use its content literally.' },
  'async-template': { name: 'Template', value: 'template', description: 'Render explicit text slots using Cascada’s Nunjucks-style syntax. Non-text native parts keep their shape.' },
  'async-template-name': { name: 'Loaded template', value: 'resource', description: 'Load a .cat resource and render it with the application context.' },
  'async-script': { name: 'Script', value: 'script', description: 'Run Cascada orchestration logic; independent operations run concurrently. Return the native operation input.' },
  'async-script-name': { name: 'Loaded script', value: 'resource', description: 'Load a .cas resource and run its logic to produce the operation input.' },
  function: { name: 'Function', value: 'function', description: 'Call a JavaScript function with prepared context; await its returned native operation input.' },
};

export const infoSections = [
  { id: 'summary', name: 'Component' },
  { id: 'variants', name: 'Variants', groups: ['tool', 'stream'] },
  { id: 'source', name: 'Source', groups: ['source'] },
  { id: 'features', name: 'Capabilities and features' },
  { id: 'invocation', name: 'Invocation', groups: ['invocation', 'conversation'] },
];
export const configSections = [
  ['variants', 'Variant configuration'], ['essential', 'Primary property and essential setup'],
  ['source', 'Source preparation'], ['common', 'Common Casai configuration'],
  ['adapted', 'Component-specific and adapted behavior'], ['sdk', 'Remaining AI SDK properties'], ['invocation', 'Invocation reference'],
].map(([id, name]) => ({ id, name }));
export const sdkGroups = [
  ['operation', 'Operation settings'], ['model', 'Model and provider settings'], ['output', 'Output'],
  ['tools', 'Tool execution'], ['callbacks', 'Callbacks'], ['request', 'Request controls'],
].map(([id, name]) => ({ id, name }));
