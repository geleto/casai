/**
 * Full component documentation as serializable data. No UI or model execution.
 * describe() and render() accept the same canonical example selection.
 * Example controls are teaching choices; reference applicability comes from the
 * public API inventory and local documentation, never from generated code.
 */
import { getComponent, validateOptions, matchesOptions, getControls, infoSections, versions, referenceSelection } from './matrix.js';
import { factory, sourceMode } from './shared.js';
import api from './reference/api.js';
import sdkDocs from './reference/sdk-docs.js';
import { componentReference, sourceModes, configSections, sdkGroups } from './reference/components.js';
import { commonProperties, componentProperties, sdkPropertyGroups } from './reference/properties.js';
import { concepts } from './reference/concepts.js';
import { shapeProperties, detailProperties, componentDetails } from './reference/details.js';

export { infoSections, configSections, sdkGroups, concepts };
export { getSourceControl, selectSource, setLoads } from './matrix.js';
export const referenceVersions = versions;
function compactType(type, alternative) {
  if (type.length <= 150) return type;
  if (alternative && alternative.length <= 150) return alternative;
  const alias = type.match(/^([\w.$]+)</)?.[1];
  const optional = type.endsWith(' | undefined') ? ' | undefined' : '';
  if (alias) return `${alias}<…>${optional}`;
  if (type.includes('=>')) return `(...arguments) => …${optional}`;
  if (type.startsWith('{')) return `{ … }${optional}`;
  return `${type.slice(0, 140)}…`;
}
const records = name => {
  if (name == null) return [];
  if (!api.shapes[name]) throw new Error(`Unknown reference shape: ${name}`);
  return api.shapes[name].map(id => {
    const property = api.properties[id];
    const local = { ...detailProperties[name.split(':')[0]]?.[property.name], ...shapeProperties[name]?.[property.name] };
    const detail = local.detail ?? commonProperties[property.name]?.detail;
    const prose = api.documentation[name]?.[property.name];
    return { ...property, displayType: compactType(property.type),
      ...(!property.description && prose ? prose : {}),
      ...(!property.description && !prose && local.description ? { description: local.description, descriptionOrigin: 'casai' } : {}),
      ...(detail ? { details: typeDetail(detail, local.appliesTo) } : {}),
    };
  });
};
function typeDetail(name, appliesTo = 'Value') {
  const detail = api.details[name];
  if (!detail) throw new Error(`Unknown reference detail: ${name}`);
  return { name, appliesTo, type: detail.type, variants: detail.variants.map(variant => ({ type: variant.type, properties: records(variant.shape) })) };
}
const byName = list => Object.fromEntries(list.map(property => [property.name, property]));
const sharedCallFields = ['context', 'toolsContext', 'abortSignal'];
const commonInheritance = 'Constructor child values replace inherited values; omitted settings inherit. Supported invocation overrides apply only to that invocation.';

function selectedSpec(component, selected) {
  const base = componentReference[component.name];
  return { factory: component.name, types: component.name, status: 'implemented', ...base,
    ...(base.variants ?? []).find(variant => matchesOptions(component, variant, selected)) };
}

