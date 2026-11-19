import { Config, Transcriber, SpeechGenerator, Translator, Embedder, Reranker, ImageGenerator, z, type ComponentConfig } from 'casai';
import type { StreamTranscriptionResult, TranscriptionResult, TranscriptionModel, EmbeddingModel } from 'ai';

declare const model: TranscriptionModel;
declare const embeddingModel: EmbeddingModel;
declare const rerankingModel: import('ai').RerankingModel, imageModel: import('ai').ImageModel;
// Explicit empty schemas still require the operation's known inputs; D's default is separate.
// @ts-expect-error No configured or schema-provided embedding input.
Embedder.asTool({ model: embeddingModel, inputSchema: z.object({}) });
// @ts-expect-error Optional public input cannot satisfy a required native value without a fallback.
Embedder.asTool({ model: embeddingModel, inputSchema: z.object({ input: z.string().optional() }) });
Embedder.asTool({ model: embeddingModel, inputSchema: z.object({ input: z.string().default('fallback') }) });
Embedder({}, Config.asTool({ model: embeddingModel, inputSchema: z.object({}), input: 'configured' }));
// @ts-expect-error No effective documents for the query.
Reranker.asTool({ model: rerankingModel, query: 'query', inputSchema: z.object({}) });
Reranker.withFunction.asTool({ model: rerankingModel, query: () => ({ query: 'query', documents: ['document'] }), inputSchema: z.object({}) });
ImageGenerator.asTool({ model: imageModel, prompt: { images: [new Uint8Array(1)] }, inputSchema: z.object({}) });
ImageGenerator.asTool({ model: imageModel, images: [new Uint8Array(1)], inputSchema: z.object({}) });
const format = { type: 'audio/pcm', rate: 24000 };
const bytes = new Uint8Array(2);
const stream = new ReadableStream<Uint8Array>();
declare const recording: AudioBuffer, upload: File;
void Transcriber({ model })(upload);
void Transcriber({ model, inputAudioFormat: format })(recording);
void Transcriber({ model, sourceFormat: { sampleRate: 48000, channels: 2 } })(new Float32Array(2));
void Transcriber.loadsAudio({ model, inputAudioFormat: format }).run({ audio: upload });
// @ts-expect-error A numeric sample array does not carry its rate or channel count.
void Transcriber({ model })(new Float32Array(2));
// Finite input may supply a WAV header; encoding is checked only after classification.
void Transcriber({ model }).run({ audio: bytes, sourceFormat: { sampleRate: 48000, channels: 2 } });
const partialLayout = Config({ sourceFormat: { sampleRate: 48000, channels: 2 } });
void Transcriber({ model, inputAudioFormat: format }, partialLayout)(upload);
void Transcriber.loadsAudio({ model, inputAudioFormat: format }, partialLayout)(stream);
void Transcriber.loadsAudio({ model, inputAudioFormat: format }, partialLayout)(new URL('https://example.test/audio'));
void Transcriber.loadsAudio({ model, inputAudioFormat: format, mediaSettings: { format: 's16le' } }, partialLayout)(bytes);
// @ts-expect-error Ordinary raw streams are not sniffed and require the complete layout for conversion.
void Transcriber({ model, inputAudioFormat: format }, partialLayout)(stream);
// @ts-expect-error Named ordinary raw streams have the same requirement.
void Transcriber({ model, inputAudioFormat: format }).run({ audio: stream, sourceFormat: { sampleRate: 48000, channels: 2 } });
const file = Transcriber({ model });
declare const bytesOrStream: Uint8Array | ReadableStream<Uint8Array>, bytesOrUrl: Uint8Array | URL;
// Every member must fit the selected native operation; a valid byte branch cannot hide a stream or URL.
// @ts-expect-error File transcription cannot consume the stream alternative without a raw target.
void file(bytesOrStream);
// @ts-expect-error Named calls enforce the same union requirement.
void file.run({ audio: bytesOrStream });
void file(bytesOrStream, format);
void file(bytesOrUrl);
// @ts-expect-error Raw transcription cannot consume the URL alternative.
void file(bytesOrUrl, format);
// A preparer that always throws never reaches native request dispatch.
void Transcriber.withFunction({ model, audio: () => { throw new Error('source unavailable'); } })();
const completed: Promise<TranscriptionResult> = file(bytes);
const collected: Promise<TranscriptionResult> = file(bytes, format);
const live = Transcriber.asStream({ model });
const incremental: Promise<StreamTranscriptionResult> = live(bytes, format);
const named: Promise<StreamTranscriptionResult> = live.run({ audio: stream, inputAudioFormat: format });
// @ts-expect-error Raw streaming requires a format.
void live(bytes);
// @ts-expect-error Raw streaming requires a format in named calls too.
void live.run({ audio: stream });
// @ts-expect-error URL downloading belongs to encoded-file execution.
void live(new URL('https://example.test/audio.wav'), format);
// @ts-expect-error Raw streams require their format even for completed delivery.
void file(stream);

