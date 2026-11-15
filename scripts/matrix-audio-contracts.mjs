// Selected audio documentation contracts. Native fields/results are extracted
// from the installed SDK; these aliases do not implement or emulate Casai APIs.
// Replace these additions with production declarations when the migration lands.
export function audioContracts(aliases, details) {
  const native = operation => `Omit<Parameters<typeof import('ai').${operation}>[0], '_internal'>`;
  const config = (owner, settings) => `Omit<import('../src/types/component.js').ComponentConfig<'${owner}', 'text'>, keyof import('../src/types/component-map.js').ComponentSettings['${owner}'] | 'streaming' | 'asTool'> & Omit<Partial<${settings}>, 'abortSignal'> & Pick<${settings}, 'model'>`;
  const raw = 'Uint8Array | ArrayBuffer | ReadableStream<Uint8Array | string>';
  const sources = { withAudio: 'text', withScript: 'async-script', withFunction: 'function', loadsScript: 'async-script-name', loadsAudio: 'audio-resource' };
  const textSources = { withText: 'text', withTemplate: 'async-template', loadsText: 'text-name', loadsTemplate: 'async-template-name', withScript: 'async-script', withFunction: 'function', loadsScript: 'async-script-name' };
  Object.assign(aliases, {
    TranscriberFile_settings: native('transcribe'),
    TranscriberStream_settings: `Omit<${native('experimental_streamTranscribe')}, 'audio'> & { audio: ${raw} }`,
    SpeechGeneratorComplete_settings: native('generateSpeech'),
    SpeechGeneratorStream_settings: native('experimental_streamSpeech'),
    Translator_settings: `Omit<${native('experimental_streamTranslate')}, 'audio' | 'includeRawChunks'> & { audio: ${raw} }`,
    TranslatorStream_settings: `Omit<${native('experimental_streamTranslate')}, 'audio'> & { audio: ${raw} }`,
    SpeechGenerator_result: `import('ai').SpeechResult & { audioFormat?: NonNullable<${native('experimental_streamSpeech')}['outputFormat']>; usage?: Awaited<Awaited<ReturnType<typeof import('ai').experimental_streamSpeech>>['usage']> }`,
    Translator_result: `{ audio: Uint8Array } & { [K in 'sourceText' | 'translationText' | 'durationInSeconds' | 'usage' | 'warnings' | 'response' | 'providerMetadata']: Awaited<Awaited<ReturnType<typeof import('ai').experimental_streamTranslate>>[K]> }`,
  });
  aliases.Transcriber_settings = 'TranscriberFile_settings';
  aliases.SpeechGenerator_settings = 'SpeechGeneratorComplete_settings';
  aliases.TranscriberRaw_settings = "Omit<TranscriberStream_settings, 'includeRawChunks'>";
  aliases.SpeechGeneratorCollected_settings = "Omit<SpeechGeneratorStream_settings, 'includeRawChunks'>";
  for (const [name, owner, settings] of [
    ['Transcriber', 'Transcriber', 'TranscriberFile_settings'],
    ['TranscriberStream', 'StreamingTranscriber', 'TranscriberStream_settings'],
    ['SpeechGenerator', 'SpeechGenerator', 'SpeechGeneratorComplete_settings'],
    ['SpeechGeneratorStream', 'StreamingSpeechGenerator', 'SpeechGeneratorStream_settings'],
    ['Translator', 'StreamingTranslator', 'Translator_settings'],
    ['TranslatorStream', 'StreamingTranslator', 'TranslatorStream_settings'],
  ]) {
    const speech = name.startsWith('Speech'), live = name.endsWith('Stream');
    const input = speech ? "SpeechGeneratorStream_settings['text']" : name === 'Transcriber' ? 'string | Uint8Array | ArrayBuffer | URL' : raw;
    aliases[`${name}_config`] = config(owner, settings);
    aliases[`${name}_inputs`] = `{ direct: ${input}; prepared: ${input}; template: ${speech ? 'string' : 'never'} }`;
    aliases[`${name}_definition`] = JSON.stringify({ name, main: speech ? 'text' : 'audio', defaultMode: 'text', modifiers: speech ? textSources : sources,
      asStream: true, toolModes: live ? [] : [...new Set(['text', ...Object.values(speech ? textSources : sources)])], required: ['model'], ...(name === 'Translator' ? { toolRequired: ['inputAudioFormat', 'targetLanguage'] } : {}) });
  }
  for (const [name, operation] of Object.entries({ TranscriberStream: 'experimental_streamTranscribe', SpeechGeneratorStream: 'experimental_streamSpeech', Translator: 'experimental_streamTranslate', TranslatorStream: 'experimental_streamTranslate' })) {
    aliases[`${name}_native`] = native(operation);
    if (name !== 'Translator') aliases[`${name}_result`] = `Awaited<ReturnType<typeof import('ai').${operation}>>`;
  }
  aliases.TranscriberRaw_config = config('StreamingTranscriber', 'TranscriberRaw_settings');
  aliases.SpeechGeneratorCollected_config = config('StreamingSpeechGenerator', 'SpeechGeneratorCollected_settings');
  // The property summary spans operations; their configuration shapes stay separate.
  aliases.SpeechGeneratorFormat_properties = "{ outputFormat?: SpeechGenerator_settings['outputFormat'] | SpeechGeneratorStream_settings['outputFormat'] }";
  Object.assign(details, {
    MediaSettings: '{ track?: number; format?: string; options?: Record<string, string | number | boolean | bigint | null | undefined> }',
    SpeechAudioFormat: `NonNullable<${native('experimental_streamSpeech')}['outputFormat']>`,
    SpeechTextPart: "import('ai').Experimental_SpeechTextPart",
  });
  aliases.AudioPreparation_config = `{ mediaSettings?: MediaSettings; inputAudioFormat?: ${native('experimental_streamTranscribe')}['inputAudioFormat'] }`;
  for (const old of ['StreamingTranscriber', 'StreamingSpeechGenerator', 'StreamingTranslator']) {
    for (const suffix of ['config', 'settings', 'inputs', 'definition', 'native', 'result']) delete aliases[`${old}_${suffix}`];
  }
}
