// Local explanations and adaptations. Native descriptions remain separately attributed.
const entry = (description, details = {}) => ({ description, ...details });
const cascadaModes = ['async-template', 'async-template-name', 'async-script', 'async-script-name'];
export const commonProperties = {
  telemetry: { detail: 'Telemetry' },
  timeout: { detail: 'Timeout' },
  inputAudioFormat: { detail: 'AudioFormat', origin: 'ai-sdk', nativeDocs: 'TranscriberStream_settings' },
  outputAudioFormat: { detail: 'AudioFormat' },
  fileAudioTarget: entry('Accepted encoded-file target for completed Transcriber.loadsAudio.', {
    section: 'source', scope: 'family', sourceModes: ['audio-resource'], detail: 'FileAudioTarget', origin: 'casai',
    locations: ['construction', 'run'], inheritance: 'Replaced as a whole value.',
    notes: 'Configure a native output format and encoder, optional rate/channels/sampleFormat constraints and byte/duration limits. Compatible accepted alternatives are copied before converting to the primary target. Copy compatibility and reported format use inspected native metadata, not certification of every packet; later playlist format changes may go undetected. Mutually exclusive with inputAudioFormat; unavailable on streaming transcription or Translator. Clear it when changing to .withAudio.',
  }),
  mediaSettings: entry('Native settings for opening or adapting media and selecting its audio.', {
    section: 'source', scope: 'family', sourceModes: ['audio-resource'], detail: 'MediaSettings', origin: 'casai',
    type: '{ track?: number; format?: string; options?: Record<string, string | number | boolean | bigint | null | undefined> }',
    locations: ['construction', 'run'], default: 'Native format detection and best audio stream; supplied-byte inputs deny nested protocol opens unless explicitly configured.',
    inheritance: 'Replaced as a whole object; no deep merge. Constructor undefined uses the ordinary clearing rule. Invocation undefined means omission.',
    notes: 'Configure source credentials here; SDK headers and providerOptions belong to the model request. inputAudioFormat sets the raw model target separately. Tool arguments cannot override mediaSettings. Supplied-byte preparation defaults options.protocol_whitelist to an empty string; a trusted non-null value overrides it. Paths/URLs retain native protocol defaults. No loader configuration is needed. A child changing away from .loadsAudio must clear inherited mediaSettings with undefined.',
  }),
  inputAudioTranscription: { detail: 'SessionTranscription' },
  outputAudioTranscription: { detail: 'SessionTranscription' },
  turnDetection: { detail: 'TurnDetection' },
  experimental_telemetry: entry('Deprecated alias for telemetry. Use telemetry instead.', { origin: 'ai-sdk', aliasFor: 'telemetry', detail: 'Telemetry' }),
  experimental_onStart: entry('Deprecated alias for onStart. Use onStart instead.', { origin: 'ai-sdk', aliasFor: 'onStart' }),
  experimental_onEnd: entry('Deprecated alias for onEnd. Use onEnd instead.', { origin: 'ai-sdk', aliasFor: 'onEnd' }),
  context: entry('Application defaults and private dependencies. Only inputSchema-declared fields are public defaults; other configured names remain private.', {
    section: 'common', scope: 'common', type: 'Record<string, unknown>', default: null,
    inheritance: 'Shallow merge by key. Call input overrides public defaults; it cannot replace configured private bindings.',
    notes: 'Templates, scripts and functions receive validated input plus private helpers. Direct calls take the component input; use .run({ context }) to supply extra context.',
  }),
  inputSchema: entry('Validates public application input after combining defaults and caller arguments.', {
    section: 'common', scope: 'common', type: 'Zod 4 Classic/Mini, SDK Schema, or Standard Schema for an object', default: null,
    required: 'Required for .asTool; its root must declare every public input field. Optional on ordinary components.',
    notes: 'Callers and defaults use schema input types; implementations use parsed output types. Reject undeclared tool arguments before parsing. Dynamic dictionaries belong inside a declared field. Zod 3 is not supported here.',
  }),
  toolContextSchema: entry('Validates trusted context supplied when binding or executing this tool. It becomes the native tool contextSchema.', {
    section: 'variants', scope: 'tool', toolOnly: true, type: 'Supported schema for trusted tool context', origin: 'casai', adaptation: 'Casai uses toolContextSchema to distinguish trusted tool context from public inputSchema.',
    default: null, notes: 'This is separate from model-controlled arguments. It does not make private context a public input.',
  }),
  tools: entry('Registers SDK tools. LLMAgent models may choose them; workflows and input preparers call executable tools as functions.', {
    section: 'common', scope: 'capability', type: 'Record<string, SDK Tool | null | undefined>', default: null,
    inheritance: 'Shallow merge by name; a child null entry removes an inherited tool.',
    notes: 'useTools is an example control, not an API requirement. Specialized models do not gain an LLM tool loop from preparer tools. Registered names cannot be replaced by undeclared public inputs.',
  }),
  toolsContext: entry('Supplies trusted context and declared public defaults for each registered tool.', {
    section: 'common', scope: 'capability', default: null,
    inheritance: 'Shallow merge by tool name. Bound public defaults override the tool’s configured public defaults; explicit payload fields win afterward.',
    notes: 'Supported .run() and method overrides are invocation-local. Bindings must remain compatible with each tool’s context contract.',
  }),
  debug: entry('Logs configuration and invocation data for troubleshooting.', { section: 'common', scope: 'common', default: 'false', notes: 'Logs are unredacted and can contain headers and private context.' }),
  description: entry('Describes the component’s purpose; on a tool it tells the calling model when to use it.', { section: 'common', scope: 'common', default: null }),
  filters: entry('Named functions available as Cascada filters in authored templates and scripts.', { section: 'source', scope: 'capability', sourceModes: cascadaModes, default: 'Cascada built-ins only.', inheritance: 'Shallow merge by name; child entries replace inherited entries.', notes: 'Creation-time rendering settings. This does not register model tools.' }),
  renderOptions: entry('Configures Cascada rendering and source caching.', { section: 'source', scope: 'capability', sourceModes: cascadaModes, origin: 'cascada', nested: 'RenderOptions', default: 'Standalone Template autoescape is false; AI source preparers always disable HTML escaping.', notes: 'Creation-time only. replayAsyncIterables defaults to sharing iterations; use fresh sources or disable replay for native single-use behavior.' }),
  loader: entry('Reads text, templates or scripts by name, for example from a file or URL.', {
    section: 'source', scope: 'capability', sourceModes: ['text-name', ...cascadaModes], type: 'Loader function | object with load(name) | ordered loader list', default: null,
    required: 'Required in a completed component using .loadsText, .loadsTemplate or .loadsScript. .loadsAudio uses native media loading instead.',
    inheritance: 'Child loaders run before parent loaders. undefined preserves the chain. raceParent and overrideParent explicitly change composition.',
    notes: 'An array tries loaders in order. raceLoaders tries loaders concurrently. FileSystemLoader, WebLoader, PrecompiledLoader and custom loaders remain application choices.',
  }),
  schema: entry('Parses the Script or Function return value. Stream schemas parse each complete element lazily.', { section: 'adapted', scope: 'family', type: 'Supported output schema | streamSchema(elementSchema) | textStreamSchema()', default: null, notes: 'This is not LLMAgent output, and there is no common outputSchema setting. Declared root streams are collected only during tool execution.' }),
  execute: entry('The Function implementation. Receives prepared context with parsed input, dependencies, registered helpers and _toolOptions.', { section: 'essential', scope: 'component', type: '(context: PreparedContext) => Value | PromiseLike<Value> | AsyncIterable<Element>', required: 'Required when creating the component, possibly inherited.', default: null, notes: 'The implementation is fixed at construction; ordinary and .run() calls supply context, not replacement code.' }),
  template: entry('A Cascada Template, or its file name with .loadsTemplate. Use variables, loops, conditions and macros to produce text.', { section: 'essential', scope: 'component', default: null }),
  script: entry('A Cascada Script, or its file name with .loadsScript. Its return value is the workflow result.', { section: 'essential', scope: 'component', default: null, notes: 'Independent operations run concurrently; use ! to sequence intentional effects.' }),
  model: { section: 'essential', scope: 'capability', origin: 'ai-sdk', default: null, required: 'Required in the completed component, including inherited settings.', notes: 'Choose a model that supports the component and requested operation.' },
  providerOptions: { section: 'sdk', sdkGroup: 'model', scope: 'capability', origin: 'ai-sdk', nativeDocs: 'GenerateSettings', default: null, notes: 'On model-backed components this configures the inner operation. On Template/Script/Function tools it configures the tool descriptor.' },
  headers: { section: 'sdk', sdkGroup: 'request', origin: 'ai-sdk', nativeDocs: 'GenerateSettings', default: null },
  abortSignal: entry('Cooperative cancellation for this invocation.', { section: 'invocation', scope: 'common', type: 'AbortSignal', origin: 'ai-sdk', default: null, inheritance: 'Never stored in reusable configuration.', notes: 'Pass to .run() or a supported native/method call. Forwarded to SDK execution and registered tools; arbitrary application helpers must cooperate themselves.' }),
  messageHistory: entry('Literal earlier conversation messages, followed by the newly prepared prompt. History is never rendered again.', { section: 'invocation', scope: 'family', type: 'readonly ModelMessage[]', default: null, notes: 'Positional arrays on LLMAgent are always history. Put newly authored message arrays in config.prompt or .run({ prompt }). Required context comes before positional history.' }),
  history: entry('Saved messages for continuation, including tool calls/results and approval events.', { section: 'invocation', type: 'readonly ModelMessage[]', required: 'Required by resume().', notes: 'resume skips source preparation. It does not reconstruct prior per-call settings; supply them again when needed.' }),
  approve: entry('Selects pending approvals when resuming.', { section: 'invocation', type: 'boolean | readonly string[] | null | undefined', default: null, notes: 'Omit to preserve recorded approval decisions. true approves pending requests; false denies them; an ID list approves those requests and denies other pending ones. This belongs only to resume(), not configuration or .run().' }),
  sdp: entry('The browser’s SDP offer for WebRTC session setup.', { section: 'invocation', type: 'string', required: 'Required by createWebRTCSession().' }),
  toolCallId: entry('The actual ID of the incoming realtime tool call.', { section: 'invocation', type: 'string', required: 'Required by executeTool().' }),
  toolName: entry('The registered tool to execute.', { section: 'invocation', type: 'keyof configured tools', required: 'Required by executeTool().' }),
  args: entry('The incoming raw tool arguments, validated by the bound tool runner.', { section: 'invocation', type: 'unknown', required: 'Required by executeTool().' }),
  _toolOptions: entry('Invocation metadata supplied by Casai as context._toolOptions. This is not a configuration property.', { section: 'invocation', type: 'ComponentExecutionOptions', default: null, override: 'Injected by Casai; callers cannot replace it.', nested: 'ExecutionOptions', notes: 'Casai injects actual metadata after validation. Ordinary calls have no fabricated toolCallId/messages. Application input and configuration cannot override this binding.' }),
};

