import { expect } from 'chai';
import { Output } from 'ai';
import { create, raceLoaders, raceParent, overrideParent, z } from './cascada';
import { model, temperatureConfig, timeout, AsyncStringLoader } from './common';

// Provider-backed coverage of prepared prompts; deterministic loader mechanics
// and inheritance live in LoaderComposition.unit.test.ts and Cascada's tests.
describe('Loaded LLMAgent provider integration', function () {
	this.timeout(timeout);
	function loader(word: string, delay: number) {
		const source = new AsyncStringLoader(delay);
		source.addString('prompt', 'Return exactly the word ' + word + ' in lowercase.');
		return source;
	}
	for (const kind of ['text', 'template', 'script'] as const) {
		it('loads a ' + kind + ' prompt from nested native chains', async () => {
			const source = new AsyncStringLoader(1);
			source.addString('prompt', kind === 'script' ? 'return "Return exactly the word ready in lowercase."' : 'Return exactly the word ready in lowercase.');
			const settings = { model, ...temperatureConfig, prompt: 'prompt', loader: [[() => null], [source]] };
			const agent = kind === 'text' ? create.LLMAgent.loadsText(settings)
				: kind === 'template' ? create.LLMAgent.loadsTemplate(settings) : create.LLMAgent.loadsScript(settings);
			expect((await agent()).value.trim()).to.equal('ready');
		});
	}
	it('races a child chain with inherited resources', async () => {
		const parent = create.Config({ loader: loader('parent', 100) });
		const agent = create.LLMAgent.loadsText({ model, ...temperatureConfig, prompt: 'prompt',
			loader: raceParent([() => null, loader('child', 1)]) }, parent);
		expect((await agent()).value.trim()).to.equal('child');
	});
	it('replaces inherited resources before producing structured output', async () => {
		const parent = create.Config({ loader: loader('parent', 1) });
		const source = new AsyncStringLoader(1);
		source.addString('prompt', 'Return a JSON object whose word field is exactly child.');
		const agent = create.LLMAgent.loadsText({ model, ...temperatureConfig, prompt: 'prompt',
			loader: overrideParent(raceLoaders([[source], () => null])), output: Output.object({ schema: z.object({ word: z.string() }) }) }, parent);
		expect((await agent()).value).to.deep.equal({ word: 'child' });
	});
});
