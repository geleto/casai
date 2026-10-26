import { z } from 'zod';
import { modelMessageSchema } from 'ai';

export const PromptStringOrMessagesSchema = z.union([
	z.string(),
	z.array(modelMessageSchema),
]);
