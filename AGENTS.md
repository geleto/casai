# Agent Notes

## Cascada References

Use the installed `cascada-engine` docs:

- Prefer `node_modules/cascada-engine/docs/cascada/cascada-agent.md` when present; it is the AI agent-friendly compressed script/template reference and saves tokens.
- If the compressed document is missing, or if syntax or semantics are unclear or contradictory, check the source docs: `node_modules/cascada-engine/docs/cascada/script.md` and `node_modules/cascada-engine/docs/cascada/template.md`.

## Tests

Do not run the whole suite by default. LLM-backed tests cost time and money.

Run one file with:

```bash
npm run test:file -- tests/Script.test.ts
```

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

With current ESM packages, type-only exports must use `import type`, for example `ToolCallOptions`, `ModelMessage`, `StreamTextResult`, `LoaderInterface`, and `ILoaderAny`.
