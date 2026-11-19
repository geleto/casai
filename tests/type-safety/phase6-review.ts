import { Config, Transcriber, Translator, SpeechGenerator, ImageGenerator, Embedder, Reranker, Decision, VoiceAgentBackend, z, type ComponentConfig } from 'casai';
import type { TranscriptionModel, SpeechModel, ImageModel } from 'ai';

declare const model: TranscriptionModel;
declare const speechModel: SpeechModel;
declare const imageModel: ImageModel;
declare const translationModel: ComponentConfig<'Translator'>['model'];
const format = { type: 'audio/pcm', rate: 24000 };
const bytes = new Uint8Array(2);
const optionalImageText = () => Math.random() > 0.5 ? 'edit' : undefined;
export const imageOnlyConfig = { model: imageModel, images: [bytes], prompt: optionalImageText } satisfies ComponentConfig<'ImageGenerator', 'function'>;
void ImageGenerator.withFunction.asTool({ model: imageModel, prompt: optionalImageText, inputSchema: z.object({}) }, Config({ images: [bytes] }));
// @ts-expect-error An image tool without configured images needs a prompt on every execution.
ImageGenerator.withFunction.asTool({ model: imageModel, prompt: optionalImageText, inputSchema: z.object({}) });
const loaded = Config.loadsAudio({ fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' }, mediaSettings: { track: 0 } });
const plain = Transcriber.withAudio({ model, fileAudioTarget: undefined, mediaSettings: undefined }, loaded);
void plain(bytes);
void plain(bytes, format);
void plain.run({ audio: bytes });
void Transcriber({ model, mediaSettings: undefined })(bytes);
void Transcriber({ model, inputAudioFormat: format, maxRetries: undefined })(bytes);
// @ts-expect-error Undefined does not admit an unknown configuration name.
Transcriber({ model, notAnAudioSetting: undefined });
// @ts-expect-error Defined incompatible settings still fail the native request check.
void Transcriber({ model, download: async () => ({ data: bytes, mediaType: 'audio/wav' }) })(bytes, format);

const translate = Translator.loadsAudio({ model: translationModel, audio: 'meeting.wav', inputAudioFormat: format });
// @ts-expect-error A leading string is a source replacement, so the required language is still missing.
void translate('fr');
void translate(undefined, 'fr');
void translate(undefined, undefined, 'fr');
void translate('replacement.wav', 'fr');
void translate.run({ targetLanguage: 'fr' });
const scripted = Translator.withScript({ model: translationModel, audio: 'return recording', inputAudioFormat: format });
// @ts-expect-error A leading string replaces the script; it cannot supply the required language.
void scripted('fr');
void scripted(undefined, 'fr');
void scripted({}, 'fr');
// Function sources do not accept strings, so a language can omit the source slot.
void Translator.withFunction({ model: translationModel, audio: () => bytes, inputAudioFormat: format })('fr');

const speak = SpeechGenerator({ model: speechModel, text: 'hello' });
void speak('new text');
void speak(undefined, 'alloy');
const draw = ImageGenerator({ model: imageModel, prompt: 'hello', images: [bytes] });
void draw('new text');
void draw(undefined, 'mask.png');
void draw(2);
void draw(bytes);

// @ts-expect-error Parsed text cannot be consumed by the selected raw operation.
Transcriber.asTool({ model, inputAudioFormat: format, inputSchema: z.object({ audio: z.string() }) });
// @ts-expect-error URL transforms also cannot feed raw transcription.
Transcriber.asTool({ model, inputAudioFormat: format, inputSchema: z.object({ audio: z.string().transform(value => new URL(value)) }) });
Transcriber.asTool({ model, inputSchema: z.object({ audio: z.string() }) });
Transcriber.asTool({ model, inputAudioFormat: format, inputSchema: z.object({ audio: z.string().transform(value => new TextEncoder().encode(value)) }) });
// @ts-expect-error Validate an inferred preparer result against the finished raw operation.
Transcriber.withFunction({ model, inputAudioFormat: format, audio: () => 'encoded' });
Transcriber.loadsAudio.asTool({ model, audio: bytes, inputAudioFormat: format, inputSchema: z.object({ audio: z.string() }) });

// Public function-mode annotations must be reusable factory inputs, not callbacks taking never.
export const transcriberFromFunction = (config: ComponentConfig<'Transcriber', 'function'>) => Transcriber.withFunction(config);
export const translatorFromFunction = (config: ComponentConfig<'Translator', 'function'>) => Translator.withFunction(config);
export const speechFromFunction = (config: ComponentConfig<'SpeechGenerator', 'function'>) => SpeechGenerator.withFunction(config);
export const imageFromFunction = (config: ComponentConfig<'ImageGenerator', 'function'>) => ImageGenerator.withFunction(config);
export const embeddingFromFunction = (config: ComponentConfig<'Embedder', 'function'>) => Embedder.withFunction(config);
export const rerankerFromFunction = (config: ComponentConfig<'Reranker', 'function'>) => Reranker.withFunction(config);
export const decisionFromFunction = (config: ComponentConfig<'Decision', 'function'>) => Decision.withFunction(config);
export const voiceFromFunction = (config: ComponentConfig<'VoiceAgentBackend', 'function'>) => VoiceAgentBackend.withFunction(config);

// Exercise calls and exported wrapper results, not just construction from annotations.
export function annotatedSpeech(config: ComponentConfig<'SpeechGenerator'>) {
	const speak = SpeechGenerator(config);
	return [speak('hello'), speak.run({ text: 'hello' })];
}
export function annotatedTranscription(config: ComponentConfig<'Transcriber'>) {
	const transcribe = Transcriber(config);
	return [transcribe(bytes), transcribe.run({ audio: bytes })];
}
export function annotatedPreparation(config: ComponentConfig<'Transcriber', 'audio-resource'>) {
	const transcribe = Transcriber.loadsAudio(config);
	return [transcribe('meeting.wav'), transcribe.run({ audio: 'meeting.wav' })];
}
export function annotatedLiveTranscription(config: ComponentConfig<'Transcriber', 'text', 'stream'>) {
	const transcribe = Transcriber.asStream(config);
	return [transcribe(bytes, format), transcribe.run({ audio: bytes, inputAudioFormat: format })];
}
const rawConfig: ComponentConfig<'Transcriber'> = { model, inputAudioFormat: format };
// @ts-expect-error A configured raw stream needs its selector in a completed annotation.
const _unselectedRaw: ComponentConfig<'Transcriber'> = { model, audio: new ReadableStream<Uint8Array>() };
void Transcriber(rawConfig)(bytes);
void Transcriber({ model }, Config(rawConfig))(bytes);
const fileConfig: ComponentConfig<'Transcriber'> = { model };
void Transcriber(fileConfig)(bytes);
// @ts-expect-error File annotations retain potentially configured file-only settings.
void Transcriber(fileConfig)(bytes, format);
const preparedConfig: ComponentConfig<'Transcriber', 'audio-resource'> = { model, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } };
void Transcriber.loadsAudio(preparedConfig)(bytes);
const collectedConfig: ComponentConfig<'SpeechGenerator'> = { model: speechModel, outputFormat: format, onError: () => undefined };
void SpeechGenerator(collectedConfig)('hello');
// @ts-expect-error A completed annotation must identify its prepared target.
const _unselectedPreparation: ComponentConfig<'Transcriber', 'audio-resource'> = { model };
// @ts-expect-error Collected-only settings need an object format in a broad completed annotation.
const _unselectedSpeech: ComponentConfig<'SpeechGenerator'> = { model: speechModel, onError: () => undefined };
// Inferred factories retain call-time target selection and native non-string text selection.
void Transcriber.loadsAudio({ model })(bytes, format);
void SpeechGenerator({ model: speechModel, text: ['hello'], onError: () => undefined })();

const fixedRaw = Transcriber.withFunction.asStream({ model, inputAudioFormat: format, audio: () => bytes });
void fixedRaw();
void fixedRaw.run();
// @ts-expect-error The fixed operation's source type rejects encoded strings.
void fixedRaw(() => 'encoded');
// @ts-expect-error Named replacement preparers have the same raw source contract.
void fixedRaw.run({ audio: () => 'encoded' });
// @ts-expect-error Native file-only settings do not belong to streaming transcription.
void fixedRaw.run({ download: async () => ({ data: bytes, mediaType: 'audio/wav' }) });
// @ts-expect-error Raw format is an object on named calls too.
void fixedRaw.run({ inputAudioFormat: 'pcm' });
const fixedSpeech = SpeechGenerator.asStream({ model: speechModel });
void fixedSpeech('hello');
void fixedSpeech.run({ text: ['hello'], outputFormat: format });
// @ts-expect-error The fixed streaming operation accepts only an object format.
void fixedSpeech.run({ text: 'hello', outputFormat: 'mp3' });
