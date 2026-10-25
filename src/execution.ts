import { asSchema, generateId, jsonSchema } from 'ai';
import type { FlexibleSchema, Tool, ToolExecutionOptions, ToolSet } from 'ai';
import { executeTool } from '@ai-sdk/provider-utils';
import { ConfigError } from './errors.js';
import { contextNames, inputNames, isPlainObject, requireContextObject, ownKeys, parseSchema, projectInput, sameContext, selectFields, snapshot } from './schema.js';
import type { Fields } from './schema.js';
import { toolOutput } from './streams.js';

/** Invocation metadata. Trusted context is already present in the execution context. */
export type ComponentExecutionOptions = Omit<ToolExecutionOptions<unknown>, 'context' | 'toolCallId' | 'messages'>
	& Partial<Pick<ToolExecutionOptions<unknown>, 'toolCallId' | 'messages'>>;

export interface ExecutionConfig {
	context?: Fields;
	inputSchema?: FlexibleSchema<unknown>;
	toolContextSchema?: FlexibleSchema<unknown>;
	tools?: Record<string, Tool | null | undefined>;
	toolsContext?: Fields;
}

type Executor = (context: Fields, registry: PreparedRegistry) => unknown;
interface Binding { tool: Tool<Fields, unknown, unknown>; context: unknown; invoke(input: unknown, options: ComponentExecutionOptions): Promise<unknown> }
// Construction identity belongs to the component, never to application arguments.
const bindComponent = Symbol.for('casai.tool.binding.v1');
type ComponentTool = Tool & { [bindComponent](context: unknown, name: string): Binding };

function isComponent(tool: Tool): tool is ComponentTool {
	if ('bindToolContext' in tool && !(bindComponent in tool)) {
		if (typeof tool === 'function') throw new ConfigError('Incompatible Casai tool binding protocol. Use compatible Casai versions or explicitly bind the tool with its originating component.');
		throw new ConfigError('Do not spread Casai components. Create a component with configuration and an optional parent instead.');
	}
	return bindComponent in tool;
}

/** Cascada names arguments explicitly. Schema field order never supplies positional meaning. */
export function namedArguments(args: readonly unknown[]): unknown[] {
	const last = args.at(-1);
	if (last === null || typeof last !== 'object' || !Object.hasOwn(last, '__hasKeywordArgs') || Reflect.get(last, '__hasKeywordArgs') !== true) return [...args];
	const { __hasKeywordArgs: _marker, ...keywords } = last as Fields;
	if (args.slice(0, -1).some(isPlainObject)) throw new ConfigError('Use either a context object or named arguments, not both.');
	return [...args.slice(0, -1), keywords];
}

export function runSettings(args: readonly unknown[], allowed: readonly string[]): Fields {
	const normalized = namedArguments(args);
	if (normalized.length > 1) throw new ConfigError('A component run accepts one settings object.');
	const settings = { ...requireContextObject(normalized[0] === undefined ? {} : normalized[0]) };
	const unknown = Object.keys(settings).filter(key => !allowed.includes(key));
	if (unknown.length) throw new ConfigError(`Unknown run settings: ${unknown.join(', ')}. Put application data in context.`);
	return settings;
}

function rejectPrivate(value: Fields, reserved: ReadonlySet<PropertyKey>): void {
	const rejected = ownKeys(value).filter(key => reserved.has(key));
	if (rejected.length) throw new ConfigError(`Private input keys: ${rejected.map(String).join(', ')}.`);
}

function inputObject(value: unknown): Fields {
	return requireContextObject(value === undefined ? {} : value);
}

export interface PreparedRegistry {
	tools: ToolSet;
	toolsContext: Fields;
	helpers(options: ComponentExecutionOptions): Fields;
	assertContext(value: unknown): void;
}

export function validateRegistryConfig(config: { tools?: unknown; toolsContext?: unknown }, supplied: { toolsContext?: unknown }): void {
	const tools = config.tools === undefined ? {} : requireContextObject(config.tools);
	const contexts = config.toolsContext === undefined ? {} : requireContextObject(config.toolsContext);
	const incoming = supplied.toolsContext === undefined ? {} : requireContextObject(supplied.toolsContext);
	const unknown = Object.keys(contexts).filter(key => !Object.hasOwn(tools, key));
	for (const key of Object.keys(incoming)) {
		if (tools[key] == null && !unknown.includes(key)) unknown.push(key);
	}
	if (unknown.length) throw new ConfigError(`Unknown toolsContext entries: ${unknown.join(', ')}.`);
}

