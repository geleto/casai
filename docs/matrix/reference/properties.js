// Local explanations and adaptations. Native descriptions remain separately attributed.
const entry = (description, details = {}) => ({ description, ...details });
export const commonProperties = {
  context: entry('Application defaults and private dependencies. Only inputSchema-declared fields are public defaults; other configured names remain private.', {
    section: 'common', scope: 'common', type: 'Record<string, unknown>', default: 'No configured bindings.',
    inheritance: 'Shallow merge by key. Call input overrides public defaults; it cannot replace configured private bindings.',
    notes: 'Prepared bodies receive parsed input plus private dependencies. Plain specialized shorthand takes native input; use .run({ context }) for additional application input.',
  }),
  inputSchema: entry('Parses public application input after defaults and direct/model arguments are merged. It does not validate every setting or the authored source.', {
    section: 'common', scope: 'common', type: 'Zod 4 Classic/Mini, SDK Schema, or Standard Schema for an object', default: 'No application parser.',
    required: 'Required for .asTool; its root must declare every public input field. Optional on ordinary components.',
    notes: 'Callers and defaults use schema input types; implementations use parsed output types. Reject undeclared tool arguments before parsing. Dynamic dictionaries belong inside a declared field. Zod 3 is not supported here.',
  }),
  toolContextSchema: entry('Validates trusted context supplied when binding or executing this tool. It becomes the native tool contextSchema.', {
    section: 'variants', scope: 'tool', type: 'Supported schema for trusted tool context', origin: 'casai', adaptation: 'Casai uses toolContextSchema to distinguish trusted tool context from public inputSchema.',
    default: 'No trusted-context schema.', notes: 'This is separate from model-controlled arguments. It does not make private context a public input.',
  }),
  tools: entry('Registers SDK tools. LLMAgent models may choose them; workflows and input preparers call executable tools as functions.', {
    section: 'common', scope: 'capability', type: 'Record<string, SDK Tool | null | undefined>', default: 'No registered tools.',
    inheritance: 'Shallow merge by name; a child null entry removes an inherited tool.',
    notes: 'useTools is an example control, not an API requirement. Specialized models do not gain an LLM tool loop from preparer tools. Registered names cannot be replaced by undeclared public inputs.',
  }),
  toolsContext: entry('Supplies trusted context and declared public defaults for each registered tool.', {
    section: 'common', scope: 'capability', default: 'No additional per-tool bindings.',
    inheritance: 'Shallow merge by tool name. Bound public defaults override the tool’s configured public defaults; explicit payload fields win afterward.',
    notes: 'Supported .run() and method overrides are invocation-local. Bindings must remain compatible with each tool’s context contract.',
  }),
  debug: entry('Logs configuration and invocation data for troubleshooting.', { section: 'common', scope: 'common', default: 'false', notes: 'Logs are unredacted and can contain headers and private context.' }),
  description: entry('Describes the component’s purpose; on a tool it tells the calling model when to use it.', { section: 'variants', scope: 'common', default: 'No description.' }),
  filters: entry('Named functions available as Cascada filters in authored templates and scripts.', { section: 'source', scope: 'capability', default: 'Cascada built-ins only.', inheritance: 'Shallow merge by name; child entries replace inherited entries.', notes: 'Creation-time rendering settings. This does not register model tools.' }),
  renderOptions: entry('Configures Cascada rendering and source caching.', { section: 'source', scope: 'capability', origin: 'cascada', nested: 'RenderOptions', default: 'Standalone Template autoescape is false; AI source preparers always disable HTML escaping.', notes: 'Creation-time only. replayAsyncIterables defaults to sharing iterations; use fresh sources or disable replay for native single-use behavior.' }),
  loader: entry('Resolves a resource name for loaded text, templates or scripts.', {
    section: 'source', scope: 'capability', type: 'Loader function | object with load(name) | ordered loader list', default: 'No loader.',
    required: 'Required in a completed component using a loads… source modifier.',
    inheritance: 'Child loaders run before parent loaders. undefined preserves the chain. raceParent and overrideParent explicitly change composition.',
    notes: 'An array tries loaders in order. raceLoaders tries loaders concurrently. FileSystemLoader, WebLoader, PrecompiledLoader and custom loaders remain application choices.',
  }),
  promptType: entry('Records how the primary property is interpreted.', { section: 'source', scope: 'capability', notes: 'Prefer source modifiers. A base factory inherits the parent’s mode; an explicit source modifier selects another mode. The property’s name remains unchanged.' }),
  asTool: entry('Selects a component that can be exposed as an SDK tool.', { section: 'variants', scope: 'tool', default: 'Not enabled.', notes: 'Prefer .asTool. Derived components retain tool mode; there is no reverse modifier. Ordinary calls still have their ordinary result contract.' }),
  streaming: entry('Selects the live result for ordinary LLMAgent calls, .run() and resume().', { section: 'variants', scope: 'family', default: 'Generation.', notes: 'Prefer .asStream. Native generate() and stream() remain available on non-tool agents regardless of this default.' }),
  schema: entry('Parses the Script or Function return value. Stream schemas parse each complete element lazily.', { section: 'adapted', scope: 'family', type: 'Supported output schema | streamSchema(elementSchema) | textStreamSchema()', default: 'Return the implementation’s value unchanged.', notes: 'This is not LLMAgent output, and there is no common outputSchema setting. Declared root streams are collected only during tool execution.' }),
  execute: entry('The Function implementation. Receives prepared context with parsed input, dependencies, registered helpers and _toolOptions.', { section: 'essential', scope: 'component', type: '(context: PreparedContext) => Value | PromiseLike<Value> | AsyncIterable<Element>', required: 'Required when creating the component, possibly inherited.', default: 'None.', notes: 'The implementation is fixed at construction; ordinary and .run() calls supply context, not replacement code.' }),
  template: entry('Trusted Cascada template source, or a resource name with loadsTemplate. Uses Nunjucks-style variables, loops, conditions and macros.', { section: 'essential', scope: 'component', default: 'None.' }),
  script: entry('Trusted Cascada orchestration code, or a resource name with loadsScript. Return the workflow’s application result.', { section: 'essential', scope: 'component', default: 'None.', notes: 'Independent operations run concurrently; use ! to sequence intentional effects.' }),
  model: { section: 'essential', scope: 'capability', origin: 'ai-sdk', default: 'None.', required: 'Required in the completed component, including inherited settings.', notes: 'The name model does not make language, embedding, image, speech, transcription, translation and realtime models interchangeable. Provider capabilities still apply.' },
  providerOptions: { section: 'sdk', sdkGroup: 'model', scope: 'capability', origin: 'ai-sdk', nativeDocs: 'GenerateSettings', default: 'No provider-specific overrides.', notes: 'On model-backed components this configures the inner operation. On Template/Script/Function tools it configures the tool descriptor.' },
  headers: { section: 'sdk', sdkGroup: 'request', origin: 'ai-sdk', nativeDocs: 'GenerateSettings', default: 'No extra request headers.' },
  abortSignal: entry('Cooperative cancellation for this invocation.', { section: 'invocation', scope: 'common', type: 'AbortSignal', origin: 'ai-sdk', default: 'No caller signal.', inheritance: 'Never stored in reusable configuration.', notes: 'Pass to .run() or a supported native/method call. Forwarded to SDK execution and registered tools; arbitrary application helpers must cooperate themselves.' }),
  messageHistory: entry('Literal earlier conversation messages. History is appended to the newly prepared prompt, never rendered again.', { section: 'invocation', scope: 'family', type: 'readonly ModelMessage[]', default: 'No earlier messages.', notes: 'Positional arrays on LLMAgent are always history. Put newly authored message arrays in config.prompt or .run({ prompt }). Required context comes before positional history.' }),
  history: entry('Saved messages for continuation, including tool calls/results and approval events.', { section: 'invocation', type: 'readonly ModelMessage[]', required: 'Required by resume().', notes: 'resume skips source preparation. It does not reconstruct prior per-call settings; supply them again when needed.' }),
  approve: entry('Selects pending approvals when resuming.', { section: 'invocation', type: 'boolean | readonly string[] | null | undefined', default: 'undefined: preserve recorded approval decisions.', notes: 'true approves pending requests; false denies them; an ID list approves those requests and denies other pending ones. This belongs only to resume(), not configuration or .run().' }),
  sdp: entry('The browser’s SDP offer for WebRTC session setup.', { section: 'invocation', type: 'string', required: 'Required by createWebRTCSession().' }),
  toolCallId: entry('The actual ID of the incoming realtime tool call.', { section: 'invocation', type: 'string', required: 'Required by executeTool().' }),
  toolName: entry('The registered tool to execute.', { section: 'invocation', type: 'keyof configured tools', required: 'Required by executeTool().' }),
  args: entry('The incoming raw tool arguments, validated by the bound tool runner.', { section: 'invocation', type: 'unknown', required: 'Required by executeTool().' }),
  _toolOptions: entry('Invocation metadata available inside prepared context.', { section: 'invocation', nested: 'ExecutionOptions', notes: 'Casai injects actual metadata after validation. Ordinary calls have no fabricated toolCallId/messages. Application input and configuration cannot override this binding.' }),
};

