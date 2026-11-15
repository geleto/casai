import { has, prepared, source, lookup, contextField, renderExample, audioStreamSetup, consumeAudio } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options), streaming = has(options, 'asStream'), loaded = has(options, 'loadAudio');
  const raw = streaming || has(options, 'audioStream') || loaded;
  const audio = loaded ? 'recordingUrl' : raw ? 'openRecording()' : 'recording';
  const configuredTool = has(options, 'asTool') && !coded;
  const tool = lookup(options, { name: 'findRecording', description: 'Find the available delivery recording.', value: "'delivery-note'" });
  return renderExample({ component: 'Transcriber', variable: 'transcribeNote', functionName: 'transcribeDeliveryNote', options, modelType: 'TranscriptionModel',
    params: [loaded ? 'recordingUrl: URL' : raw ? 'pcm24k: Uint8Array' : 'recording: Uint8Array'], description: 'Transcribe the same delivery note. Supply encoded file bytes, raw samples or a media location.', imports: coded ? tool.imports : [],
    toolDescription: 'Transcribe the available delivery-note recording.',
    setup: [...(loaded ? ['// Supply an application-authorized recordingUrl, including trusted redirects/playlist resources.'] : []), ...(raw && !loaded && !configuredTool ? [audioStreamSetup] : []), ...(coded ? [tool.setup,
      `const recordings = { 'delivery-note': ${raw ? 'openRecording' : '() => recording'} };`,
      'const getRecording = (id: string) => recordings[id as keyof typeof recordings]();'] : [])],
    fields: [...(raw ? ['// This example requires a model with streaming support for 24 kHz mono PCM16.', "inputAudioFormat: { type: 'audio/pcm', rate: 24000 },"] : []), ...(loaded ? ["// Install node-av. FFmpeg detects the format and selects its best audio stream.", 'mediaSettings: {},'] : []), ...(coded ? [...contextField(['getRecording', ...tool.context]), ...tool.fields] : [])],
    schema: coded || configuredTool ? 'z.object({})' : undefined,
    source: source('Transcriber', 'audio', options, resources, configuredTool ? loaded ? 'recordingUrl' : raw ? 'pcm24k' : 'recording' : undefined,
      'async ({ findRecording, getRecording }) => getRecording(await findRecording())'),
    call: coded || configuredTool ? 'transcribeNote({})' : `transcribeNote(${audio})`, named: coded || configuredTool ? '{ context: {} }' : `{ audio: ${audio} }`,
    toolPrompt: "'Transcribe the available delivery note.'",
    toolArgs: '{}', result: streaming ? consumeAudio('text') : 'return result.text;',
  });
}
