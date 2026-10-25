/* eslint-disable @typescript-eslint/no-floating-promises -- Compiler-only public consumers. */
import { create } from 'casai';
import { z } from 'zod/v4';
import * as mini from 'zod/mini';
import { expectEqual, expectType } from './assert.js';

const inputSchema = z.preprocess(value => value, z.object({ name: z.string().transform(value => value.length) }));
const db = { trusted: true };
const component = create.Function.asTool({ inputSchema, context: { name: 'Ada', db }, execute: input => {
	expectEqual<typeof input.name, number>();
	expectEqual<typeof input.db, typeof db>();
	return input.name;
} });
component();
component({ name: 'Grace' });
component.run({ context: { name: 'Grace' } });
component.bindToolContext({ name: 'Grace', db });
// Native preprocess input is unknown: runtime validation owns value restrictions and completeness.
component({ name: 42 });
// @ts-expect-error Preprocessing cannot authorize a private dependency override.
component({ db: {} });
// @ts-expect-error The same boundary applies to run.
component.run({ context: { db: {} } });
const privateOnly = create.Function({ inputSchema, context: { db }, execute: input => input.name });
privateOnly({ name: 'Ada' });

const owner = create.Function({ tools: { component }, toolsContext: { component: { name: 'Grace', db } }, execute: input => {
	input.component({ name: 'public' });
	// @ts-expect-error Injected helpers retain private-name protection.
	input.component({ db: {} });
	return input.component();
} });
owner();

const renamed = z.preprocess(value => value, z.object({ name: z.string() }).transform(({ name }) => ({ label: name })));
create.Function({ inputSchema: renamed, context: { name: 'Ada', db }, execute: input => {
	expectEqual<typeof input.label, string>();
	// @ts-expect-error The raw public default is removed by the transform.
	expectType<unknown>(input.name);
	return input.label;
} });
const postprocess = z.object({ raw: z.string() }).transform(({ raw }) => ({ name: raw.length }));
create.Function({ inputSchema: postprocess, context: { raw: 'Ada', db }, execute: input => {
	expectEqual<typeof input.name, number>();
	// @ts-expect-error Ordinary transforms keep the input side's declarations too.
	expectType<unknown>(input.raw);
	return input.name;
} });
const miniature = mini.pipe(mini.transform(value => value), mini.object({ name: mini.string() }));
create.Function({ inputSchema: miniature, context: { name: 'Ada', db }, execute: input => {
	expectEqual<typeof input.name, string>(); return input.name;
} })({ name: 'Grace' });
const alternatives = z.preprocess(value => value, z.union([z.object({ name: z.string() }), z.object({ age: z.number() })]));
create.Function({ inputSchema: alternatives, context: { db }, execute: input => input })({ age: 2 });
