import assert from 'node:assert/strict';
import type { ModelMessage, ToolContent } from 'ai';
import { denyPendingApprovals, ValidationError } from './cascada';
import { applyApprovalSelection } from '../src/runtime/approvals.js';
import { pendingHistory, decision, recordedResult, parts, callDefinition } from './fixtures/approval-history.js';

describe('Approval history construction', () => {
	for (const approve of [undefined, null, true, false, [], ['approve-a'], ['approve-a', 'approve-a']] as const) {
		it(`selects ${JSON.stringify(approve)} with native response parts only`, () => {
			const history = pendingHistory('a', 'b');
			const result = applyApprovalSelection(history, approve);
			assert.notEqual(result, history);
			assert.equal(result[0], history[0]);
			assert.equal(result[1], history[1]);
			const expected = approve == null ? [] : [decision('a', approve === true || Array.isArray(approve) && approve.includes('approve-a')), decision('b', approve === true)];
			assert.deepEqual(result.slice(history.length), expected.length ? [{ role: 'tool', content: expected }] : []);
			assert.equal(history.length, 2);
		});
	}

	for (const approve of [0, 'true', {}, [1], ['missing']]) it(`rejects invalid selection ${JSON.stringify(approve)}`, () => {
		assert.throws(() => applyApprovalSelection(pendingHistory('a'), approve), ValidationError);
	});

	it('extends a frozen final tool message without mutating or losing metadata', () => {
		const existing = recordedResult('done');
		const tail = { role: 'tool' as const, content: [existing], providerOptions: { fixture: { marker: 'keep' } } };
		Object.freeze(tail.content); Object.freeze(tail);
		const history = Object.freeze([...pendingHistory('a'), tail]);
		const result = applyApprovalSelection(history, true);
		assert.deepEqual(result.at(-1), { ...tail, content: [existing, decision('a', true)] });
		assert.notEqual(result.at(-1), tail);
		assert.equal(result.at(-1)?.providerOptions, tail.providerOptions);
		assert.equal(parts(result).find(part => part === existing), existing);
		assert.equal(tail.content.length, 1);
	});

	it('excludes recorded decisions/results and retains orphan automatic requests', () => {
		const history = pendingHistory('approved', 'denied', 'result', 'automatic', 'orphan');
		for (const part of parts(history)) if (part.type === 'tool-approval-request' && ['automatic', 'orphan'].includes(part.toolCallId)) part.isAutomatic = true;
		history.push({ role: 'tool', content: [decision('approved', true), decision('denied', false), recordedResult('result'), decision('automatic', true)] });
		const result = applyApprovalSelection(history, true);
		assert.deepEqual(parts(result).filter(part => part.type === 'tool-approval-response').at(-1), decision('orphan', true));
		for (const id of ['approved', 'denied', 'result', 'automatic']) assert.throws(() => applyApprovalSelection(history, [`approve-${id}`]), /resolved/);
		assert.deepEqual(denyPendingApprovals(history).slice(0, -1), history.slice(0, -1));
		assert.equal(parts(denyPendingApprovals(history)).filter(part => part.type === 'tool-result').length, 3);
	});

	it('settles recorded local denials without results and leaves other recorded work', () => {
		const history = pendingHistory('denied', 'remote', 'approved', 'answered', 'pending');
		callDefinition(history, 'remote').providerExecuted = true;
		history.push({ role: 'tool', content: [
			{ ...decision('denied', false), reason: 'Recorded.' }, { ...decision('remote', false), providerExecuted: true },
			decision('approved', true), decision('answered', false),
			{ type: 'tool-result', toolCallId: 'answered', toolName: 'lookup', output: { type: 'execution-denied' } },
		] });
		const result = denyPendingApprovals(history, 'New turn.');
		assert.deepEqual(parts(result).slice(parts(history).length), [
			{ type: 'tool-result', toolCallId: 'denied', toolName: 'lookup', output: { type: 'execution-denied', reason: 'Recorded.' } },
			{ ...decision('pending', false), reason: 'New turn.' },
			{ type: 'tool-result', toolCallId: 'pending', toolName: 'lookup', output: { type: 'execution-denied', reason: 'New turn.' } },
		]);
		assert.deepEqual(denyPendingApprovals(result), result);
		assert.deepEqual(parts(applyApprovalSelection(history, true)).slice(parts(history).length), [decision('pending', true)]);
	});

	for (const boundary of ['user', 'system'] as const) it(`limits selection to the active segment after ${boundary}`, () => {
		const history: ModelMessage[] = [...pendingHistory('old', 'reused'), { role: 'tool', content: [decision('reused', true), recordedResult('reused')] },
			{ role: boundary, content: 'Next turn.' }, ...pendingHistory('reused', 'new').slice(1)];
		assert.deepEqual(parts(applyApprovalSelection(history, false)).filter(part => part.type === 'tool-approval-response').slice(-2), [decision('reused', false), decision('new', false)]);
		assert.throws(() => applyApprovalSelection(history, ['approve-old']), /unknown/);
		assert.equal(parts(denyPendingApprovals(history)).filter(part => part.type === 'tool-result' && part.toolCallId === 'old').length, 0);
	});

	it('uses last-write request/call definitions across history without ambiguity checks', () => {
		const history = pendingHistory('a', 'b');
		history.push({ role: 'assistant', content: [
			{ type: 'tool-call', toolCallId: 'b', toolName: 'remote', input: {}, providerExecuted: true },
			{ type: 'tool-approval-request', approvalId: 'approve-a', toolCallId: 'b' },
		] });
		const result = applyApprovalSelection(history, ['approve-a']);
		assert.deepEqual(parts(result).filter(part => part.type === 'tool-approval-response'), [
			{ ...decision('a', true), providerExecuted: true }, { ...decision('b', false), providerExecuted: true },
		]);
		const crossTurn: ModelMessage[] = [...history, { role: 'user', content: 'Next.' },
			{ role: 'assistant', content: [{ type: 'tool-approval-request', approvalId: 'fresh', toolCallId: 'b' }] }];
		assert.deepEqual(parts(applyApprovalSelection(crossTurn, true)).at(-1), { type: 'tool-approval-response', approvalId: 'fresh', approved: true, providerExecuted: true });
	});

	it('uses own-key lookup for prototype-shaped IDs', () => {
		const history = pendingHistory('__proto__', 'constructor', 'toString');
		for (const part of parts(history)) if (part.type === 'tool-approval-request') part.approvalId = part.toolCallId;
		assert.equal(parts(applyApprovalSelection(history, ['__proto__'])).filter(part => part.type === 'tool-approval-response').length, 3);
		assert.equal(parts(denyPendingApprovals(history)).filter(part => part.type === 'tool-result').length, 3);
		assert.throws(() => applyApprovalSelection([], ['toString']), ValidationError);
	});

	it('leaves missing calls to native resume handling but rejects helper construction', () => {
		const history: ModelMessage[] = [{ role: 'assistant', content: [{ type: 'tool-approval-request', approvalId: 'orphan', toolCallId: 'missing' }] }];
		assert.deepEqual(parts(applyApprovalSelection(history, true)).at(-1), { type: 'tool-approval-response', approvalId: 'orphan', approved: true });
		assert.throws(() => denyPendingApprovals(history), /tool call 'missing' is missing/);
		assert.throws(() => denyPendingApprovals([...history, { role: 'tool', content: [{ type: 'tool-approval-response', approvalId: 'orphan', approved: false }] }]), /tool call 'missing' is missing/);
	});

	for (const reason of [undefined, '', 'A new request.']) it(`constructs local/provider denials with reason=${JSON.stringify(reason)}`, () => {
		const history = pendingHistory('local', 'remote');
		callDefinition(history, 'local').providerExecuted = false;
		callDefinition(history, 'remote').providerExecuted = true;
		callDefinition(history, 'remote').providerOptions = { fixture: { reference: 'keep' } };
		const expected: ToolContent = [
			{ ...decision('local', false), providerExecuted: false, ...(reason === undefined ? {} : { reason }) },
			{ type: 'tool-result', toolCallId: 'local', toolName: 'lookup', output: { type: 'execution-denied', ...(reason === undefined ? {} : { reason }) } },
			{ ...decision('remote', false), providerExecuted: true, ...(reason === undefined ? {} : { reason }) },
		];
		assert.deepEqual(denyPendingApprovals(history, reason).at(-1), { role: 'tool', content: expected });
		assert.equal(denyPendingApprovals(history)[1], history[1]);
	});

	it('adds one local result for multiple undecided requests referring to one call', () => {
		const history = pendingHistory('a');
		history.push({ role: 'assistant', content: [{ type: 'tool-approval-request', approvalId: 'second', toolCallId: 'a' }] });
		const result = denyPendingApprovals(history);
		assert.equal(parts(result).filter(part => part.type === 'tool-approval-response').length, 2);
		assert.equal(parts(result).filter(part => part.type === 'tool-result').length, 1);
		assert.deepEqual(denyPendingApprovals(result), result);
	});

	for (const history of [[], [{ role: 'user', content: 'Hello.' }], [{ role: 'assistant', content: 'Text.' }]] satisfies ModelMessage[][]) it('copies empty/no-pending history without adding a tool message', () => {
		for (const approve of [true, false, []]) {
			const result = applyApprovalSelection(history, approve);
			assert.deepEqual(result, history); assert.notEqual(result, history);
		}
		const denied = denyPendingApprovals(history);
		assert.deepEqual(denied, history); assert.notEqual(denied, history);
	});

	it('validates helper inputs without requiring an agent', () => {
		for (const history of [undefined, null, {}, [{ role: 'invalid', content: '' }]]) assert.throws(() => denyPendingApprovals(history as ModelMessage[]), ValidationError);
		assert.throws(() => denyPendingApprovals([], 42 as unknown as string), ValidationError);
	});
});
