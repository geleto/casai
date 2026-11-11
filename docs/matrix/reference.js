/**
 * Full component documentation as serializable data. No UI or model execution.
 * describe() and render() accept the same canonical example selection.
 * Example controls are teaching choices; reference applicability comes from the
 * public API inventory and local documentation, never from generated code.
 */
import { getComponent, validateOptions, visibleGroups, selectOption, matchesOptions } from './matrix.js';
import { factory, sourceMode } from './shared.js';
import api from './reference/api.js';
import sdkDocs from './reference/sdk-docs.js';
import { componentReference, sourceKinds, sourceModes, infoSections, configSections, sdkGroups } from './reference/components.js';
import { commonProperties, componentProperties, sdkPropertyGroups } from './reference/properties.js';
import { concepts } from './reference/concepts.js';

export { infoSections, configSections, sdkGroups, concepts };
export const referenceVersions = api.packages;
const records = name => (api.shapes[name] ?? []).map(id => api.properties[id]);
const byName = list => Object.fromEntries(list.map(property => [property.name, property]));
const sharedCallFields = ['context', 'toolsContext', 'abortSignal'];
const commonInheritance = 'Constructor child values replace inherited values; omitted settings inherit. Supported invocation overrides apply only to that invocation.';

export function getSourceControl(name, selected = getComponent(name).activeOptions) {
  const component = getComponent(name);
  const group = component.groups.find(group => group.id === 'source');
  if (!group) return null;
  const ids = group.choices.map(choice => choice.id);
  const choices = sourceKinds.filter(kind => kind.id === 'default' || ids.includes(kind.inline));
  const current = choices.find(kind => selected.includes(kind.inline) || (kind.loaded && selected.includes(kind.loaded))) ?? choices[0];
  return {
    id: 'source', name: 'Source', kind: current.id,
    choices: choices.map(({ id, name }) => ({ id, name })),
    loads: { id: 'loads', name: 'Loads', active: Boolean(current.loaded && selected.includes(current.loaded)), available: Boolean(current.loaded && ids.includes(current.loaded)), description: 'Load this source from a resource using the configured loader.' },
    modifier: sourceMode(selected)?.replace(/^load/, 'loads') ?? null,
    description: 'The source property keeps its name; this choice changes how its value is interpreted.',
  };
}

export function selectSource(name, selected, kind) {
  const control = getSourceControl(name, selected);
  if (!control?.choices.some(choice => choice.id === kind)) throw new Error(`Unsupported ${name} source: ${kind}`);
  const choice = sourceKinds.find(choice => choice.id === kind);
  const current = sourceMode(selected);
  if (kind === 'default') return current ? selectOption(name, selected, current, false) : [...selected];
  return selectOption(name, selected, control.loads.active && choice.loaded ? choice.loaded : choice.inline);
}

export function setLoads(name, selected, active) {
  const control = getSourceControl(name, selected);
  if (!control?.loads.available) throw new Error(`Loading is unavailable for the selected ${name} source`);
  const choice = sourceKinds.find(choice => choice.id === control.kind);
  return selectOption(name, selected, active ? choice.loaded : choice.inline);
}

function selectedSpec(component, selected) {
  const base = componentReference[component.name];
  return { factory: component.name, types: component.name, status: 'implemented', ...base,
    ...(base.variants ?? []).find(variant => matchesOptions(component, variant, selected)) };
}

