// Shared explanations inside the matrix, authored from Casai's current guide.
// These are not extracted README sections or the future documentation topics.
// link records the existing guide location used to check the explanation.
export const concepts = {
  'video-generation': {
    title: 'Video generation and native completion',
    paragraphs: ['VideoGenerator is a stateless reusable operation. Supply text or a native image prompt, optionally preparing it with a template, script or function. Call it directly from Cascada Script; results keep the SDK video files and metadata.', 'The SDK chooses direct generation or its native asynchronous start/status flow, and owns retries, polling, webhook completion and downloads. Native poll and webhook settings remain available; the component does not retain provider job state or create a scheduler. Standalone native start/status APIs remain available when an application needs detached jobs.', 'There is no .asStream variant. Ordinary tools return video file payloads using the native file-content mapping; the calling model must accept that media type, or an explicit toModelOutput must choose a suitable application representation. Reference-media support, dimensions, duration, audio and frame controls remain provider-specific.'],
    link: 'README2.md#videogenerator',
  },
  'voice-client': {
    title: 'Browser voice sessions and shared preferences',
    paragraphs: ['Import VoiceAgentClient from casai/client. The stateless reusable component creates independent disconnected native sessions through ordinary calls or run. Each returned handle owns its state and can be passed between browser Cascada scripts or application callbacks. Source, streaming and tool modifiers do not apply.', 'In browser Cascada, var session = voiceClient() creates the handle. Later scripts can use session!.sendEvent(command) and session!.getSnapshot(). Inspect command results with is error when failures matter. The host coordinates shared-session use and owns cleanup in try/finally. This uses Cascada browser execution directly and needs no UI library or Node Casai Script import.', 'Native connect can settle before readiness. Observe status === connected before readiness-dependent commands; Cascada sequencing does not turn native void methods into provider acknowledgements. Optional UI stores use subscribe/getSnapshot over this same handle. There is no React dependency; the native experimental_useRealtime hook creates its own session rather than adopting this one.', 'Pair token/WebRTC setup and private tool calls through application-owned authenticated routes using VoiceAgentBackend. Relays and Live event delegation remain application-owned. Provider API keys and tool executors stay on the server; browser session credentials do not replace application authorization.', 'When common defaults are useful, share an explicit public object typed with native session fields, such as voice. Keep the server model, instructions, trusted context and executors separate. TypeScript Pick does not remove runtime properties or secrets. Runtime user-specific preferences must come from admitted application values.', 'Use graceful close when finishing, then unsubscribe and dispose in the owning scope, including on failure. Configuration is reusable; a session is an independent live handle. Native browser, provider, microphone and playback restrictions remain in effect.'],
    link: 'README2.md#browser-voice-client',
  },
  configuration: {
    title: 'Construction and reusable configuration',
    paragraphs: ['Factories take settings and an optional compatible parent. Required settings can be inherited. Config fragments may be incomplete, but every finished component must contain settings that shorthand cannot supply, such as model, Function execute and a loader for loaded text/templates/scripts. .loadsAudio uses native media loading and needs no loader setting.', 'The combined settings must fit one compatible component/operation shape. Ordinary calls and run return promises; invalid construction throws synchronously. Treat configuration as read-only; create a new component to change its settings or dependencies.'],
    link: 'README.md#common-component-contracts',
  },
  inheritance: {
    title: 'Inheritance, overrides and clearing',
    paragraphs: ['Child scalar settings replace parent settings; explicit undefined can clear an ordinary constructor value. context, filters, tools and toolsContext merge shallowly by key. A null tool removes that entry. Loader chains combine with child priority, unless explicitly overridden or raced.', 'Select source, streaming and tool modes only through factory/Config modifiers. promptType, streaming and asTool are not settings, even when assigned undefined. An explicit source selector replaces the inherited source; .asStream and .asTool remain enabled in derived components and cannot be combined or disabled. Internal metadata preserves these selections through Config and configuration spreads. Same-named fields inside application schemas/context remain ordinary data.', 'Plain Config preserves an inherited source without choosing a default. Reusable Config callbacks need explicit types; a completed component checks inherited callback compatibility. Invocation overrides are local and never mutate the component’s config.'],
    link: 'README2.md#common-component-contracts',
  },
  context: {
    title: 'Application input, defaults and private context',
    paragraphs: ['Declare public application fields with inputSchema. Their configured context values act as defaults. Bound tool defaults override configured public defaults; explicit payload fields win next. Casai combines these values, validates them once, then passes them to the component alongside its private helpers.', 'Other configured names are private dependencies and cannot be replaced by caller/model data. Without an input schema, ordinary components can accept unrelated fields, while configured names remain private. A context field named prompt, for example, is separate from the prompt source in configuration.'],
    link: 'README.md#input-defaults-and-private-context',
  },
  schemas: {
    title: 'Input and output validation',
    paragraphs: ['Casai accepts Zod 4 Classic/Mini, SDK schemas and Standard Schema. Direct Zod 3 schemas are rejected. Calls and configured defaults use schema input types; implementations and consumers use parsed output types.', 'Schema callbacks must be pure. Native copying, reference sharing, readonly freezing and default behavior are preserved; Casai does not deep-clone data to compensate. Prefer fresh structured defaults. Script/Function schema validates application output; LLMAgent output uses the SDK Output contract.'],
    link: 'README.md#input-defaults-and-private-context',
  },
  sources: {
    title: 'Text, templates, scripts and files',
    paragraphs: ['Use input directly, render a Cascada Template, run a Cascada Script, or call a JavaScript function. The property name stays the same: for example, Reranker uses query in every mode. With .loadsText, .loadsTemplate or .loadsScript, supply a file name and a loader. Templates, scripts and functions are application code and must come from a trusted source.', 'A Cascada Template fills in variables and supports loops, conditions and macros. In messages and image prompts, it renders text fields; images, files and other non-text content pass through unchanged. AI input templates do not escape HTML characters. Independent expressions can run at the same time. Templates, scripts and functions can call registered tools while building the input; specialized AI models do not call those tools themselves.'],
    link: 'README.md#sources-loaders-and-rendering',
  },
  effects: {
    title: 'Concurrency and authorized state changes',
    paragraphs: ['Independent Cascada expressions run concurrently. Use ! when an intentional effect must finish before subsequent work reads its state. Applications coordinate shared resources across independent invocations.', 'Casai merging and preparation leave shared application data intact. Bodies may deliberately mutate authorized state, though pure operations are easier to reuse. Context captures top-level bindings; nested services may still be shared.'],
    link: 'README.md#common-component-contracts',
  },
  tools: {
    title: 'Expose this component or call other tools',
    paragraphs: ['.asTool lets an AI agent or workflow call this component. tools registers other tools for the component to call. Declare the public arguments in inputSchema. Put dynamic key/value data inside a named field rather than accepting arbitrary top-level arguments.', 'Direct calls and .run() return the usual component result. An agent or workflow calling the tool receives the value described under Input & return. On AI components, providerOptions configures the model operation; on Template, Script and Function tools, it configures the SDK tool. toolContextSchema validates trusted tool context separately from public arguments.', 'Every .asStream + .asTool combination is prohibited, including prepared sources, Config fragments and inherited modifiers. Ordinary Transcriber, SpeechGenerator and Translator tools can execute native streaming internally and return completed results. Use configured finite audio with a closed empty schema when the model should request work without supplying audio. A .loadsAudio tool can instead accept a declared audio path/URL, subject to an enforced application resource boundary; model arguments cannot override media settings or credentials. The examples configure an application-authorized recording so the model cannot choose another resource.', 'Script and Function collect a returned stream when its schema declares one, so that stream must end. This is separate from .asStream. Native third-party SDK tools retain native preliminary-result support. An LLMAgent tool fails if its work is unfinished or paused for approval.'],
    link: 'README.md#using-components-as-tools',
  },
  history: {
    title: 'Prompt messages, history and continuation',
    paragraphs: ['New authored content belongs in prompt, including one message or an array. Positional message arrays are always literal history. Required context precedes positional history. Earlier history is never rendered again.', 'resume(history, options) continues without another source render. It can settle approvals, provider pauses or other continuation states. approve belongs only to resume. Supply required raw context and prior per-call settings again. Returned history preserves the original pre-hook conversation plus native response messages; it is not proof of success.'],
    link: 'README.md#tool-approvals-and-continuation',
  },
  hooks: {
    title: 'Request and step preparation',
    paragraphs: ['prepareCall(request, config, context) receives the resolved editable request and returns a complete replacement. It runs after application context preparation. prepareStep(step, config, context) runs only when the SDK schedules a step and returns native partial overrides.', 'Hooks cannot replace fixed output settings, remove explicit cancellation, or disable registered callbacks, approval rules or telemetry policy. Hooks must return replacements without mutating shared settings. They do not perform source rendering again or rewrite retained history.'],
    link: 'README.md#hooks',
  },
  steps: {
    title: 'Multiple steps and completion',
    paragraphs: ['One call can contain several model/tool steps when stopWhen allows them. Current Casai core calls retain the SDK one-step default; configure a suitable condition for a tool loop. ToolLoopAgent’s twenty-step default is a different constructor default.', 'A step limit does not approve pending work or restart a paused invocation. Native finish reasons, output and approval/tool events describe the result. A valid output schema alone does not certify workflow completion.'],
    link: 'README.md#steps-hooks-and-continuation',
  },
  streams: {
    title: 'Application streams',
    paragraphs: ['Script/Function may return async iterables. streamSchema parses each complete element lazily; textStreamSchema validates text chunks. Awaiting the call obtains the iterable, not a fully validated collection.', 'collectStream and collectTextStream collect explicitly. toReadableStream adapts an iterable. makeSharedIterable shares one validated source with explicit retention/disposal responsibilities. No automatic replay or whole-result validity is promised. A tool collects the stream returned directly by the function or script when its schema declares one. That stream must end.'],
    link: 'README.md#streams-from-function-and-script',
  },
  audio: {
    title: 'Audio input, output and stream ownership',
    paragraphs: [
      'Input delivery and result delivery are independent. Ordinary audio components return completed results; .asStream returns incremental results. Both can accept streamed input when the model supports it. A .withFunction preparer runs once and may return a fresh stream directly or through a promise; Casai awaits the preparer without collecting its input stream.',
      'For Transcriber, omit inputAudioFormat for encoded file bytes or a base64 string. Supply it for raw bytes or a stream of raw chunks; this selects native streaming execution. Translator always uses native streaming. Raw bytes may be Uint8Array (including Buffer) or ArrayBuffer; stream chunks may be Uint8Array or base64 strings. File paths and URLs use .loadsAudio.',
      'SpeechGenerator uses native generateSpeech for string text with an omitted or string outputFormat. An object format or iterable/streamed text selects native streaming, collected into a file for ordinary calls. Iterable/streamed text accepts an object format or no format. To use a streaming-only model with string text, configure an object format. .asStream always requires streaming support. The streaming SDK operations are experimental, including when ordinary calls collect their output.',
      'Supply a fresh stream for each invocation. A configured stream is single-use, including when inherited. Finite configured bytes can be reused. Casai detects a previously handed-off ReadableStream, but cannot detect external consumption or every reused iterator. The selected request must be supported by the model; Casai does not retry it with another operation.',
      'On .asStream results, access fullStream (or speech audioStream) before any result-promise property if you need the events or audio. Accessing a result promise first consumes the stream internally, even before you await it. Choose one stream view, read it once, then await final values. Ordinary speech/translation calls consume the audio before returning and reject if it fails; ordinary transcription awaits the native final transcript fields. Completed calls require input that ends.',
    ],
    link: 'README2.md#transcriber',
  },
  media: {
    title: 'Files, URLs, tracks and authenticated media',
    paragraphs: [
      'Transcriber.loadsAudio and Translator.loadsAudio accept a file path, URL string or URL object. FFmpeg/node-av opens the resource and prepares its audio. Install node-av; no loader setting or application adapter is needed. The native dependency is required even for WAV files and is loaded when preparing a call. Construction performs no media I/O. Existing Cascada text loaders remain unchanged.',
      'Omit mediaSettings.format to use FFmpeg’s format detection. It examines content and native filename, extension and MIME hints; Casai adds no extension-based format lookup. Set format to a native input demuxer name when detection needs help. Raw media may also need rate, channel and encoding options. Supported containers, codecs and protocols depend on the installed build. A supported format can still fail for a damaged file or a source that cannot provide required seeks.',
      'Audio and video files use the same preparation path. Omit mediaSettings.track to select the native best audio stream, or supply a zero-based container stream index. With video at index 0 and audio at indices 1 and 2, track: 2 selects the second audio stream. A missing or non-audio index fails. Track selection does not select channels within a track. The conversion processes selected audio; native inspection may also read or decode other streams.',
      'Use mediaSettings.options for native FFmpeg input options, including source authentication. For HTTP, an example is { options: { headers: "Authorization: Bearer TOKEN\\r\\n" } }. Keep native option names, value formats and units. Supply fresh credentials through trusted .run({ audio, mediaSettings, abortSignal }) settings. SDK headers/providerOptions configure the model request separately. mediaSettings is replaced as a whole, so a per-call replacement must include any track/format options you still need.',
      'FFmpeg handles supported redirects, range requests, playlists and streaming protocols. Applications must authorize every resource that may be opened, including playlist segments and keys; native loading does not inherit SDK URL/download restrictions. Native options are not a universal authentication or token-refresh hook, and unknown options may be ignored. Keep credentials out of model arguments and exposed logs; Casai debug logs are unredacted.',
      'Preparation reads enough headers and stream information to determine the source and conversion; the probe has no fixed byte limit. Subsequent audio processing is lazy, but an encoded-file model request may require complete buffering. Files retain native seeking; forward-only streams retain their limitations. Each call opens fresh resources. Casai closes owned resources on preparation or dispatch failure; after successful handoff, native execution owns cleanup and cancellation.',
      'Choose the LGPL/GPL distribution when installing node-av. The native FFmpeg build determines functionality and licensing independently of the JavaScript wrapper license. Audio-only use does not remove GPL components from a GPL-enabled build. Follow the selected distribution’s license obligations.',
    ],
    link: 'README2.md#recorded-audio-and-optional-codecs',
  },
  'audio-conversion': {
    title: 'Source formats and model targets',
    paragraphs: [
      'mediaSettings.format identifies the source container/demuxer. inputAudioFormat identifies the model’s raw-audio target. For example, an MP4 source may need decoding to 24 kHz mono PCM16 little-endian samples. Supply the target when the model does not expose its requirements; source detection cannot determine what a model accepts.',
      'Preparation preserves compatible audio and converts encoding, rate and channel layout when needed. Raw direct input must already match its declared format: metadata alone does not decode or resample it. The PCM helper convention is mono PCM16 little-endian with an explicit rate. The examples require a model supporting 24 kHz; it is not a universal default.',
      'Main-entry PCM/WAV utilities work on supplied bytes or streams without node-av. They support byte/sample conversion and WAV reading/writing. SDK-backed resampling is experimental and has aliasing/quality limitations. Streaming downsampling supports integer ratios while retaining incomplete samples between chunks; other ratios require native conversion or explicit finite collection.',
      'The optional casai/node-av conversion entry uses native conversion when installed. If node-av is absent, supported supplied-byte/stream conversions can use SDK/local utilities. A broken installation or a decode failure is reported rather than retried through another backend. This fallback does not apply to .loadsAudio, which always requires node-av.',
    ],
    link: 'README2.md#recorded-audio-and-optional-codecs',
  },
  'image-media': {
    title: 'Image descriptions, references and masks',
    paragraphs: ['An image prompt object may contain text, images and a mask. When using a text prompt, template, script or function, you can configure images and mask separately as defaults. Images or a mask supplied in a call override the prompt object. Changing only the text keeps existing reference images.', 'Supplying new images in a call clears the old mask unless you also supply a new one. An empty images array clears the references. Changing only the mask keeps the images. Inherited configuration merges differently: replacing configured images does not automatically clear an inherited mask. An unchanged prompt object keeps the AI SDK behavior for empty image arrays.'],
    link: 'README.md#imagegenerator',
  },
  translation: {
    title: 'Speech translation',
    paragraphs: ['Translator translates speech into target-language audio and text. Ordinary calls and tools return completed results; Translator.asStream exposes incremental events. Both accept raw bytes or fresh streams and support .loadsAudio for media files/URLs. Written-text translation uses LLMAgent with translation instructions.', 'Completed output contains audio bytes, final sourceText and translationText, and resolved native metadata. Depending on the provider, text-only output may have empty audio and audio-only output may have empty translationText. Tool results contain text, base64 audio and optional duration; the calling model receives translated text by default.'],
    link: 'README2.md#translator',
  },
  'voice-session': {
    title: 'Voice session setup and server tools',
    paragraphs: ['VoiceAgentBackend prepares instructions and tools, creates short-lived client secrets or answers WebRTC offers, depending on the model. Provider API keys stay on the server; a browser session credential authenticates its provider connection. Use the model directly for relay connection information.', 'Your application server authenticates users, authorizes session creation and tool calls, and supplies trusted context. Session credentials do not replace these checks. executeTool validates and runs a registered tool using the incoming call ID and arguments. It returns the tool result without formatting it for a language model. HTTP endpoints, session storage, approvals and audio transport remain application responsibilities.'],
    link: 'README.md#voiceagentbackend',
  },
  errors: {
    title: 'Cancellation and failures',
    paragraphs: ['Invalid configuration throws at construction. Ordinary calls and run return promises and reject invocation failures. SDK/provider execution, stream error parts, final output availability and completion retain their native contracts.', 'Cancellation belongs to an invocation. abortSignal reaches native execution and registered helpers; arbitrary application functions must cooperate. A stream event is not automatically a thrown error, and a resolved final value is not universal proof of workflow success.'],
    link: 'README.md#cancellation-and-errors',
  },
};
