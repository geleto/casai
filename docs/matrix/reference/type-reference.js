// Reader-facing explanations for public aliases. Keep the exact contract in
// property.type; these labels and notes explain what an application supplies.
export const typeReference = {
  PromptValue: {
    display: 'string | ModelMessage | ModelMessage[]',
    description: 'A text string, one message object, or an array of messages. A message has `role` and `content`, for example `{ role: "user", content: "Summarize this report." }`. Content may also contain image, file or other parts supported by that role.',
    covers: ['ModelMessage'],
  },
  ModelMessage: { description: 'A message object with `role` (`system`, `user`, `assistant` or `tool`) and `content`. For example: `{ role: "user", content: "Hello" }`. The role determines which text, image, file and tool parts are allowed.' },
  Instructions: {
    display: 'string | SystemModelMessage | SystemModelMessage[]',
    description: 'Instruction text, one system message, or an array of system messages. A system message looks like `{ role: "system", content: "Answer briefly." }`.',
    covers: ['SystemModelMessage'],
  },
  SystemModelMessage: { description: 'A message with `role: "system"` and instruction text in `content`.' },
  DataContent: {
    display: 'string | Uint8Array | ArrayBuffer | Buffer',
    description: 'Binary data supplied as a base64 string, `Uint8Array`, `ArrayBuffer`, or Node.js `Buffer`.',
  },
  GenerateImagePrompt: {
    display: 'string | { images: DataContent[]; text?: string; mask?: DataContent }',
    description: 'An image description string, or an object with required `images` and optional `text` and `mask`. Each image and the mask can be a base64 string or binary data (`Uint8Array`, `ArrayBuffer` or `Buffer`).',
    covers: ['DataContent'],
  },
  DecisionState: {
    display: 'string | Readonly<JSONObject> | readonly DecisionStatePart[]',
    description: 'Text, a JSON object, or an ordered array of text, file and JSON parts. For example, `{ type: "text", text: "The delivery arrived late." }` supplies text, and `{ type: "json", value: { rating: 2 } }` supplies JSON.',
    covers: ['DecisionStatePart', 'JSONObject', 'JSONValue'],
  },
  DecisionStatePart: { description: 'An object with a `type` of `text`, `file` or `json`. Text parts contain `text`; file parts contain file `data` and a media type; JSON parts contain `value`.' },
  QueryDocuments: {
    display: '{ query: string; documents: (string | JSONObject)[] }',
    description: 'An object containing both `query` and `documents`. The query is text; each document is text or a JSON object to rank.',
    covers: ['JSONObject'],
  },
  SpeechTextPart: { description: 'A text chunk such as `{ type: "text", text: "Hello" }`. It can also specify a `voice` and `providerOptions` for that chunk.' },
  PreparedContext: { description: 'The `context` object passed to the function combines application values, configured private bindings, registered tool helpers and `_toolOptions` call metadata. Casai validates application values when `inputSchema` is configured.' },
  Value: { description: '`Value` is the value returned by your implementation. The configured `schema`, when present, validates or transforms it.' },
  Element: { description: '`Element` is one item produced by an iterable result. A stream schema validates each item.' },
  Request: { description: '`Request` is the complete set of settings for this component call, including its prepared input. Return the changed request from the hook.' },
  NativeStepOverrides: { description: 'An object containing the model-step settings to change, such as `model`, `messages`, `toolChoice` or `activeTools`. Return `undefined` to leave them unchanged.' },
  JSONObject: { description: 'An object with string keys and JSON values: strings, numbers, booleans, null, arrays or nested JSON objects.' },
  JSONValue: { description: 'A JSON value: a string, number, boolean, null, array or object containing other JSON values.' },
  LanguageModel: { description: 'A language-model object created by a provider, or a model identifier resolved by the SDK.' },
  RealtimeModelV4: { description: 'A realtime model object created by a provider that supports the requested voice-session operation.' },
  ConfigureOptions: { description: 'An object of Cascada rendering options, such as `autoescape`, `trimBlocks` and `lstripBlocks`. Expand the rendering options below for individual fields.' },
  AIOutput: { description: 'An SDK output specification, such as `Output.text()` or `Output.object({ schema })`, which controls how model output is parsed.' },
  SharedV4ProviderOptions: { description: 'An object keyed by provider name. Each entry contains settings supported by that provider.' },
  ProviderOptions: { description: 'An object keyed by provider name. Each entry contains settings supported by that provider.' },
  SharedV4AudioFormat: { description: 'An audio-format object, for example `{ type: "audio/pcm", rate: 24000 }`. The provider determines which formats and sample rates are supported.' },
  DownloadFunction: { description: 'A function receiving an array of `{ url, isUrlSupportedByModel }` requests. It returns a promise of matching `{ data, mediaType }` download results, or `null` entries when no data is downloaded. `data` is a `Uint8Array`.' },
  OnLanguageModelCallStartCallback: { description: 'A function receiving an event object just before a model request begins. It can return a promise if it needs to do asynchronous work.' },
  TemplatePromptType: { display: '"async-template" | "async-template-name"' },
  ScriptPromptType: { display: '"async-script" | "async-script-name"' },
  PromptType: { display: '"text" | "text-name" | "async-template" | "async-template-name" | "async-script" | "async-script-name" | "function"' },
};

const descriptions = new Map();
export function describeType(type) {
  if (descriptions.has(type)) return descriptions.get(type);
  const names = new Set([...type.matchAll(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[A-Za-z_$][\w$]*/g)]
    .map(match => match[0]).filter(name => typeReference[name]));
  const covered = new Set([...names].flatMap(name => typeReference[name].covers ?? []));
  const notes = [...new Set([...names].filter(name => !covered.has(name)).map(name => typeReference[name].description).filter(Boolean))];
  const description = notes.length ? notes.join('\n\n') : null;
  descriptions.set(type, description);
  return description;
}
