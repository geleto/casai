import { z } from 'zod';
import { modelMessageSchema } from 'ai';

// Preserve the public Casai name while letting the SDK own message validation.
export { modelMessageSchema as ModelMessageSchema } from 'ai';

export const PromptStringOrMessagesSchema = z.union([
	z.string(),
	z.array(modelMessageSchema),
]);
