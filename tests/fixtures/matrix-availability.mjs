// Test coverage tracks the checked-out implementation, separately from the
// published API reference. Never emulate new factories just to pass examples.
// Remove exclusions as each planned API lands and run those examples.
export function executesCurrentSource(example) {
  const { component, activeOptions: selected } = example;
  if (['VoiceAgentClient', 'VideoGenerator'].includes(component)) return false;
  if (selected.some(id => ['loadAudio', 'withAudio'].includes(id)) || component === 'Translator') return false;
  if (component === 'Transcriber') return !selected.some(id => ['asStream', 'audioStream'].includes(id));
  if (component === 'SpeechGenerator') return !selected.some(id => ['asStream', 'textStream', 'nativeStream'].includes(id));
  return true;
}