export function prepareRegistry(config: ExecutionConfig, overrides?: Fields): PreparedRegistry {
	const selected = { ...config.toolsContext, ...overrides };
	if (overrides) validateRegistryConfig({ ...config, toolsContext: selected }, { toolsContext: overrides });
	const entries = Object.entries(config.tools ?? {}).filter((entry): entry is [string, Tool] => entry[1] != null);
	const bindings = new Map<string, Binding>();
	const tools: ToolSet = Object.fromEntries<Tool>(entries.map(([key, tool]) => {
		if (!isComponent(tool)) return [key, tool] as const;
		const binding = tool[bindComponent](Object.hasOwn(selected, key) ? selected[key] : undefined, key);
		bindings.set(key, binding);
		return [key, binding.tool] as const;
	}));
	const toolsContext = Object.fromEntries(entries.map(([key]) => [key, bindings.has(key) ? bindings.get(key)!.context
		: Object.hasOwn(selected, key) ? selected[key] : undefined]));
	return {
		tools, toolsContext,
		assertContext(value) {
			const next = requireContextObject(value);
			for (const key of bindings.keys()) {
				if (!sameContext(toolsContext[key], Object.hasOwn(next, key) ? next[key] : undefined)) throw new ConfigError(`Bound tool context '${key}' cannot change within an invocation.`);
			}
		},
		helpers(options) {
			return Object.fromEntries(entries.filter(([, tool]) => typeof tool.execute === 'function').map(([key, tool]) => [key,
				async (...args: unknown[]) => {
					const normalized = namedArguments(args);
					if (normalized.length > 1) throw new ConfigError('A registered tool accepts one input value.');
					options.abortSignal?.throwIfAborted();
					const metadata = { ...options, toolCallId: generateId(), messages: [] };
					const binding = bindings.get(key);
					if (binding) return binding.invoke(normalized[0], metadata);
					const { value: input } = await parseSchema(tool.inputSchema, normalized[0], `Tool '${key}' input`);
					const raw = Object.hasOwn(selected, key) ? selected[key] : undefined;
					const context = tool.contextSchema === undefined ? raw
						: (await parseSchema(tool.contextSchema, raw, `Tool '${key}' context`)).value;
					options.abortSignal?.throwIfAborted();
					// Registry enumeration erases the correlated native generic parameters.
					const executable = tool as Tool<unknown, unknown, unknown> & { execute: NonNullable<Tool<unknown, unknown, unknown>['execute']> };
					for await (const result of executeTool({ tool: executable, input, options: { ...metadata, context: context as never } })) {
						if (result.type === 'final') return result.output;
					}
					return undefined;
				},
			]));
		},
	};
}

/**
 * One application parse, followed by one private-context assembly. SDK executors
 * enter after parsing; ordinary and injected calls enter before it.
 */
function preparation(config: ExecutionConfig, tool: boolean, binding?: { context: unknown; name?: string | undefined }) {
	const context = snapshot(binding?.context);
	const toolName = binding?.name;
	const configured = { ...config.context };
	const declared = contextNames(config.toolContextSchema);
	const registered = Object.entries(config.tools ?? {}).filter(([, tool]) => typeof tool?.execute === 'function').map(([key]) => key);
	let declarations: Promise<Set<string>> | undefined;
	const namesFor = () => declarations ??= config.inputSchema === undefined ? Promise.resolve(new Set<string>())
		: inputNames(config.inputSchema, tool).then(names => new Set(names));
	async function prepare() {
		const incoming = !binding ? {} : inputObject(config.toolContextSchema === undefined ? context
			: (await parseSchema(config.toolContextSchema, context, toolName === undefined ? 'Tool context' : `Tool '${toolName}' context`)).value);
		const keys = [...ownKeys(configured), ...ownKeys(incoming), ...declared, ...registered];
		const names = tool || keys.some(key => typeof key === 'string') ? await namesFor() : new Set<string>();
		const defaults = { ...selectFields(configured, names, true), ...selectFields(incoming, names, true) };
		const reserved = new Set(keys.filter(key => typeof key !== 'string' || !names.has(key)));
		return { incoming, names, defaults, reserved };
	}
	let facts: ReturnType<typeof prepare> | undefined;
	const ready = () => facts ??= prepare();
	return {
		context,
		async parse(value: unknown, sdk = false) {
			const argumentsCopy = { ...inputObject(value) };
			if (tool) {
				const names = await namesFor();
				const unknown = ownKeys(argumentsCopy).filter(key => typeof key !== 'string' || !names.has(key));
				if (unknown.length) throw new ConfigError(`Undeclared tool input keys: ${unknown.map(String).join(', ')}.`);
			}
			const { defaults, reserved } = await ready();
			const complete = { ...defaults, ...argumentsCopy };
			// Only application validation exposes native details to the SDK. Preparation
			// above can fail on private context and retains its stage-only error.
			const parsed = config.inputSchema === undefined ? complete : requireContextObject((await parseSchema(config.inputSchema, complete,
				sdk ? undefined : toolName === undefined ? 'Application input' : `Tool '${toolName}' input`)).value);
			rejectPrivate(parsed, reserved);
			return { value: parsed };
		},
		async assemble(input: Fields, incoming: Fields, options: ComponentExecutionOptions, registry: PreparedRegistry) {
			const facts = await ready();
			const names = Object.keys(incoming).length ? await namesFor() : facts.names;
			if (!binding && Object.keys(incoming).some(key => names.has(key))) {
				throw new ConfigError('Incoming public defaults require bindToolContext().');
			}
			const privateFields = { ...selectFields(configured, names, false), ...selectFields(incoming, names, false) };
			rejectPrivate(input, new Set([...facts.reserved, ...ownKeys(privateFields)]));
			const execution = { ...privateFields, ...input, _toolOptions: options };
			for (const [key, helper] of Object.entries(registry.helpers(options))) {
				if (!Object.hasOwn(execution, key)) Object.defineProperty(execution, key, {
					value: helper, enumerable: true, writable: true, configurable: true,
				});
			}
			options.abortSignal?.throwIfAborted();
			// A helper named `then` must remain data across the async boundary.
			return { context: execution };
		},
		ready,
		metadata: async () => {
			if (!config.inputSchema) throw new ConfigError('Tools require inputSchema.');
			const { defaults, incoming } = await ready();
			return projectInput(await asSchema(config.inputSchema).jsonSchema, defaults, configured, incoming);
		},
	};
}

