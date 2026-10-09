// Family boundaries must hold for both local settings and inherited providers.
import { create, z } from 'casai';
import type { LanguageModel } from 'ai';

declare const model: LanguageModel;
const inputSchema = z.object({ value: z.number() });
const schema = z.number();
const loader = (name: string) => name;
const filters = { upper: (value: string) => value.toUpperCase() };
const options = { autoescape: false };
const execute = () => 1;
const functionParent = create.Config({ execute });
const rendererParent = create.Config({ filters, options, context: { label: 'value' }, inputSchema });

create.Template({ template: '{{ value }}', filters, options, inputSchema });
create.Script({ script: 'return value', schema, filters, options, inputSchema });
create.TextGenerator.withTemplate({ model, prompt: '{{ value }}' }, rendererParent);
create.ObjectGenerator.withScript({ model, schema, prompt: 'return value' }, rendererParent);
// Function prompts support context and inputSchema, but do not create a Cascada environment.
create.TextGenerator.withFunction({ model, inputSchema, context: { label: 'value' }, prompt: ({ value, label }) => `${label}${value}` });

// @ts-expect-error Template components cannot execute JavaScript callbacks as their body.
create.Template({ template: '{{ value }}', execute });
// @ts-expect-error Script components cannot execute JavaScript callbacks as their body.
create.Script({ script: 'return 1', execute });
// @ts-expect-error Text generators cannot carry Function implementations.
create.TextGenerator({ model, prompt: 'Answer', execute });
// @ts-expect-error Object generators cannot carry Function implementations.
create.ObjectGenerator({ model, schema, prompt: 'Answer', execute });
// @ts-expect-error Inherited Function implementations remain invalid in renderer components.
create.Template({ template: 'Answer' }, functionParent);
// @ts-expect-error Inherited Function implementations remain invalid in LLM components.
create.TextGenerator({ model, prompt: 'Answer' }, functionParent);

// @ts-expect-error Plain text does not render configured context.
create.TextGenerator({ model, prompt: 'Answer', context: { value: 1 } });
// @ts-expect-error Plain text does not validate rendering input.
create.TextGenerator({ model, prompt: 'Answer', inputSchema });
// @ts-expect-error Plain object generation does not create renderer filters.
create.ObjectGenerator({ model, schema, prompt: 'Answer', filters });
// @ts-expect-error Plain object generation does not create renderer options.
create.ObjectGenerator({ model, schema, prompt: 'Answer', options });
// @ts-expect-error Plain object generation does not render configured context.
create.ObjectGenerator({ model, schema, prompt: 'Answer', context: { value: 1 } });
// @ts-expect-error Plain object generation does not validate rendering input.
create.ObjectGenerator({ model, schema, prompt: 'Answer', inputSchema });
// @ts-expect-error JavaScript prompt functions do not use Cascada filters.
create.TextGenerator.withFunction({ model, prompt: () => 'Answer', filters });
// @ts-expect-error JavaScript object prompt functions do not use Cascada options.
create.ObjectGenerator.withFunction({ model, schema, prompt: () => 'Answer', options });

// @ts-expect-error Filter map values must be callable.
create.Template({ template: 'Answer', filters: { bad: 1 } });
// @ts-expect-error Renderer options retain their value types.
create.Script({ script: 'return 1', options: { autoescape: 'false' } });
// @ts-expect-error Template bodies are strings.
create.Template({ template: () => 'Answer' });
// @ts-expect-error Script bodies are strings.
create.Script({ script: 1 });

// @ts-expect-error Function components cannot configure models.
create.Function({ execute, model });
// @ts-expect-error Function components cannot configure loaders.
create.Function({ execute, loader });
// @ts-expect-error Function components cannot configure tools.
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
// @ts-expect-error Tool maps remain invalid when inherited by a Function.
create.Function({ execute }, create.Config({ tools: {} }));
// @ts-expect-error Messages remain invalid when inherited by a Function.
create.Function({ execute }, create.Config({ messages: [{ role: 'user', content: 'Answer' }] }));
// @ts-expect-error Prompts remain invalid when inherited by a Function.
create.Function({ execute }, create.Config({ prompt: 'Answer' }));
// @ts-expect-error Templates remain invalid when inherited by a Function.
create.Function({ execute }, create.Config({ template: 'Answer' }));

const text = create.TextGenerator({ model, prompt: 'Answer' });
const template = create.Template({ template: 'Answer' });
const script = create.Script({ script: 'return 1' });
// @ts-expect-error A text generator's model config is not a Template parent.
create.Template({ template: 'Answer' }, text);
// @ts-expect-error A text generator's model config is not a Script parent.
create.Script({ script: 'return 1' }, text);
// @ts-expect-error A Template body is not a text-generator setting.
create.TextGenerator({ model, prompt: 'Answer' }, template);
// @ts-expect-error A Script body is not an object-generator setting.
create.ObjectGenerator({ model, schema, prompt: 'Answer' }, script);
// @ts-expect-error Function implementations are not Script parent settings.
create.Script({ script: 'return 1' }, functionParent);