const fragment = Config.asStream({ inputAudioFormat: format });
const inherited = Transcriber({ model }, fragment);
const inheritedResult: Promise<StreamTranscriptionResult> = inherited(bytes);
const copied = Transcriber({ ...fragment.config, model });
const copiedResult: Promise<StreamTranscriptionResult> = copied(bytes);
const prepared = Transcriber.withFunction({ audio: ({ size }) => new Uint8Array(size), inputSchema: z.object({ size: z.string().transform(Number) }) }, inherited);
const preparedResult: Promise<StreamTranscriptionResult> = prepared({ size: '2' });
// @ts-expect-error Inherited streaming also selects the preparer's native result contract.
Transcriber.withFunction({ audio: () => new URL('https://example.test/audio.wav') }, inherited);
// @ts-expect-error A stream and tool are incompatible even through inheritance.
Transcriber.asTool({ inputSchema: z.object({}), audio: bytes }, inherited);
// @ts-expect-error Other families cannot inherit streaming selection.
Embedder({ model: embeddingModel }, fragment);
// @ts-expect-error Named flags have been removed, including undefined.
Transcriber({ model, streaming: undefined });
// @ts-expect-error Named flags have been removed from incomplete fragments too.
Config({ asTool: true });
const annotation: ComponentConfig<'Transcriber', 'text', 'stream'> = { model, inputAudioFormat: format };
Transcriber.asStream(annotation);
// @ts-expect-error Embedder has no streaming factory.
const _streamingEmbedder: ComponentConfig<'Embedder', 'text', 'stream'> = { model: embeddingModel };
// @ts-expect-error Only Transcriber in this family union can load audio.
const _loadedEmbedder: ComponentConfig<'Transcriber' | 'Embedder', 'audio-resource'> = { model: embeddingModel };
const _supportedStream: ComponentConfig<'Transcriber' | 'Embedder', 'text', 'stream'> = annotation;
// @ts-expect-error Raw-only execution must not accept native file downloading.
Transcriber.asStream({ model, download: async () => ({ data: bytes, mediaType: 'audio/wav' }) });
// @ts-expect-error Completed delivery does not expose raw event chunks.
Transcriber({ model, inputAudioFormat: format, includeRawChunks: true });
Transcriber.asStream({ model, inputAudioFormat: format, includeRawChunks: true });
void Promise.all([completed, collected, incremental, named, inheritedResult, copiedResult, preparedResult]);

