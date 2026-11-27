// Audio variants use the same family-owned declarations as the public factories.
export function audioContracts(aliases, details) {
  const family = (owner, stream = false) => `import('../src/factories/${owner}.js').Types<'text', ${stream ? "import('../src/config/modifiers.js').EnabledStreamMode" : '{}'}, false>`;
  const config = (owner, stream = false) => `import('../src/types/component.js').ComponentConfig<'${owner}', 'text', '${stream ? 'stream' : 'complete'}'>`;
  for (const owner of ['Transcriber', 'SpeechGenerator', 'Translator']) {
    for (const stream of [false, true]) {
      const name = owner + (stream ? 'Stream' : '');
      const types = family(owner, stream);
      aliases[`${name}_config`] = config(owner, stream);
      aliases[`${name}_settings`] = `${types}['selectedSettings']`;
      aliases[`${name}_result`] = `${types}['result']`;
      aliases[`${name}_definition`] = `${types}['definition']`;
      const input = `${types}['selectedSettings']['${owner === 'SpeechGenerator' ? 'text' : 'audio'}']`;
      aliases[`${name}_inputs`] = `{ direct: ${input}; prepared: ${input}; template: ${owner === 'SpeechGenerator' ? 'string' : 'never'} }`;
    }
  }
  // A submitted file has no live input format. Keep the native live field and its documentation independently.
  aliases.TranscriberLive_native = "Extract<Parameters<typeof import('ai').experimental_streamTranscribe>[0], { inputAudioFormat: { type: string } }>";
  aliases.TranscriberFile_settings = `Extract<${family('Transcriber')}['selectedSettings'], { inputAudioFormat?: undefined }>`;
  aliases.TranscriberRaw_settings = `Exclude<${family('Transcriber')}['selectedSettings'], { inputAudioFormat?: undefined }>`;
  aliases.TranscriberRaw_config = `Exclude<${config('Transcriber')}, { inputAudioFormat?: undefined }>`;
  aliases.Transcriber_settings = 'TranscriberFile_settings';
  aliases.Transcriber_config = `Extract<${config('Transcriber')}, { inputAudioFormat?: undefined }>`;
  aliases.SpeechGeneratorComplete_settings = `Extract<${family('SpeechGenerator')}['selectedSettings'], { outputFormat?: string }>`;
  aliases.SpeechGeneratorCollected_settings = `Exclude<${family('SpeechGenerator')}['selectedSettings'], { outputFormat?: string }>`;
  aliases.SpeechGeneratorCollected_config = `Exclude<${config('SpeechGenerator')}, { outputFormat?: string }>`;
  aliases.SpeechGenerator_settings = 'SpeechGeneratorComplete_settings';
  aliases.SpeechGenerator_config = `Extract<${config('SpeechGenerator')}, { outputFormat?: string }>`;
  aliases.SpeechGeneratorFormat_properties = `Pick<${family('SpeechGenerator')}['selectedSettings'], 'outputFormat'>`;
  aliases.AudioPreparation_config = "Pick<import('../src/types/component.js').ComponentConfig<'Transcriber', 'audio-resource'>, 'mediaSettings' | 'fileAudioTarget' | 'inputAudioFormat'>";
  aliases.RawAudioPreparation_config = "Pick<AudioPreparation_config, 'mediaSettings' | 'inputAudioFormat'>";
  Object.assign(details, {
    PcmSourceFormat: "import('../src/audio/pcm.js').PcmSourceFormat",
    MediaSettings: "import('../src/audio/preparation.js').MediaSettings",
    FileAudioTarget: "import('../src/audio/preparation.js').FileAudioTarget",
    FileAudioFormat: "import('../src/audio/preparation.js').FileAudioFormat",
    SpeechAudioFormat: "import('../src/audio.js').AudioFormat",
    SpeechTextPart: "import('ai').Experimental_SpeechTextPart",
  });
}
