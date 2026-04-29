import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { z } from 'zod';
import { create, race } from './cascada';
import { AsyncStringLoader, timeout } from './common';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('README literal examples', function () {
	this.timeout(timeout);

	it('renders the Callable Component Objects template example', async () => {
		const dynamicComponent = create.Template({
			template: 'Hello {{ name }}',
			context: { name: 'World' }
		});

		const result = await dynamicComponent();
		expect(result).to.equal('Hello World');

		const result2 = await dynamicComponent('Hi {{ user }}', { user: 'Alice' });
		expect(result2).to.equal('Hi Alice');
	});

	it('runs the Script deal finder example with ordered data-channel output', async () => {
		const dealFinder = create.Script({
			schema: z.record(
				z.string(),
				z.array(z.object({ vendor: z.string(), price: z.number() }))
			),
			inputSchema: z.object({
				productIds: z.array(z.string()),
				vendors: z.array(z.string())
			}),
			context: {
				getPrice: async (productId: string, vendor: string) => ({
					vendor,
					price: productId === 'sku-a123' ? 101 : 202,
				}),
			},
			script: `
				data result
				for productId in productIds
					for vendor in vendors
						var priceInfo = getPrice(productId, vendor)
						result[productId].push(priceInfo)
					endfor
				endfor
				return result.snapshot()
			`,
		});

		const result = await dealFinder({
			productIds: ['sku-a123', 'sku-b456'],
			vendors: ['VendorX', 'VendorY']
		});
		expect(result).to.deep.equal({
			'sku-a123': [
				{ vendor: 'VendorX', price: 101 },
				{ vendor: 'VendorY', price: 101 }
			],
			'sku-b456': [
				{ vendor: 'VendorX', price: 202 },
				{ vendor: 'VendorY', price: 202 }
			]
		});
	});

	it('runs Script one-off input and Script-as-tool examples', async () => {
		const runner = create.Script({
			script: 'return "configured-id"'
		});
		const oneOffResult = await runner(`
			return "new-id"
		`);
		expect(oneOffResult).to.equal('new-id');

		const userOnboardingTool = create.Script.asTool({
			description: 'Onboards a new user by creating a profile and sending a welcome email.',
			inputSchema: z.object({ name: z.string(), email: z.string() }),
			context: {
				db: {
					createUser: ({ name, email }: { name: string; email: string }) => ({
						id: `${name}:${email}`,
					})
				},
				emailService: {
					sendWelcome: (email: string) => ({ success: email.includes('@') })
				}
			},
			script: `
				var profile = db.createUser({ name: name, email: email })
				var emailStatus = emailService.sendWelcome(email)
				return { userId: profile.id, emailSent: emailStatus.success }
			`
		});

		const toolResult = await userOnboardingTool.execute(
			{ name: 'Ada', email: 'ada@example.com' },
			{ toolCallId: 'readme-example', messages: [] }
		);
		expect(toolResult).to.deep.equal({
			userId: 'Ada:ada@example.com',
			emailSent: true
		});
	});

	it('runs the loader race example shape without calling an LLM', async () => {
		const webLoader = new AsyncStringLoader(20);
		webLoader.addString('main.njk', 'Template result: {{ source }} from web');
		const localLoader = new AsyncStringLoader(1);
		localLoader.addString('main.njk', 'Template result: {{ source }} from local');

		const parentConfig = create.Config({
			loader: race([
				webLoader
			], 'cdn')
		});

		const component = create.Template.loadsTemplate({
			loader: race([
				localLoader
			], 'cdn'),
			template: 'main.njk'
		}, parentConfig);

		const result = await component({ source: 'README' });
		expect(result).to.equal('Template result: README from local');
	});

	it('runs the Script input/output validation examples with direct context calls', async () => {
		const userProcessor = create.Script({
			inputSchema: z.object({
				userId: z.string(),
				db: z.object({
					getUser: z.function(),
				}),
			}),
			script: `
				return db.getUser(userId)
			`
		});

		const user = await userProcessor({
			userId: '123',
			db: { getUser: (id: string) => ({ id }) }
		});
		expect(user).to.deep.equal({ id: '123' });
		await expect(userProcessor({ user_id: '123' } as never)).to.be.rejected;

		const dataAggregator = create.Script({
			schema: z.object({ status: z.string(), count: z.number() }),
			script: `
				return { status: "completed", count: 100 }
			`
		});
		const result = await dataAggregator();
		expect(result).to.deep.equal({ status: 'completed', count: 100 });
	});

	it('runs the component orchestration Script and Template examples with local components', async () => {
		const characterGenerator = create.Function({
			execute: async ({ topic }: { topic: string }) => ({
				object: { name: 'Orion', topic }
			})
		});
		const storyGenerator = create.Function({
			execute: async ({ character, topic }: { character: { name: string }, topic: string }) => ({
				text: `${character.name} explores ${topic}`
			})
		});
		const critiqueGenerator = create.Function({
			execute: async ({ story }: { story: string }) => ({
				text: `Critique: ${story.length}`
			})
		});

		const mainOrchestrator = create.Script({
			context: {
				characterGenerator,
				storyGenerator,
				critiqueGenerator,
				topic: 'a lost astronaut'
			},
			script: `
				var character = characterGenerator({ topic: topic }).object
				var story = storyGenerator({ character: character, topic: topic }).text
				var critique = critiqueGenerator({ story: story }).text
				return { character: character, story: story, critique: critique }
			`
		});

		const scriptResult = await mainOrchestrator();
		expect(scriptResult).to.deep.equal({
			character: { name: 'Orion', topic: 'a lost astronaut' },
			story: 'Orion explores a lost astronaut',
			critique: 'Critique: 31'
		});

		const storyComponent = storyGenerator;
		const critiqueStreamer = create.Function({
			execute: async ({ story }: { story: string }) => ({
				textStream: (async function* () {
					yield `Critique: ${story.length}`;
				})()
			})
		});

		const mainComponent = create.Template({
			context: {
				characterGenerator,
				storyComponent,
				critiqueStreamer,
				topic: 'a lost astronaut'
			},
			template: `
				{% set character = characterGenerator({ topic: topic }).object %}
				Character: {{ character.name }}

				{% set storyContent = storyComponent({ character: character, topic: topic }).text %}
				Story: {{ storyContent }}

				Live Critique: {% for chunk in critiqueStreamer({ story: storyContent }).textStream %}{{ chunk }}{% endfor %}
			`
		});

		const templateResult = await mainComponent();
		expect(templateResult).to.include('Character: Orion');
		expect(templateResult).to.include('Story: Orion explores a lost astronaut');
		expect(templateResult).to.include('Live Critique: Critique: 31');
	});
});