declare const speechModel: Parameters<typeof import('ai').generateSpeech>[0]['model'];
declare const translationModel: Parameters<typeof import('ai').experimental_streamTranslate>[0]['model'];
declare const mixedSamples: Uint8Array | Float32Array;
// @ts-expect-error An explicit loaded target annotation describes mono PCM16.
const _loadedCompanded: ComponentConfig<'Transcriber', 'audio-resource', 'stream'> = { model, inputAudioFormat: { type: 'audio/pcmu', rate: 8000 } };
// @ts-expect-error Loaded translation shorthand has the same target as a named call.
void Translator.loadsAudio({ model: translationModel, targetLanguage: 'fr' })('recording', { type: 'audio/pcmu', rate: 8000 });
const rawRecording = Transcriber({ model, inputAudioFormat: format });
// @ts-expect-error Numeric shorthand requires the source rate and channel count.
void rawRecording(new Int16Array(4));
// @ts-expect-error Every member of the input union needs an executable layout.
void rawRecording.run({ audio: mixedSamples });
// @ts-expect-error A finished numeric tool cannot obtain its private layout from descriptor arguments.
Transcriber.asTool({ model, audio: new Float32Array(2), inputSchema: z.object({}) });
// @ts-expect-error The typed preparer returns headerless samples.
Transcriber.withFunction.asTool({ model, inputAudioFormat: format, audio: () => new Float32Array(2), inputSchema: z.object({}) });
// @ts-expect-error Array-valued text selects streaming speech, which cannot use a string format.
SpeechGenerator.asTool({ model: speechModel, outputFormat: 'mp3', inputSchema: z.object({ text: z.array(z.string()) }) });
// @ts-expect-error Complete-only retries cannot apply to the parsed text stream.
SpeechGenerator.asTool({ model: speechModel, maxRetries: 2, inputSchema: z.object({ text: z.array(z.string()) }) });
// @ts-expect-error Loaded PCM preparation needs a target rate.
Transcriber.loadsAudio({ model, inputAudioFormat: { type: 'audio/pcm' } });
// @ts-expect-error An explicit companded target cannot be produced by native raw preparation.
Translator.loadsAudio({ model: translationModel, inputAudioFormat: { type: 'audio/pcmu', rate: 8000 } as const, targetLanguage: 'fr' });
// @ts-expect-error Loaded named calls also need the PCM rate.
void Transcriber.loadsAudio({ model }).run({ audio: 'recording.wav', inputAudioFormat: { type: 'audio/pcm' } });
Transcriber.withFunction.asTool({ model, sourceFormat: { channels: 1, sampleRate: 48000 }, audio: () => new Float32Array(2), inputSchema: z.object({}) });
SpeechGenerator.asTool({ model: speechModel, outputFormat: format, inputSchema: z.object({ text: z.array(z.string()) }) });
// @ts-expect-error SpeechGenerator has no native audio source modifier.
const _loadedSpeaker: ComponentConfig<'SpeechGenerator', 'audio-resource'> = { model: speechModel, text: new URL('file:///speech') };
const speaker = SpeechGenerator({ model: speechModel });
void speaker('hello', 'alloy');
void speaker(['hello', 'world']);
void speaker.run({ text: ['hello'], outputFormat: format });
// @ts-expect-error Complete string formats cannot encode native text streams.
void speaker.run({ text: ['hello'], outputFormat: 'mp3' });
const mp3 = SpeechGenerator({ model: speechModel, outputFormat: 'mp3' });
// @ts-expect-error A configured string format also requires string text.
void mp3(['hello']);
// @ts-expect-error Streaming speech uses native format objects.
SpeechGenerator.asStream({ model: speechModel, outputFormat: 'mp3' });
// @ts-expect-error Completed delivery has no raw event chunks.
SpeechGenerator({ model: speechModel, includeRawChunks: true });
const speechAnnotation: ComponentConfig<'SpeechGenerator', 'text', 'stream'> = { model: speechModel, onError: event => { String(event.error); } };
SpeechGenerator.asStream(speechAnnotation);