export async function prepareExecution(config: ExecutionConfig, input: unknown, options: ComponentExecutionOptions = {}, toolsContext?: Fields, tool = false) {
	options.abortSignal?.throwIfAborted();
	const registry = prepareRegistry(config, toolsContext);
	const prepared = preparation(config, tool);
	const { value } = await prepared.parse(input);
	const { context } = await prepared.assemble(value, {}, options, registry);
	return { context, registry };
}

export const descriptorKeys = [
	'description', 'title', 'deferLoading', 'providerOptions', 'metadata', 'strict', 'inputExamples',
	'toModelOutput', 'onInputStart', 'onInputDelta', 'onInputAvailable', 'needsApproval',
] as const satisfies readonly (keyof Tool)[];

/** Add the native SDK surface directly to a callable; its original config stays intact. */
export function defineTool<T extends { config: ExecutionConfig }>(
	component: T, execute: Executor, outputSchema?: FlexibleSchema<unknown>, descriptorConfig: object = component.config,
): T & Tool<Fields, unknown, unknown> & { bindToolContext(context: unknown): { tool: Tool<Fields, unknown, unknown>; context: unknown } } {
	const config = component.config;
	function bind(raw: unknown, bound: boolean, toolName?: string): Binding {
		const prepared = preparation(config, true, bound ? { context: raw, name: toolName } : undefined);
		const properties = Object.fromEntries(descriptorKeys.filter(key => Object.hasOwn(descriptorConfig, key)).map(key => [key, (descriptorConfig as Fields)[key]]));
		async function finish(input: Fields, incoming: Fields, options: ComponentExecutionOptions) {
			options.abortSignal?.throwIfAborted();
			const registry = prepareRegistry(config);
			const { context } = await prepared.assemble(input, incoming, options, registry);
			return toolOutput(await execute(context, registry), outputSchema);
		}
		const tool: Tool<Fields, unknown, unknown> = {
			...properties,
			type: 'function',
			inputSchema: jsonSchema(prepared.metadata, { async validate(value) {
				try { return { success: true, ...(await prepared.parse(value, true)) }; }
				catch (error) { return { success: false, error: error instanceof Error ? error : new Error(String(error)) }; }
			} }),
			...(config.toolContextSchema === undefined ? {} : { contextSchema: config.toolContextSchema }),
			execute(input, options) {
				const { context, ...metadata } = options;
				return finish(requireContextObject(input), inputObject(context), metadata);
			},
		};
		return {
			tool, context: prepared.context,
			async invoke(input, options) {
				const { value } = await prepared.parse(input);
				const { incoming } = await prepared.ready();
				return finish(value, incoming, options);
			},
		};
	}
	Object.defineProperty(component, bindComponent, { value: (context: unknown, name: string) => bind(context, true, name) });
	return Object.assign(component, bind(undefined, false).tool, {
		bindToolContext(context: unknown) {
			const binding = bind(context, true);
			return { tool: binding.tool, context: binding.context };
		},
	});
}
