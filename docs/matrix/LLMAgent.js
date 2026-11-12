import { has, prepared, source, lookup, contextField, renderExample, literal } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options), tools = has(options, 'useTools'), history = has(options, 'messages');
  const resume = has(options, 'resume'), stream = has(options, 'asStream'), structured = has(options, 'structured');
  const policy = 'Report damage within 30 days and include a photo. Replacement shipping is free.';
  const question = 'My mug arrived cracked. What should I do?';
  const context = resume ? 'input' : `{ question: ${literal(question)} }`;
  const tool = lookup(options, { name: 'lookupPolicy', description: 'Look up the store returns policy.', value: 'policy' });
  const fields = [
    ...(has(options, 'asTool') && !coded ? ['// This tool answers the saved request; it accepts no new question.'] : []),
    ...contextField(coded ? ['policy'] : []),
    ...(tools ? [...tool.fields, "instructions: 'Call lookupPolicy before answering the customer.',", 'stopWhen: isStepCount(3),'] : []),
    ...(resume ? ["toolApproval: { lookupPolicy: 'user-approval' },"] : []),
    ...(structured ? ['output: Output.object({ schema: z.object({ answer: z.string(), nextStep: z.string() }) }),'] : []),
  ];
  const named = [...(coded ? [`context: ${context}`] : []), ...(history ? ['messageHistory'] : [])];
  const call = has(options, 'run') ? `returnsAdvisor.run({${named.length ? ' ' + named.join(', ') + ' ' : ''}})`
    : `returnsAdvisor(${[...(coded ? [context] : []), ...(history ? ['messageHistory'] : [])].join(', ')})`;
  const consume = name => stream ? `for await (const part of ${name}.fullStream) console.log(part);\n` : '';
  const final = name => `return { output: ${stream ? 'await ' : ''}${name}.output, messageHistory: await ${name}.messageHistory };`;
  const body = resume ? `const pending = await ${call};
${consume('pending')}const content = await pending.content;
const requests = content.flatMap(part => part.type === 'tool-approval-request' ? [part.approvalId] : []);
if (!requests.length) { ${final('pending')} }
// Collect a decision for this paused turn; unselected requests are denied.
const approvedIds = await chooseApprovals(requests);
const result = await returnsAdvisor.resume(await pending.messageHistory, {
  approve: approvedIds,${coded ? '\n  context: input,' : ''}
});
${consume('result')}${final('result')}` : (has(options, 'asTool') && !has(options, 'run') ? undefined : `const result = await ${call};\n${consume('result')}${final('result')}`);
  return renderExample({ component: 'LLMAgent', variable: 'returnsAdvisor', functionName: 'answerReturnQuestion', options, modelType: 'LanguageModel',
    typeImports: history ? ['ModelMessage'] : [],
    params: resume ? ['chooseApprovals: (requestIds: string[]) => Promise<string[]>'] : [],
    description: 'Answer the same customer question using the store returns policy.',
    toolDescription: coded ? 'Answer a customer question using the store returns policy.' : 'Explain how to return the damaged mug in this saved customer request.',
    imports: [...(tools ? tool.imports : []), ...(structured ? ['z'] : [])], aiImports: structured ? ['Output'] : [],
    setup: [...(coded || tools ? [`const policy = ${literal(policy)};`] : []), ...(coded && resume ? [`const input = { question: ${literal(question)} };`] : []),
      ...(tools ? [tool.setup] : []),
      ...(history ? ["const messageHistory: ModelMessage[] = [\n  { role: 'user', content: 'I bought a Trail mug yesterday.' },\n  { role: 'assistant', content: 'How can I help with your mug?' },\n];"] : [])],
    fields, schema: coded ? 'z.object({ question: z.string() })' : has(options, 'asTool') ? 'z.object({})' : undefined,
    source: source('LLMAgent', 'prompt', options, resources,
      literal(`Policy: ${policy}\nQuestion: ${question}`),
      '({ policy, question }) => `Policy: ${policy}\\nQuestion: ${question}`'),
    toolPrompt: coded ? literal(question) : "'Explain the return steps for the saved damaged-mug request.'",
    toolArgs: coded ? context : '{}', body,
  });
}
