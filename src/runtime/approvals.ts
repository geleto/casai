import type { ModelMessage, ToolApprovalRequest, ToolApprovalResponse, ToolCallPart, ToolContent } from 'ai';
import { validateMessagesArray } from '../config/validate.js';
import { ValidationError } from '../errors.js';

/** Active-segment requests without results; selection is shorthand for new decisions, not validation of native history. */
function unsettledApprovals(history: readonly ModelMessage[]) {
	const calls = new Map<string, ToolCallPart>();
	const requests = new Map<string, ToolApprovalRequest>();
	const decisions = new Map<string, ToolApprovalResponse>();
	const settled = new Set<string>();
	for (const message of history) {
		if (message.role === 'user' || message.role === 'system') {
			requests.clear();
			decisions.clear();
			settled.clear();
			continue;
		}
		if (typeof message.content === 'string') continue;
		for (const part of message.content) {
			switch (part.type) {
				case 'tool-call': calls.set(part.toolCallId, part); break;
				case 'tool-approval-request': requests.set(part.approvalId, part); break;
				case 'tool-approval-response': decisions.set(part.approvalId, part); break;
				case 'tool-result': settled.add(part.toolCallId); break;
			}
		}
	}
	return [...requests.values()].filter(request => !settled.has(request.toolCallId))
		.map(request => ({ request, call: calls.get(request.toolCallId), decision: decisions.get(request.approvalId) }));
}

function append(history: readonly ModelMessage[], parts: ToolContent): ModelMessage[] {
	const result = [...history];
	if (parts.length) {
		const last = result.at(-1);
		if (last?.role === 'tool') result[result.length - 1] = { ...last, content: [...last.content, ...parts] };
		else result.push({ role: 'tool', content: parts });
	}
	return result;
}

/** Called after the invocation's ordinary message-shape validation. */
export function applyApprovalSelection(history: readonly ModelMessage[], approve: unknown): ModelMessage[] {
	if (approve == null) return [...history];
	if (typeof approve !== 'boolean' && (!Array.isArray(approve) || !approve.every(id => typeof id === 'string'))) {
		throw new ValidationError('approve must be a boolean, an array of approval IDs, null or undefined.');
	}
	const selected = Array.isArray(approve) ? new Set<string>(approve) : undefined;
	const pending = unsettledApprovals(history).filter(({ decision }) => !decision);
	if (selected) {
		const ids = new Set(pending.map(({ request }) => request.approvalId));
		for (const id of selected) if (!ids.has(id)) throw new ValidationError(`Approval '${id}' is unknown or already resolved.`);
	}
	return append(history, pending.map(({ request, call }) => ({
		type: 'tool-approval-response', approvalId: request.approvalId,
		approved: selected ? selected.has(request.approvalId) : approve === true,
		...(call?.providerExecuted === undefined ? {} : { providerExecuted: call.providerExecuted }),
	})));
}

/**
 * Deny undecided approvals before adding a new user turn. Recorded local denials also receive
 * their missing result, as in native UI message conversion; other unfinished work is unchanged.
 */
export function denyPendingApprovals(history: readonly ModelMessage[], reason?: string): ModelMessage[] {
	if (!Array.isArray(history)) throw new ValidationError('Approval history must be an array of model messages.');
	validateMessagesArray(history, ValidationError);
	if (reason !== undefined && typeof reason !== 'string') throw new ValidationError('An approval denial reason must be a string.');
	const parts: ToolContent = [];
	const results = new Set<string>();
	for (const { request, call, decision } of unsettledApprovals(history)) {
		if (decision?.approved) continue;
		if (!call) throw new ValidationError(`Cannot deny approval '${request.approvalId}': tool call '${request.toolCallId}' is missing.`);
		const denial = decision ? decision.reason : reason;
		if (!decision) parts.push({ type: 'tool-approval-response', approvalId: request.approvalId, approved: false,
			...(call.providerExecuted === undefined ? {} : { providerExecuted: call.providerExecuted }),
			...(denial === undefined ? {} : { reason: denial }),
		});
		if (!call.providerExecuted && !results.has(call.toolCallId)) {
			parts.push({ type: 'tool-result', toolCallId: call.toolCallId, toolName: call.toolName,
				output: { type: 'execution-denied', ...(denial === undefined ? {} : { reason: denial }) },
			});
			results.add(call.toolCallId);
		}
	}
	return append(history, parts);
}
