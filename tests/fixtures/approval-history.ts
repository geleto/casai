import type { ModelMessage, ToolApprovalResponse, ToolCallPart, ToolContent } from 'ai';

export function pendingHistory(...ids: string[]): ModelMessage[] {
	return [{ role: 'user', content: 'Use the tools.' }, { role: 'assistant', content: ids.flatMap(id => [
		{ type: 'tool-call' as const, toolCallId: id, toolName: 'lookup', input: { key: id } },
		{ type: 'tool-approval-request' as const, approvalId: `approve-${id}`, toolCallId: id },
	]) }];
}

export function decision(id: string, approved: boolean): ToolApprovalResponse {
	return { type: 'tool-approval-response', approvalId: `approve-${id}`, approved };
}

export function recordedResult(id: string): ToolContent[number] {
	return { type: 'tool-result', toolCallId: id, toolName: 'lookup', output: { type: 'text', value: 'recorded' } };
}

export function parts(history: readonly ModelMessage[]) {
	return history.flatMap<Exclude<ModelMessage['content'], string>[number]>(message => typeof message.content === 'string' ? [] : message.content);
}

export function callDefinition(history: readonly ModelMessage[], id: string): ToolCallPart {
	const call = parts(history).find(part => part.type === 'tool-call' && part.toolCallId === id);
	if (call?.type !== 'tool-call') throw new Error(`Missing fixture call: ${id}`);
	return call;
}
