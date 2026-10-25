import assert from 'node:assert/strict';
import { z } from 'zod/v4';
import { jsonSchema, validateTypes } from '@ai-sdk/provider-utils';
import type { FlexibleSchema } from '@ai-sdk/provider-utils';
import { ToolLoopAgent, isStepCount, tool, InvalidToolApprovalSignatureError } from 'ai';
import type { Tool, ModelMessage } from 'ai';
import { TypeValidationError } from '@ai-sdk/provider';
import { create, ConfigError } from './cascada';
import { modelFor } from './fixtures/phase2-security-sdk.js';
import { explicitMetadata } from './fixtures/phase2-api-schemas.js';

type Fields = Record<string, unknown>;
interface Binding { tool: Tool<Fields, unknown, unknown>; context: unknown }
type DynamicComponent = Tool<Fields, unknown, unknown> & {
	(input?: Fields): Promise<unknown>;
	run(options: { context: Fields }): Promise<unknown>;
	bindToolContext(context: unknown): Binding;
};
// Generated/adversarial inputs intentionally erase static shape information.
// Representative valid/invalid public calls live in the paired compiler fixture.
const make = (definition: object): DynamicComponent => {
	const factory: unknown = 'inputSchema' in definition ? create.Function.asTool : create.Function;
	return (factory as (definition: object) => DynamicComponent)(definition);
};
async function executeBound<I, O, C>(binding: { tool: Tool<I, O, C>; context: unknown }, input: Fields) {
	const parsed = await validateTypes({ schema: binding.tool.inputSchema, value: input });
	const context = binding.tool.contextSchema === undefined ? binding.context : await validateTypes({ schema: binding.tool.contextSchema, value: binding.context });
	return binding.tool.execute!(parsed, { toolCallId: 'generated', messages: [], context: context as C });
}
const keys = ['userId', 'constructor', 'toString', '__proto__', '0', 'profile.role',
	...Array.from({ length: 3 }, (_, index) => `private_${index}_\u03bb`)];
const families = ['zod4', 'sdk', 'standard'] as const;
const policies = ['strict', 'strip', 'open', 'catchall'] as const;
const wrappers = ['plain', 'optional', 'async-rename', 'rename-public'] as const;
const owners = ['config', 'bound', 'declared-absent'] as const;
type Family = typeof families[number];
type Policy = typeof policies[number];
type Wrapper = typeof wrappers[number];
type Owner = typeof owners[number];
const sentinel = 'PRIVATE_GENERATED_SENTINEL';
function own(key: string, value: unknown): Fields { return Object.fromEntries([[key, value]]); }
function fields(value: unknown): Fields {
	assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
	return value as Fields;
}
function schemaFor(family: Family, policy: Policy, wrapper: Wrapper, key: string): FlexibleSchema<unknown> {
	const finish = async (value: Fields) => {
		if (wrapper === 'rename-public') {
			const { amount, ...rest } = value;
			return { ...rest, total: amount };
		}
		const { alias, ...rest } = value;
		return alias === undefined ? rest : { ...rest, ...own(key, alias) };
	};
	const base = z.object({ amount: z.coerce.number(), alias: z.unknown().optional(), tag: z.string().optional() });
	const schema = policy === 'strict' ? base.strict() : policy === 'strip' ? base
		: policy === 'open' ? base.loose() : base.catchall(z.string());
	const wrapped = wrapper === 'plain' ? schema : wrapper === 'optional' ? schema.optional() : schema.transform(finish);
	if (family === 'zod4') return wrapped;
	const metadata = { type: 'object' as const, properties: { amount: { type: 'number' as const }, alias: {}, tag: { type: 'string' as const } },
		required: ['amount'], additionalProperties: policy === 'open' || policy === 'catchall' };
	if (family === 'standard') return explicitMetadata(wrapped, metadata);
	// Explicit SDK metadata declares raw names; its validator owns native parsing.
	return jsonSchema(metadata, {
		validate: async value => {
			const result = await wrapped.safeParseAsync(value);
			return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
		},
	});
}

