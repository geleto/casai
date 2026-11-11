// Shared explanations inside the matrix, authored from Casai's current guide.
// These are not extracted README sections or the future documentation topics.
// link records the existing guide location used to check the explanation.
export const concepts = {
  configuration: {
    title: 'Construction and reusable configuration',
    paragraphs: ['Factories take settings and an optional compatible parent. Required settings can be inherited. Config fragments may be incomplete, but every finished component must contain settings that shorthand cannot supply, such as model, Function execute and loaded-source loader.', 'The effective settings must match one component configuration shape. Native runtime delegation does not relax TypeScript compatibility. Ordinary calls and run return promises; invalid construction throws synchronously. Configuration is immutable by authoring contract; create a new component to replace captured bindings.'],
    link: 'README.md#common-component-contracts',
  },
  inheritance: {
    title: 'Inheritance, overrides and clearing',
    paragraphs: ['Child scalar settings replace parent settings; explicit undefined can clear an ordinary constructor value. context, filters, tools and toolsContext merge shallowly by key. A null tool removes that entry. Loader chains combine with child priority, unless explicitly overridden or raced.', 'Derived components retain source/tool/stream modifiers. Explicit source modifiers replace the source mode. Reusable Config callbacks need explicit types; a completed component checks inherited callback compatibility. Invocation overrides are local and never mutate the component’s config.'],
    link: 'README.md#configuration-and-inheritance',
  },
  context: {
    title: 'Application input, defaults and private context',
    paragraphs: ['Declare public application fields with inputSchema. Their configured context values act as defaults. Bound tool defaults override configured public defaults; explicit payload fields win next. Parse the shallow-merged application object once, then execute with parsed values plus selected private bindings.', 'Other configured names are private dependencies and cannot be replaced by caller/model data. Without an input schema, ordinary components can accept unrelated fields, while configured names remain private. Authored source and settings are not application payload, even when names coincide.'],
    link: 'README.md#input-defaults-and-private-context',
  },
  schemas: {
    title: 'Schema boundaries',
    paragraphs: ['Casai accepts Zod 4 Classic/Mini, SDK schemas and Standard Schema. Direct Zod 3 schemas are rejected. Calls and configured defaults use schema input types; implementations and consumers use parsed output types.', 'Schema callbacks must be pure. Native copying, reference sharing, readonly freezing and default behavior are preserved; Casai does not deep-clone data to compensate. Prefer fresh structured defaults. Script/Function schema validates application output; LLMAgent output uses the SDK Output contract.'],
    link: 'README.md#input-defaults-and-private-context',
  },
  sources: {
    title: 'Source preparation and loading',
    paragraphs: ['The primary property keeps its name while the modifier changes its meaning: literal input, template, script, preparation function or resource name. Loaded modes require a loader at construction. Template/Script sources and Function callbacks are trusted application code, not a sandbox.', 'Cascada uses Nunjucks-style variables, loops, macros and conditions, and runs independent work concurrently. Only explicit text slots of native multimodal objects are rendered. AI preparers disable HTML escaping. Input preparers can call registered helpers; this does not give a specialized model a tool loop.'],
    link: 'README.md#sources-loaders-and-rendering',
  },
  effects: {
    title: 'Concurrency and authorized state changes',
    paragraphs: ['Independent Cascada expressions run concurrently. Use ! when an intentional effect must finish before subsequent work reads its state. Applications coordinate shared resources across independent invocations.', 'Casai merging and preparation leave shared application data intact. Bodies may deliberately mutate authorized state, though pure operations are easier to reuse. Context captures top-level bindings; nested services may still be shared.'],
    link: 'README.md#common-component-contracts',
  },
  tools: {
    title: 'Expose a tool versus use tools',
    paragraphs: ['asTool publishes this component through an SDK Tool descriptor. tools registers other tools callable by the model, workflow or preparer. Every Casai tool requires explicitly declared public root fields; dynamic dictionaries belong inside one declared field.', 'Ordinary calls and run retain their component result. SDK descriptor execution and injected helpers return the tool projection. Model-backed providerOptions configures the inner operation; coded tool providerOptions configures the descriptor. toolContextSchema maps to native contextSchema and validates trusted binding data separately.', 'Tools expose completed application results. Script/Function collect declared finite root streams. A streaming transcription tool needs an explicit preparer. LLMAgent tools cannot expose resumable inner pauses; incomplete work fails the tool call.'],
    link: 'README.md#using-components-as-tools',
  },
  history: {
    title: 'Prompt messages, history and continuation',
    paragraphs: ['New authored content belongs in prompt, including one message or an array. Positional message arrays are always literal history. Required context precedes positional history. Earlier history is never rendered again.', 'resume(history, options) continues without another source render. It can settle approvals, provider pauses or other continuation states. approve belongs only to resume. Supply required raw context and prior per-call settings again. Returned history preserves the original pre-hook conversation plus native response messages; it is not proof of success.'],
    link: 'README.md#tool-approvals-and-continuation',
  },
  hooks: {
    title: 'Request and step preparation',
    paragraphs: ['prepareCall(request, config, context) receives the resolved editable request and returns a complete replacement. It runs after application context preparation. prepareStep(step, config, context) runs only when the SDK schedules a step and returns native partial overrides.', 'Fixed output/contracts, explicit cancellation, composed observers and approval/telemetry policy retain protected handling. Hooks must return replacements without mutating shared settings. They do not perform source rendering again or rewrite retained history.'],
    link: 'README.md#hooks',
  },
  steps: {
    title: 'Multiple steps and completion',
    paragraphs: ['One call can contain several model/tool steps when stopWhen allows them. Current Casai core calls retain the SDK one-step default; configure a suitable condition for a tool loop. ToolLoopAgent’s twenty-step default is a different constructor default.', 'A step limit does not approve pending work or restart a paused invocation. Native finish reasons, output and approval/tool events describe the result. A valid output schema alone does not certify workflow completion.'],
    link: 'README.md#steps-hooks-and-continuation',
  },
  streams: {
    title: 'Application streams',
    paragraphs: ['Script/Function may return async iterables. streamSchema parses each complete element lazily; textStreamSchema validates text chunks. Awaiting the call obtains the iterable, not a fully validated collection.', 'collectStream and collectTextStream collect explicitly. toReadableStream adapts an iterable. makeSharedIterable shares one validated source with explicit retention/disposal responsibilities. No automatic replay or whole-result validity is promised. Tool execution collects only a declared finite root stream.'],
    link: 'README.md#streams-from-function-and-script',
  },
  audio: {
    title: 'Audio input, output and stream ownership',
    paragraphs: ['Complete and streaming operations have distinct settings. Complete Transcriber accepts encoded recordings; current streaming transcription/translation require raw streams with format metadata. Complete speech uses a string outputFormat; streaming speech uses a native audio-format object.', 'Use fresh streams for independent invocations. Casai rejects a repeated ReadableStream identity handed to its live SDK path; it does not promise to detect external consumption or replay arbitrary iterators. Native results own stream completion, errors and cleanup. Consume event streams before awaiting final values where the native single-consumer contract requires it.', 'Provider capabilities still apply. Format metadata does not decode WAV/MP3 or resample PCM. The optional conversion helpers and finite-byte admission described in the streaming plan are not implemented yet.'],
    link: 'README.md#specialized-ai-components',
  },
  'image-media': {
    title: 'Image prompts and media precedence',
    paragraphs: ['Native prompt bundles own their media. Separate configured images/mask are defaults for split text/prepared sources. Explicit invocation images or mask override a resolved bundle. Text-only updates retain existing references.', 'New invocation images, including an empty array, drop the prior mask unless the call supplies one. Mask-only updates retain images. Constructor inheritance follows ordinary shallow merging; it differs from invocation replacement. An untouched native empty image array retains native SDK meaning.'],
    link: 'README.md#imagegenerator',
  },
  translation: {
    title: 'Speech translation and planned completion',
    paragraphs: ['StreamingTranslator translates speech into target-language audio and text. A finite recording can feed its stream. Ordinary text translation uses LLMAgent with translation instructions.', 'Complete Translator is planned. Its selected contract reuses one native translation execution, collects audio bytes and reads resolved final text and metadata. No completed implementation exists yet; planned reference entries and examples must retain their status.'],
    link: 'README.md#streamingtranslator',
  },
  'voice-session': {
    title: 'Voice session ownership',
    paragraphs: ['VoiceSessionSetup prepares instructions and tools, creates supported client secrets or answers WebRTC offers. The native model determines capabilities. Use the model directly for relay connection information.', 'Applications own HTTP transport, authentication and server context. executeTool is a thin validated runner using real call metadata; it adds no session store, approval loop or audio loop. Its result is execution JSON, not the language-model toModelOutput projection.'],
    link: 'README.md#voicesessionsetup',
  },
  errors: {
    title: 'Cancellation and failures',
    paragraphs: ['Invalid configuration throws at construction. Ordinary calls and run return promises and reject invocation failures. SDK/provider execution, stream error parts, final output availability and completion retain their native contracts.', 'Cancellation belongs to an invocation. abortSignal reaches native execution and registered helpers; arbitrary application functions must cooperate. A stream event is not automatically a thrown error, and a resolved final value is not universal proof of workflow success.'],
    link: 'README.md#cancellation-and-errors',
  },
};
