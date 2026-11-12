import { sourceMode } from '../config/source-mode.js';
import type { PromptType } from '../types/prompt.js';
import type { FilePayload } from '../types/result.js';
import type { OptionalUndefined } from '../types/utils.js';
import type { ConfigForMode } from '../types/factory-config.js';
import type { CanOmitComponentInput } from '../types/component-input.js';
import type { CallableComponent, SourceArguments, SourceSettings, BaseRunSettings, Configured } from '../types/component.js';
import { generateImage } from 'ai';
import { createComponentFactory, textModifiers, textModes } from './component-factory.js';
import { createComponentRuntime } from '../runtime/component-call.js';
import { isContextArgument } from '../runtime/execution.js';
import type { RuntimeComponentConfig, PreparedComponentCall } from '../runtime/component-call.js';
import type { ToolInvocation } from '../types/execution.js';
import type { Fields } from '../types/utils.js';
import { isPlainObject } from '../schema.js';
import { ValidationError } from '../errors.js';

type ImagePrompt = Exclude<Parameters<typeof generateImage>[0]['prompt'], string>;
type Settings = Omit<Parameters<typeof generateImage>[0], '_internal'> & Partial<Pick<ImagePrompt, 'images' | 'mask'>>;
export const definition = {
	name: 'ImageGenerator', defaultMode: 'text', main: 'prompt', structured: 'image', modifiers: textModifiers, toolModes: textModes, required: ['model'],
} as const satisfies import('./component-factory.js').ComponentDefinition<Settings>;

type ToolResult = FilePayload[];
type HasSource<P extends PromptType, T> = P extends 'text' ? true extends Configured<T, 'prompt'> | Configured<T, 'images'> ? true : false : Configured<T, 'prompt'>;
type MaskCountArguments = OptionalUndefined<[mask?: Settings['mask'], n?: number] | [n?: number]>;
type MediaArguments = [images?: Settings['images'], ...MaskCountArguments] | MaskCountArguments;
type ImageOnlyArguments = [text: undefined, images: NonNullable<Settings['images']>, ...MaskCountArguments]
	| [images: NonNullable<Settings['images']>, ...MaskCountArguments];
type Arguments<P extends PromptType, T> = SourceArguments<'ImageGenerator', P, T, MediaArguments, HasSource<P, T>>
	| (P extends 'text' ? CanOmitComponentInput<T> extends true ? HasSource<P, T> extends false ? ImageOnlyArguments : never : never : never);
type RunSettings<P extends PromptType, T> = BaseRunSettings<'ImageGenerator', T,
	SourceSettings<'ImageGenerator', P, T, HasSource<P, T>> | (P extends 'text' ? HasSource<P, T> extends false ? { prompt?: undefined; images: NonNullable<Settings['images']> } : never : never)>;
export interface Calls<P extends PromptType, T> { arguments: Arguments<P, T>; settings: RunSettings<P, T> }

/** Invocation fields override the resolved source; replacing images drops the previous mask. */
function imageInput({ settings: { prompt: input }, supplied }: PreparedComponentCall, config: RuntimeComponentConfig): Settings['prompt'] {
	const object = isPlainObject(input);
	const bundle = object ? input as ImagePrompt : isPlainObject(config.prompt) ? config.prompt as ImagePrompt : undefined;
	const text = object ? bundle!.text : input as string | undefined;
	if (object && supplied.images === undefined && supplied.mask === undefined) return input as ImagePrompt;
	const images = supplied.images ?? bundle?.images ?? config.images;
	const mask = supplied.mask ?? (supplied.images === undefined ? bundle ? bundle.mask : config.mask : undefined);
	if (images !== undefined && !Array.isArray(images)) throw new ValidationError('Image generation images must be an array.');
	if (Array.isArray(images) && images.length) return { text, images: images as ImagePrompt['images'], ...(mask === undefined ? {} : { mask: mask as ImagePrompt['mask'] }) };
	if (mask !== undefined) throw new ValidationError('An image mask requires images.');
	if (text === undefined) throw new ValidationError('Image generation without images requires prompt text.');
	return text;
}

export interface Types<P extends PromptType, T, A extends boolean> {
	definition: typeof definition;
	settings: Settings;
	templateInput: Settings['prompt'];
	component: CallableComponent<'ImageGenerator', P, T, A, { [M in P]: Calls<M, ConfigForMode<T, M, P>> }, true>;
	result: import('ai').GenerateImageResult;
	toolResult: ToolResult;
	toolInput: Settings['prompt'] | (Configured<T, 'images'> extends true ? undefined : never);
}

function createImageGenerator(config: RuntimeComponentConfig) {
	const runtime = createComponentRuntime(config, definition);
	async function invoke(raw: Fields, tool?: ToolInvocation) {
		const prepared = await runtime.prepare(raw, tool);
		prepared.settings.prompt = imageInput(prepared, config);
		const result = await generateImage(runtime.request(prepared, ['images', 'mask']) as Settings);
		return tool ? result.images.map(({ mediaType, base64 }) => ({ mediaType, base64 })) : result;
	}
	return runtime.callable(invoke, args => {
		const call = runtime.arguments(args, {
			literal: first => first === undefined || typeof first === 'string' || isPlainObject(first),
			prepared: values => isPlainObject(values[0]) && isContextArgument(values[1]),
			objectSource: config[sourceMode] === 'async-template',
		});
		call.take('images', Array.isArray);
		call.take('mask', value => typeof value === 'string' || value instanceof Uint8Array || value instanceof ArrayBuffer);
		call.take('n', value => typeof value === 'number');
		return call.done();
	}, ({ output }) => ({ type: 'content', value: (output as ToolResult).map(file => ({ type: 'file', data: { type: 'data', data: file.base64 }, mediaType: file.mediaType })) }));
}

type Factory = import('./component-factory.js').SourceFactory<'ImageGenerator'>;
export const ImageGenerator = createComponentFactory(definition, createImageGenerator) as Factory;
