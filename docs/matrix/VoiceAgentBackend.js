import { has, prepared, source, renderExample, literal, invoke } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options), tools = has(options, 'useTools');
  const context = "{ company: 'Northstar', language: 'English' }";
  const settings = coded ? `{ context: ${context} }` : '{}';
  const call = has(options, 'prepareSession') ? invoke('voiceSupport.prepareSessionConfig', settings)
    : has(options, 'webRTC') ? invoke('voiceSupport.createWebRTCSession', `{ sdp: offerSdp,${coded ? ` context: ${context},` : ''} }`)
    : has(options, 'run') ? invoke('voiceSupport.run', settings) : invoke('voiceSupport', coded ? context : '');
  return renderExample({ component: 'VoiceAgentBackend', variable: 'voiceSupport', functionName: 'prepareVoiceSupportSession', options, modelType: 'Experimental_RealtimeModel',
    params: has(options, 'webRTC') ? ['offerSdp: string'] : [],
    description: 'Prepare a browser voice assistant with a realtime model\n// supporting the selected session method.',
    imports: tools ? ['Function', 'z'] : [],
    setup: tools ? [`const lookupOrder = Function.asTool({
  description: 'Look up an order delivery date.',
  inputSchema: z.object({ orderId: z.string() }),
  execute: ({ orderId }) => ({ orderId, deliveryDay: 'Friday' }),
});`] : [],
    fields: tools ? ['// The model must support session tools.\n// The application routes calls back to the server.', 'tools: { lookupOrder },'] : [],
    schema: coded ? 'z.object({ company: z.string(), language: z.string() })' : undefined,
    source: source('VoiceAgentBackend', 'instructions', options, resources,
      literal('Help Northstar customers in English. Keep replies short and ask one question at a time.'),
      '({ company, language }) =>\n  `Help ${company} customers in ${language}. ` +\n  "Keep replies short and ask one question at a time."'),
    body: `const session = await ${call};
${tools ? `// Call this adapter from an authenticated server route after checking access.
// Forward the actual call ID and arguments received from the voice session.
const executeTool = (call: {
  toolCallId: string;
  toolName: 'lookupOrder';
  args: unknown;
}) => voiceSupport.executeTool(call);
return { session, executeTool };` : 'return session;'}`,
  });
}