const translation = Translator({ model: translationModel, inputAudioFormat: format });
void translation(bytes, 'fr');
new Response((await translation(bytes, 'fr')).audio);
void translation(bytes, format, 'fr');
void translation.run({ audio: bytes, targetLanguage: 'fr' });
// @ts-expect-error Language remains required independently of delivery.
void translation(bytes);
// @ts-expect-error Raw native URLs are not translation audio.
void translation(new URL('https://example.test/audio.wav'), 'fr');
// @ts-expect-error Tools need a fixed translation target.
Translator.asTool({ model: translationModel, inputAudioFormat: format, audio: bytes, inputSchema: z.object({}) });
Translator.asTool({ model: translationModel, inputAudioFormat: format, targetLanguage: 'fr', audio: bytes, inputSchema: z.object({}) });
const translationSettings = { model: translationModel, inputAudioFormat: format, targetLanguage: 'fr' };
// @ts-expect-error A direct translation tool cannot dispatch an encoded string as raw audio.
Translator.asTool({ ...translationSettings, inputSchema: z.object({ audio: z.string() }) });
// @ts-expect-error A URL is not raw input for ordinary translation.
Translator.asTool({ ...translationSettings, inputSchema: z.object({ audio: z.instanceof(URL) }) });
Translator.asTool({ ...translationSettings, inputSchema: z.object({ audio: z.string().transform(() => bytes) }) });

const target = { format: 'wav', codec: 'pcm_s16le' };
const loaded = Transcriber.loadsAudio({ model, fileAudioTarget: target });
declare const demuxer: string | undefined;
void loaded.run({ audio: bytes, mediaSettings: { format: demuxer } });
void loaded.run({ audio: new Float32Array(4), sourceFormat: { sampleRate: 48000, channels: 2 } });
void loaded('recording.mp4');
void loaded(bytes);
void loaded.run({ audio: stream, mediaSettings: { track: 2, options: { headers: 'Authorization: Bearer private\r\n' } } });
// @ts-expect-error Loaded encoded-file preparation cannot also select raw streaming.
Transcriber.loadsAudio({ model, fileAudioTarget: target, inputAudioFormat: format });
// @ts-expect-error File targets are not raw streaming targets.
Transcriber.loadsAudio.asStream({ model, fileAudioTarget: target });
// @ts-expect-error Ordinary supplied audio does not use native media options.
Transcriber({ model, mediaSettings: { track: 0 } });
// @ts-expect-error Loaded tools cannot delegate resource selection to model arguments.
Transcriber.loadsAudio.asTool({ model, fileAudioTarget: target, inputSchema: z.object({ audio: z.string() }) });
const loadedFragment = Config.loadsAudio({ audio: bytes, fileAudioTarget: target });
Transcriber.asTool({ model, inputSchema: z.object({}) }, loadedFragment);
// @ts-expect-error Leaving native preparation requires clearing its target.
Transcriber.withAudio({ model }, loadedFragment);
Transcriber.withAudio({ model, fileAudioTarget: undefined }, loadedFragment);
const loadedTranslation = Translator.loadsAudio({ model: translationModel, audio: 'recording.mp4', inputAudioFormat: format, targetLanguage: 'fr' });
void loadedTranslation();
void loadedTranslation.run({ targetLanguage: 'es' });
void loadedTranslation(undefined, undefined, 'es');
// Dispatch checks use effective inputs, including omitted calls and inherited settings.
const configuredRaw = Transcriber({ model, audio: stream });
// @ts-expect-error The no-argument overload must not bypass the required format.
void configuredRaw();
// @ts-expect-error Named calls have the same requirement.
void configuredRaw.run();
void configuredRaw(format);
const preparedRaw = Transcriber.withFunction({ model, audio: () => stream });
// @ts-expect-error A configured preparer returning raw audio still needs the format.
void preparedRaw();
void preparedRaw({}, format);
// @ts-expect-error Ordinary URL input cannot be sent to raw transcription.
void file(new URL('https://example.test/recording.wav'), format);
// @ts-expect-error Named URL inputs cannot be sent to raw transcription either.
void file.run({ audio: new URL('https://example.test/recording.wav'), inputAudioFormat: format });
void file(new URL('https://example.test/recording.wav'));
const retryFragment = Config({ maxRetries: 2 });
const retryTranscription = Transcriber({ model }, retryFragment);
void retryTranscription(bytes);
// @ts-expect-error Selecting raw streaming must not discard inherited retry settings.
void retryTranscription(bytes, format);
// @ts-expect-error Named overrides must select one compatible native operation.
void retryTranscription.run({ audio: bytes, inputAudioFormat: format });
// @ts-expect-error Mixing the operation-only setting in the call is also invalid.
void file.run({ audio: bytes, inputAudioFormat: format, maxRetries: 2 });
const downloaded = Transcriber({ model, download: async () => ({ data: bytes, mediaType: 'audio/wav' }) });
// @ts-expect-error The native downloader belongs only to file transcription.
void downloaded(bytes, format);
const retrySpeech = SpeechGenerator({ model: speechModel }, retryFragment);
void retrySpeech('hello');
// @ts-expect-error Iterable text selects streaming, which cannot apply maxRetries.
void retrySpeech(['hello']);
// @ts-expect-error The named text override has the same dispatch rule.
void retrySpeech.run({ text: ['hello'] });
// @ts-expect-error A format override cannot discard complete-only settings.
void retrySpeech.run({ text: 'hello', outputFormat: format });
// @ts-expect-error Undefined invocation settings inherit; they do not clear retry configuration.
void retrySpeech.run({ text: ['hello'], maxRetries: undefined });
void mp3.run({ text: ['hello'], outputFormat: format });
const preparedSpeech = SpeechGenerator.withFunction({ model: speechModel, text: () => 'hello' }, retryFragment);
void preparedSpeech();
// @ts-expect-error Replacement preparers cannot select an incompatible native request.
void preparedSpeech(() => ['hello']);
const onErrorSpeech = SpeechGenerator({ model: speechModel, onError: () => undefined });
void onErrorSpeech(['hello']);
void onErrorSpeech.run({ text: 'hello', outputFormat: format });
// @ts-expect-error onError does not make a complete-text call select streaming.
void onErrorSpeech('hello');
declare const optionalFormat: typeof format | undefined;
void file(bytes, optionalFormat);
void speaker.run({ text: 'hello', outputFormat: optionalFormat });
declare const textOrStream: string | string[];
void speaker(textOrStream);
// @ts-expect-error Every possible request must support the configured retries.
void retrySpeech(textOrStream);