function describeProperty(property, spec, { definition, mode, selected, runKeys, operationRequired }) {
  const name = property.name;
  const common = commonProperties[name] ?? {};
  const own = componentProperties[spec.types]?.[name] ?? {};
  const local = { ...common, ...own, ...spec.overrides?.[name] };
  const native = [property, byName(records(`${spec.types}_native`))[name], byName(records(spec.nativeDocs))[name], byName(records(local.nativeDocs))[name]]
    .find(record => record?.source?.package && record.description);
  const isMain = name === definition?.main;
  const input = byName(records(`${spec.types}_inputs`));
  const sourceKind = sourceModes[mode];
  const sourceTypes = {
    direct: input.direct?.type,
    template: input.template?.type,
    resource: 'string (resource name)', script: 'string (Cascada source)',
    function: `(context: PreparedContext) => ${input.prepared?.type ?? 'unknown'} | PromiseLike<${input.prepared?.type ?? 'unknown'}>`,
  };
  const requiredAtCreation = !spec.fragment && (definition?.required.includes(name)
    || (mode?.endsWith('-name') ? name === 'loader' : definition?.inlineRequired?.includes(name))
    || (selected.includes('asTool') && (name === 'inputSchema' || definition?.toolRequired?.includes(name) || (isMain && mode !== 'text'))));
  const constructor = !['abortSignal', 'messageHistory'].includes(name);
  const positional = definition && ((isMain && !spec.fixedImplementation) || spec.positional?.includes(name)
    || name === 'context' && (spec.coded || spec.contextPositional || mode !== 'text' || selected.includes('asTool')));
  const locations = [...(constructor ? ['construction'] : []), ...(runKeys.includes(name) ? ['run'] : []), ...(positional ? ['ordinary'] : [])];
  const origin = local.origin ?? (property.source?.package?.startsWith('cascada') ? 'cascada' : property.source?.package ? 'ai-sdk' : 'casai');
  const descriptor = records('Tool').some(record => record.name === name) && !records(`${spec.types}_settings`).some(record => record.name === name);
  const section = isMain || name === 'model' || requiredAtCreation && !local.section ? 'essential' : local.section ?? (descriptor ? 'variants' : 'sdk');
  const sdkGroup = local.sdkGroup ?? Object.entries(sdkPropertyGroups).find(([, names]) => names.includes(name))?.[0] ?? 'operation';
  return {
    id: name, name, type: local.type ?? (isMain && sourceKind ? sourceTypes[sourceKind.value] : property.type),
    description: local.description ?? native?.description ?? property.description ?? '',
    descriptionOrigin: local.description ? 'casai' : native?.source?.package ?? 'casai',
    default: local.default ?? property.tags?.find(tag => tag.name === 'default')?.text ?? native?.tags?.find(tag => tag.name === 'default')?.text ?? 'Omitted; the selected operation owns any default.',
    required: { construction: Boolean(requiredAtCreation), operation: operationRequired.includes(name), description: local.required ?? (requiredAtCreation ? 'Required when constructing the finished component, possibly inherited.' : isMain ? 'Must resolve from configuration or invocation unless an alternative native input satisfies the operation.' : 'Optional.') },
    locations, override: runKeys.includes(name) ? 'Supported through .run(); see the property-specific merge/clearing rule.' : 'Fixed at construction; derive a component to replace it.',
    inheritance: local.inheritance ?? commonInheritance,
    scope: local.scope ?? 'component', origin, adaptation: local.adaptation ?? null,
    applicability: { component: spec.factory, sourceMode: isMain ? mode : null, operations: local.operations ?? null },
    section, sdkGroup, notes: local.notes ?? null,
    sourceMode: isMain ? mode : null,
    relatedOptions: optionProperties.filter(rule => rule.properties.includes(name)).map(rule => rule.option),
    upstream: native?.source?.package ? { ...native.source, description: native.description, type: native.type, tags: native.tags } : null,
    source: property.source ?? null,
    nested: local.nested ? records(local.nested) : [],
    status: spec.status,
    deprecated: property.tags?.find(tag => tag.name === 'deprecated')?.text ?? null,
  };
}

// This relationship highlights relevant properties; it does not restrict API support.
const optionProperties = [
  { option: 'asTool', properties: ['asTool', 'inputSchema', 'toolContextSchema', 'description', 'toModelOutput', 'strict', 'inputExamples'] },
  { option: 'asStream', properties: ['streaming', 'inputAudioFormat', 'outputFormat', 'outputAudioFormat', 'onChunk', 'onError', 'onAbort', 'streamRetries'] },
  { option: 'useTools', properties: ['tools', 'toolsContext', 'toolChoice', 'stopWhen'] },
  { option: 'structured', properties: ['output'] }, { option: 'batch', properties: ['input', 'maxParallelCalls'] },
  { option: 'referenceImage', properties: ['images'] }, { option: 'mask', properties: ['mask'] }, { option: 'count', properties: ['n'] },
  { option: 'voice', properties: ['voice'] }, { option: 'topN', properties: ['topN'] }, { option: 'textStream', properties: ['text'] },
  { option: 'messages', properties: ['messageHistory'] }, { option: 'resume', properties: ['messageHistory', 'toolApproval'] },
  { option: 'loadTemplate', properties: ['loader'] }, { option: 'loadScript', properties: ['loader'] },
];

