// Amend only missing native prose; preserve native fields, types and attribution.
// Key by extracted shape, not component-specific branches in the resolver.
const rawAudioSettings = { audio: { description: 'Raw bytes/ArrayBuffer or a fresh stream matching inputAudioFormat; finite bytes are wrapped once for native dispatch.' } };
export const shapeProperties = {
  VideoGenerator_result: {
    video: { detail: 'GeneratedFile', appliesTo: 'First generated video' },
    videos: { detail: 'GeneratedFile', appliesTo: 'Each generated video' },
  },
  VoiceAgentClient_result: {
    getSnapshot: { description: 'Read the current native session state. The snapshot identity is stable between native state changes; treat it and its contents as read-only.', detail: 'VoiceClientSnapshot', appliesTo: 'Returned snapshot' },
    subscribe: { description: 'Subscribe to state changes. Returns an unsubscribe function. Read getSnapshot after subscribing for initial rendering; subscribing does not connect or replay events.' },
    dispose: { description: 'Immediately disconnect using native disposal. Unsubscribe application state listeners separately; use close first when graceful completion is required.' },
  },
  TranscriberFile_settings: { audio: { description: 'Supplied encoded audio bytes/ArrayBuffer, base64 or a native URL using the SDK downloader; .loadsAudio separately prepares paths, URLs or supplied encoded media.' } },
  TranscriberStream_settings: rawAudioSettings,
  TranscriberRaw_settings: rawAudioSettings,
  VoiceAgentBackend_result: { tools: { description: 'Prepared native tool definitions for this session.', detail: 'RealtimeToolDefinition', appliesTo: 'Each tool definition' } },
  VoiceWebRTC_result: {
    sessionId: { description: 'The provider identifier for the created session.' },
    sdp: { description: 'The SDP answer to give to the browser peer connection.' },
  },
  Output: {
    object: { detail: 'OutputObject', appliesTo: 'Builder options' },
    array: { detail: 'OutputArray', appliesTo: 'Builder options' },
    choice: { detail: 'OutputChoice', appliesTo: 'Builder options' },
    json: { detail: 'OutputJSON', appliesTo: 'Optional builder options' },
  },
  ImageGenerator_result: {
    image: { detail: 'GeneratedFile', appliesTo: 'Generated file' },
    images: { detail: 'GeneratedFile', appliesTo: 'Each generated file' },
  },
  SpeechGenerator_result: {
    audio: { detail: 'GeneratedAudioFile', appliesTo: 'Generated file' },
    audioFormat: { description: 'The actual emitted format on collected streaming speech, including sample rate where applicable; absent on native complete results.', detail: 'SpeechAudioFormat' },
    usage: { description: 'Resolved native usage from collected streaming speech; absent when the native complete result does not expose it.' },
  },
  Translator_result: { audio: { description: 'Collected translated audio bytes; empty on native text-only success. No media type is inferred.' } },
  RenderOptions: {
    autoescape: { description: 'Escape HTML-sensitive output characters. Casai defaults standalone rendering to false; AI input preparers always disable it.' },
    throwOnUndefined: { description: 'Throw when a template outputs null or undefined. Defaults to false.' },
    trimBlocks: { description: 'Remove the first newline after a block tag. Defaults to false.' },
    lstripBlocks: { description: 'Remove indentation before a block tag. Defaults to false.' },
    dev: { description: 'Keep developer-oriented template error details instead of cleaning the stack. Defaults to false.' },
    watch: { description: 'Cascada configure() loader option. Casai constructs an environment directly, so configure watching on your supplied loader.' },
    noCache: { description: 'Cascada configure() loader option. Configure caching on your supplied loader; this flag does not configure it through Casai renderOptions.' },
    web: { description: 'Cascada configure() web-loader options. With Casai, pass these options to your WebLoader instead.', detail: 'RenderWeb', appliesTo: 'WebLoader options' },
    express: { description: 'Cascada configure() Express integration. Casai does not call configure() or install an Express view engine.' },
    tags: { description: 'Custom opening and closing delimiters for Cascada template syntax.', detail: 'RenderTags' },
  },
};
export const componentDetails = {
  VideoGenerator: {
    prompt: { detail: 'VideoPrompt', appliesTo: 'Native object prompt' },
    poll: { detail: 'VideoPoll' },
    frameImages: { detail: 'VideoFrame', appliesTo: 'Each role-tagged frame' },
    inputReferences: { detail: 'VideoReference', appliesTo: 'Object-form reference input; raw DataContent is also accepted' },
  },
  VoiceAgentClient: { api: { detail: 'VoiceClientApi' }, sessionConfig: { detail: 'VoiceClientSessionConfig' } },
  LLMAgent: { prompt: { detail: 'ModelMessage', appliesTo: 'A direct or prepared message, or each message in an array' } },
  Decision: { questions: { detail: 'DecisionQuestion', appliesTo: 'Each named question' } },
  ImageGenerator: { prompt: { detail: 'ImagePrompt', appliesTo: 'A direct or prepared image-prompt object' } },
  SpeechGeneratorStream: { outputFormat: { detail: 'SpeechAudioFormat' } },
};
const fields = descriptions => Object.fromEntries(Object.entries(descriptions).map(([name, description]) => [name, { description }]));
export const detailProperties = {
  FileAudioTarget: { alternatives: { detail: 'FileAudioFormat', appliesTo: 'Each accepted copy alternative' } },
  VoiceClientApi: fields({
    token: 'Application endpoint that returns the native short-lived token response.',
    session: 'Application endpoint that accepts the browser SDP offer and returns the native WebRTC answer.',
    websocket: 'Application-owned relay WebSocket URL.',
    protocols: 'Optional native WebSocket subprotocols for the relay connection.',
  }),
  SpeechTextPart: fields({ type: 'Identifies a text part.', text: 'The text to synthesize in this part.' }),
  MediaSettings: fields({
    track: 'A non-negative zero-based absolute container stream index, not the ordinal audio-track number. Omit for the native best audio stream. Missing, non-audio or undecodable selections fail. For a video at index 0 and audio at index 1, select track: 1. This does not select channels within an audio track.',
    format: 'Optional native input demuxer name. Omit to let FFmpeg detect the container using content and native filename/extension/MIME hints. It is not an output encoding or a model format. Raw input may need an explicit demuxer and native raw-format options.',
    options: 'Input AVOptions with native names, scalar values and units. For example headers: "Authorization: Bearer TOKEN\\r\\n" for an HTTP input. This is not a CLI argument list, output settings or model headers. Native handling determines applicability and may ignore unknown options.',
  }),
  Timeout: fields({
    totalMs: 'Total time limit for the call, in milliseconds.',
    stepMs: 'Time limit for a complete step, including generation, retries and local tool execution.',
    firstChunkMs: 'Streaming time limit until the first content chunk arrives.',
    chunkMs: 'Streaming time limit between content chunks.',
    toolMs: 'Default time limit for each tool execution, in milliseconds.',
    tools: 'Per-tool time limits that override toolMs. Keys use the tool name followed by Ms, such as lookupOrderMs.',
  }),
  DecisionQuestion: fields({ type: 'The question kind. Each kind has its own criteria and instruction requirements.', instructions: 'Instructions for this question; whether they may be omitted depends on the question kind.' }),
  ModelMessage: fields({ role: 'The message role: system, user, assistant or tool.', content: 'Content accepted for this role. The type lists supported text and multimodal parts.' }),
  ImagePrompt: fields({ text: 'Text describing the image to generate or edit.', images: 'Input images for generation or editing. The selected model determines supported formats and editing behavior.', mask: 'An optional mask for editing the supplied images. Mask conventions depend on the selected model.' }),
  RenderTags: fields({ blockStart: 'Opening block delimiter. Default: {%.', blockEnd: 'Closing block delimiter. Default: %}.', variableStart: 'Opening expression delimiter. Default: {{.', variableEnd: 'Closing expression delimiter. Default: }}.', commentStart: 'Opening comment delimiter. Default: {#.', commentEnd: 'Closing comment delimiter. Default: #}.' }),
  RenderWeb: fields({ useCache: 'Cache resources in a WebLoader. Defaults to false.', async: 'Load resources asynchronously in a WebLoader. Use the asynchronous API when enabled.' }),
};

