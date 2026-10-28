import { Output } from 'ai';
// Family boundaries must hold for both local settings and inherited providers.
import { create, z } from 'casai';
import type { LanguageModel } from 'ai';

declare const model: LanguageModel;
const inputSchema = z.object({ value: z.number() });
const schema = z.number();
const loader = (name: string) => name;
const filters = { upper: (value: string) => value.toUpperCase() };
const renderOptions = { autoescape: false };
const execute = () => 1;
const functionParent = create.Config({ execute });
const rendererParent = create.Config({ filters, renderOptions, context: { label: 'value' }, inputSchema });

create.Template({ template: '{{ value }}', filters, renderOptions, inputSchema });
create.Script({ script: 'return value', schema, filters, renderOptions, inputSchema });
create.LLMAgent.withTemplate({ model, prompt: '{{ value }}' }, rendererParent);
create.LLMAgent.withScript({ model, prompt: 'return value', output: Output.object({ schema: schema }) }, rendererParent);
// Function prompts support context and inputSchema, but do not create a Cascada environment.
create.LLMAgent.withFunction({ model, inputSchema, context: { label: 'value' }, prompt: ({ value, label }) => `${label}${value}` });

// @ts-expect-error Template components cannot execute JavaScript callbacks as their body.
create.Template({ template: '{{ value }}', execute });
// @ts-expect-error Script components cannot execute JavaScript callbacks as their body.
create.Script({ script: 'return 1', execute });
// @ts-expect-error Text generators cannot carry Function implementations.
create.LLMAgent({ model, prompt: 'Answer', execute });
// @ts-expect-error Object generators cannot carry Function implementations.
create.LLMAgent({ model, prompt: 'Answer', execute, output: Output.object({ schema: schema }) });
// @ts-expect-error Inherited Function implementations remain invalid in renderer components.
create.Template({ template: 'Answer' }, functionParent);
// @ts-expect-error Inherited Function implementations remain invalid in LLM components.
create.LLMAgent({ model, prompt: 'Answer' }, functionParent);

create.LLMAgent({ model, prompt: 'Answer', context: { value: 1 } });
create.LLMAgent({ model, prompt: 'Answer', inputSchema });
create.LLMAgent({ model, prompt: 'Answer', filters, output: Output.object({ schema: schema }) });
// @ts-expect-error Plain object generation does not create renderer options.
create.LLMAgent({ model, prompt: 'Answer', options: renderOptions, output: Output.object({ schema: schema }) });
create.LLMAgent({ model, prompt: 'Answer', context: { value: 1 }, output: Output.object({ schema: schema }) });
create.LLMAgent({ model, prompt: 'Answer', inputSchema, output: Output.object({ schema: schema }) });
create.LLMAgent.withFunction({ model, prompt: () => 'Answer', filters });
// @ts-expect-error JavaScript object prompt functions do not use Cascada options.
create.LLMAgent.withFunction({ model, prompt: () => 'Answer', options: renderOptions, output: Output.object({ schema: schema }) });

// @ts-expect-error Filter map values must be callable.
create.Template({ template: 'Answer', filters: { bad: 1 } });
// @ts-expect-error Renderer options retain their value types.
create.Script({ script: 'return 1', renderOptions: { autoescape: 'false' } });
// @ts-expect-error Template bodies are strings.
create.Template({ template: () => 'Answer' });
// @ts-expect-error Script bodies are strings.
create.Script({ script: 1 });

// @ts-expect-error Function components cannot configure models.
create.Function({ execute, model });
// @ts-expect-error Function components cannot configure loaders.
create.Function({ execute, loader });
// Coded components can own tools.
create.Function({ execute, tools: {} });
// @ts-expect-error Function components cannot configure message history.
create.Function({ execute, messages: [{ role: 'user', content: 'Answer' }] });
// @ts-expect-error Function components cannot configure prompts.
create.Function({ execute, prompt: 'Answer' });
// @ts-expect-error Function components cannot configure templates.
create.Function({ execute, template: 'Answer' });
// @ts-expect-error Model settings remain invalid when inherited by a Function.
create.Function({ execute }, create.Config({ model }));
// @ts-expect-error Loader settings remain invalid when inherited by a Function.
create.Function({ execute }, create.Config({ loader }));
// Registry inheritance applies to Functions too.
create.Function({ execute }, create.Config({ tools: {} }));
// @ts-expect-error Messages remain invalid when inherited by a Function.
create.Function({ execute }, create.Config({ messages: [{ role: 'user', content: 'Answer' }] }));
// @ts-expect-error Prompts remain invalid when inherited by a Function.
create.Function({ execute }, create.Config({ prompt: 'Answer' }));
// @ts-expect-error Templates remain invalid when inherited by a Function.
create.Function({ execute }, create.Config({ template: 'Answer' }));

const text = create.LLMAgent({ model, prompt: 'Answer' });
const template = create.Template({ template: 'Answer' });
const script = create.Script({ script: 'return 1' });
// @ts-expect-error A text generator's model config is not a Template parent.
create.Template({ template: 'Answer' }, text);
// @ts-expect-error A text generator's model config is not a Script parent.
create.Script({ script: 'return 1' }, text);
// @ts-expect-error A Template body is not a text-generator setting.
create.LLMAgent({ model, prompt: 'Answer' }, template);
// @ts-expect-error A Script body is not an object-generator setting.
create.LLMAgent({ model, prompt: 'Answer', output: Output.object({ schema: schema }) }, script);
// @ts-expect-error Function implementations are not Script parent settings.
create.Script({ script: 'return 1' }, functionParent);
