import { has, prepared, source, lookup, contextField, renderExample, audioStreamSetup, consumeAudio } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options), streaming = has(options, 'asStream'), loaded = has(options, 'loadAudio');
  const raw = streaming || has(options, 'audioStream') || loaded;
  const urlTool = has(options, 'asTool') && !coded && !raw;
  const configuredTool = has(options, 'asTool') && !coded && !urlTool;
  const audio = loaded || urlTool ? 'recordingUrl' : raw ? 'openRecording()' : 'recording';
  const tool = lookup(options, { name: 'findRecording', description: 'Find the available delivery recording.', value: "'delivery-note'" });
  return renderExample({ component: 'Transcriber', variable: 'transcribeNote', functionName: 'transcribeDeliveryNote', options, modelType: 'TranscriptionModel',
    params: [loaded || urlTool ? 'recordingUrl: URL' : raw ? 'pcm24k: Uint8Array' : 'recording: Uint8Array'], description: 'Transcribe the same delivery note.\n// Supply encoded file bytes, raw samples or a media location.', imports: coded ? tool.imports : [],
    toolDescription: 'Transcribe the available delivery-note recording.',
    aiImports: urlTool ? ['createDownload'] : [],
    setup: [...(loaded || urlTool ? ['// Supply an application-authorized recordingUrl, including trusted\n// redirects and playlist resources.'] : []), ...(raw && !loaded && !configuredTool ? [audioStreamSetup] : []), ...(coded ? [tool.setup,
      `const recordings = { 'delivery-note': ${raw ? 'openRecording' : '() => recording'} };`,
      'const getRecording = (id: string) =>\n  recordings[id as keyof typeof recordings]();'] : [])],
    fields: [...(raw ? ['// Requires a model with streaming support for 24 kHz mono PCM16.', "inputAudioFormat: { type: 'audio/pcm', rate: 24000 },"] : []), ...(urlTool ? ['download: createDownload({ maxBytes: 20 * 1024 * 1024 }),'] : []), ...(loaded ? ["// Install node-av. FFmpeg detects the format\n// and selects its best audio stream.", 'mediaSettings: {},'] : []), ...(coded ? [...contextField(['getRecording', ...tool.context]), ...tool.fields] : [])],
    schema: urlTool ? 'z.object({\n  audio: z.enum([recordingUrl.href])\n    .transform(value => new URL(value)),\n})' : coded || configuredTool ? 'z.object({})' : undefined,
    source: source('Transcriber', 'audio', options, resources, configuredTool ? loaded ? 'recordingUrl' : 'pcm24k' : undefined,
      'async ({ findRecording, getRecording }) =>\n  getRecording(await findRecording())'),
    call: coded || configuredTool ? 'transcribeNote({})' : `transcribeNote(${audio})`, named: coded || configuredTool ? '{ context: {} }' : `{ audio: ${audio} }`,
    toolPrompt: "'Transcribe the available delivery note.'",
    toolArgs: urlTool ? '{ audio: recordingUrl.href }' : '{}', result: streaming ? consumeAudio('text') : 'return result.text;',
  });
}
