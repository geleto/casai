import type { ChoiceId, Component, ComponentKind, ComponentName, ControlSection, Example } from './matrix.js';

export type MatrixProfile = 'full' | 'simple';
export interface MatrixPolicy { kinds: ComponentKind[]; choices: ChoiceId[] | null }
export const matrixProfiles: Record<MatrixProfile, MatrixPolicy>;
export interface Matrix {
  profile: MatrixProfile;
  components: Component[];
  normalizeOptions(name: ComponentName, input?: readonly string[]): { activeOptions: ChoiceId[]; dropped: string[] };
  getControls(name: ComponentName, selected?: ChoiceId[], options?: { unavailable?: 'hide' | 'include' }): ControlSection[];
  render(name: ComponentName, selected?: ChoiceId[], options?: { readText?: (url: URL) => string | Promise<string> }): Promise<Example>;
}
/** Full preserves all canonical controls; simple filters advanced options and their transitions. */
export function createMatrix(profile?: MatrixProfile): Matrix;
