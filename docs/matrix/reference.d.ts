import type { Component, ComponentName, ChoiceId, ControlSection, DescriptionSource, Example, ReferenceSelection, Rules, SourceLocation } from './matrix.js';
export { getSourceControl, selectSource, setLoads, infoSections } from './matrix.js';
export type { SourceControl } from './matrix.js';
export type ConfigSectionId = 'variants' | 'essential' | 'source' | 'common' | 'adapted' | 'sdk' | 'invocation';
export type SDKGroupId = 'operation' | 'model' | 'output' | 'tools' | 'callbacks' | 'request';

export interface NativeProperty {
  name: string; type: string; displayType: string; optional: boolean; description: string;
  tags: { name: string; text: string }[]; source?: SourceLocation;
  descriptionSource?: SourceLocation; descriptionOrigin?: string; details?: TypeDetail;
}
export interface TypeDetail {
  name: string; appliesTo: string; type: string;
  /** Separate alternatives; never combine their fields into one config shape. */
  variants: { type: string; properties: NativeProperty[] }[];
}
export interface PropertyReference {
  id: string; name: string; type: string; displayType: string; description: string; descriptionOrigin: string; default: string;
  required: { construction: boolean; operation: boolean; description: string };
  locations: ('construction' | 'run' | 'ordinary')[]; override: string; inheritance: string;
  scope: string; origin: 'casai' | 'cascada' | 'ai-sdk'; adaptation: string | null;
  applicability: { component: string; sourceMode: string | null; operations: string[] | null };
  section: ConfigSectionId; sdkGroup: SDKGroupId; notes: string | null; sourceMode: string | null; relatedOptions: ChoiceId[];
  upstream: (SourceLocation & { description: string; type: string; tags: NativeProperty['tags'] }) | null;
  source: SourceLocation | null; nested: NativeProperty[]; details: TypeDetail | null; status: 'implemented' | 'planned';
  deprecated: string | null; aliasFor: string | null;
}
export interface Concept { title: string; paragraphs: string[]; link: string }
export interface SourceForm { modifier: string | null; mode: string; name: string; value: string; description: string; toolSupported: boolean; applicable: boolean }
/** Method-only inputs may have local explanatory fields without a native type. */
export interface LocalProperty {
  name: string; description?: string; type?: string; default?: string; required?: string;
  notes?: string; inheritance?: string; origin?: string; scope?: string; section?: string;
  adaptation?: string; nested?: NativeProperty[];
}
export interface MethodReference extends Rules {
  name: string; signature: string; description: string; kind?: string;
  shape?: string; resultShape?: string; argumentOverrides?: Record<string, Partial<NativeProperty>>;
  arguments?: NativeProperty[]; propertyIds?: string[]; properties?: LocalProperty[]; result?: NativeProperty[];
  additionalProperties?: { name: string; type: string; description: string }[];
}
export interface Section { id: string; name: string }
export interface ConfigSection extends Section {
  id: ConfigSectionId;
  propertyIds: string[]; references?: string[]; notes?: string[];
  groups?: (Section & { id: SDKGroupId; propertyIds: string[] })[]; methods?: MethodReference[];
}
export interface ReferenceForm {
  factory: string | null; primaryProperty: string | null; operation: string | null;
  sourceMode: string | null; sourceModifier: string | null; notices: string[];
}
export interface ReferenceInfo {
  description: string; descriptionSource: DescriptionSource | null; kind: 'component' | 'configuration' | 'concept'; input: string; result: string;
  controls: ControlSection[];
}
export interface ReferenceConfig {
  properties: Record<string, PropertyReference>; sections: ConfigSection[];
  index: { name: string; propertyId: string; section: ConfigSectionId; deprecated: string | null; aliasFor: string | null }[];
  highlightedPropertyIds: string[]; requiredPropertyIds: string[]; supportedSources: SourceForm[];
  alternatives: { component: ComponentName; factory: string; shape: string; activeOptions: ChoiceId[] }[];
}
export interface ReferenceResult {
  description: string; tool: string | null; shapes: { name: string; properties: NativeProperty[] }[];
  additionalProperties: { name: string; type: string; description: string }[];
}
export interface ComponentReference {
  component: ComponentName; activeOptions: ChoiceId[]; canonical: ReferenceSelection; status: 'implemented' | 'planned'; versions: Record<string, string>;
  form: ReferenceForm; info: ReferenceInfo; config: ReferenceConfig; result: ReferenceResult;
  concepts: (Concept & { id: string })[];
  /** Actual factory names; config.alternatives maps each to its matrix family. */
  relatedComponents: string[]; relatedProperties: PropertyReference[];
  example: { constraints: (Rules & { id: string })[]; note: string };
}
export interface CatalogExport { schemaVersion: 1; components: Component[]; concepts: Record<string, Concept>; versions: Record<string, string> }
export interface SelectionExport { schemaVersion: 1; reference: ComponentReference; example: Example }
export type MatrixExport = CatalogExport | SelectionExport;

export const configSections: (Section & { id: ConfigSectionId })[];
export const sdkGroups: (Section & { id: SDKGroupId })[];
export const concepts: Record<string, Concept>;
export const referenceVersions: Record<string, string>;
export function describe(name: ComponentName, selected?: ChoiceId[]): ComponentReference;
