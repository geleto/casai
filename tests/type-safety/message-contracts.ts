// Public validators must produce SDK messages, and accept every SDK message part.
import { create, ModelMessageSchema, PromptStringOrMessagesSchema, z } from 'casai';
import type { ModelMessage } from 'casai';
import type { LanguageModel, modelMessageSchema } from 'ai';
import { expectEqual, expectType } from './assert.js';

declare const model: LanguageModel;
declare const sdkMessage: ModelMessage;
const parsed = ModelMessageSchema.parse({ role: 'user', content: 'Question' });
expectType<ModelMessage>(parsed);
expectEqual<z.output<typeof ModelMessageSchema>, ModelMessage>();
create.Config({ messages: [parsed] });
create.TextGenerator({ model, prompt: [parsed] });
create.TextStreamer({ model, messages: [parsed] });
const generator = create.TextGenerator({ model, prompt: 'Answer' });
void generator([parsed]);
void generator.run({ messages: [parsed] });
const prompt = PromptStringOrMessagesSchema.parse([sdkMessage]);
expectType<string | ModelMessage[]>(prompt);
expectEqual<z.output<typeof PromptStringOrMessagesSchema>, string | ModelMessage[]>();
// @ts-expect-error Validated prompts retain their string/message shape.
expectType<number>(prompt);

// The exported validator is the SDK validator, including its input and output contracts.
expectEqual<typeof ModelMessageSchema, typeof modelMessageSchema>();
expectEqual<z.input<typeof ModelMessageSchema>, z.input<typeof modelMessageSchema>>();

const custom = ModelMessageSchema.parse({ role: 'assistant', content: [{ type: 'custom', kind: 'provider.state' }] });
if (custom.role === 'assistant' && typeof custom.content !== 'string') {
	for (const part of custom.content) {
		if (part.type === 'custom') {
			expectEqual<typeof part.kind, `${string}.${string}`>();
			// @ts-expect-error Custom kinds retain their provider-qualified contract.
			const _unqualified: typeof part.kind = 'state';
		}
	}
}

const media = ModelMessageSchema.parse({ role: 'user', content: [{ type: 'file', mediaType: 'text/plain', data: 'file' }] });
expectType<ModelMessage>(media);
const approval = ModelMessageSchema.parse({ role: 'tool', content: [{ type: 'tool-approval-response', approvalId: 'approval', approved: true }] });
expectType<ModelMessage>(approval);
if (approval.role === 'tool') {
	for (const part of approval.content) {
		if (part.type === 'tool-approval-response') {
			expectType<boolean>(part.approved);
			// @ts-expect-error Approval decisions remain boolean after validation.
			expectType<string>(part.approved);
		}
	}
}