function describeProperty(property, spec, { definition, mode, selected, runKeys, operationRequired, choices }) {
  const name = property.name;
  const common = commonProperties[name] ?? {};
  const own = componentProperties[spec.types]?.[name] ?? {};
  const local = { ...common, ...own, ...componentDetails[spec.types]?.[name], ...spec.overrides?.[name] };
  const nativeShape = api.shapes[`${spec.types}_native`] ? `${spec.types}_native` : null;
  const native = [property, byName(records(nativeShape))[name], byName(records(spec.nativeDocs))[name], byName(records(local.nativeDocs))[name]]
    .find(record => record?.source?.package && record.description);
  const isMain = name === definition?.main;
  const input = { ...Object.fromEntries(records(definition ? `${spec.types}_inputs` : null).map(property => [property.name, property.type])), ...spec.inputTypes };
  const sourceKind = sourceModes[mode];
  const sourceTypes = {
    direct: input.direct,
    template: input.template,
    resource: 'string (resource name)', script: 'string (Cascada source)',
    function: `(context: PreparedContext) => ${input.prepared ?? 'unknown'} | PromiseLike<${input.prepared ?? 'unknown'}>`,
  };
  const requiredAtCreation = !spec.fragment && (definition?.required.includes(name)
    || (mode?.endsWith('-name') ? name === 'loader' : definition?.inlineRequired?.includes(name))
    || (selected.includes('asTool') && (name === 'inputSchema' || definition?.toolRequired?.includes(name) || (isMain && mode !== 'text'))));
  const constructor = !['abortSignal', 'messageHistory'].includes(name);
  const positional = definition && ((isMain && !spec.fixedImplementation) || spec.positional?.includes(name)
    || name === 'context' && (spec.coded || spec.contextPositional || mode !== 'text' || selected.includes('asTool')));
  const locations = local.locations ?? spec.locations ?? [...(constructor ? ['construction'] : []), ...(runKeys.includes(name) ? ['run'] : []), ...(positional ? ['ordinary'] : [])];
  const owner = native?.source?.package ?? property.source?.package;
  const origin = local.origin ?? (owner?.startsWith('cascada') ? 'cascada' : owner ? 'ai-sdk' : 'casai');
  const descriptor = records('Tool').some(record => record.name === name) && !records(definition ? `${spec.types}_settings` : null).some(record => record.name === name);
  const section = isMain || name === 'model' || requiredAtCreation && !local.section ? 'essential' : local.section ?? (descriptor ? 'variants' : 'sdk');
  const sdkGroup = local.sdkGroup ?? Object.entries(sdkPropertyGroups).find(([, names]) => names.includes(name))?.[0] ?? 'operation';
  const type = local.type ?? (isMain && sourceKind ? sourceTypes[sourceKind.value] : property.type);
  return {
    id: name, name, type, displayType: compactType(type, isMain || local.type ? undefined : native?.type),
    description: local.description ?? native?.description ?? property.description ?? '',
    descriptionOrigin: local.description ? 'casai' : native?.source?.package ?? 'casai',
    default: local.default ?? property.tags?.find(tag => tag.name === 'default')?.text ?? native?.tags?.find(tag => tag.name === 'default')?.text ?? (origin === 'casai' ? 'Not configured.' : 'Omitted; the selected operation owns any default.'),
    required: { construction: Boolean(requiredAtCreation), operation: operationRequired.includes(name) || Boolean(definition?.inlineRequired?.includes(name)) || Boolean(isMain && spec.preparedSourceRequired && mode !== 'text'), description: local.required ?? (requiredAtCreation ? 'Required when constructing the finished component, possibly inherited.' : isMain ? 'Must resolve from configuration or invocation unless an alternative native input satisfies the operation.' : 'Optional.') },
    locations, override: local.override ?? spec.override ?? (runKeys.includes(name) ? 'Supported through .run(); see the property-specific merge/clearing rule.' : 'Fixed at construction; derive a component to replace it.'),
    inheritance: local.inheritance ?? commonInheritance,
    scope: local.scope ?? 'component', origin, adaptation: local.adaptation ?? null,
    applicability: { component: spec.factory, sourceMode: isMain ? mode : null, operations: local.operations ?? null },
    section, sdkGroup, notes: local.notes ?? null,
    sourceMode: isMain ? mode : null,
    relatedOptions: choices.filter(choice => choice.properties.includes(name)).map(choice => choice.id),
    upstream: native?.source?.package ? { ...native.source, description: native.description, type: native.type, tags: native.tags } : null,
    source: property.source ?? null,
    nested: local.nested ? records(local.nested) : [],
    details: local.detail ? typeDetail(local.detail, local.appliesTo) : null,
    status: spec.status,
    deprecated: property.tags?.find(tag => tag.name === 'deprecated')?.text ?? native?.tags?.find(tag => tag.name === 'deprecated')?.text ?? null,
    aliasFor: local.aliasFor ?? null,
  };
}

