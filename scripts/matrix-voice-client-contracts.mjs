// Selected client API for documentation only. Replace with production exports
// when Phase 7 lands; this does not implement or emulate a browser session.
export function voiceClientContracts(aliases, details) {
  const options = "import('ai').Experimental_RealtimeSessionOptions";
  const session = "import('ai').Experimental_AbstractRealtimeSession";
  Object.assign(aliases, {
    VoiceAgentClient_config: options,
    VoiceAgentClient_settings: options,
    VoiceAgentClient_native: options,
    VoiceAgentClient_inputs: '{}',
    VoiceAgentClient_definition: JSON.stringify({ name: 'VoiceAgentClient', main: null, defaultMode: null, modifiers: {}, toolModes: [], required: ['model', 'api'], fixedSettings: ['model'] }),
    VoiceAgentClient_result: `Pick<${session}, keyof ${session}> & { getSnapshot(): Readonly<import('ai').Experimental_RealtimeState>; subscribe(listener: () => void): () => void }`,
  });
  Object.assign(details, {
    VoiceClientApi: `${options}['api']`,
    VoiceClientSnapshot: "Readonly<import('ai').Experimental_RealtimeState>",
    VoiceClientSessionConfig: "import('ai').Experimental_RealtimeSessionConfig",
  });
}