// A configured union keeps each source paired with its own native format.
declare const audioAlternative: { audio: URL; inputAudioFormat?: undefined }
	| { audio: Uint8Array; inputAudioFormat: typeof format };
const configuredAlternative = Transcriber({ model }, { config: audioAlternative });
void configuredAlternative();
void configuredAlternative.run();
// @ts-expect-error The raw branch cannot accept a URL override.
void configuredAlternative.run({ audio: new URL('https://example.test/audio.wav') });
declare const speechAlternative: { text: string; outputFormat: 'mp3' }
	| { text: string[]; outputFormat: typeof format };
const configuredSpeechAlternative = SpeechGenerator({ model: speechModel }, { config: speechAlternative });
void configuredSpeechAlternative();
void configuredSpeechAlternative.run();
// @ts-expect-error The string-format branch cannot accept an iterable override.
void configuredSpeechAlternative.run({ text: ['hello'] });
void speaker.run(speechAlternative);
const scriptSpeech = SpeechGenerator.withScript({ model: speechModel, text: 'return "hello"', maxRetries: 1 });
void scriptSpeech();
void scriptSpeech.run();
const mp3Script = SpeechGenerator.withScript({ model: speechModel, text: 'return "hello"', outputFormat: 'mp3' });
void mp3Script();
// @ts-expect-error An object format makes streaming certain even when the script result is opaque.
void scriptSpeech.run({ outputFormat: format });