function methodReference(method, properties) {
  const { settings, omit = [], ...details } = method;
  const names = [...new Set([...(method.properties ?? []), ...(settings === 'run' ? Object.values(properties).filter(property => property.locations.includes('run')).map(property => property.name) : [])])].filter(name => !omit.includes(name));
  return { ...details,
    arguments: method.shape ? records(method.shape).map(property => ({ ...property, ...method.argumentOverrides?.[property.name],
      ...(method.argumentOverrides?.[property.name]?.description ? { descriptionOrigin: 'casai' } : {}),
    })) : [],
    propertyIds: names.filter(name => properties[name]),
    properties: names.filter(name => !properties[name]).map(name => ({ name, ...(commonProperties[name] ?? {}) })),
    result: method.resultShape ? records(method.resultShape) : [],
  };
}

function invocationMethods(component, spec, definition, properties, options, tool) {
  const callable = Boolean(definition);
  return [
    ...(callable ? [
      { name: 'call', signature: spec.call, description: 'Positional shorthand. Omit resolved slots only when the next argument identifies its role unambiguously. Use .run() for same-type collisions or longer setting lists.' },
      { name: 'run', signature: 'component.run({ context?, ...supportedInputsAndOverrides })', description: 'Named invocation. Missing required application input and unresolved operation input remain required. Configuration-only settings cannot be replaced here.', propertyIds: Object.values(properties).filter(property => property.locations.includes('run')).map(property => property.id) },
      { name: 'config', signature: 'component.config', description: 'The resolved configuration. Treat it as immutable; construct a new component to replace captured dependencies.' },
    ] : []),
    ...(spec.methods ?? []).filter(method => matchesOptions(component, method, options)).map(method => methodReference(method, properties)),
    ...(tool ? [
      { name: 'bindToolContext', signature: 'component.bindToolContext(trustedContext)', description: 'Returns { tool, context } with validated trusted bindings and declared public defaults. Use the bound descriptor and matching context for SDK execution.' },
      { name: 'execute', signature: 'tool.execute(parsedInput, nativeToolOptions)', description: 'Native SDK descriptor entry: input is already parsed by the owning SDK path. Ordinary component calls validate raw input; do not use descriptor execution to bypass that boundary.' },
    ] : []),
  ];
}

