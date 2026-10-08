# Agent Notes

## Cascada References

Use the installed `cascada-engine` docs:

- Prefer `node_modules/cascada-engine/dist/docs/cascada-agent.md` when present; it is the AI agent-friendly compressed script/template reference and saves tokens.
- If the compressed document is missing, or if syntax or semantics are unclear or contradictory, check the source docs: `node_modules/cascada-engine/dist/docs/script.md` and `node_modules/cascada-engine/dist/docs/template.md`.

## Tests

Do not run the whole suite by default. LLM-backed tests cost time and money.

Run one file with:

```bash
npm run test:file -- tests/Script.test.ts
```

`npm run test:file` uses the `casai-source` export condition and runs tests against `src`.
`npm run test` runs the type tests, then the full suite against the package entrypoint in `dist`.

Mocha strips types, so the `@ts-expect-error` type tests are checked only by the compiler, in `test:types`.

- `npm run test:local` runs every test file that uses mock models only. Add new mock-only files to it.
- `npm run test:types` type-checks the tests against `src` with TS7 and TS6, builds, then checks them against the `dist` declarations and runs the `exactOptionalPropertyTypes` checks in `tests/type-safety`.
- `npm run check` runs `test:types`, `lint` and `test:local`: everything that needs no paid LLM calls.

Add `-- --grep "pattern"` after the filename for a single test or group.

`.mocharc.json` defines `tests/**/*.test.ts`, so plain `npx mocha tests/File.test.ts` is not a true single-file run.

`inputSchema` validates call-time context; do not put required input-only fields only in configured `context`.

## Environment

Tests load `dotenv/config`. Put local keys in project-root `.env`:

```env
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
```

Test model/provider defaults are in `tests/common.ts`.

## Current Script Notes

Prefer direct script return values. Use `data` or `text` channels only when the test needs ordered concurrent collection or streamed text assembly.

Prefer regular `var` values whenever they are sufficient; do not introduce channels for ordinary structured data.

For root array data channels, initialize before pushing:

```cascada
data out
out = []
out.push(value)
return out.snapshot()
```

## Provider Quirks

Use `...temperatureConfig` from `tests/common.ts` in LLM test configs; do not pass `temperature` directly.

For exact-output tests on small models, use simple marker strings unless punctuation is the behavior being tested.

Avoid near-famous numeric decoys, Use famous numbers in exact known answers for cited output, but not when this allows guessing a test-derived answer.

Anthropic may reject some JSON-schema keywords before generation. For validation-failure tests, prefer local Zod validation such as `.refine(...)` instead of provider-level numeric bounds.

Exact-output LLM assertions need strict prompts such as `Output exactly ... and nothing else`.

## API Imports

With current ESM packages, type-only exports must use `import type`, for example `ToolExecutionOptions`, `ModelMessage`, `StreamTextResult`, `LoaderInterface`, and `ILoaderAny`.
