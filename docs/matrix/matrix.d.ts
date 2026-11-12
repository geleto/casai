/** Public data contract for the separate matrix/documentation project. */
export type ComponentName = 'Config' | 'Context' | 'Template' | 'Script' | 'Function' | 'LLMAgent' | 'Decision' | 'Embedder' | 'Reranker' | 'ImageGenerator' | 'Transcriber' | 'SpeechGenerator' | 'Translator' | 'VoiceSessionSetup';
export type ChoiceId = 'asTool' | 'asStream' | 'useTools' | 'run' | 'prepareSession' | 'webRTC' | 'structured' | 'batch' | 'topN' | 'referenceImage' | 'mask' | 'count' | 'voice' | 'textStream' | 'messages' | 'resume' | 'withText' | 'withTemplate' | 'withScript' | 'withFunction' | 'loadText' | 'loadTemplate' | 'loadScript';
export type GroupId = 'tool' | 'stream' | 'source' | 'tools' | 'invocation' | 'conversation' | 'output' | 'batch' | 'limit' | 'media' | 'mask' | 'count' | 'voice' | 'inputDelivery';
export type SourceKind = 'default' | 'text' | 'template' | 'script' | 'function';
export type ComponentKind = 'component' | 'configuration' | 'concept';
export type InfoSectionId = 'summary' | 'variants' | 'source' | 'features' | 'invocation';
export type Requirements = Partial<Record<GroupId, (ChoiceId | null)[]>>;
export interface Rules { requires?: Requirements | Requirements[]; excludes?: ChoiceId[] }
export interface Choice extends Rules { id: ChoiceId; name: string; description: string; properties: string[]; affectsReference: boolean; experimental?: string; defaultControl?: { name: string; description: string } }
export interface Group { id: GroupId; name: string; description?: string; optional: boolean; choices: Choice[] }
export interface SourceLocation { path: string; line?: number; package?: string; version?: string; url?: string; documentation?: string }
export interface DescriptionSource { operation: string; description: string; source: SourceLocation; reuse: 'verbatim' | 'adapted' }
export interface Component {
  name: ComponentName; kind: ComponentKind; file: string; shortDescription: string; shortDescriptionSource?: DescriptionSource;
  /** Full component explanation in Markdown; shortDescription retains the original summary. */
  description: string; descriptionSources: SourceLocation[];
  activeOptions: ChoiceId[]; resources: string[]; inlineResource?: string; groups: Group[]; experimental?: string; sourceDefault: SourceKind | null;
  planned?: Rules & { description: string };
}
export interface ExampleFile { name: string; language: string; code: string }
export interface Example {
  id: string; component: ComponentName; activeOptions: ChoiceId[]; status: 'implemented' | 'planned'; notice?: string;
  configuration: { component: string; factory: string; variable: string; properties: string[] };
  files: ExampleFile[]; explanations: string[];
}
export const components: Component[];
export interface Transition { activeOptions: ChoiceId[]; cleared: ChoiceId[]; added: ChoiceId[] }
export interface ControlChoice extends Choice { active: boolean; available: boolean; unavailableReasons: string[]; transition: Transition | null }
export interface ControlGroup extends Omit<Group, 'choices'> { choices: ControlChoice[] }
export interface SourceControl {
  id: 'source'; name: string; kind: SourceKind | null; affectsReference: true;
  choices: { id: SourceKind; name: string; description: string; transition: Transition | null }[];
  loads: { id: 'loads'; name: string; active: boolean; available: boolean; description: string; transition: Transition | null };
  modifier: string | null; description: string;
}
export type ControlSection = { id: 'source'; name: string; control: SourceControl | null } | { id: 'variants' | 'features' | 'invocation'; name: string; groups: ControlGroup[] };
export interface ReferenceSelection { component: ComponentName; id: string; activeOptions: ChoiceId[] }
export const infoSections: { id: InfoSectionId; name: string; groups?: GroupId[] }[];
export const versions: Record<string, string>;
export const repository: string;
export function sourceUrl(source: SourceLocation | null, revision?: string): string | null;
export function getComponent(name: ComponentName): Component;
export function matchesOptions(component: Component, rules: Rules, selected: ChoiceId[]): boolean;
/** Low-level canonical groups. Use getControls() for the UI. */
export function visibleGroups(name: ComponentName, selected?: ChoiceId[]): Group[];
export function validateOptions(name: ComponentName, selected?: ChoiceId[]): ChoiceId[];
export function selectOption(name: ComponentName, selected: ChoiceId[], id: ChoiceId, active?: boolean): ChoiceId[];
export function normalizeOptions(name: ComponentName, input?: readonly string[]): { activeOptions: ChoiceId[]; dropped: string[] };
export function getSourceControl(name: ComponentName, selected?: ChoiceId[]): SourceControl | null;
export function selectSource(name: ComponentName, selected: ChoiceId[], kind: SourceKind | null): ChoiceId[];
export function setLoads(name: ComponentName, selected: ChoiceId[], active: boolean): ChoiceId[];
export function getControls(name: ComponentName, selected?: ChoiceId[], options?: { unavailable?: 'hide' | 'include' }): ControlSection[];
export function referenceSelection(name: ComponentName, selected?: ChoiceId[]): ReferenceSelection;
/** All reachable canonical API forms, optionally restricted to one family. No example-only choices. */
export function referenceSelections(name?: ComponentName): ReferenceSelection[];
export function render(name: ComponentName, selected?: ChoiceId[], options?: { readText?: (url: URL) => string | Promise<string> }): Promise<Example>;
