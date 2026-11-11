/** Public data contract for the separate matrix/documentation project. */
export type Requirements = Record<string, (string | null)[]>;
export interface Rules { requires?: Requirements | Requirements[]; excludes?: string[] }
export interface Choice extends Rules { id: string; name: string; description: string; properties: string[]; experimental?: string }
export interface Group { id: string; name: string; description?: string; optional: boolean; choices: Choice[] }
export interface SourceLocation { path: string; line?: number; package?: string; version?: string; url?: string; documentation?: string }
export interface DescriptionSource { operation: string; description: string; source: SourceLocation; reuse: 'verbatim' | 'adapted' }
export interface Component {
  name: string; file: string; description: string; descriptionSource?: DescriptionSource;
  activeOptions: string[]; resources: string[]; inlineResource?: string; groups: Group[]; experimental?: string;
  planned?: Rules & { description: string };
}
export interface ExampleFile { name: string; language: string; code: string }
export interface Example {
  id: string; component: string; activeOptions: string[]; status: 'implemented' | 'planned'; notice?: string;
  configuration: { component: string; factory: string; variable: string; properties: string[] };
  files: ExampleFile[]; explanations: string[];
}
export const components: Component[];
export function getComponent(name: string): Component;
export function matchesOptions(component: Component, rules: Rules, selected: string[]): boolean;
export function visibleGroups(name: string, selected?: string[]): Group[];
export function validateOptions(name: string, selected?: string[]): string[];
export function selectOption(name: string, selected: string[], id: string, active?: boolean): string[];
export function render(name: string, selected?: string[], options?: { readText?: (url: URL) => string | Promise<string> }): Promise<Example>;