function methodReference(method, properties) {
  return { ...method,
    arguments: method.shape ? records(method.shape).map(property => ({ ...property, ...method.argumentOverrides?.[property.name] })) : [],
    propertyIds: (method.properties ?? []).filter(name => properties[name]),
    properties: (method.properties ?? []).filter(name => !properties[name]).map(name => ({ name, ...(commonProperties[name] ?? {}) })),
    result: method.resultShape ? records(method.resultShape) : [],
  };
}

export function describe(name, selected = getComponent(name).activeOptions) {
  const component = getComponent(name);
  const options = validateOptions(name, selected);
  const spec = selectedSpec(component, options);
  const definition = api.definitions[spec.types];
  const modifier = sourceMode(options)?.replace(/^load/, 'loads');
  const mode = definition?.modifiers[modifier] ?? definition?.defaultMode;
  const tool = options.includes('asTool');
  const config = byName((spec.propertyShapes ?? [`${spec.types}_config`]).flatMap(records));
  if (tool) for (const property of records('Tool')) config[property.name] ??= property;
  const settings = records(`${spec.types}_settings`).map(property => property.name);
  const operationRequired = records(`${spec.types}_settings`).filter(property => !property.optional).map(property => property.name);
  const runKeys = !definition ? [] : spec.runShape ? [...records(spec.runShape).map(property => property.name), ...sharedCallFields]
    : spec.coded ? [...(spec.fixedImplementation ? [] : [definition.main]), ...sharedCallFields]
    : [...settings.filter(name => !definition?.fixedSettings?.includes(name)), ...sharedCallFields];
  if (definition) config.abortSignal = { name: 'abortSignal', type: 'AbortSignal', tags: [] };
  if (spec.runShape) config.messageHistory = { name: 'messageHistory', type: 'readonly ModelMessage[]', tags: [] };
  const properties = Object.values(config).filter(property => !spec.omit?.includes(property.name))
    .map(property => describeProperty(property, spec, { definition, mode, selected: options, runKeys, operationRequired }));
  const map = byName(properties);
  const callable = Boolean(definition);
  const methods = [
    ...(callable ? [
      { name: 'call', signature: spec.call, description: 'Positional shorthand. Omit resolved slots only when the next argument identifies its role unambiguously. Use .run() for same-type collisions or longer setting lists.' },
      { name: 'run', signature: 'component.run({ context?, ...supportedInputsAndOverrides })', description: 'Named invocation. Missing required application input and unresolved operation input remain required. Configuration-only settings cannot be replaced here.', propertyIds: properties.filter(property => property.locations.includes('run')).map(property => property.id) },
      { name: 'config', signature: 'component.config', description: 'The resolved configuration. Treat it as immutable; construct a new component to replace captured dependencies.' },
    ] : []),
    ...(spec.methods ?? []).filter(method => matchesOptions(component, method, options)).map(method => methodReference(method, map)),
    ...(tool ? [
      { name: 'bindToolContext', signature: 'component.bindToolContext(trustedContext)', description: 'Returns { tool, context } with validated trusted bindings and declared public defaults. Use the bound descriptor and matching context for SDK execution.' },
      { name: 'execute', signature: 'tool.execute(parsedInput, nativeToolOptions)', description: 'Native SDK descriptor entry: input is already parsed by the owning SDK path. Ordinary component calls validate raw input; do not use descriptor execution to bypass that boundary.' },
    ] : []),
  ];
  const groups = visibleGroups(name, options);
  const groupedIds = infoSections.flatMap(section => section.groups ?? []);
  const controls = infoSections.filter(section => section.id !== 'summary').map(section => ({ ...section,
    ...(section.id === 'source' ? { control: getSourceControl(name, options) } : { groups: groups.filter(group => section.groups ? section.groups.includes(group.id) : !groupedIds.includes(group.id)) }),
  }));
  const notices = [component.experimental, component.planned && matchesOptions(component, component.planned, options) ? component.planned.description : null,
    ...component.groups.flatMap(group => group.choices).filter(choice => options.includes(choice.id)).map(choice => choice.experimental)].filter(Boolean);
  const forms = definition && definition.defaultMode !== null ? [
    { modifier: null, mode: definition.defaultMode, ...sourceModes[definition.defaultMode] },
    ...Object.entries(definition.modifiers).map(([modifier, mode]) => ({ modifier, mode, ...sourceModes[mode] })),
  ].map(form => ({ ...form, toolSupported: definition.toolModes.includes(form.mode), applicable: !tool || definition.toolModes.includes(form.mode) })) : [];
  const resultShapes = spec.resultShapes ?? (spec.result ? [spec.result] : []);
  const conceptsForComponent = [...new Set(['configuration', ...(spec.concepts ?? [])])];
  const summary = sdkDocs[spec.summaryOperation];
  return {
    component: name, activeOptions: options, status: spec.status, versions: referenceVersions,
    form: { factory: callable ? factory(spec.factory, options.filter(id => id !== 'asStream' || spec.streamModifier)) : null,
      primaryProperty: definition?.main ?? null, operation: spec.operation ?? null, sourceMode: mode ?? null, sourceModifier: modifier ?? null, notices },
    info: { description: summary?.description ?? component.description,
      descriptionSource: summary ? { operation: spec.summaryOperation, ...summary, reuse: 'verbatim' } : component.descriptionSource ?? null,
      kind: spec.kind ?? 'component', input: spec.input, result: spec.resultSummary, controls },
    config: {
      properties: map,
      sections: configSections.map(section => ({ ...section, propertyIds: properties.filter(property => property.section === section.id).map(property => property.id),
        ...(section.id === 'variants' ? { references: [...new Set([
          ...(tool ? ['inputSchema', definition.main, ...definition.required, ...(definition.toolRequired ?? [])] : []),
          ...(options.includes('asStream') ? ['model', definition.main, ...operationRequired, 'output', 'outputFormat', 'outputAudioFormat'] : []),
        ])].filter(name => map[name] && map[name].section !== 'variants'),
          notes: [tool ? spec.toolResult : null, options.includes('asStream') ? spec.resultDescription ?? spec.resultSummary : null].filter(Boolean) } : {}),
        ...(section.id === 'sdk' ? { groups: sdkGroups.map(group => ({ ...group, propertyIds: properties.filter(property => property.section === 'sdk' && property.sdkGroup === group.id).map(property => property.id) })) } : {}),
        ...(section.id === 'invocation' ? { methods } : {}),
      })),
      index: properties.map(property => ({ name: property.name, propertyId: property.id, section: property.section })).sort((a, b) => a.name.localeCompare(b.name)),
      highlightedPropertyIds: properties.filter(property => property.relatedOptions.some(option => options.includes(option))).map(property => property.id),
      requiredPropertyIds: properties.filter(property => property.required.construction || property.required.operation).map(property => property.id),
      supportedSources: forms,
      alternatives: spec.fragment ? Object.entries(componentReference).filter(([name]) => api.definitions[name]).flatMap(([component, reference]) => [
        { component, factory: component, shape: `${component}_config` },
        ...(reference.variants ?? []).map(variant => ({ component, factory: variant.factory ?? component, shape: `${variant.types ?? component}_config`, requires: variant.requires })),
      ]) : [],
    },
    result: { description: spec.resultDescription ?? spec.resultSummary, tool: tool ? spec.toolResult ?? null : null,
      shapes: resultShapes.map(result => ({ name: result, properties: records(`${result}_result`) })),
      additionalProperties: spec.additionalResults ?? [] },
    concepts: conceptsForComponent.map(id => ({ id, ...concepts[id] })),
    relatedComponents: spec.kind === 'configuration' ? Object.keys(componentReference).filter(name => api.definitions[name]) : [],
    relatedProperties: (spec.relatedProperties ?? []).map(name => ({ name, ...commonProperties[name], nested: records(commonProperties[name]?.nested) })),
    example: { constraints: component.groups.flatMap(group => group.choices).filter(choice => choice.requires || choice.excludes).map(choice => ({ id: choice.id, requires: choice.requires, excludes: choice.excludes })),
      note: 'Example constraints choose a teaching scenario. They do not define the complete API contract. Highlights identify related properties; render().configuration separately names the actual factory and properties used in the example’s main construction.' },
  };
}
