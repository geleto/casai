import { has } from './shared.js';

export default function render(options) {
  return {
    configuration: { component: 'VoiceAgentClient', factory: 'VoiceAgentClient', variable: 'voiceSupport', properties: ['model', 'api', 'sessionConfig'] },
    files: [{ name: 'VoiceAgentClient.ts', language: 'typescript', code: `import { VoiceAgentClient } from 'casai/client';
import type { Experimental_RealtimeModel } from 'ai';

export async function prepareVoiceSupportClient(
  model: Experimental_RealtimeModel,
) {
  const voiceSupport = VoiceAgentClient({
    model,
    // Your route authenticates the user and calls VoiceAgentBackend.
    api: { token: '/api/voice/setup' },
    sessionConfig: { voice: 'alloy' },
  });
  const session = await ${has(options, 'run') ? 'voiceSupport.run()' : 'voiceSupport()'};
  // Pass this handle to browser Cascada scripts or application callbacks.
  // Connect explicitly, then observe status === 'connected' before sending.
  // Optional UI adapters use session.subscribe and session.getSnapshot.
  // The owner gracefully closes and disposes the handle when finished.
  return session;
}
` }],
  };
}