function sourceForms(definition, tool) {
  return definition && definition.defaultMode !== null ? [
    { modifier: null, mode: definition.defaultMode, ...sourceModes[definition.defaultMode] },
    ...Object.entries(definition.modifiers).map(([modifier, mode]) => ({ modifier, mode, ...sourceModes[mode] })),
  ].map(form => ({ ...form, toolSupported: definition.toolModes.includes(form.mode), applicable: !tool || definition.toolModes.includes(form.mode) })) : [];
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
  const settings = records(definition ? `${spec.types}_settings` : null).map(property => property.name);
  const operationRequired = records(definition ? `${spec.types}_settings` : null).filter(property => !property.optional).map(property => property.name);
  const runKeys = !definition ? [] : spec.runShape ? [...records(spec.runShape).map(property => property.name), ...sharedCallFields]
    : spec.coded ? [...(spec.fixedImplementation ? [] : [definition.main]), ...sharedCallFields]
    : [...settings.filter(name => !definition?.fixedSettings?.includes(name)), ...sharedCallFields];
  if (definition) config.abortSignal = { name: 'abortSignal', type: 'AbortSignal', tags: [] };
  if (spec.runShape) config.messageHistory = { name: 'messageHistory', type: 'readonly ModelMessage[]', tags: [] };
  const properties = Object.values(config).filter(property => !spec.omit?.includes(property.name))
    .map(property => describeProperty(property, spec, { definition, mode, selected: options, runKeys, operationRequired, choices: component.groups.flatMap(group => group.choices) }));
  const map = byName(properties);
  const methods = invocationMethods(component, spec, definition, map, options, tool);
  const variantGroups = infoSections.find(section => section.id === 'variants').groups;
  const variantOptions = component.groups.filter(group => variantGroups.includes(group.id)).flatMap(group => group.choices).map(choice => choice.id).filter(id => options.includes(id));
  const controls = getControls(name, options);
  const notices = [component.experimental, component.planned && matchesOptions(component, component.planned, options) ? component.planned.description : null,
    ...component.groups.flatMap(group => group.choices).filter(choice => options.includes(choice.id)).map(choice => choice.experimental)].filter(Boolean);
  const forms = sourceForms(definition, tool);
  const resultShapes = spec.resultShapes ?? (spec.result ? [spec.result] : []);
  const conceptsForComponent = [...new Set(['configuration', ...(spec.concepts ?? [])])];
  const summary = sdkDocs[spec.summaryOperation];
  const related = byName((spec.relatedPropertyShapes ?? []).flatMap(records));
  return {
    component: name, activeOptions: options, canonical: referenceSelection(name, options), status: spec.status, versions: referenceVersions,
    form: { factory: definition ? factory(spec.factory, options.filter(id => id !== 'asStream' || spec.streamModifier)) : null,
      primaryProperty: definition?.main ?? null, operation: spec.operation ?? null, sourceMode: mode ?? null, sourceModifier: modifier ?? null, notices },
    info: { description: summary?.description ?? component.description,
      descriptionSource: summary ? { operation: spec.summaryOperation, ...summary, reuse: 'verbatim' } : component.descriptionSource ?? null,
      kind: spec.kind ?? 'component', input: spec.input, result: spec.resultSummary, controls },
    config: {
      properties: map,
      sections: configSections.map(section => ({ ...section, propertyIds: properties.filter(property => property.section === section.id).map(property => property.id),
        ...(section.id === 'variants' ? { references: properties.filter(property => property.section !== 'variants' && variantOptions.length && (property.required.construction || property.required.operation || property.relatedOptions.some(id => variantOptions.includes(id)))).map(property => property.id),
          notes: [tool ? spec.toolResult : null, options.includes('asStream') ? spec.resultDescription ?? spec.resultSummary : null].filter(Boolean) } : {}),
        ...(section.id === 'sdk' ? { groups: sdkGroups.map(group => ({ ...group, propertyIds: properties.filter(property => property.section === 'sdk' && property.sdkGroup === group.id).map(property => property.id) })) } : {}),
        ...(section.id === 'invocation' ? { methods } : {}),
      })),
      index: properties.map(property => ({ name: property.name, propertyId: property.id, section: property.section, deprecated: property.deprecated, aliasFor: property.aliasFor })).sort((a, b) => a.name.localeCompare(b.name)),
      highlightedPropertyIds: properties.filter(property => property.relatedOptions.some(option => options.includes(option))).map(property => property.id),
      requiredPropertyIds: properties.filter(property => property.required.construction || property.required.operation).map(property => property.id),
      supportedSources: forms,
      alternatives: spec.fragment ? Object.keys(api.definitions).map(factory => {
        const [component, reference] = Object.entries(componentReference).find(([name, reference]) => (reference.factory ?? name) === factory || reference.variants?.some(variant => variant.factory === factory));
        return { component, factory, shape: `${factory}_config`, activeOptions: reference.variants?.find(variant => variant.factory === factory)?.activeOptions ?? [] };
      }) : [],
    },
    result: { description: spec.resultDescription ?? spec.resultSummary, tool: tool ? spec.toolResult ?? null : null,
      shapes: resultShapes.map(result => ({ name: result, properties: records(`${result}_result`) })),
      additionalProperties: spec.additionalResults ?? [] },
    concepts: conceptsForComponent.map(id => ({ id, ...concepts[id] })),
    relatedComponents: spec.kind === 'configuration' ? Object.keys(api.definitions) : [],
    relatedProperties: (spec.relatedProperties ?? []).map(name => describeProperty(related[name] ?? { name, type: commonProperties[name]?.type ?? 'unknown', tags: [] }, spec, { definition: undefined, mode: undefined, selected: [], runKeys: [], operationRequired: [], choices: [] })),
    example: { constraints: component.groups.flatMap(group => group.choices).filter(choice => choice.requires || choice.excludes).map(choice => ({ id: choice.id, requires: choice.requires, excludes: choice.excludes })),
      note: 'Example constraints choose a teaching scenario. They do not define the complete API contract. Highlights identify related properties; render().configuration separately names the actual factory and properties used in the example’s main construction.' },
  };
}
