// Selected Phase 8 documentation contracts, derived from the installed SDK.
// Replace with production declarations when implemented; do not emulate execution.
export function videoContracts(aliases, details) {
  const native = "Parameters<typeof import('ai').experimental_generateVideo>[0]";
  const base = "import('../src/types/component.js').ComponentConfig<'ImageGenerator', 'text'>";
  const owned = "keyof import('../src/types/component-map.js').ComponentSettings['ImageGenerator']";
  const modifiers = { withText: 'text', withTemplate: 'async-template', withScript: 'async-script', withFunction: 'function', loadsText: 'text-name', loadsTemplate: 'async-template-name', loadsScript: 'async-script-name' };
  Object.assign(aliases, {
    VideoGenerator_settings: native,
    VideoGenerator_native: native,
    VideoGenerator_config: `Omit<${base}, ${owned} | 'streaming' | 'asTool'> & Omit<Partial<${native}>, 'abortSignal'> & Pick<${native}, 'model'>`,
    VideoGenerator_inputs: `{ direct: ${native}['prompt']; prepared: ${native}['prompt']; template: ${native}['prompt'] }`,
    VideoGenerator_definition: JSON.stringify({ name: 'VideoGenerator', main: 'prompt', defaultMode: 'text', structured: 'image', modifiers, toolModes: [...new Set(Object.values(modifiers))], required: ['model'] }),
    VideoGenerator_result: "Awaited<ReturnType<typeof import('ai').experimental_generateVideo>>",
  });
  Object.assign(details, {
    VideoPrompt: "Exclude<import('ai').GenerateVideoPrompt, string>",
    VideoPoll: `NonNullable<${native}['poll']>`,
    VideoFrame: `NonNullable<${native}['frameImages']>[number]`,
    VideoReference: `Extract<NonNullable<${native}['inputReferences']>[number], { data: unknown }>`,
  });
}