export const componentProperties = {
  VideoGenerator: {
    model: entry('The video model used to generate clips.', { section: 'essential', origin: 'ai-sdk' }),
    prompt: { section: 'essential', origin: 'ai-sdk', notes: 'Use a string or the native { image, text? } object. Frame and reference settings retain native behavior; no separate image or mask aliases are added.' },
    poll: { section: 'sdk', origin: 'ai-sdk', notes: 'Delegated to the SDK. Native capability selection and warnings apply; this does not select streaming output or create a Casai job manager.' },
    webhook: { section: 'sdk', origin: 'ai-sdk', notes: 'An application-owned native webhook factory. Keep it in trusted configuration or invocation settings, outside model arguments.' },
    download: { section: 'sdk', origin: 'ai-sdk', notes: 'The native generated-video download hook. This is separate from .loadsAudio media preparation and does not introduce a general Casai loader.' },
  },
  VoiceAgentClient: {
    model: entry('The browser-compatible realtime model adapter. Keep provider API credentials on the server.', { section: 'essential', origin: 'ai-sdk' }),
    api: { section: 'essential', origin: 'ai-sdk', notes: 'Application routes own authentication and authorization. Native fetch/WebSocket restrictions apply; this component adds no custom headers, fetch implementation or authentication protocol.' },
    sessionConfig: { section: 'sdk', origin: 'ai-sdk', notes: 'Public browser preferences only. Share an explicit typed public object when useful; do not inherit the backend configuration. Replacements use whole-value semantics.' },
    onToolCall: { section: 'sdk', origin: 'ai-sdk', notes: 'The application handles local actions or calls an authorized backend executeTool route. This is a native callback, not a Casai tools registry.' },
    onEvent: { section: 'sdk', origin: 'ai-sdk' },
    onError: { section: 'sdk', origin: 'ai-sdk' },
  },
  Config: {
    mediaSettings: { locations: ['construction'] },
    inputAudioFormat: { notes: 'With .loadsAudio, this is the model target for audio conversion. mediaSettings.format describes the source container instead. The receiving component determines whether a target is required.' },
  },
  LLMAgent: {
    toModelOutput: { required: 'Optional.', notes: 'Receives the completed text or parsed structured tool value and replaces its default formatter. Ordinary calls retain the full native result; select files in an explicit Function tool when needed. Explicit formatter composition may call a base formatter.' },
    include: { detail: 'StreamInclude' },
    onAbort: entry('Called when native streaming generation is aborted, with the completed step information available at that point.', { section: 'sdk', sdkGroup: 'callbacks', origin: 'ai-sdk', operations: ['streamText'] }),
    onChunk: { section: 'sdk', sdkGroup: 'callbacks', origin: 'ai-sdk', operations: ['streamText'] },
    onError: { section: 'sdk', sdkGroup: 'callbacks', origin: 'ai-sdk', operations: ['streamText'] },
    streamRetries: { section: 'sdk', sdkGroup: 'request', origin: 'ai-sdk', operations: ['streamText'], notes: 'A streaming-only control. Casai does not add a retry loop; follow the native onError and retry contract.' },
    experimental_transform: { section: 'sdk', sdkGroup: 'request', origin: 'ai-sdk', operations: ['streamText'] },
    prompt: entry('Text to send to the model, one message object, or an array of messages. A message contains a role and content, for example { role: "user", content: "Summarize this report." }.', { default: null, section: 'essential', scope: 'component', notes: 'A Cascada Template renders message text; images, files and other non-text content pass through unchanged. A primary source is separate from a public input field named prompt. Positional message arrays supply history, not newly authored source.' }),
    output: { section: 'adapted', origin: 'ai-sdk', nested: 'Output', default: 'Output.text() behavior.', notes: 'Fixed at construction. Generation returns output; streaming returns its final promise and native partial/element views. No extra Casai output schema is applied.' },
    stopWhen: { section: 'sdk', sdkGroup: 'tools', origin: 'ai-sdk', default: 'isStepCount(20), matching ToolLoopAgent.', notes: 'The limit counts model steps, not individual tool calls; without tool activity, execution normally finishes after one step. Configuration and call settings can replace the default with isStepCount(n) or native predicates. The default is supplied before prepareCall; removing or clearing stopWhen in that hook selects the core SDK’s one-step fallback. A paused turn needs a continuation call; increasing a step limit does not approve tools.' },
    prepareCall: entry('Transforms the resolved request once before SDK execution.', { default: null, section: 'adapted', origin: 'casai', type: '(request, config, context) => Request | PromiseLike<Request>', adaptation: 'The three-argument Casai hook receives resolved configuration and prepared application context.', notes: 'Return the complete editable request. Omitted editable fields are not restored. Fixed contracts, explicit cancellation, composed observers and approval/telemetry policy remain protected. The retained history is not rewritten by the hook.' }),
    prepareStep: entry('Changes supported native settings before an SDK-scheduled model step.', { section: 'adapted', origin: 'ai-sdk', type: '(step, config, context) => NativeStepOverrides | undefined | PromiseLike<...>', adaptation: 'Retains the SDK name and partial-return contract; Casai adds resolved config and prepared context arguments.', notes: 'It does not schedule another step or restart a paused invocation. Return replacements without mutating shared configuration.' }),
    id: entry('The SDK Agent identifier.', { section: 'adapted', default: null, notes: 'Tool forms do not expose Agent identity or native generate/stream methods.' }),
  },
  Decision: {
    state: entry('The content to evaluate: text, a JSON object, or an array of text, file and JSON parts.', { section: 'essential', origin: 'ai-sdk', scope: 'component' }),
    questions: entry('Named questions describing the requested decisions: category, boolean, score, or supported spatial answer.', { section: 'essential', origin: 'ai-sdk', scope: 'component', required: 'Required in the completed component.', notes: 'Question definitions determine answer types and are fixed at construction.' }),
  },
  Embedder: {
    onStart: entry('Callback that is called when the embedding operation begins, before the embedding model is called.', { origin: 'ai-sdk', notes: 'String input uses embed; array input uses embedMany. Callback events follow the selected native operation.' }),
    onEnd: entry('Callback that is called when the embedding operation completes, after all embedding model calls return.', { origin: 'ai-sdk', notes: 'String input uses embed; array input uses embedMany. Callback events follow the selected native operation.' }),
    input: entry('A string for one embedding or a string array for a batch.', { default: null, section: 'essential', origin: 'casai', scope: 'component', adaptation: 'Mapped to native embed({ value }) or embedMany({ values }); native results are preserved.', notes: 'Inline templates produce one string. Script/function preparers may produce arrays. Configured input permits a no-replacement .run().' }),
    maxParallelCalls: { section: 'sdk', sdkGroup: 'operation', origin: 'ai-sdk', notes: 'Relevant to array input. Casai does not add its own batching or concurrency loop.' },
  },
  Reranker: {
    query: entry('The search text used to rank documents by relevance.', { section: 'essential', origin: 'ai-sdk', adaptation: 'A script or function can supply both the query and documents in one return value.' }),
    documents: entry('Candidate strings or native structured documents to rank.', { section: 'essential', origin: 'ai-sdk', required: 'Must be available by invocation. A plain tool needs configured documents; a preparer can supply the complete query/documents pair.', inheritance: 'Invocation documents override prepared documents, which override configured candidates.' }),
    topN: { section: 'sdk', sdkGroup: 'operation', origin: 'ai-sdk', notes: 'Available as a positional tail or .run() setting; it is not a public plain-tool argument.' },
  },
  ImageGenerator: {
    prompt: entry('An image description, or an object containing text, images and an optional mask. A Cascada Template renders the text; images and masks pass through unchanged.', { section: 'essential', origin: 'ai-sdk', required: 'Text or effective reference images must resolve by invocation.', adaptation: 'Separate configured/invocation media can be composed with text or prepared prompts.', notes: 'An untouched complete bundle owns its media. Explicit invocation images/mask override it. Use .run() to select structured authored source unambiguously on tools.' }),
    images: entry('Reference images for generation or editing.', { default: null, section: 'adapted', origin: 'casai', adaptation: 'Top-level convenience for the native prompt.images field.', inheritance: 'Constructor values use ordinary replacement and may retain an inherited separate mask. Invocation images replace prior images and drop the previous mask unless that call supplies one.', notes: 'An empty invocation array clears references; undefined retains them. Text-only updates keep existing media. Complete native bundles retain native empty-array behavior.' }),
    mask: entry('An edit mask accompanying reference images; conventions depend on the model.', { default: null, section: 'adapted', origin: 'casai', adaptation: 'Top-level convenience for native prompt.mask.', inheritance: 'Mask-only updates retain images. New invocation images drop the old mask unless the call supplies a defined replacement.', notes: 'A separate mask requires at least one reference image. Providers own mask encoding and editing support.' }),
  },
  Transcriber: {
    download: { sourceModes: ['text', 'async-script', 'function', 'async-script-name'], notes: 'Native encoded-file URL download only, with SDK address/redirect and byte-limit handling. The inspected default is 2 GiB; always set an application-appropriate maxBytes for model-selected URLs. Excluded from raw streaming and .loadsAudio, which uses FFmpeg.' },
    audio: entry('Encoded recording bytes/ArrayBuffer, base64 or a native URL without inputAudioFormat; raw bytes/ArrayBuffer or a fresh native stream with inputAudioFormat.', { section: 'essential', origin: 'ai-sdk', notes: 'Node Buffer is a Uint8Array. Raw bytes must match the declared format. A raw stream without a format is invalid. Native URL objects use the SDK downloader; strings remain encoded audio. .loadsAudio prepares paths/URLs or supplied encoded bytes/byte streams with FFmpeg. .withAudio resets inherited preparation. Plain model tool arguments use URLs through the SDK downloader. .loadsAudio.asTool requires configured audio, including inheritance; model arguments cannot replace it. Trusted ordinary/run calls retain explicit source overrides. Explicit Function/Script workflows handle dynamic native resources and application-defined payloads.' }),
    inputAudioFormat: { section: 'adapted', origin: 'ai-sdk', required: 'Required by invocation for raw input unless configured. Raw-input tools require it in finished configuration.', notes: 'On ordinary Transcriber, this setting selects native streaming execution and a completed transcript. Direct raw input must already match the format. .loadsAudio converts to this explicit target; mediaSettings.format describes the source container instead. Completed raw ComponentConfig annotations require this selector.' },
  },
  SpeechGenerator: {
    text: { section: 'essential', origin: 'ai-sdk', nativeDocs: 'SpeechGeneratorStream_settings', detail: 'SpeechTextPart', appliesTo: 'Each text part in an iterable or stream', notes: 'A script or function preparer may return a fresh text stream. Non-string input requires native streaming support; an ordinary call collects the generated audio into a file. Text-part objects belong inside an iterable or stream.' },
    outputFormat: entry('A format string for native generateSpeech, or an audio-format object for native streaming.', { section: 'sdk', sdkGroup: 'output', origin: 'ai-sdk', detail: 'SpeechAudioFormat', appliesTo: 'Object format', notes: 'With string text, omitting the format or using a string selects generateSpeech. An object, such as { type: "audio/pcm", rate: 24000 }, selects streaming execution and a completed audio file. With iterable/streamed text, use an object or omit the format. To use a streaming-only model with string text, supply an object format. Supported formats depend on the provider.' }),
  },
  SpeechGeneratorStream: {
    text: { section: 'essential', origin: 'ai-sdk', detail: 'SpeechTextPart', appliesTo: 'Each text part in an iterable or stream', notes: 'A script or function preparer may return a fresh text stream. Text-part objects belong inside an iterable or stream.' },
    outputFormat: { section: 'sdk', sdkGroup: 'output', origin: 'ai-sdk', detail: 'SpeechAudioFormat', notes: '.asStream selects native streaming even when outputFormat is omitted. Format strings such as "mp3" belong to native generateSpeech; use an object here.' },
  },
  Translator: {
    toModelOutput: { required: 'Optional, including on finished tools.', notes: 'The default sends only translationText to the model. The execution result retains source/translated text and serialized audio for the application and custom formatter. Audio-only output may give empty model text; optionally package audio using its actual known layout. No format guessing, mandatory formatter or new missing-text error.' },
    audio: entry('Raw audio bytes/ArrayBuffer or a fresh ReadableStream of Uint8Array or base64 chunks.', { section: 'essential', origin: 'ai-sdk', notes: 'A completed result requires finite input and native completion. Bytes match inputAudioFormat; use .loadsAudio or an explicit preparer to decode encoded recordings. Configured finite bytes can be reused; configured streams remain single-use.' }),
    inputAudioFormat: { section: 'essential', origin: 'ai-sdk', required: 'Required by invocation unless configured; required in finished tool configuration.', notes: 'Direct raw input must already match the format. .loadsAudio converts to this explicitly supplied target.' },
    targetLanguage: { section: 'essential', origin: 'ai-sdk', required: 'Required by invocation unless configured; required in finished tool configuration.' },
  },
  VoiceAgentBackend: {
    model: entry('The realtime model used to set up the voice session.', { section: 'essential', origin: 'ai-sdk' }),
    instructions: entry('Instructions for the voice assistant, supplied by the server.', { section: 'essential', origin: 'ai-sdk', default: null, required: 'Optional in the direct form. Prepared forms need source in configuration or invocation.' }),
    tools: entry('Tools offered in the session and executable through the server’s executeTool adapter.', { section: 'common', origin: 'casai', notes: 'Prepared definitions are omitted when empty. Nonempty tools retain provider capability errors. Client-supplied preferences must not replace server-owned tool policy.' }),
    expiresAfterSeconds: entry('Requests the client-secret lifetime supported by the model.', { section: 'sdk', sdkGroup: 'operation', origin: 'ai-sdk', operations: ['doCreateClientSecret'], notes: 'Applies to ordinary/token calls, not to session configuration or WebRTC negotiation.' }),
  },
};

