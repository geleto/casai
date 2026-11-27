# Working on Casai

## Where decisions live

Keep project-wide rules here. Find each feature's plan through the [roadmap](docs/plan.md). Put decisions and acceptance criteria in that plan, and reproductions, test results and release gates in its review or implementation record.

When a public contract changes, update its plan and user documentation together. Keep the [README](README.md) brief. Put per-form signatures and examples in the [component matrix](docs/matrix/README.md) and cross-component workflows in the [user guide](docs/matrix/documentation.md). Mark planned forms until acceptance and distinguish syntax-checked examples from executed ones. Follow the [matrix maintenance guide](docs/matrix/MAINTENANCE.md).

## Design principles

- Delegate model execution to the AI SDK and script and template execution to Cascada. Inspect the installed runtime's types, implementation and relevant tests before adding integration code. Each wrapper or abstraction needs a concrete caller benefit that justifies its implementation, typing and maintenance costs.
- Support direct calls and Cascada composition in Node and browsers, independent of UI frameworks. Reserve positional arguments for common, unambiguous inputs. Put longer option lists in configuration or named calls.
- Keep invocation state out of reusable components and settings. Each call owns its execution, cancellation and cleanup. Result views share that execution. Specify who owns each stream and when its output is final.
- Keep application data, executable source, trusted bindings and execution controls distinct. Resolve application inputs before parsing, use the parsed values and preserve shared data and defaults. Protect user- and model-facing boundaries. Verify ordinary calls before adding or removing defensive handling.
- When code and plan disagree, consider which contract better serves callers. Fix clear issues. Bring meaningful tradeoffs in behavior, precedence or public types to the user with a caller example for each option.

Cascada runtime and packaging fixes belong upstream. Get the user's approval before editing that repository. For language questions, start with `node_modules/cascada-engine/dist/docs/cascada-agent.md`. Consult `script.md` or `template.md` in that directory when needed.

## Verification

For routine fixes, test the affected public path and a nearby case that should still work. Run applicable lint or type checks. Use mock providers by default. Paid tests are opt-in. Run memory-heavy checks sequentially. [Test workflow](tests/README.md#where-the-time-goes)

Batch broader checks at integration, release, or on request. Run one sooner for a specific risk. Reuse passing results while their inputs still apply. At handoff, name each deferred check and when it is due. Track it in the existing implementation or review record.

Follow the [review process](docs/review-process.md) for implementation reviews. In a full audit, sweep the whole relevant surface on every pass. Use what earlier passes missed to choose the next probes. Close after a fresh pass finds no new important issue, and report unresolved decisions.
