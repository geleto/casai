// Test coverage tracks the checked-out implementation, separately from the
// published API reference. Never emulate new factories just to pass examples.
// Remove exclusions as each planned API lands and run those examples.
export const compilesCurrentSource = ({ component }) => !['VoiceAgentClient', 'VideoGenerator'].includes(component);
// Native resource examples compile here and execute in the optional native stage.
export const executesCurrentSource = example => compilesCurrentSource(example) && !example.activeOptions.includes('loadAudio');
