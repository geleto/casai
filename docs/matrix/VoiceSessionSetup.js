import { has, prepared, source, renderExample } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options), tools = has(options, 'useTools');
  const settings = coded ? '{ context: input }' : '{}';
  const call = has(options, 'prepareSession') ? `voiceSupport.prepareSessionConfig(${settings})`
    : has(options, 'webRTC') ? `voiceSupport.createWebRTCSession({ sdp: offerSdp,${coded ? ' context: input,' : ''} })`
    : has(options, 'run') ? `voiceSupport.run(${settings})` : `voiceSupport(${coded ? 'input' : ''})`;
  return renderExample({ component: 'VoiceSessionSetup', variable: 'voiceSupport', options, modelType: 'Experimental_RealtimeModel',
    params: has(options, 'webRTC') ? ['offerSdp: string'] : [],
    description: 'Prepare a browser voice assistant with a realtime model supporting the selected session method.',
    imports: tools ? ['Function', 'z'] : [],
    setup: ["const input = { company: 'Northstar', language: 'English' };", ...(tools ? [`const lookupOrder = Function.asTool({
  description: 'Look up an order delivery date.',
  inputSchema: z.object({ orderId: z.string() }),
  execute: ({ orderId }) => ({ orderId, deliveryDay: 'Friday' }),
});`] : [])],
    fields: tools ? ['// The model must support session tools; the application routes calls back to the server.', 'tools: { lookupOrder },'] : [],
    schema: coded ? 'z.object({ company: z.string(), language: z.string() })' : undefined,
    source: source('VoiceSessionSetup', 'instructions', options, resources,
      '`Help ${input.company} customers in ${input.language}. Keep replies short and ask one question at a time.`',
      '({ company, language }) => `Help ${company} customers in ${language}. Keep replies short and ask one question at a time.`'),
    body: `const session = await ${call};
${tools ? `// Call this adapter from an authenticated server route after checking access.
// Forward the actual call ID and arguments received from the voice session.
const executeTool = (call: { toolCallId: string; toolName: 'lookupOrder'; args: unknown }) =>
  voiceSupport.executeTool(call);
return { session, executeTool };` : 'return session;'}`,
  });
}
