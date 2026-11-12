// Shared explanations inside the matrix, authored from Casai's current guide.
// These are not extracted README sections or the future documentation topics.
// link records the existing guide location used to check the explanation.
export const concepts = {
  configuration: {
    title: 'Construction and reusable configuration',
    paragraphs: ['Factories take settings and an optional compatible parent. Required settings can be inherited. Config fragments may be incomplete, but every finished component must contain settings that shorthand cannot supply, such as model, Function execute and loaded-source loader.', 'The combined settings must be valid for the chosen component. Ordinary calls and run return promises; invalid construction throws synchronously. Treat configuration as read-only; create a new component to change its settings or dependencies.'],
    link: 'README.md#common-component-contracts',
  },
  inheritance: {
    title: 'Inheritance, overrides and clearing',
    paragraphs: ['Child scalar settings replace parent settings; explicit undefined can clear an ordinary constructor value. context, filters, tools and toolsContext merge shallowly by key. A null tool removes that entry. Loader chains combine with child priority, unless explicitly overridden or raced.', 'Config and component factories support source selectors followed by compatible .asStream or .asTool modifiers. Derived components retain these modifiers; an explicit source selector replaces the inherited source mode. Plain Config preserves an inherited source without choosing a default. Select sources through modifiers; promptType is not an authored setting. Reusable Config callbacks need explicit types; a completed component checks inherited callback compatibility. Invocation overrides are local and never mutate the component’s config.'],
    link: 'README.md#configuration-and-inheritance',
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
    paragraphs: ['.asTool lets an AI agent or workflow call this component. tools registers other tools for the component to call. Declare the public arguments in inputSchema. Put dynamic key/value data inside a named field rather than accepting arbitrary top-level arguments.', 'Direct calls and .run() return the usual component result. An agent or workflow calling the tool receives the value described under Input & return. On AI components, providerOptions configures the model operation; on Template, Script and Function tools, it configures the SDK tool. toolContextSchema validates trusted tool context separately from public arguments.', 'Tool calls return completed results. Script and Function collect a returned stream when its schema declares one, so that stream must end. Streaming transcription tools need a script or function to open the audio stream. An LLMAgent tool fails if its work is unfinished or paused for approval.'],
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
    paragraphs: ['Complete and streaming operations have distinct settings. Complete Transcriber accepts encoded recordings; current streaming transcription/translation require raw streams with format metadata. Complete speech uses a string outputFormat; streaming speech uses a native audio-format object.', 'Use fresh streams for independent invocations. Casai rejects reusing the same ReadableStream for live audio, but cannot detect whether other code has already read it. Native results own stream completion, errors and cleanup. Consume event streams before awaiting final values where the native single-consumer contract requires it.', 'Provider capabilities still apply. Format metadata does not decode WAV/MP3 or resample PCM. Audio conversion helpers and support for passing byte arrays directly to streaming components are planned.'],
    link: 'README.md#specialized-ai-components',
  },
  'image-media': {
    title: 'Image descriptions, references and masks',
    paragraphs: ['An image prompt object may contain text, images and a mask. When using a text prompt, template, script or function, you can configure images and mask separately as defaults. Images or a mask supplied in a call override the prompt object. Changing only the text keeps existing reference images.', 'Supplying new images in a call clears the old mask unless you also supply a new one. An empty images array clears the references. Changing only the mask keeps the images. Inherited configuration merges differently: replacing configured images does not automatically clear an inherited mask. An unchanged prompt object keeps the AI SDK behavior for empty image arrays.'],
    link: 'README.md#imagegenerator',
  },
  translation: {
    title: 'Speech translation and planned completion',
    paragraphs: ['StreamingTranslator translates speech into target-language audio and text. A finite recording can feed its stream. Ordinary text translation uses LLMAgent with translation instructions.', 'Complete Translator is planned. Its selected contract reuses one native translation execution, collects audio bytes and reads resolved final text and metadata. This component is not implemented yet.'],
    link: 'README.md#streamingtranslator',
  },
  'voice-session': {
    title: 'Setting up a voice session',
    paragraphs: ['VoiceSessionSetup prepares instructions and tools, creates client secrets or answers WebRTC offers, depending on the model. Use the model directly for relay connection information.', 'Your application handles HTTP requests, authentication and server context. executeTool validates and runs a registered tool using the incoming call ID and arguments. It returns the tool result without formatting it for a language model. Session storage, approvals and audio transport remain application responsibilities.'],
    link: 'README.md#voicesessionsetup',
  },
  errors: {
    title: 'Cancellation and failures',
    paragraphs: ['Invalid configuration throws at construction. Ordinary calls and run return promises and reject invocation failures. SDK/provider execution, stream error parts, final output availability and completion retain their native contracts.', 'Cancellation belongs to an invocation. abortSignal reaches native execution and registered helpers; arbitrary application functions must cooperate. A stream event is not automatically a thrown error, and a resolved final value is not universal proof of workflow success.'],
    link: 'README.md#cancellation-and-errors',
  },
};