componentProperties.TranscriberStream = {
  inputAudioFormat: componentProperties.Transcriber.inputAudioFormat,
  audio: entry('Raw audio bytes/ArrayBuffer or a fresh ReadableStream of Uint8Array or base64 chunks.', { section: 'essential', origin: 'ai-sdk', notes: 'Encoded file data requires .loadsAudio or an explicit preparer. Reusing a known ReadableStream through Casai is rejected. Finite bytes are wrapped in a fresh stream per invocation.' }),
};
componentProperties.TranslatorStream = {
  audio: componentProperties.Translator.audio,
  inputAudioFormat: componentProperties.Translator.inputAudioFormat,
  targetLanguage: componentProperties.Translator.targetLanguage,
};

export const sdkPropertyGroups = {
  model: ['providerOptions', 'runtimeContext', 'telemetry', 'experimental_telemetry'],
  output: ['output', 'outputFormat', 'outputAudioFormat', 'include', 'includeRawChunks'],
  tools: ['toolChoice', 'activeTools', 'toolOrder', 'toolCallConcurrency', 'toolApproval', 'experimental_toolCallers', 'experimental_toolApprovalSecret', 'experimental_sandbox', 'experimental_steering', 'repairToolCall', 'experimental_refineToolInput', 'stopWhen'],
  callbacks: ['onStart', 'onEnd', 'onStepStart', 'onStepEnd', 'onStepError', 'onLanguageModelCallStart', 'onLanguageModelCallEnd', 'onToolExecutionStart', 'onToolExecutionEnd', 'onChunk', 'onError', 'onAbort', 'experimental_onStart', 'experimental_onEnd'],
  request: ['headers', 'maxRetries', 'timeout', 'download', 'experimental_download', 'streamRetries', 'experimental_transform'],
};
