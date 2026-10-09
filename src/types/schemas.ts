import { z } from 'zod';
import type { ModelMessage } from 'ai';

// Content part schemas
export const TextPartSchema = z.object({
	type: z.literal('text'),
	text: z.string(),
	providerOptions: z.any().optional(),
}).passthrough();

export const ImagePartSchema = z.object({
	type: z.literal('image'),
	image: z.any(), // data (base64/Uint8Array/ArrayBuffer/Buffer) or URL
	mediaType: z.string().optional(),
	providerOptions: z.any().optional(),
}).passthrough();

export const FilePartSchema = z.object({
	type: z.literal('file'),
	data: z.any(), // data (base64/Uint8Array/ArrayBuffer/Buffer) or URL
	filename: z.string().optional(),
	mediaType: z.string(),
	providerOptions: z.any().optional(),
}).passthrough();

export const ReasoningPartSchema = z.object({
	type: z.literal('reasoning'),
	text: z.string(),
	providerOptions: z.any().optional(),
}).passthrough();

export const CustomPartSchema = z.object({
	type: z.literal('custom'),
	kind: z.templateLiteral([z.string(), '.', z.string()]),
	providerOptions: z.any().optional(),
}).passthrough();

export const ReasoningFilePartSchema = z.object({
	type: z.literal('reasoning-file'),
	data: z.any(),
	mediaType: z.string(),
	providerOptions: z.any().optional(),
}).passthrough();

export const ToolCallPartSchema = z.object({
	type: z.literal('tool-call'),
	toolCallId: z.string(),
	toolName: z.string(),
	input: z.any(),
	providerOptions: z.any().optional(),
	providerExecuted: z.boolean().optional(),
}).passthrough();

export const ToolResultPartSchema = z.object({
	type: z.literal('tool-result'),
	toolCallId: z.string(),
	toolName: z.string(),
	output: z.any(),
	providerOptions: z.any().optional(),
}).passthrough();

export const ToolApprovalRequestSchema = z.object({
	type: z.literal('tool-approval-request'),
	approvalId: z.string(),
	toolCallId: z.string(),
	reason: z.string().optional(),
	isAutomatic: z.boolean().optional(),
	signature: z.string().optional(),
	inputSchemaInput: z.any().optional(),
}).passthrough();

export const ToolApprovalResponseSchema = z.object({
	type: z.literal('tool-approval-response'),
	approvalId: z.string(),
	approved: z.boolean(),
	reason: z.string().optional(),
	providerExecuted: z.boolean().optional(),
}).passthrough();

// Message content schemas
export const UserContentSchema = z.union([
	z.string(),
	z.array(z.union([TextPartSchema, ImagePartSchema, FilePartSchema])),
]);

export const AssistantContentSchema = z.union([
	z.string(),
	z.array(
		z.union([
			TextPartSchema,
			CustomPartSchema,
			FilePartSchema,
			ReasoningPartSchema,
			ReasoningFilePartSchema,
			ToolCallPartSchema,
			ToolResultPartSchema,
			ToolApprovalRequestSchema,
		]),
	),
]);

export const ToolContentSchema = z.array(z.union([ToolResultPartSchema, ToolApprovalResponseSchema]));

// Message schemas
export const SystemModelMessageSchema = z
	.object({
		role: z.literal('system'),
		content: z.string(),
		providerOptions: z.any().optional(),
	})
	.passthrough();

export const UserModelMessageSchema = z
	.object({
		role: z.literal('user'),
		content: UserContentSchema,
		providerOptions: z.any().optional(),
	})
	.passthrough();

export const AssistantModelMessageSchema = z
	.object({
		role: z.literal('assistant'),
		content: AssistantContentSchema,
		providerOptions: z.any().optional(),
	})
	.passthrough();

export const ToolModelMessageSchema = z
	.object({
		role: z.literal('tool'),
		content: ToolContentSchema,
		providerOptions: z.any().optional(),
	})
	.passthrough();

const ModelMessageUnionSchema = z.union([
	SystemModelMessageSchema,
	UserModelMessageSchema,
	AssistantModelMessageSchema,
	ToolModelMessageSchema,
]);

// Match the SDK's public output contract while retaining the inferred validation input for drift checks.
// The underlying union stays intact, including passthrough provider extension fields.
export const ModelMessageSchema: z.ZodType<ModelMessage, z.input<typeof ModelMessageUnionSchema>> = ModelMessageUnionSchema;

// Union schema: string | ModelMessage[]
export const PromptStringOrMessagesSchema = z.union([
	z.string(),
	z.array(ModelMessageSchema),
]);
