
type Func<C> = {
	execute: (ctx: C) => void;
	context?: Partial<C>;
};

function createMixed<
	ParentCtx,
	LocalCtx,
	TConfig extends Func<ParentCtx & LocalCtx>
>(
	config: { context?: LocalCtx } & TConfig,
	parent: { context: ParentCtx }
) {
	return config;
}

const parentM = { context: { a: 1 } };

type IsAny<T> = 0 extends (1 & T) ? true : false;

// Test 1: No local context
createMixed({
	execute: (ctx) => {
		console.log(ctx.a);
		const isAny: IsAny<typeof ctx> = false;
	}
}, parentM);

// Test 2: With local context
createMixed({
	context: { b: 2 },
	execute: (ctx) => {
		console.log(ctx.a);
		console.log(ctx.b);
		const isAny: IsAny<typeof ctx> = false;
	}
}, parentM);
