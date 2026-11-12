import { create } from 'casai';

// Public fragments provide structural mode metadata for union and inheritance fixtures.
export const sourceModes = {
	text: create.Config.withText({}),
	'async-template': create.Config.withTemplate({}),
	'async-script': create.Config.withScript({}),
	function: create.Config.withFunction({}),
	'text-name': create.Config.loadsText({}),
	'async-template-name': create.Config.loadsTemplate({}),
	'async-script-name': create.Config.loadsScript({}),
};
export type SourceMode<P extends keyof typeof sourceModes> = (typeof sourceModes)[P]['config'];
export type SourceModeOf<T> = T extends Record<keyof SourceMode<'text'>, infer P> ? P : never;