export const componentProperties = {
  LLMAgent: {
    onAbort: entry('Called when native streaming generation is aborted, with the completed step information available at that point.', { section: 'sdk', sdkGroup: 'callbacks', origin: 'ai-sdk', operations: ['streamText'] }),
    onChunk: { section: 'sdk', sdkGroup: 'callbacks', origin: 'ai-sdk', operations: ['streamText'] },
    onError: { section: 'sdk', sdkGroup: 'callbacks', origin: 'ai-sdk', operations: ['streamText'] },
    streamRetries: { section: 'sdk', sdkGroup: 'request', origin: 'ai-sdk', operations: ['streamText'], notes: 'A streaming-only control. Casai does not add a retry loop; follow the native onError and retry contract.' },
    experimental_transform: { section: 'sdk', sdkGroup: 'request', origin: 'ai-sdk', operations: ['streamText'] },
    prompt: entry('New content for this invocation. Direct and inline-template forms accept a string, one ModelMessage, or a message array; scripts/functions return the same native shapes.', { section: 'essential', scope: 'component', notes: 'Templates render explicit text slots only. A primary source is separate from a public input field named prompt. Positional message arrays supply history, not newly authored source.' }),
    output: { section: 'adapted', origin: 'ai-sdk', nested: 'Output', default: 'Output.text() behavior.', notes: 'Fixed at construction. Generation returns output; streaming returns its final promise and native partial/element views. No extra Casai output schema is applied.' },
    stopWhen: { section: 'sdk', sdkGroup: 'tools', origin: 'ai-sdk', default: 'isStepCount(1), matching the current core SDK call.', notes: 'Set isStepCount(n) or native predicates for multiple steps. ToolLoopAgent’s 20-step default is not Casai’s current default. A paused turn needs a continuation call; increasing a step limit does not approve tools.' },
    prepareCall: entry('Transforms the resolved request once before SDK execution.', { section: 'adapted', origin: 'casai', type: '(request, config, context) => Request | PromiseLike<Request>', adaptation: 'The three-argument Casai hook receives resolved configuration and prepared application context.', notes: 'Return the complete editable request. Omitted editable fields are not restored. Fixed contracts, explicit cancellation, composed observers and approval/telemetry policy remain protected. The retained history is not rewritten by the hook.' }),
    prepareStep: entry('Changes supported native settings before an SDK-scheduled model step.', { section: 'adapted', origin: 'ai-sdk', type: '(step, config, context) => NativeStepOverrides | undefined | PromiseLike<...>', adaptation: 'Retains the SDK name and partial-return contract; Casai adds resolved config and prepared context arguments.', notes: 'It does not schedule another step or restart a paused invocation. Return replacements without mutating shared configuration.' }),
    id: entry('The SDK Agent identifier.', { section: 'adapted', default: 'No explicit ID.', notes: 'Tool forms do not expose Agent identity or native generate/stream methods.' }),
  },
  Decision: {
    state: entry('The state to evaluate: text or supported native multimodal parts. Prepared sources return that state.', { section: 'essential', origin: 'ai-sdk', scope: 'component' }),
    questions: entry('Named questions describing the requested decisions: category, boolean, score, or supported spatial answer.', { section: 'essential', origin: 'ai-sdk', scope: 'component', required: 'Required in the completed component.', notes: 'Question definitions determine answer types and are fixed at construction.' }),
  },
  Embedder: {
    input: entry('A string for one embedding or a string array for a batch.', { section: 'essential', origin: 'casai', scope: 'component', adaptation: 'Mapped to native embed({ value }) or embedMany({ values }); native results are preserved.', notes: 'Inline templates produce one string. Script/function preparers may produce arrays. Configured input permits a no-replacement .run().' }),
    maxParallelCalls: { section: 'sdk', sdkGroup: 'operation', origin: 'ai-sdk', notes: 'Relevant to array input. Casai does not add its own batching or concurrency loop.' },
  },
  Reranker: {
    query: entry('The ranking query. Script/function preparers can return a string or a complete { query, documents } bundle.', { section: 'essential', origin: 'ai-sdk', adaptation: 'Prepared bundles add compositional convenience around the native query/documents pair.' }),
    documents: entry('Candidate strings or native structured documents to rank.', { section: 'essential', origin: 'ai-sdk', required: 'Must be available by invocation. A plain tool needs configured documents; a preparer can supply the complete query/documents pair.', inheritance: 'Invocation documents override prepared documents, which override configured candidates.' }),
    topN: { section: 'sdk', sdkGroup: 'operation', origin: 'ai-sdk', notes: 'Available as a positional tail or .run() setting; it is not a public plain-tool argument.' },
  },
  ImageGenerator: {
    prompt: entry('Text or a native prompt bundle with text, images and optional mask. Template mode preserves the native bundle and renders explicit text only.', { section: 'essential', origin: 'ai-sdk', required: 'Text or effective reference images must resolve by invocation.', adaptation: 'Separate configured/invocation media can be composed with text or prepared prompts.', notes: 'An untouched complete bundle owns its media. Explicit invocation images/mask override it. Use .run() to select structured authored source unambiguously on tools.' }),
    images: entry('Reference images for generation or editing.', { section: 'adapted', origin: 'casai', adaptation: 'Top-level convenience for the native prompt.images field.', inheritance: 'Constructor values use ordinary replacement and may retain an inherited separate mask. Invocation images replace prior images and drop the previous mask unless that call supplies one.', notes: 'An empty invocation array clears references; undefined retains them. Text-only updates keep existing media. Complete native bundles retain native empty-array behavior.' }),
    mask: entry('An edit mask accompanying reference images; conventions depend on the model.', { section: 'adapted', origin: 'casai', adaptation: 'Top-level convenience for native prompt.mask.', inheritance: 'Mask-only updates retain images. New invocation images drop the old mask unless the call supplies a defined replacement.', notes: 'A split/field mask requires effective nonempty images. Providers own mask encoding and editing support.' }),
  },
  Transcriber: {
    audio: entry('Encoded recording data (base64 string, bytes or ArrayBuffer) or a URL. Use the provider’s file transcription operation for complete recordings.', { section: 'essential', origin: 'ai-sdk' }),
  },
  StreamingTranscriber: {
    audio: entry('A fresh ReadableStream of raw audio chunks matching inputAudioFormat.', { section: 'essential', origin: 'ai-sdk', notes: 'Current components do not decode containers or admit standalone finite bytes. Prepared tools must open bounded streams. Reusing the same ReadableStream through Casai is rejected.' }),
    inputAudioFormat: entry('The native format of the raw input chunks.', { section: 'essential', origin: 'ai-sdk', required: 'Required by the call unless configured; required in a finished tool configuration.', notes: 'Provider support applies. This is format metadata, not a decoder or automatic conversion request.' }),
  },
  SpeechGenerator: {
    text: entry('The complete text to synthesize.', { section: 'essential', origin: 'ai-sdk' }),
  },
  StreamingSpeechGenerator: {
    text: entry('Text, text parts, or an iterable/stream supplying them incrementally.', { section: 'essential', origin: 'ai-sdk', notes: 'A suitable script/function preparer may return streamed text. The direct-input restriction belongs only to the sample scenario.' }),
    outputFormat: entry('A native audio-format object, such as { type: "audio/pcm", rate: 24000 }.', { section: 'sdk', sdkGroup: 'output', origin: 'ai-sdk', notes: 'This differs from complete SpeechGenerator’s string format. The provider determines supported values.' }),
  },
  StreamingTranslator: {
    audio: entry('A fresh stream of raw audio chunks to translate into speech and text.', { section: 'essential', origin: 'ai-sdk', notes: 'A recording may supply a finite stream. Do not pass encoded MP3/WAV data as if it were raw PCM.' }),
    inputAudioFormat: entry('The native format of the input chunks.', { section: 'essential', origin: 'ai-sdk', required: 'Required by invocation unless configured.' }),
    targetLanguage: { section: 'essential', origin: 'ai-sdk', required: 'Required by invocation unless configured.' },
  },
  VoiceSessionSetup: {
    model: entry('The realtime model used to set up the voice session.', { section: 'essential', origin: 'ai-sdk' }),
    instructions: entry('Server-owned voice-session instructions. May be literal or produced by the selected source preparer.', { section: 'essential', origin: 'ai-sdk', default: 'No extra instructions in the direct form.', required: 'Optional in the direct form. Prepared forms need source in configuration or invocation.' }),
    tools: entry('Tools offered in the session and executable through the server’s executeTool adapter.', { section: 'common', origin: 'casai', notes: 'Prepared definitions are omitted when empty. Nonempty tools retain provider capability errors. Client-supplied preferences must not replace server-owned tool policy.' }),
    expiresAfterSeconds: entry('Requests the client-secret lifetime supported by the model.', { section: 'sdk', sdkGroup: 'operation', origin: 'ai-sdk', notes: 'Applies to ordinary/token calls, not to session configuration or WebRTC negotiation.' }),
  },
};

export const sdkPropertyGroups = {
  model: ['providerOptions', 'runtimeContext', 'telemetry', 'experimental_telemetry'],
  output: ['output', 'outputFormat', 'outputAudioFormat', 'include', 'includeRawChunks'],
  tools: ['toolChoice', 'activeTools', 'toolOrder', 'toolCallConcurrency', 'toolApproval', 'experimental_toolCallers', 'experimental_toolApprovalSecret', 'experimental_sandbox', 'experimental_steering', 'repairToolCall', 'experimental_refineToolInput', 'stopWhen'],
  callbacks: ['onStart', 'onEnd', 'onStepStart', 'onStepEnd', 'onStepError', 'onLanguageModelCallStart', 'onLanguageModelCallEnd', 'onToolExecutionStart', 'onToolExecutionEnd', 'onChunk', 'onError', 'onAbort', 'experimental_onStart', 'experimental_onEnd'],
  request: ['headers', 'maxRetries', 'timeout', 'download', 'experimental_download', 'streamRetries', 'experimental_transform'],
};

export const invocationProperties = ['abortSignal', 'messageHistory', 'history', 'approve', 'sdp', 'toolCallId', 'toolName', 'args', '_toolOptions'];
