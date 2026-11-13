// Shared introductory content for the matrix and the full documentation.
// Layout belongs to the website; keep this content independent of its UI.
// Each principle has a one-sentence `summary`, always visible, and `text` with
// further detail. The text continues the summary; do not repeat it. Keep links
// in the text: summaries may be rendered inside interactive elements.
export const introduction = {
  title: 'Orchestrate reusable components with Casai',
  lead: 'Casai combines AI agents, [templates](https://cascada.dev/cascada-template/), [scripts](https://cascada.dev/cascada-script/) and JavaScript/TypeScript code into reusable workflows. Write the workflow logic in [CascadaScript](https://cascada.dev/cascada-script/) - a simple, instantly familiar language with automatic concurrency - to call components, make decisions and combine results.',
  principles: [
    {
      title: 'Concurrency and streaming',
      summary: 'Independent operations run concurrently without extra code, and streaming lets you use results as they arrive.',
      text: 'AI workflows spend much of their time waiting for model responses, web pages, APIs and databases, sometimes for seconds or minutes. Your code logic tells Cascada which results each step needs. For example, a Cascada Script can fetch several independent pages concurrently, then combine their contents once they are ready. You write the dependencies; Cascada schedules the work.\n\nStreaming lets you process data immediately when it becomes available: display generated text or process audio in chunks before the operation finishes. [LLMAgent](component:LLMAgent?options=asStream) uses `.asStream`, [Script](component:Script) and [Function](component:Function) can return async iterables, and [speech generation](component:SpeechGenerator?options=asStream) and [transcription](component:Transcriber?options=asStream) have streaming variants. A step that needs the complete result still waits for the stream to finish.',
    },
    {
      title: 'Components - create, reuse and swap',
      summary: 'Factories create reusable components with a common calling interface; when inputs and outputs match, you can swap one for another.',
      text: 'Every component follows the factory pattern: configure it once, then reuse it with different inputs. Call it directly with `await component(input)`, or use `await component.run({...})` for named input and supported execution overrides. The input depends on the component and its source mode: it can be the source itself or structured data used to prepare it.\n\nSchemas validate inputs and results. To replace deterministic code with an LLM agent, or try another implementation, keep the input and returned value expected by the workflow stable. Template returns a string, Script and Function return their program\'s value, and LLMAgent returns an SDK result containing `.output`. A small wrapper can extract that output so either implementation returns the value the workflow expects.',
    },
    {
      title: 'The context object - structured data input',
      summary: 'Turn your own structured data into component input with a template, script or function.',
      text: 'Each component has a source property, such as [`prompt`](component:LLMAgent?property=prompt), [`input`](component:Embedder?property=input), [`query`](component:Reranker?property=query), [`text`](component:SpeechGenerator?property=text) or [`audio`](component:Transcriber?property=audio). Supply it directly, for example as plain text, or use a supported [Cascada Template](https://cascada.dev/cascada-template/) (`.withTemplate`), [Cascada Script](https://cascada.dev/cascada-script/) (`.withScript`) or JavaScript/TypeScript code (`.withFunction`) to build it from a `context` object.\n\nFor example, the template prompt `Summarize {{ document }} in {{ language }}.` turns a document and a language into the text an agent receives. The template stays configured on the component; each call supplies the data. Scripts and functions can also fetch data, call other components and build structured input.\n\nDeclare public input fields with `inputSchema`. Their configured `context` values provide defaults, which each call can override. Other configured context entries can hold private dependencies, such as service clients, helpers or components; caller input cannot replace them.',
    },
    {
      title: 'Shared configuration - inherit and specialize',
      summary: 'Components inherit models, tools and defaults from a `Config` or another component, overriding only what changes.',
      text: 'A [`Config`](component:Config) holds settings but does not run a task. Pass it, or an existing component, as the second factory argument, for example `LLMAgent({...}, sharedConfig)`. Several agents can share a model and tools while each supplies its own prompt or instructions.\n\nA child replaces individual settings, while `context` and `tools` merge by key. Creating a child leaves the parent unchanged. A Config can hold incomplete settings and select modifiers such as `.withTemplate` or `.asTool`; the finished component must support those settings and modifiers and satisfy its required configuration.',
    },
    {
      title: 'Call tools',
      summary: 'Agents, templates, scripts and functions can call AI SDK tools, including MCP tools.',
      text: 'Register tools with the `tools` config option of [LLMAgent](component:LLMAgent?property=tools), [Template](component:Template?property=tools), [Script](component:Script?property=tools), [Function](component:Function?property=tools) or [VoiceSessionSetup](component:VoiceSessionSetup?property=tools). The registry accepts AI SDK tools and Casai components created with `.asTool`. Connect [MCP tools](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools) through the [AI SDK MCP client](https://ai-sdk.dev/docs/reference/ai-sdk-core/create-mcp-client).\n\nIn agents and voice sessions, the model chooses which tools to request and supplies their arguments. Templates, scripts and functions call registered tools by name in their code. Other components can use the same tools while a template, script or function prepares their input.\n\nAn agent may need another model step to turn a tool result into its answer. Configure [`stopWhen`](component:LLMAgent?property=stopWhen) to allow those extra steps; registering tools alone does not enable a multi-step loop.',
    },
    {
      title: 'Turn a component into a tool',
      summary: 'Add `.asTool` and an `inputSchema` to turn almost any component into a tool that agents and workflows can call.',
      text: 'For example, [`LLMAgent.asTool({...})`](component:LLMAgent?options=asTool) creates an agent that other agents can call. Its `inputSchema` declares and validates the public arguments, and its `description` tells the calling model when to use the tool. Register it in another component\'s `tools` under the name callers should use. This lets a workflow delegate a task to a specialized component with its own configuration.\n\nThe component remains callable directly and through `.run()`. The tool interface returns completed application output: an LLMAgent tool returns its `.output`, while an ordinary call retains the full SDK result. A declared Script or Function stream is collected into a completed string or array for tool callers.',
    },
  ],
};
