import { create } from 'casai';

declare const choice:
	| { promptType: 'async-template'; template: string }
	| { promptType: 'async-template-name'; loader: { load(name: string): string } };
const template = create.Template(choice);
// @ts-expect-error A configured source may be missing.
void template();
// @ts-expect-error Named calls likewise need the missing source.
void template.run();
// @ts-expect-error An empty named call cannot provide a missing source.
void template.run({});
void template('replacement');
void template.run({ template: 'replacement' });

declare const scriptChoice:
	| { promptType: 'async-script'; script: string }
	| { promptType: 'async-script-name'; loader: { load(name: string): string } };
const script = create.Script(scriptChoice);
// @ts-expect-error A configured source may be missing.
void script();
// @ts-expect-error Named calls likewise need the missing source.
void script.run();
void script.run({ script: 'replacement' });

// Every alternative supplies a source, so omission remains safe on both entry paths.
declare const complete:
	| { promptType: 'async-template'; template: string }
	| { promptType: 'async-template-name'; template: string; loader: { load(name: string): string } };
const completeTemplate = create.Template(complete);
void completeTemplate();
void completeTemplate.run();
void completeTemplate.run({});
// @ts-expect-error Undefined invocation source is omission, not a replacement.
void template.run({ template: undefined });
const inherited = create.Template({}, { config: choice });
// @ts-expect-error Inheritance cannot make the missing branch source definite.
void inherited.run();
void inherited.run({ template: 'replacement' });