// Independent oracle: the generator declares one private name and one public
// fallback. Native validation determines stripping/transforms, never ownership.
async function expected(schema: FlexibleSchema<unknown>, args: Fields, owner: Owner, key: string, policy: Policy) {
	if (policy === 'open' || policy === 'catchall' || Object.keys(args).some(key => !['amount', 'alias', 'tag'].includes(key))) return { allowed: false as const };
	try {
		const parsed = fields(await validateTypes({ schema, value: { amount: owner === 'bound' ? '5' : '3', ...args } }));
		return Object.hasOwn(parsed, key) ? { allowed: false as const } : { allowed: true as const, parsed };
	} catch { return { allowed: false as const }; }
}

describe('Phase 2 generated security invariants (production factories)', function () {
	this.timeout(30000);
	for (const family of families) for (const policy of policies) for (const wrapper of wrappers) {
		it(`enumerates ownership, names, defaults and entry paths: ${family}/${policy}/${wrapper}`, async () => {
			let checked = 0;
			for (const key of keys) for (const owner of owners) for (const path of ['ordinary', 'run', 'bound'] as const) {
				if (owner === 'bound' && path !== 'bound') continue;
				const schema = schemaFor(family, policy, wrapper, key);
				for (const [label, args] of [
					['omitted', {}], ['override-extra', { amount: '9', tag: 'ok', unrelated: 'allowed' }],
					['collision', own(key, 'attacker')], ['transform', { alias: 'attacker' }],
				] as const) {
					const id = `${family}/${policy}/${wrapper}/${key}/${owner}/${path}/${label}`;
					let entered = 0;
					let seen: Fields | undefined;
					const config = { amount: '3', ...(owner === 'config' ? own(key, sentinel) : {}) };
					const incoming = owner === 'bound' ? { amount: '5', ...own(key, sentinel) } : {};
					const contextSchema = z.object({ [key]: z.unknown().optional() });
					const trusted = owner === 'declared-absent'
						? path === 'bound' ? fields(await contextSchema.parseAsync(incoming)) : {}
						: own(key, sentinel);
					const operation = make({ inputSchema: schema, context: config,
						...(owner === 'declared-absent' ? { toolContextSchema: contextSchema } : {}),
						execute: (input: Fields) => { entered++; seen = input; return input.amount; } });
					const bound = operation.bindToolContext(incoming);
					const expectation = await expected(schema, args, owner, key, policy);
					const invoke = () => path === 'ordinary' ? operation(args) : path === 'run'
						? operation.run({ context: args }) : executeBound(bound, args);
					try {
						if (!expectation.allowed) {
							await assert.rejects(invoke, error => error instanceof ConfigError || path === 'bound' && TypeValidationError.isInstance(error), id);
							assert.equal(entered, 0, `${id}: rejected input entered the body`);
						} else {
							assert.equal(await invoke(), expectation.parsed.amount, id);
							assert.equal(entered, 1, id);
							assert.ok(seen, id);
							assert.equal(Object.hasOwn(seen, key), Object.hasOwn(trusted, key), id);
							if (Object.hasOwn(trusted, key)) assert.equal(seen[key], trusted[key], id);
							assert.equal(seen.unrelated, expectation.parsed.unrelated, id);
							assert.equal(Object.hasOwn(seen, 'amount'), Object.hasOwn(expectation.parsed, 'amount'), id);
							assert.equal(seen.total, expectation.parsed.total, id);
							assert.equal(Object.getPrototypeOf(seen), Object.prototype, id);
						}
						assert.equal(config.amount, '3', id);
						if (owner === 'config') assert.equal(config[key as keyof typeof config], sentinel, id);
						checked++;
					} catch (error) { throw new Error(`Generated security case: ${id}`, { cause: error }); }
				}
			}
			assert.equal(checked, keys.length * 7 * 4);
		});
	}

	for (const depth of [1, 2, 3]) for (const path of ['ordinary', 'run', 'registered'] as const) {
		it(`preserves private ownership through ${depth} ${path} forwarding hops`, async () => {
			for (const key of keys) for (const supplied of ['attacker', undefined, sentinel]) {
				let entered = 0;
				const leaf = make({ context: own(key, sentinel), execute: () => ++entered });
				// A schema-less leaf is a real ordinary forwarding destination.
				const leafSchema = z.object({ unrelated: z.string().optional() });
				const callableLeaf = make({ inputSchema: leafSchema, context: own(key, sentinel), execute: (input: Fields) => {
					assert.equal(input[key], sentinel); return ++entered;
				} });
				let next: (args: Fields) => Promise<unknown> = path === 'registered'
					? async args => {
						const owner = make({ inputSchema: z.object({ payload: z.unknown() }), tools: { leaf: callableLeaf },
							execute: (input: Fields) => (input.leaf as (value: Fields) => Promise<unknown>)(fields(input.payload)) });
						return owner({ payload: args });
					} : path === 'run' ? args => leaf.run({ context: args }) : args => leaf(args);
				for (let hop = 0; hop < depth; hop++) {
					const child = next;
					const forward = make({ inputSchema: z.object({ payload: z.unknown() }),
						execute: (input: Fields) => child(fields(input.payload)) });
					next = args => forward({ payload: args });
				}
				await assert.rejects(() => next(own(key, supplied)), ConfigError, `${path}/${depth}/${key}`);
				assert.equal(entered, 0);
				assert.equal(await next({ unrelated: 'valid' }), 1);
			}
		});
	}

	for (const mode of ['generate', 'stream'] as const) {
		it(`enforces generated private bindings through real SDK ${mode} transport`, async () => {
			for (const key of keys.filter(key => key !== '__proto__')) for (const owner of owners) for (const attack of [false, true]) {
				let entered = 0;
				const contextSchema = z.object({ [key]: z.unknown().optional() });
				const trusted = owner === 'declared-absent' ? fields(await contextSchema.parseAsync({})) : own(key, sentinel);
				const operation = make({ inputSchema: z.object({ amount: z.number().optional() }),
					...(owner === 'config' ? { context: own(key, sentinel) } : {}),
					...(owner === 'declared-absent' ? { toolContextSchema: contextSchema } : {}),
					execute: (input: Fields) => {
						entered++;
						assert.equal(Object.hasOwn(input, key), Object.hasOwn(trusted, key));
						if (Object.hasOwn(trusted, key)) assert.equal(input[key], trusted[key]);
						return 'public-success';
					} });
				const model = modelFor(attack ? { amount: 2, ...own(key, 'attacker') } : { amount: 2 });
				// This generated harness knows raw contexts are records; it does not
				// establish public factory inference from an erased Tool type.
				const agent = new ToolLoopAgent({ model, tools: { probe: operation as Tool<Fields, unknown, Fields> },
					toolsContext: { probe: owner === 'bound' ? own(key, sentinel) : {} } as never, stopWhen: isStepCount(2) });
				const result = mode === 'generate' ? await agent.generate({ prompt: 'run' }) : await agent.stream({ prompt: 'run' });
				const chunks: unknown[] = [];
				const consume = 'toUIMessageStream' in result ? (async () => {
					for await (const part of result.toUIMessageStream({ onError: error => error instanceof Error ? error.message : String(error) })) chunks.push(part);
				})() : Promise.resolve();
				const steps = await result.steps;
				await consume;
				assert.equal(entered, attack ? 0 : 1, `${mode}/${key}/${owner}`);
				assert.ok(steps[0].content.some(part => part.type === (attack ? 'tool-error' : 'tool-result')), `${mode}/${key}/${owner}/${attack}`);
				const calls = mode === 'generate' ? model.doGenerateCalls : model.doStreamCalls;
				assert.equal(calls.length, 2);
				assert.ok(!JSON.stringify(calls).includes(sentinel));
				assert.ok(!JSON.stringify(steps.flatMap(step => step.response.messages)).includes(sentinel));
				assert.ok(!JSON.stringify(chunks).includes(sentinel));
				if (mode === 'stream') assert.ok(chunks.some(part => fields(part).type === (attack ? 'tool-output-error' : 'tool-output-available')));
			}
		});

		it(`does not grant authority to repaired ${mode} tool input`, async () => {
			let entered = 0, repaired = 0;
			const operation = create.Function.asTool({ inputSchema: z.object({ amount: z.number() }), context: { userId: 'member' },
				execute: () => ++entered });
			const model = modelFor({ amount: 'invalid' });
			const agent = new ToolLoopAgent({ model, tools: { probe: operation }, stopWhen: isStepCount(2),
				experimental_repairToolCall: async ({ toolCall }) => {
					repaired++;
					return { ...toolCall, input: JSON.stringify({ amount: 2, userId: 'admin' }) };
				} });
			const result = mode === 'generate' ? await agent.generate({ prompt: 'run' }) : await agent.stream({ prompt: 'run' });
			const steps = await result.steps;
			assert.equal(repaired, 1);
			assert.equal(entered, 0);
			assert.ok(steps[0].content.some(part => part.type === 'tool-error'));
		});

		it(`limits ${mode} tool selection to own registered names`, async () => {
			for (const name of ['constructor', 'toString', '__proto__', 'notRegistered']) for (const registered of [false, true]) {
				let entered = 0;
				const operation = create.Function.asTool({ inputSchema: z.object({}), execute: () => ++entered });
				const model = modelFor({}, name);
				const tools = registered ? Object.fromEntries([[name, operation]]) : { probe: operation };
				const agent = new ToolLoopAgent({ model, tools, stopWhen: isStepCount(2) });
				const result = mode === 'generate' ? await agent.generate({ prompt: 'run' }) : await agent.stream({ prompt: 'run' });
				const steps = await result.steps;
				assert.equal(entered, registered ? 1 : 0, `${mode}/${name}/${registered}`);
				assert.ok(steps[0].content.some(part => part.type === (registered ? 'tool-result' : 'tool-error')));
			}
		});

		it(`keeps private state bindings stable across sequential SDK ${mode} invocations`, async () => {
			const session = { total: 0, add(amount: number) { this.total += amount; return this.total; } };
			const operation = create.Function.asTool({ inputSchema: z.object({ amount: z.number() }), context: { session, userId: 'member' },
				execute: input => {
					assert.equal(input.session, session);
					assert.equal(input.userId, 'member');
					return input.session.add(input.amount);
				} });
			for (const [input, total] of [[{ amount: 2 }, 2], [{ amount: 3, userId: 'admin' }, 2],
				[{ amount: 4, session: { total: 9000 } }, 2], [{ amount: 5 }, 7]] as const) {
				const model = modelFor(input);
				const agent = new ToolLoopAgent({ model, tools: { probe: operation }, stopWhen: isStepCount(2) });
				const result = mode === 'generate' ? await agent.generate({ prompt: 'run' }) : await agent.stream({ prompt: 'run' });
				await result.steps;
				assert.equal(session.total, total);
			}
		});

		it(`characterizes native and Casai approval replay for effectful ${mode} tools`, async () => {
			for (const native of [false, true]) for (const signed of [false, true]) {
				let effects = 0;
				const signing = signed ? { experimental_toolApprovalSecret: 'phase2-test-approval-key' } : {};
				const inputSchema = z.object({ amount: z.number() });
				const definition = { inputSchema, execute: () => ++effects };
				const candidate = create.Function.asTool(definition);
				const operation = native ? tool({ ...definition, needsApproval: true })
					: { inputSchema: candidate.inputSchema, execute: candidate.execute, needsApproval: true };
				const initial = new ToolLoopAgent({ ...signing, model: modelFor({ amount: 1 }), tools: { probe: operation }, stopWhen: isStepCount(2) });
				const first = mode === 'generate' ? await initial.generate({ prompt: 'run' }) : await initial.stream({ prompt: 'run' });
				const history = (await first.steps).flatMap(step => step.response.messages);
				const request = history.flatMap(message => message.role === 'assistant' && Array.isArray(message.content)
					? message.content.filter(part => part.type === 'tool-approval-request') : [])[0];
				assert.ok(request);
				assert.equal(typeof request.signature === 'string', signed);
				assert.equal(effects, 0);
				const messages: ModelMessage[] = [{ role: 'user', content: 'run' }, ...history,
					{ role: 'tool', content: [{ type: 'tool-approval-response', approvalId: request.approvalId, approved: true }] }];
				for (const expectedEffects of [1, 2]) {
					const resumed = new ToolLoopAgent({ ...signing, model: modelFor(undefined), tools: { probe: operation }, stopWhen: isStepCount(2) });
					const result = mode === 'generate' ? await resumed.generate({ messages }) : await resumed.stream({ messages });
					await result.steps;
					assert.equal(effects, expectedEffects, 'Native approval does not supply cross-invocation deduplication.');
				}
				if (signed) {
					// Keep the approval response and signature, but alter the operation.
					const tampered = structuredClone(messages);
					for (const message of tampered) if (message.role === 'assistant' && Array.isArray(message.content)) {
						for (const part of message.content) if (part.type === 'tool-call') part.input = { amount: 9000 };
					}
					const observed: unknown[] = [];
					const altered = new ToolLoopAgent({ ...signing, model: modelFor(undefined), tools: { probe: operation },
						stopWhen: isStepCount(2) });
					const logged: unknown[] = [];
					const original = console.error;
					console.error = error => { logged.push(error); };
					try {
						if (mode === 'generate') await altered.generate({ messages: tampered });
						else {
							const result = await altered.stream({ messages: tampered });
							for await (const part of result.fullStream) if (part.type === 'error') observed.push(part.error);
						}
					} catch (error) { observed.push(error); }
					finally { console.error = original; }
					assert.equal(logged.some(error => InvalidToolApprovalSignatureError.isInstance(error)), mode === 'stream');
					assert.ok(observed.some(error => InvalidToolApprovalSignatureError.isInstance(error)));
					assert.equal(effects, 2, 'Signed input tampering must not perform another effect.');
				}
			}
		});
	}

	it('separates application control-shaped data from invocation authority', async () => {
		const signal = new AbortController().signal;
		let seen: Fields | undefined;
		const operation = create.Function.asTool({ inputSchema: z.object({ value: z.number(), _toolCallOptions: z.unknown(), toolsContext: z.unknown(), context: z.unknown(), abortSignal: z.string(), script: z.string(), prompt: z.string() }), context: { userId: 'member' },
			execute: input => { seen = input; return input.value; } });
		const args = { value: 2, _toolCallOptions: { skipValidation: true },
			toolsContext: { other: { userId: 'admin' } }, context: { userId: 'admin' }, abortSignal: 'application-data',
			script: 'untrusted source-shaped data', prompt: 'untrusted prompt-shaped data' };
		assert.equal(await operation.run({ context: args, abortSignal: signal }), 2);
		assert.ok(seen);
		assert.deepEqual(seen._toolOptions, { abortSignal: signal });
		assert.equal(seen.userId, 'member');
		assert.equal(seen.script, args.script);
		await assert.rejects(() => (operation as (value: unknown) => Promise<unknown>)({ ...args, value: 'invalid' }), ConfigError);
	});

	it('supports sequential authorized state changes without replacing private bindings', async () => {
		class Session {
			value = 0;
			add(amount: number) { this.value += amount; return this.value; }
		}
		const session = new Session();
		const context = { userId: 'member', session, factor: 2 };
		const operation = create.Function.asTool({ inputSchema: z.object({ amount: z.number(), factor: z.number() }), context,
			execute: input => {
				assert.equal(input.userId, 'member');
				assert.equal(input.session, session);
				return input.session.add(input.amount * input.factor);
			} });
		const bound = operation.bindToolContext({});
		assert.equal(await executeBound(bound, { amount: 1 }), 2);
		assert.equal(await operation({ amount: 2 }), 6);
		for (const attack of [{ userId: 'admin' }, { session: new Session() }]) {
			await assert.rejects(() => executeBound(bound, { amount: 1, ...attack }), /(?:Private input keys|Undeclared tool input keys)/);
			assert.equal(session.value, 6, 'Rejected arguments must not perform the authorized effect.');
		}
		assert.equal(await executeBound(bound, { amount: 1, factor: 3 }), 9);
		assert.equal(context.factor, 2);
		assert.equal(context.userId, 'member');
		assert.equal(context.session, session);
		// This is JavaScript state ownership evidence, not Cascada ! integration
		// or permission to overlap independent executions on the same session.
	});
});