// Optional modifiers preserve both delivery outcomes through spreads and parents.
const maybeLive = Math.random() ? Config.asStream({}).config : undefined;
const maybeTranscribe = Transcriber({ model, inputAudioFormat: format, ...maybeLive });
const maybeSpeak = SpeechGenerator({ model: speechModel, outputFormat: format, ...maybeLive });
const maybeTranslate = Translator({ model: translationModel, inputAudioFormat: format, targetLanguage: 'fr', ...maybeLive });
const _maybeTranscript: Promise<TranscriptionResult | StreamTranscriptionResult> = maybeTranscribe(bytes);
const _maybeSpeech: Promise<import('casai').SpeechResult | import('ai').Experimental_StreamSpeechResult> = maybeSpeak('hello');
const _maybeTranslation: Promise<import('casai').TranslationResult | import('ai').Experimental_StreamTranslationResult> = maybeTranslate(bytes);
// @ts-expect-error Optional streaming cannot promise only a streaming result.
const _onlyStreamTranscript: Promise<StreamTranscriptionResult> = maybeTranscribe(bytes);
// @ts-expect-error Optional streaming cannot promise only a streaming result.
const _onlyStreamSpeech: Promise<import('ai').Experimental_StreamSpeechResult> = maybeSpeak('hello');
// @ts-expect-error Optional streaming cannot promise only a streaming result.
const _onlyStreamTranslation: Promise<import('ai').Experimental_StreamTranslationResult> = maybeTranslate(bytes);
const optionalParent = Config({}, Config({ ...maybeLive }));
const maybeInherited = Transcriber({ model, inputAudioFormat: format }, optionalParent);
// @ts-expect-error Intermediate Config inheritance must retain delivery uncertainty.
const _onlyStreamParent: Promise<StreamTranscriptionResult> = maybeInherited.run({ audio: bytes });
// @ts-expect-error Completed delivery cannot expose raw events.
Transcriber({ model, inputAudioFormat: format, includeRawChunks: true, ...maybeLive });
// @ts-expect-error Completed delivery cannot expose raw events.
SpeechGenerator({ model: speechModel, outputFormat: format, includeRawChunks: true, ...maybeLive });
// @ts-expect-error Completed delivery cannot expose raw events.
Translator({ model: translationModel, inputAudioFormat: format, targetLanguage: 'fr', includeRawChunks: true, ...maybeLive });
// @ts-expect-error Named settings must also be valid with completed delivery.
void maybeTranslate.run({ audio: bytes, includeRawChunks: true });
// @ts-expect-error Loaded optional streaming still excludes completed raw events.
Transcriber.loadsAudio({ model, inputAudioFormat: format, includeRawChunks: true, ...maybeLive });
// @ts-expect-error A possible streaming request cannot use file downloading.
Transcriber({ model, download: async () => ({ data: bytes, mediaType: 'audio/wav' }), ...maybeLive });
const uncertainSpeech = SpeechGenerator({ model: speechModel, onError: () => undefined, ...maybeLive });
void uncertainSpeech(['hello']);
void uncertainSpeech.run({ text: 'hello', outputFormat: format });
// @ts-expect-error Without the modifier this selects complete speech, which has no onError.
void uncertainSpeech('hello');
// @ts-expect-error Named calls must validate the complete branch too.
void uncertainSpeech.run({ text: 'hello' });
const correlatedParent = Math.random() ? Config.asStream({ inputAudioFormat: format, includeRawChunks: true }) : Config({ inputAudioFormat: format });
void Transcriber({ model }, correlatedParent)(bytes);

// Trusted source overrides on tools distinguish streams from application context.
const uploadedTool = Transcriber.loadsAudio.asTool({ model, audio: bytes, inputAudioFormat: format, inputSchema: z.object({ label: z.string() }) });
void uploadedTool(stream, { label: 'upload' });
void uploadedTool.run({ audio: stream, context: { label: 'upload' } });
// @ts-expect-error Source recognition must not hide required application input.
void uploadedTool(stream);
const uploadedTranslation = Translator.loadsAudio.asTool({ model: translationModel, audio: bytes, inputAudioFormat: format, targetLanguage: 'fr', inputSchema: z.object({}) });
void uploadedTranslation(stream);
void uploadedTranslation(stream, {});
void uploadedTranslation.run({ audio: stream });
// @ts-expect-error SDK model arguments cannot replace the configured resource.
void uploadedTranslation.execute({ audio: stream }, { toolCallId: 'call', messages: [], context: undefined });
const plainAudioTool = Transcriber.asTool({ model, audio: bytes, inputAudioFormat: format, inputSchema: z.object({}) });
void plainAudioTool(stream);
