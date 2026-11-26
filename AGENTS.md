# Working on Casai

## Where decisions live

Use the [roadmap](docs/plan.md) to find the owning plan. Keep repository-wide working rules here, feature decisions and acceptance criteria in the plan, and reproductions, test results and open release gates in the implementation or review record. When a public contract changes, update the plan and the affected user documentation together.

Keep the [README](README.md) brief. Put per-form signatures and examples in the [component matrix](docs/matrix/README.md) and cross-component workflows in the [user guide](docs/matrix/documentation.md). Mark planned forms until acceptance and distinguish syntax-checked examples from executed ones. Follow the [matrix maintenance guide](docs/matrix/MAINTENANCE.md).

## Design principles

- Delegate model execution to the AI SDK and script and template execution to Cascada. Inspect the installed runtime's types, implementation and relevant tests before adding integration code. A wrapper or abstraction should earn its implementation, typing and maintenance cost through a concrete caller benefit.
- Design components for direct calls and Cascada composition in Node and browsers, independent of UI frameworks. Reserve positional arguments for common, unambiguous inputs. Put longer option lists in configuration or named calls.
- Keep reusable components and settings stateless. Each invocation owns its execution, cancellation and cleanup. Result views share that execution. Make stream ownership and the point at which output becomes final explicit.
- Keep data, executable source, trusted bindings and execution controls distinguishable. Resolve application inputs before parsing, use the parsed values downstream and preserve shared inputs and defaults. Protect boundaries exposed to users and models. Check ordinary caller behavior before adding defensive handling or removing it.
- When code and plan disagree, assess which contract better serves callers. Fix clear issues. Bring meaningful tradeoffs in behavior, precedence or public types to the user with a caller example for each option.

Cascada runtime and packaging fixes belong upstream. Obtain the user's approval before editing the separate Cascada repository. For language questions, start with `node_modules/cascada-engine/dist/docs/cascada-agent.md`. Consult `script.md` or `template.md` in that directory when needed.

## Tests

For a routine fix, exercise the affected public path and a nearby case that should still work. Run directly affected lint or type checks. Use mock providers by default and keep paid tests opt-in. Run memory-heavy compiler, lint and matrix jobs sequentially. [Test commands and workflow](tests/README.md#where-the-time-goes)

Batch broader suites across fixes at integration, release, or on request. Run one earlier when a specific risk needs it. Reuse passing evidence while its inputs still apply. At handoff, name each relevant deferred check and when it is due. Carry pending checks across tasks in the existing implementation or review record.

For a full audit, sweep the relevant public surface on every pass. Use what earlier passes missed to choose the next probes. Finish after a subsequent complete pass finds no new important issue and report unresolved decisions. Follow the [review process](docs/review-process.md).
