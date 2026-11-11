# Third-party documentation and declaration material

`api.js` contains descriptions and type information extracted from installed dependency declarations, plus selected result descriptions from the matching SDK reference pages. Casai modifies their organization by extracting, deduplicating and grouping records, following exported aliases, separating nested union alternatives and reusing builder parameter descriptions. `sdk-docs.js` contains opening descriptions from the SDK's packaged MDX reference pages; Casai extracts the paragraphs, joins wrapped lines and resolves root-relative documentation links. Local explanations and adaptations are maintained separately in `matrix.js`, `properties.js`, `components.js`, `details.js` and `concepts.js`; they do not replace the attributed native description stored in each record.

## AI SDK

Copyright 2023 Vercel, Inc.

The inspected packages are `ai@7.0.162`, `@ai-sdk/provider@4.0.35` and `@ai-sdk/provider-utils@5.0.74`. Each extracted record identifies its exact package version and declaration or documentation source. The repository is [vercel/ai](https://github.com/vercel/ai); its [license notice](https://github.com/vercel/ai/blob/main/LICENSE) specifies Apache License 2.0.

The full license is included in [LICENSE-Apache-2.0.txt](LICENSE-Apache-2.0.txt). Retain this attribution and the license when redistributing the data. No separate applicable NOTICE file was present in these inspected installed packages. Review notices again when refreshing dependencies. The snapshot does not import branding, website assets or provider documentation.

## Cascada

Rendering-option declarations/descriptions come from `cascada-engine@0.6.2` under BSD-2-Clause.

Copyright (c) 2012–2015, James Long. Copyright (c) 2025, Angel Popov.

The complete notice, conditions and disclaimer are retained in [LICENSE-Cascada.txt](LICENSE-Cascada.txt). Source/version information is also attached to extracted records.
