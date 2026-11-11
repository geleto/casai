// Generated from installed public declarations. AI SDK: Apache-2.0; Cascada: BSD-2-Clause.
// Modified by Casai: extracted, deduplicated and grouped for documentation. See THIRD_PARTY.md for notices and licenses.
export default {
  "packages": {
    "ai": "7.0.162",
    "@ai-sdk/provider-utils": "5.0.74",
    "@ai-sdk/provider": "4.0.35",
    "cascada-engine": "0.6.2"
  },
  "definitions": {
    "Template": {
      "name": "Template",
      "main": "template",
      "defaultMode": "async-template",
      "modifiers": {
        "withTemplate": "async-template",
        "loadsTemplate": "async-template-name"
      },
      "toolModes": [
        "async-template",
        "async-template-name"
      ],
      "required": [],
      "inlineRequired": [
        "template"
      ],
      "keys": [
        "template"
      ]
    },
    "Script": {
      "name": "Script",
      "main": "script",
      "defaultMode": "async-script",
      "modifiers": {
        "withScript": "async-script",
        "loadsScript": "async-script-name"
      },
      "toolModes": [
        "async-script",
        "async-script-name"
      ],
      "required": [],
      "inlineRequired": [
        "script"
      ],
      "fixedSettings": [
        "schema"
      ],
      "keys": [
        "script",
        "schema"
      ]
    },
    "Function": {
      "name": "Function",
      "main": "execute",
      "defaultMode": null,
      "modifiers": {},
      "toolModes": [
        null
      ],
      "required": [
        "execute"
      ],
      "fixedSettings": [
        "execute",
        "schema"
      ],
      "keys": [
        "execute",
        "schema"
      ]
    },
    "LLMAgent": {
      "name": "LLMAgent",
      "main": "prompt",
      "defaultMode": "text",
      "modifiers": {
        "withText": "text",
        "withTemplate": "async-template",
        "loadsText": "text-name",
        "loadsTemplate": "async-template-name",
        "withScript": "async-script",
        "withFunction": "function",
        "loadsScript": "async-script-name"
      },
      "toolModes": [
        "function",
        "text",
        "async-template",
        "async-template-name",
        "async-script",
        "async-script-name",
        "text-name"
      ],
      "required": [
        "model"
      ],
      "toolRequired": [
        "prompt"
      ],
      "asStream": true
    },
    "Decision": {
      "name": "Decision",
      "defaultMode": "text",
      "main": "state",
      "structured": "parts",
      "modifiers": {
        "withText": "text",
        "withTemplate": "async-template",
        "loadsText": "text-name",
        "loadsTemplate": "async-template-name",
        "withScript": "async-script",
        "withFunction": "function",
        "loadsScript": "async-script-name"
      },
      "toolModes": [
        "function",
        "text",
        "async-template",
        "async-template-name",
        "async-script",
        "async-script-name",
        "text-name"
      ],
      "required": [
        "model",
        "questions"
      ],
      "fixedSettings": [
        "questions"
      ]
    },
    "Embedder": {
      "name": "Embedder",
      "defaultMode": "text",
      "main": "input",
      "modifiers": {
        "withText": "text",
        "withTemplate": "async-template",
        "loadsText": "text-name",
        "loadsTemplate": "async-template-name",
        "withScript": "async-script",
        "withFunction": "function",
        "loadsScript": "async-script-name"
      },
      "toolModes": [
        "function",
        "text",
        "async-template",
        "async-template-name",
        "async-script",
        "async-script-name",
        "text-name"
      ],
      "required": [
        "model"
      ]
    },
    "Reranker": {
      "name": "Reranker",
      "defaultMode": "text",
      "main": "query",
      "modifiers": {
        "withText": "text",
        "withTemplate": "async-template",
        "loadsText": "text-name",
        "loadsTemplate": "async-template-name",
        "withScript": "async-script",
        "withFunction": "function",
        "loadsScript": "async-script-name"
      },
      "toolModes": [
        "function",
        "text",
        "async-template",
        "async-template-name",
        "async-script",
        "async-script-name",
        "text-name"
      ],
      "required": [
        "model"
      ]
    },
    "ImageGenerator": {
      "name": "ImageGenerator",
      "defaultMode": "text",
      "main": "prompt",
      "structured": "image",
      "modifiers": {
        "withText": "text",
        "withTemplate": "async-template",
        "loadsText": "text-name",
        "loadsTemplate": "async-template-name",
        "withScript": "async-script",
        "withFunction": "function",
        "loadsScript": "async-script-name"
      },
      "toolModes": [
        "function",
        "text",
        "async-template",
        "async-template-name",
        "async-script",
        "async-script-name",
        "text-name"
      ],
      "required": [
        "model"
      ]
    },
    "Transcriber": {
      "name": "Transcriber",
      "defaultMode": "text",
      "main": "audio",
      "modifiers": {
        "withScript": "async-script",
        "withFunction": "function",
        "loadsScript": "async-script-name"
      },
      "toolModes": [
        "text",
        "function",
        "async-script",
        "async-script-name"
      ],
      "required": [
        "model"
      ]
    },
    "StreamingTranscriber": {
      "name": "StreamingTranscriber",
      "defaultMode": "text",
      "main": "audio",
      "modifiers": {
        "withScript": "async-script",
        "withFunction": "function",
        "loadsScript": "async-script-name"
      },
      "toolModes": [
        "function",
        "async-script",
        "async-script-name"
      ],
      "required": [
        "model"
      ],
      "toolRequired": [
        "inputAudioFormat"
      ]
    },
    "SpeechGenerator": {
      "name": "SpeechGenerator",
      "defaultMode": "text",
      "main": "text",
      "modifiers": {
        "withText": "text",
        "withTemplate": "async-template",
        "loadsText": "text-name",
        "loadsTemplate": "async-template-name",
        "withScript": "async-script",
        "withFunction": "function",
        "loadsScript": "async-script-name"
      },
      "toolModes": [
        "function",
        "text",
        "async-template",
        "async-template-name",
        "async-script",
        "async-script-name",
        "text-name"
      ],
      "required": [
        "model"
      ]
    },
    "StreamingSpeechGenerator": {
      "name": "StreamingSpeechGenerator",
      "defaultMode": "text",
      "main": "text",
      "modifiers": {
        "withText": "text",
        "withTemplate": "async-template",
        "loadsText": "text-name",
        "loadsTemplate": "async-template-name",
        "withScript": "async-script",
        "withFunction": "function",
        "loadsScript": "async-script-name"
      },
      "toolModes": [],
      "required": [
        "model"
      ]
    },
    "StreamingTranslator": {
      "name": "StreamingTranslator",
      "defaultMode": "text",
      "main": "audio",
      "modifiers": {
        "withScript": "async-script",
        "withFunction": "function",
        "loadsScript": "async-script-name"
      },
      "toolModes": [],
      "required": [
        "model"
      ]
    },
    "VoiceSessionSetup": {
      "name": "VoiceSessionSetup",
      "defaultMode": "text",
      "main": "instructions",
      "modifiers": {
        "withText": "text",
        "withTemplate": "async-template",
        "loadsText": "text-name",
        "loadsTemplate": "async-template-name",
        "withScript": "async-script",
        "withFunction": "function",
        "loadsScript": "async-script-name"
      },
      "toolModes": [],
      "required": [
        "model"
      ],
      "fixedSettings": [
        "model"
      ]
    }
  },
  "shapes": {
    "Template_config": [
      "template-902b6327f5ff",
      "inputSchema-f335a5a81f68",
      "promptType-adaae62fa855",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "tools-05ebb5c95a02",
      "toolsContext-492a80518673"
    ],
    "Template_settings": [
      "template-902b6327f5ff",
      "inputSchema-f335a5a81f68",
      "promptType-adaae62fa855",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "tools-05ebb5c95a02",
      "toolsContext-492a80518673"
    ],
    "Template_inputs": [
      "direct-c287cb6ac7c7",
      "template-7349d7682caf",
      "prepared-01eff35c8614"
    ],
    "Script_config": [
      "script-3ee7336160ef",
      "schema-288e8cf2b21a",
      "inputSchema-f335a5a81f68",
      "promptType-4e6960d1ae5c",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "tools-05ebb5c95a02",
      "toolsContext-492a80518673"
    ],
    "Script_settings": [
      "script-3ee7336160ef",
      "schema-288e8cf2b21a",
      "inputSchema-f335a5a81f68",
      "promptType-4e6960d1ae5c",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "tools-05ebb5c95a02",
      "toolsContext-492a80518673"
    ],
    "Script_inputs": [
      "direct-b5cef17f1666",
      "template-7349d7682caf",
      "prepared-360e241e4dcb"
    ],
    "Function_config": [
      "inputSchema-434f89f77423",
      "schema-1d2155b590a2",
      "execute-5deb85869c1d",
      "context-884c05d5299f",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "tools-05ebb5c95a02",
      "toolsContext-492a80518673"
    ],
    "Function_settings": [
      "inputSchema-434f89f77423",
      "schema-1d2155b590a2",
      "execute-5deb85869c1d",
      "context-884c05d5299f",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "tools-05ebb5c95a02",
      "toolsContext-492a80518673"
    ],
    "Function_inputs": [
      "direct-61182c4fc774",
      "template-7349d7682caf",
      "prepared-d70b23f5570a"
    ],
    "LLMAgent_config": [
      "inputSchema-d2ab2b864d21",
      "promptType-a87a79942498",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "tools-d8cac053f1e9",
      "toolsContext-be97e33328f3",
      "runtimeContext-5279a5b531bf",
      "providerOptions-bdb985c437b4",
      "id-7c420ba44547",
      "output-960376aadf77",
      "maxOutputTokens-28aceb6f8de2",
      "temperature-d5e463222c25",
      "topP-c18ae9faa20b",
      "topK-9dca433077cb",
      "presencePenalty-ffb8353a33d5",
      "frequencyPenalty-24e57c07ecf0",
      "stopSequences-d8033627c3bb",
      "seed-42d63366f1c9",
      "reasoning-50148c4a1de6",
      "maxRetries-0ed81bc73d61",
      "headers-74f55db49467",
      "timeout-d2d66c53fa17",
      "instructions-b0d8abcfc99d",
      "allowSystemInMessages-e1a407f3bbe9",
      "prompt-dbcb70464d4d",
      "model-f5334808405d",
      "toolChoice-ee62be34526e",
      "telemetry-8764a08784e2",
      "experimental_sandbox-2582909742ec",
      "experimental_steering-82714f7fe6df",
      "activeTools-e09d12af5e53",
      "toolOrder-c6855d505085",
      "toolCallConcurrency-940e6b2336b5",
      "experimental_toolCallers-ffe6f3c3e609",
      "experimental_toolApprovalSecret-4ff3620966c4",
      "include-2f0b096d0254",
      "streamRetries-2780ace7cb77",
      "streaming-7ebe1c1cd17f",
      "stopWhen-fb42ba28c06a",
      "toolApproval-6a9876dda4cd",
      "experimental_download-339211b44f67",
      "repairToolCall-5401ceab17c1",
      "experimental_refineToolInput-fdf12acc03d8",
      "onStart-c175b325404b",
      "onStepStart-9053e2711378",
      "onLanguageModelCallStart-d5f244e3950e",
      "onLanguageModelCallEnd-25e2e9bc83ca",
      "onToolExecutionStart-81d084f43eb0",
      "onToolExecutionEnd-e56d20dd0b14",
      "onStepEnd-8b3fdb23f1d8",
      "onStepError-97a24c8aaa0f",
      "onEnd-3644bf4f2d1c",
      "experimental_transform-89cd4ae316b3",
      "onChunk-53740e0f058c",
      "onError-74cbedca876d",
      "onAbort-1aceb31e0923",
      "prepareCall-1ce8440c2874",
      "prepareStep-b1fc7f13d5d4",
      "asTool-dfdd3e4eaf49"
    ],
    "LLMAgent_settings": [
      "runtimeContext-5279a5b531bf",
      "providerOptions-bdb985c437b4",
      "maxOutputTokens-28aceb6f8de2",
      "temperature-d5e463222c25",
      "topP-c18ae9faa20b",
      "topK-9dca433077cb",
      "presencePenalty-ffb8353a33d5",
      "frequencyPenalty-24e57c07ecf0",
      "stopSequences-d8033627c3bb",
      "seed-42d63366f1c9",
      "reasoning-50148c4a1de6",
      "maxRetries-0ed81bc73d61",
      "headers-74f55db49467",
      "timeout-d2d66c53fa17",
      "instructions-b0d8abcfc99d",
      "allowSystemInMessages-e1a407f3bbe9",
      "model-f5334808405d",
      "toolChoice-ee62be34526e",
      "stopWhen-e8250c5614a3",
      "telemetry-8764a08784e2",
      "experimental_sandbox-2582909742ec",
      "experimental_steering-82714f7fe6df",
      "activeTools-e09d12af5e53",
      "toolOrder-c6855d505085",
      "toolCallConcurrency-940e6b2336b5",
      "toolApproval-f04ab75b2254",
      "experimental_toolCallers-ffe6f3c3e609",
      "experimental_toolApprovalSecret-4ff3620966c4",
      "experimental_download-162e51e5ff3c",
      "repairToolCall-1cfd20033b0a",
      "experimental_refineToolInput-b3ee93fb0d2b",
      "onStart-66b9a75d9d1d",
      "onStepStart-5585ea699152",
      "onLanguageModelCallStart-8d83021ae3c8",
      "onLanguageModelCallEnd-94d3ab4bd2e8",
      "onToolExecutionStart-1954e5a469ba",
      "onToolExecutionEnd-ea85b06844b0",
      "onStepEnd-8a03a3480e69",
      "onStepError-64f9d90f19cc",
      "onEnd-2e786bb451d8",
      "include-2f0b096d0254",
      "experimental_transform-0ec05c4143a3",
      "onChunk-6fbcb2a9372a",
      "onError-16e40c751f49",
      "streamRetries-2780ace7cb77",
      "onAbort-9e072f29fce0",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "id-7c420ba44547",
      "streaming-7ebe1c1cd17f",
      "output-960376aadf77",
      "prompt-dbcb70464d4d",
      "promptType-a87a79942498",
      "inputSchema-d2ab2b864d21",
      "tools-d8cac053f1e9",
      "toolsContext-be97e33328f3"
    ],
    "LLMAgent_inputs": [
      "direct-92236f2a65ad",
      "template-cb881cd7cb54",
      "prepared-3c21b736ebb0"
    ],
    "Decision_config": [
      "runtimeContext-0add664a522c",
      "providerOptions-c53d3bd5265d",
      "maxOutputTokens-16305b3096c8",
      "reasoning-892add36e4d9",
      "maxRetries-23097e18368b",
      "headers-86575131d3c3",
      "model-c591403d9d0a",
      "telemetry-41ea114badea",
      "onStart-5643812436ab",
      "onEnd-a03dc449884e",
      "questions-dd5363516405",
      "state-f6557702dc32",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "toolContextSchema-d7c206b57ff4",
      "inputSchema-e1f157741580",
      "tools-f8808df35909",
      "toolsContext-a026c14e3010",
      "promptType-fcb30516c7a6"
    ],
    "Decision_settings": [
      "runtimeContext-0add664a522c",
      "providerOptions-c53d3bd5265d",
      "maxOutputTokens-16305b3096c8",
      "reasoning-892add36e4d9",
      "maxRetries-23097e18368b",
      "abortSignal-3e2de4b1ba34",
      "headers-86575131d3c3",
      "model-82af40007353",
      "telemetry-41ea114badea",
      "onStart-5643812436ab",
      "onEnd-a03dc449884e",
      "questions-dd5363516405",
      "state-db13ea08a329"
    ],
    "Decision_inputs": [
      "direct-80c1b590bd26",
      "template-b1e3d963012c",
      "prepared-37a4f0163687"
    ],
    "Embedder_config": [
      "runtimeContext-b82193f21760",
      "providerOptions-a94e237310ca",
      "maxRetries-21df607005af",
      "headers-f7116f3e57a6",
      "model-e9e0c47ec797",
      "telemetry-e0229feb9d3a",
      "experimental_telemetry-031d59a19554",
      "onStart-3eefebc5d492",
      "experimental_onStart-3beabf892011",
      "onEnd-5bb5b5ee92e8",
      "dimensions-2ccabb90d619",
      "maxParallelCalls-6694df5c0a88",
      "experimental_onEnd-a59f437a84ba",
      "input-fb5baefd9ad6",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "toolContextSchema-d7c206b57ff4",
      "inputSchema-e1f157741580",
      "tools-f8808df35909",
      "toolsContext-a026c14e3010",
      "promptType-fcb30516c7a6"
    ],
    "Embedder_settings": [
      "runtimeContext-b82193f21760",
      "providerOptions-a94e237310ca",
      "maxRetries-21df607005af",
      "abortSignal-2b7c59d4f74b",
      "headers-f7116f3e57a6",
      "model-01b0663ad509",
      "telemetry-e0229feb9d3a",
      "experimental_telemetry-031d59a19554",
      "onStart-3eefebc5d492",
      "experimental_onStart-3beabf892011",
      "onEnd-5bb5b5ee92e8",
      "dimensions-2ccabb90d619",
      "maxParallelCalls-6694df5c0a88",
      "experimental_onEnd-a59f437a84ba",
      "input-dcc8da217a5c"
    ],
    "Embedder_inputs": [
      "direct-fce20620be48",
      "template-7349d7682caf",
      "prepared-2ea72cf3d6e5"
    ],
    "Reranker_config": [
      "runtimeContext-bfeb4849a32a",
      "providerOptions-323e9176b870",
      "maxRetries-5a3efed0cfd5",
      "headers-d3e2a061a8b8",
      "model-c5e0815e9abc",
      "telemetry-7031c717fdc7",
      "experimental_telemetry-6ff335051f6b",
      "onStart-28980c38987c",
      "experimental_onStart-b12bd48010fa",
      "onEnd-336a122ae41f",
      "experimental_onEnd-7bae4c05bcee",
      "documents-153e8de9ac0a",
      "topN-2e58a6ef4988",
      "query-bf57c694fea9",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "toolContextSchema-d7c206b57ff4",
      "inputSchema-e1f157741580",
      "tools-f8808df35909",
      "toolsContext-a026c14e3010",
      "promptType-fcb30516c7a6"
    ],
    "Reranker_settings": [
      "runtimeContext-bfeb4849a32a",
      "providerOptions-323e9176b870",
      "maxRetries-5a3efed0cfd5",
      "abortSignal-1be52e81fd5e",
      "headers-d3e2a061a8b8",
      "model-38a5e14b7041",
      "telemetry-7031c717fdc7",
      "experimental_telemetry-6ff335051f6b",
      "onStart-28980c38987c",
      "experimental_onStart-b12bd48010fa",
      "onEnd-336a122ae41f",
      "experimental_onEnd-7bae4c05bcee",
      "documents-e64a9272b831",
      "query-7008b7b4625a",
      "topN-2e58a6ef4988"
    ],
    "Reranker_inputs": [
      "direct-c287cb6ac7c7",
      "template-7349d7682caf",
      "prepared-443e2e85b058"
    ],
    "ImageGenerator_config": [
      "providerOptions-d0dcb86a4b4b",
      "seed-2911d722b271",
      "maxRetries-43a557421317",
      "headers-8a1860c91ac4",
      "model-11f5ef204b2c",
      "n-f9857b6df04f",
      "maxImagesPerCall-7d962d74cbca",
      "size-5a9c136a3a29",
      "aspectRatio-29de3eadc285",
      "images-a9ef46239974",
      "mask-67715919181b",
      "prompt-e832a0f8b353",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "toolContextSchema-d7c206b57ff4",
      "inputSchema-e1f157741580",
      "tools-f8808df35909",
      "toolsContext-a026c14e3010",
      "promptType-fcb30516c7a6"
    ],
    "ImageGenerator_settings": [
      "providerOptions-d0dcb86a4b4b",
      "seed-2911d722b271",
      "maxRetries-43a557421317",
      "abortSignal-f0f3c7bf9130",
      "headers-8a1860c91ac4",
      "prompt-48ad41e1e072",
      "model-b484e382e133",
      "n-f9857b6df04f",
      "maxImagesPerCall-7d962d74cbca",
      "size-5a9c136a3a29",
      "aspectRatio-29de3eadc285",
      "images-a9ef46239974",
      "mask-67715919181b"
    ],
    "ImageGenerator_inputs": [
      "direct-2d5fd362f21e",
      "template-2885c0b86495",
      "prepared-02ae7791d4f4"
    ],
    "Transcriber_config": [
      "providerOptions-6fb067a708e2",
      "maxRetries-569af71b732f",
      "headers-23ed9be29275",
      "model-b8a9484641b3",
      "telemetry-72cc4604f7aa",
      "download-f08788366d4c",
      "audio-0c1c18aa3172",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "toolContextSchema-d7c206b57ff4",
      "inputSchema-e1f157741580",
      "tools-f8808df35909",
      "toolsContext-a026c14e3010",
      "promptType-fcb30516c7a6"
    ],
    "Transcriber_settings": [
      "providerOptions-6fb067a708e2",
      "maxRetries-569af71b732f",
      "abortSignal-1f5a193f4cfe",
      "headers-23ed9be29275",
      "model-d63e7d77f371",
      "telemetry-72cc4604f7aa",
      "audio-2c7771e7c87b",
      "download-f08788366d4c"
    ],
    "Transcriber_inputs": [
      "direct-0fa09a3c675a",
      "template-7349d7682caf",
      "prepared-98dc444fb407"
    ],
    "StreamingTranscriber_config": [
      "providerOptions-0e700395c4b1",
      "headers-1c3aaeb2734c",
      "model-93d3f90bcfb6",
      "telemetry-237457941031",
      "includeRawChunks-7d3f5f2a41a1",
      "inputAudioFormat-7e0e83a62aca",
      "audio-73f3d8f8ab2d",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "toolContextSchema-d7c206b57ff4",
      "inputSchema-e1f157741580",
      "tools-f8808df35909",
      "toolsContext-a026c14e3010",
      "promptType-fcb30516c7a6"
    ],
    "StreamingTranscriber_settings": [
      "providerOptions-0e700395c4b1",
      "abortSignal-69af4f81640d",
      "headers-1c3aaeb2734c",
      "model-e9ed376d43a6",
      "telemetry-237457941031",
      "includeRawChunks-7d3f5f2a41a1",
      "audio-3b4b6bba6442",
      "inputAudioFormat-a530ffc7dab7"
    ],
    "StreamingTranscriber_inputs": [
      "direct-cb45dbd030e6",
      "template-7349d7682caf",
      "prepared-3509297a8ac6"
    ],
    "SpeechGenerator_config": [
      "providerOptions-b4ea33bb4d7b",
      "maxRetries-3203a207b457",
      "headers-210ca6223697",
      "instructions-589fb8cbb087",
      "model-94567991422d",
      "telemetry-f8a2081d9c3e",
      "voice-524c54983482",
      "outputFormat-6291f13adf52",
      "speed-4d164fbb7f9d",
      "language-61b62537a500",
      "text-9952b743697d",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "toolContextSchema-d7c206b57ff4",
      "inputSchema-e1f157741580",
      "tools-f8808df35909",
      "toolsContext-a026c14e3010",
      "promptType-fcb30516c7a6"
    ],
    "SpeechGenerator_settings": [
      "text-ec806897822a",
      "providerOptions-b4ea33bb4d7b",
      "maxRetries-3203a207b457",
      "abortSignal-dde81d3b7308",
      "headers-210ca6223697",
      "instructions-589fb8cbb087",
      "model-8d9d31f1896c",
      "telemetry-f8a2081d9c3e",
      "voice-524c54983482",
      "outputFormat-6291f13adf52",
      "speed-4d164fbb7f9d",
      "language-61b62537a500"
    ],
    "SpeechGenerator_inputs": [
      "direct-c287cb6ac7c7",
      "template-7349d7682caf",
      "prepared-01eff35c8614"
    ],
    "StreamingSpeechGenerator_config": [
      "providerOptions-8ef11a06508b",
      "headers-a43707561005",
      "instructions-4b3f21b46179",
      "model-e7347b132223",
      "includeRawChunks-90c2b49e91af",
      "onError-50a850676fc2",
      "voice-a24507351f00",
      "outputFormat-1c52617eb72c",
      "speed-38cf774e7d2f",
      "language-17c4c3804341",
      "text-85a9dc177766",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "toolContextSchema-d7c206b57ff4",
      "inputSchema-e1f157741580",
      "tools-f8808df35909",
      "toolsContext-a026c14e3010",
      "promptType-fcb30516c7a6"
    ],
    "StreamingSpeechGenerator_settings": [
      "text-730665458c8e",
      "providerOptions-8ef11a06508b",
      "abortSignal-ba9834cb4957",
      "headers-a43707561005",
      "instructions-4b3f21b46179",
      "model-f710fabe18e0",
      "includeRawChunks-90c2b49e91af",
      "onError-50a850676fc2",
      "voice-a24507351f00",
      "outputFormat-1c52617eb72c",
      "speed-38cf774e7d2f",
      "language-17c4c3804341"
    ],
    "StreamingSpeechGenerator_inputs": [
      "direct-5306f56796f6",
      "template-7349d7682caf",
      "prepared-b47e988fe35e"
    ],
    "StreamingTranslator_config": [
      "providerOptions-629f88d39640",
      "headers-8bb00513d5db",
      "model-c8d77816a238",
      "includeRawChunks-29430afa6810",
      "inputAudioFormat-2df44b715671",
      "targetLanguage-94fcfd26675f",
      "sourceLanguage-af6309dbca4a",
      "outputAudioFormat-89e588aef43c",
      "audio-73f3d8f8ab2d",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "toolContextSchema-d7c206b57ff4",
      "inputSchema-e1f157741580",
      "tools-f8808df35909",
      "toolsContext-a026c14e3010",
      "promptType-fcb30516c7a6"
    ],
    "StreamingTranslator_settings": [
      "providerOptions-629f88d39640",
      "abortSignal-d9dfce9e4ae0",
      "headers-8bb00513d5db",
      "model-2844db232f29",
      "includeRawChunks-29430afa6810",
      "audio-bc4b82bb8b5d",
      "inputAudioFormat-a9437bf10d0a",
      "targetLanguage-f5006a68aa47",
      "sourceLanguage-af6309dbca4a",
      "outputAudioFormat-89e588aef43c"
    ],
    "StreamingTranslator_inputs": [
      "direct-cb45dbd030e6",
      "template-7349d7682caf",
      "prepared-3509297a8ac6"
    ],
    "VoiceSessionSetup_config": [
      "providerOptions-017504595b6e",
      "model-ffb52545b337",
      "inputAudioFormat-955d75ed5ca3",
      "voice-7e42c4fa10ac",
      "outputAudioFormat-bc737eb9a538",
      "outputModalities-39bbf6b1aadb",
      "inputAudioTranscription-bc4eeaf53b51",
      "outputAudioTranscription-d19f1c7d2fa9",
      "turnDetection-8e67b91d87d3",
      "expiresAfterSeconds-f25ee8b0931a",
      "instructions-cda74c669be0",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "toolContextSchema-d7c206b57ff4",
      "inputSchema-e1f157741580",
      "tools-f8808df35909",
      "toolsContext-a026c14e3010",
      "promptType-fcb30516c7a6"
    ],
    "VoiceSessionSetup_settings": [
      "providerOptions-017504595b6e",
      "instructions-4cc81f59e6ac",
      "inputAudioFormat-955d75ed5ca3",
      "voice-7e42c4fa10ac",
      "outputAudioFormat-bc737eb9a538",
      "outputModalities-39bbf6b1aadb",
      "inputAudioTranscription-bc4eeaf53b51",
      "outputAudioTranscription-d19f1c7d2fa9",
      "turnDetection-8e67b91d87d3",
      "expiresAfterSeconds-f25ee8b0931a",
      "model-ffb52545b337"
    ],
    "VoiceSessionSetup_inputs": [
      "direct-b5cef17f1666",
      "template-7349d7682caf",
      "prepared-360e241e4dcb"
    ],
    "Tool": [
      "inputSchema-47ed76ea66b3",
      "asTool-dfdd3e4eaf49",
      "toolContextSchema-d7c206b57ff4",
      "onInputAvailable-0ee077587da3",
      "onInputStart-060e54bf784e",
      "onInputDelta-ea4168ae0b75",
      "needsApproval-e2c793a8ce88",
      "title-6e688f9a6e86",
      "deferLoading-ae9383ee0fa8",
      "providerOptions-42fe4696b43b",
      "metadata-6d9129abab07",
      "toModelOutput-8f0e85e088c7",
      "strict-07a151c197b1",
      "inputExamples-ff69a7242b1e",
      "description-e0df7f9e2319"
    ],
    "AgentRun": [
      "debug-cdff8d93c93d",
      "description-094750903948",
      "runtimeContext-5279a5b531bf",
      "providerOptions-bdb985c437b4",
      "maxOutputTokens-28aceb6f8de2",
      "temperature-d5e463222c25",
      "topP-c18ae9faa20b",
      "topK-9dca433077cb",
      "presencePenalty-ffb8353a33d5",
      "frequencyPenalty-24e57c07ecf0",
      "stopSequences-d8033627c3bb",
      "seed-42d63366f1c9",
      "reasoning-50148c4a1de6",
      "maxRetries-0ed81bc73d61",
      "headers-74f55db49467",
      "timeout-1bba377e46d4",
      "instructions-b0d8abcfc99d",
      "allowSystemInMessages-e1a407f3bbe9",
      "toolChoice-180fe037bbc0",
      "telemetry-678067987faf",
      "experimental_sandbox-2582909742ec",
      "experimental_steering-82714f7fe6df",
      "activeTools-97c193783099",
      "toolOrder-e8ffff15b565",
      "toolCallConcurrency-940e6b2336b5",
      "experimental_toolCallers-ff9afda2223d",
      "experimental_toolApprovalSecret-4ff3620966c4",
      "include-2f0b096d0254",
      "streamRetries-2780ace7cb77",
      "prompt-0bb201e140ef",
      "messageHistory-fb9b9d072e86",
      "stopWhen-ff0af44bb75f",
      "toolApproval-c6b1e240ae25",
      "experimental_download-339211b44f67",
      "repairToolCall-2a971774557c",
      "experimental_refineToolInput-98f7247ec4dd",
      "onStart-64b4743c0ba2",
      "onStepStart-eb7ccd45b965",
      "onLanguageModelCallStart-d5f244e3950e",
      "onLanguageModelCallEnd-6758c6032d86",
      "onToolExecutionStart-582c7170e9f4",
      "onToolExecutionEnd-0e3a45072d00",
      "onStepEnd-41a36140d3f2",
      "onStepError-bcce88d062ae",
      "onEnd-457c295e22f5",
      "experimental_transform-7216d3f250a7",
      "onChunk-776bfe13cff3",
      "onError-74cbedca876d",
      "onAbort-e8b00af800f1",
      "prepareCall-80fbe84c6775",
      "prepareStep-8ac0218841fa",
      "tools-fdfe05249bc3",
      "model-9cc84a88e236"
    ],
    "NativeGenerate": [
      "options-37bd75580b6d",
      "prompt-1ffdc31f366f",
      "messages-df6f076db158",
      "abortSignal-52561c51f595",
      "timeout-2b6830ecfea3",
      "onStart-aef48ea7e7b4",
      "experimental_onStart-bb23f034eb71",
      "onStepStart-4eac7e85c7c3",
      "experimental_onStepStart-97ac29c27fbe",
      "onToolExecutionStart-e4f0d33f9232",
      "experimental_onToolCallStart-edf35f9005ce",
      "onToolExecutionEnd-7a5b4146deff",
      "experimental_onToolCallFinish-3717e6bbaa7d",
      "onStepEnd-c19ef6fba098",
      "onStepFinish-570883b7dcbd",
      "onEnd-f2ea97395729",
      "onFinish-70e885571273",
      "experimental_sandbox-7a420260cec2"
    ],
    "NativeStream": [
      "options-37bd75580b6d",
      "prompt-1ffdc31f366f",
      "messages-df6f076db158",
      "abortSignal-52561c51f595",
      "timeout-9e14af0b9943",
      "onStart-9ac541be5597",
      "experimental_onStart-8b450fd7696a",
      "onStepStart-47b571f98d6a",
      "experimental_onStepStart-73171b13a668",
      "onToolExecutionStart-44653cbecfb4",
      "experimental_onToolCallStart-31c7d68b5570",
      "onToolExecutionEnd-73d3571a0e34",
      "experimental_onToolCallFinish-e743e6d45d56",
      "onStepEnd-38a1e56505af",
      "onStepFinish-749f084a3582",
      "onEnd-5c5601675cd4",
      "onFinish-3a20cbb9bf1e",
      "experimental_sandbox-7a420260cec2",
      "experimental_transform-4d7fc66a5495"
    ],
    "GenerateSettings": [
      "maxOutputTokens-28aceb6f8de2",
      "temperature-d5e463222c25",
      "topP-c18ae9faa20b",
      "topK-9dca433077cb",
      "presencePenalty-ffb8353a33d5",
      "frequencyPenalty-24e57c07ecf0",
      "stopSequences-d8033627c3bb",
      "seed-42d63366f1c9",
      "reasoning-50148c4a1de6",
      "maxRetries-0ed81bc73d61",
      "abortSignal-fc62ed60653c",
      "headers-74f55db49467",
      "timeout-d2d66c53fa17",
      "instructions-b0d8abcfc99d",
      "system-172f838ea9ab",
      "allowSystemInMessages-e1a407f3bbe9",
      "prompt-da6f2a5e577b",
      "messages-4821e5bed3b2",
      "tools-c7e657498fc5",
      "toolsContext-84d563e92fb8",
      "model-bcb922cd8d09",
      "toolChoice-e966120430af",
      "stopWhen-58682c71d97a",
      "telemetry-426b4fc5106b",
      "experimental_telemetry-a9e7af1f89df",
      "providerOptions-84c631799d17",
      "experimental_sandbox-99c3bd2e8aa3",
      "experimental_steering-5a09c397514b",
      "runtimeContext-4a749ca4bd3e",
      "activeTools-40780df8380f",
      "toolOrder-3e1ebf5c6c12",
      "toolCallConcurrency-b74f772b74e0",
      "output-e60b98f327bb",
      "toolApproval-172adab271f3",
      "experimental_toolCallers-1828a8c45edd",
      "experimental_toolApprovalSecret-605bca05f581",
      "experimental_download-a484b37b0e10",
      "prepareStep-722de7983b61",
      "repairToolCall-90618d4db5d0",
      "experimental_repairToolCall-8b5571b91327",
      "experimental_refineToolInput-47f3c0fd9da8",
      "onStart-04bef8beb81a",
      "experimental_onStart-e62aaae29cc6",
      "onStepStart-f84d162aacac",
      "experimental_onStepStart-028c613cdafb",
      "onLanguageModelCallStart-5a20308df072",
      "experimental_onLanguageModelCallStart-220a502fe06c",
      "onLanguageModelCallEnd-d5815d586cf9",
      "experimental_onLanguageModelCallEnd-09ab6ee2dbab",
      "onToolExecutionStart-759b258f7ebb",
      "experimental_onToolCallStart-8d8e55310f46",
      "onToolExecutionEnd-7103c945dc4c",
      "experimental_onToolCallFinish-bab0dfda3943",
      "onStepEnd-7464be587786",
      "onStepError-ff3b402b51ab",
      "onStepFinish-08052cbd0975",
      "onEnd-88496c796bd5",
      "onFinish-bba008f25f73",
      "include-08574c6232c5",
      "experimental_include-61e712cf0599",
      "_internal-f6a277d4bac6"
    ],
    "StreamSettings": [
      "maxOutputTokens-28aceb6f8de2",
      "temperature-d5e463222c25",
      "topP-c18ae9faa20b",
      "topK-9dca433077cb",
      "presencePenalty-ffb8353a33d5",
      "frequencyPenalty-24e57c07ecf0",
      "stopSequences-d8033627c3bb",
      "seed-42d63366f1c9",
      "reasoning-50148c4a1de6",
      "maxRetries-0ed81bc73d61",
      "abortSignal-fc62ed60653c",
      "headers-74f55db49467",
      "timeout-d2d66c53fa17",
      "instructions-b0d8abcfc99d",
      "system-172f838ea9ab",
      "allowSystemInMessages-e1a407f3bbe9",
      "prompt-da6f2a5e577b",
      "messages-4821e5bed3b2",
      "tools-c7e657498fc5",
      "toolsContext-84d563e92fb8",
      "model-f5334808405d",
      "toolChoice-ee62be34526e",
      "stopWhen-061b01707f0c",
      "telemetry-c4d62b940351",
      "experimental_telemetry-b6b99a209d23",
      "providerOptions-bdb985c437b4",
      "experimental_sandbox-2582909742ec",
      "experimental_steering-82714f7fe6df",
      "runtimeContext-ded6f4342986",
      "activeTools-e09d12af5e53",
      "toolOrder-c6855d505085",
      "toolCallConcurrency-940e6b2336b5",
      "output-fe44a89cb056",
      "toolApproval-ed5d414f0f62",
      "experimental_toolCallers-ffe6f3c3e609",
      "experimental_toolApprovalSecret-4ff3620966c4",
      "prepareStep-7d67e4ce16c8",
      "repairToolCall-1cfd20033b0a",
      "experimental_repairToolCall-e8fd40680c55",
      "experimental_refineToolInput-b3ee93fb0d2b",
      "experimental_transform-0ec05c4143a3",
      "experimental_download-162e51e5ff3c",
      "includeRawChunks-4927cd9740df",
      "onChunk-6fbcb2a9372a",
      "onError-16e40c751f49",
      "streamRetries-2780ace7cb77",
      "onEnd-ef461f83e3bb",
      "onFinish-f20459a0ea53",
      "onAbort-c24d17adc5f3",
      "onStepEnd-d8e8f0f2289a",
      "onStepError-6ac92c5732e1",
      "onStepFinish-a6df59245cbd",
      "onStart-57baf4db48d0",
      "experimental_onStart-98bf0b5a2745",
      "onStepStart-9ebb7d08a587",
      "experimental_onStepStart-15e8aea9fae2",
      "onLanguageModelCallStart-8d83021ae3c8",
      "experimental_onLanguageModelCallStart-491395c8a913",
      "onLanguageModelCallEnd-94d3ab4bd2e8",
      "experimental_onLanguageModelCallEnd-a09d59f7a599",
      "onToolExecutionStart-1954e5a469ba",
      "experimental_onToolCallStart-3976f3ffdb21",
      "onToolExecutionEnd-ea85b06844b0",
      "experimental_onToolCallFinish-08b7141b6862",
      "include-2f0b096d0254",
      "experimental_include-c911c6b3941e",
      "_internal-2797c17b47fe"
    ],
    "RenderOptions": [
      "replayAsyncIterables-08bd2e383475",
      "autoescape-19ef6c31974b",
      "throwOnUndefined-c31e1e20c542",
      "trimBlocks-1cbedc8066bc",
      "lstripBlocks-d9932524bb24",
      "watch-9dc748ac9d7d",
      "noCache-4c9b4c901eb7",
      "dev-14d5494fcdff",
      "web-284a273e5641",
      "express-fa9408561b49",
      "tags-3d4ec07f1a22"
    ],
    "ExecutionOptions": [
      "abortSignal-2bf31b7f87fc",
      "experimental_sandbox-0dfa76df5e3e",
      "toolCallId-b3e91af1743a",
      "messages-f97f28a7fbbb"
    ],
    "Output": [
      "array-a50da8c00109",
      "choice-89fbb2824793",
      "json-56015e6681ff",
      "object-fb3d199946ca",
      "text-2dba2c59564f"
    ],
    "SessionConfig": [
      "instructions-4cc81f59e6ac",
      "voice-7e42c4fa10ac",
      "outputModalities-39bbf6b1aadb",
      "inputAudioFormat-955d75ed5ca3",
      "inputAudioTranscription-bc4eeaf53b51",
      "outputAudioTranscription-d19f1c7d2fa9",
      "outputAudioFormat-bc737eb9a538",
      "turnDetection-8e67b91d87d3",
      "tools-a0a46f619d2a",
      "providerOptions-017504595b6e"
    ],
    "VoiceSessionConfig_result": [
      "instructions-4cc81f59e6ac",
      "voice-7e42c4fa10ac",
      "outputModalities-39bbf6b1aadb",
      "inputAudioFormat-955d75ed5ca3",
      "inputAudioTranscription-bc4eeaf53b51",
      "outputAudioTranscription-d19f1c7d2fa9",
      "outputAudioFormat-bc737eb9a538",
      "turnDetection-8e67b91d87d3",
      "tools-a0a46f619d2a",
      "providerOptions-017504595b6e"
    ],
    "VoiceWebRTC_result": [
      "sessionId-b384762552aa",
      "sdp-6a765cb22ad4"
    ],
    "LLMAgent_result": [
      "content-2a8a29548036",
      "text-925a2201a0e9",
      "reasoning-c999ae832ad1",
      "reasoningText-37eedd3b6264",
      "files-0e94b2d13dfd",
      "sources-a83f0411473e",
      "toolCalls-b8abddbc1a19",
      "staticToolCalls-4700a386356d",
      "dynamicToolCalls-9598dbe74c2d",
      "toolResults-309dd0a07bcf",
      "staticToolResults-2edcf41036e7",
      "dynamicToolResults-500736a6ee5f",
      "finishReason-dfb59b85b501",
      "rawFinishReason-31c21f78dc95",
      "usage-24adb70fb568",
      "totalUsage-498de2aec016",
      "warnings-2846ee005e14",
      "request-221385acc282",
      "response-e5e32110ad14",
      "responseMessages-806464dfb85b",
      "providerMetadata-cbbb7591ae4c",
      "steps-136a8e127e1f",
      "finalStep-37d35df42bd8",
      "output-a77136f8075d"
    ],
    "LLMAgent_native": [
      "maxOutputTokens-28aceb6f8de2",
      "temperature-d5e463222c25",
      "topP-c18ae9faa20b",
      "topK-9dca433077cb",
      "presencePenalty-ffb8353a33d5",
      "frequencyPenalty-24e57c07ecf0",
      "stopSequences-d8033627c3bb",
      "seed-42d63366f1c9",
      "reasoning-50148c4a1de6",
      "maxRetries-0ed81bc73d61",
      "abortSignal-fc62ed60653c",
      "headers-74f55db49467",
      "timeout-d2d66c53fa17",
      "instructions-b0d8abcfc99d",
      "system-172f838ea9ab",
      "allowSystemInMessages-e1a407f3bbe9",
      "prompt-da6f2a5e577b",
      "messages-4821e5bed3b2",
      "tools-c7e657498fc5",
      "toolsContext-84d563e92fb8",
      "model-bcb922cd8d09",
      "toolChoice-e966120430af",
      "stopWhen-58682c71d97a",
      "telemetry-426b4fc5106b",
      "experimental_telemetry-a9e7af1f89df",
      "providerOptions-84c631799d17",
      "experimental_sandbox-99c3bd2e8aa3",
      "experimental_steering-5a09c397514b",
      "runtimeContext-4a749ca4bd3e",
      "activeTools-40780df8380f",
      "toolOrder-3e1ebf5c6c12",
      "toolCallConcurrency-b74f772b74e0",
      "output-e60b98f327bb",
      "toolApproval-172adab271f3",
      "experimental_toolCallers-1828a8c45edd",
      "experimental_toolApprovalSecret-605bca05f581",
      "experimental_download-a484b37b0e10",
      "prepareStep-722de7983b61",
      "repairToolCall-90618d4db5d0",
      "experimental_repairToolCall-8b5571b91327",
      "experimental_refineToolInput-47f3c0fd9da8",
      "onStart-04bef8beb81a",
      "experimental_onStart-e62aaae29cc6",
      "onStepStart-f84d162aacac",
      "experimental_onStepStart-028c613cdafb",
      "onLanguageModelCallStart-5a20308df072",
      "experimental_onLanguageModelCallStart-220a502fe06c",
      "onLanguageModelCallEnd-d5815d586cf9",
      "experimental_onLanguageModelCallEnd-09ab6ee2dbab",
      "onToolExecutionStart-759b258f7ebb",
      "experimental_onToolCallStart-8d8e55310f46",
      "onToolExecutionEnd-7103c945dc4c",
      "experimental_onToolCallFinish-bab0dfda3943",
      "onStepEnd-7464be587786",
      "onStepError-ff3b402b51ab",
      "onStepFinish-08052cbd0975",
      "onEnd-88496c796bd5",
      "onFinish-bba008f25f73",
      "include-08574c6232c5",
      "experimental_include-61e712cf0599",
      "_internal-f6a277d4bac6"
    ],
    "LLMAgentStream_result": [
      "content-78185f28d35d",
      "text-ed5e8048e5c8",
      "reasoning-adfeb01c242e",
      "reasoningText-8e5d43bfaac9",
      "files-3baf3c0948a7",
      "sources-5c24b516104e",
      "toolCalls-00000473a97a",
      "staticToolCalls-fe800df0b657",
      "dynamicToolCalls-b95642b6e21a",
      "staticToolResults-7eb944588ecf",
      "dynamicToolResults-659935885523",
      "toolResults-a3b17144d068",
      "finishReason-1b0fe72a0778",
      "rawFinishReason-c8a69858eb5c",
      "usage-729563a623ca",
      "totalUsage-75bf30f90be3",
      "warnings-87d9968f8e07",
      "steps-ac71cf637c67",
      "finalStep-f5a197f739f2",
      "request-f2c6f88f10d3",
      "response-61c06f5c4845",
      "responseMessages-419d83f78ea5",
      "providerMetadata-7c8da1cc1063",
      "textStream-942de4eaf2e3",
      "stream-010421b1bb75",
      "fullStream-fef6926e69b8",
      "experimental_partialOutputStream-a73b4cb78c17",
      "partialOutputStream-99c9325a20da",
      "elementStream-b56d509c0449",
      "output-123131f9da41",
      "consumeStream-f9c55348e54f",
      "toUIMessageStream-b8151304fa46",
      "pipeUIMessageStreamToResponse-0c12508e1e68",
      "pipeTextStreamToResponse-1d88dc69bf5b",
      "toUIMessageStreamResponse-e50d56ba1962",
      "toTextStreamResponse-5ec832758faa"
    ],
    "LLMAgentStream_native": [
      "maxOutputTokens-28aceb6f8de2",
      "temperature-d5e463222c25",
      "topP-c18ae9faa20b",
      "topK-9dca433077cb",
      "presencePenalty-ffb8353a33d5",
      "frequencyPenalty-24e57c07ecf0",
      "stopSequences-d8033627c3bb",
      "seed-42d63366f1c9",
      "reasoning-50148c4a1de6",
      "maxRetries-0ed81bc73d61",
      "abortSignal-fc62ed60653c",
      "headers-74f55db49467",
      "timeout-d2d66c53fa17",
      "instructions-b0d8abcfc99d",
      "system-172f838ea9ab",
      "allowSystemInMessages-e1a407f3bbe9",
      "prompt-da6f2a5e577b",
      "messages-4821e5bed3b2",
      "tools-c7e657498fc5",
      "toolsContext-84d563e92fb8",
      "model-f5334808405d",
      "toolChoice-ee62be34526e",
      "stopWhen-061b01707f0c",
      "telemetry-c4d62b940351",
      "experimental_telemetry-b6b99a209d23",
      "providerOptions-bdb985c437b4",
      "experimental_sandbox-2582909742ec",
      "experimental_steering-82714f7fe6df",
      "runtimeContext-ded6f4342986",
      "activeTools-e09d12af5e53",
      "toolOrder-c6855d505085",
      "toolCallConcurrency-940e6b2336b5",
      "output-fe44a89cb056",
      "toolApproval-ed5d414f0f62",
      "experimental_toolCallers-ffe6f3c3e609",
      "experimental_toolApprovalSecret-4ff3620966c4",
      "prepareStep-7d67e4ce16c8",
      "repairToolCall-1cfd20033b0a",
      "experimental_repairToolCall-e8fd40680c55",
      "experimental_refineToolInput-b3ee93fb0d2b",
      "experimental_transform-0ec05c4143a3",
      "experimental_download-162e51e5ff3c",
      "includeRawChunks-4927cd9740df",
      "onChunk-6fbcb2a9372a",
      "onError-16e40c751f49",
      "streamRetries-2780ace7cb77",
      "onEnd-ef461f83e3bb",
      "onFinish-f20459a0ea53",
      "onAbort-c24d17adc5f3",
      "onStepEnd-d8e8f0f2289a",
      "onStepError-6ac92c5732e1",
      "onStepFinish-a6df59245cbd",
      "onStart-57baf4db48d0",
      "experimental_onStart-98bf0b5a2745",
      "onStepStart-9ebb7d08a587",
      "experimental_onStepStart-15e8aea9fae2",
      "onLanguageModelCallStart-8d83021ae3c8",
      "experimental_onLanguageModelCallStart-491395c8a913",
      "onLanguageModelCallEnd-94d3ab4bd2e8",
      "experimental_onLanguageModelCallEnd-a09d59f7a599",
      "onToolExecutionStart-1954e5a469ba",
      "experimental_onToolCallStart-3976f3ffdb21",
      "onToolExecutionEnd-ea85b06844b0",
      "experimental_onToolCallFinish-08b7141b6862",
      "include-2f0b096d0254",
      "experimental_include-c911c6b3941e",
      "_internal-2797c17b47fe"
    ],
    "Decision_result": [
      "answers-08dc93da3be8",
      "usage-4d2839fc326e",
      "warnings-09983a0ccdb9",
      "rounding-21207da9926c",
      "providerMetadata-f0f9ffbcadb5",
      "response-1a7dc2392bcd"
    ],
    "Decision_native": [
      "model-82af40007353",
      "state-db13ea08a329",
      "questions-dd5363516405",
      "maxOutputTokens-16305b3096c8",
      "reasoning-892add36e4d9",
      "maxRetries-23097e18368b",
      "abortSignal-3e2de4b1ba34",
      "headers-86575131d3c3",
      "providerOptions-c53d3bd5265d",
      "telemetry-7b4f0ebaca44",
      "runtimeContext-750515b0b35b",
      "onStart-8b18b7c09df5",
      "onEnd-d7aa5cddc6cf",
      "_internal-99eba0cdff92"
    ],
    "Embedder_result": [
      "value-d2798f2459dc",
      "embedding-28465d16c7d2",
      "usage-0f7d9f5a6a3b",
      "warnings-47b367d54554",
      "providerMetadata-42cd5ecbd571",
      "response-7af554c6fae8"
    ],
    "Embedder_native": [
      "model-48aa9f877e2f",
      "value-c37f5640ff7b",
      "dimensions-2a545e83fd43",
      "maxRetries-446dc9e70593",
      "abortSignal-ba91bd67cbb7",
      "headers-1ed650c3b13b",
      "providerOptions-84b4899a0815",
      "telemetry-39fa616edbc3",
      "experimental_telemetry-13341df2875d",
      "runtimeContext-5a66a39874dd",
      "onStart-cc3c9aa8dc3f",
      "experimental_onStart-f2f7f020a9e5",
      "onEnd-eed8fe22bc47",
      "experimental_onEnd-2c0ae17e5f79",
      "_internal-de3674fe249f"
    ],
    "EmbedderBatch_result": [
      "values-d66df071b78f",
      "embeddings-6f1b362870e6",
      "usage-ff21b5ddb575",
      "warnings-1d3fccb3d882",
      "providerMetadata-48bfc7037b5c",
      "responses-ac7be9f9b8c3"
    ],
    "EmbedderBatch_native": [
      "model-01b0663ad509",
      "values-6aa442082344",
      "dimensions-2ccabb90d619",
      "maxRetries-21df607005af",
      "abortSignal-2b7c59d4f74b",
      "headers-f7116f3e57a6",
      "telemetry-4c89c3844737",
      "experimental_telemetry-c7ea9dba6c92",
      "runtimeContext-9ac3967b5bf5",
      "providerOptions-a94e237310ca",
      "maxParallelCalls-6694df5c0a88",
      "onStart-d4e8d9c392c1",
      "experimental_onStart-beec57122067",
      "onEnd-6e04994067d5",
      "experimental_onEnd-97a0acabe2fe",
      "_internal-03883d0a112a"
    ],
    "Reranker_result": [
      "originalDocuments-215eb4fac765",
      "rerankedDocuments-732cf9cfaede",
      "ranking-dda77c1a65ca",
      "providerMetadata-6ddff93d9315",
      "response-cb4078ff4fd7"
    ],
    "Reranker_native": [
      "model-38a5e14b7041",
      "documents-e64a9272b831",
      "query-7008b7b4625a",
      "topN-2e58a6ef4988",
      "maxRetries-5a3efed0cfd5",
      "abortSignal-1be52e81fd5e",
      "headers-d3e2a061a8b8",
      "telemetry-0c47e752120d",
      "experimental_telemetry-09dd8794b725",
      "runtimeContext-b1f87baccfa3",
      "providerOptions-323e9176b870",
      "onStart-2e8ca1a184bf",
      "experimental_onStart-abc629b14bdc",
      "onEnd-361d10c86f16",
      "experimental_onEnd-2567d3ca2920",
      "_internal-29b6970b9db3"
    ],
    "ImageGenerator_result": [
      "image-a98fbf11406a",
      "images-48a4cc2d363e",
      "calls-5b86ccbe82f7",
      "warnings-0e6fb7a66231",
      "responses-8658993a1aff",
      "providerMetadata-fa85bd12bf6d",
      "usage-b4dcc0622deb"
    ],
    "ImageGenerator_native": [
      "model-b484e382e133",
      "prompt-48ad41e1e072",
      "n-f9857b6df04f",
      "maxImagesPerCall-7d962d74cbca",
      "size-5a9c136a3a29",
      "aspectRatio-29de3eadc285",
      "seed-2911d722b271",
      "providerOptions-d0dcb86a4b4b",
      "maxRetries-43a557421317",
      "abortSignal-f0f3c7bf9130",
      "headers-8a1860c91ac4"
    ],
    "Transcriber_result": [
      "text-352c730b4bb8",
      "segments-428a1f286ac8",
      "language-2f06686a7383",
      "durationInSeconds-19431d9e2a62",
      "warnings-1e34a2635ebf",
      "responses-a6bddb02ea18",
      "providerMetadata-fb60083c3c2d"
    ],
    "Transcriber_native": [
      "model-d63e7d77f371",
      "audio-2c7771e7c87b",
      "providerOptions-6fb067a708e2",
      "maxRetries-569af71b732f",
      "abortSignal-1f5a193f4cfe",
      "headers-23ed9be29275",
      "telemetry-72cc4604f7aa",
      "download-f08788366d4c",
      "_internal-a4d65510b686"
    ],
    "StreamingTranscriber_result": [
      "text-b4b7399b21c2",
      "segments-33df0823f194",
      "language-6859a8acc1d2",
      "durationInSeconds-24de35d7d0a5",
      "warnings-8a7a10343ff2",
      "responses-187bc4e8cfa3",
      "providerMetadata-2ecb679233eb",
      "fullStream-007898973bb7"
    ],
    "StreamingTranscriber_native": [
      "model-e9ed376d43a6",
      "audio-3b4b6bba6442",
      "inputAudioFormat-a530ffc7dab7",
      "providerOptions-0e700395c4b1",
      "abortSignal-69af4f81640d",
      "headers-1c3aaeb2734c",
      "includeRawChunks-7d3f5f2a41a1",
      "telemetry-237457941031",
      "_internal-76401c9df9f4"
    ],
    "SpeechGenerator_result": [
      "audio-090e31c3f07e",
      "warnings-751664670b6e",
      "responses-d50a12d4caa1",
      "providerMetadata-d8670c7292b8"
    ],
    "SpeechGenerator_native": [
      "model-8d9d31f1896c",
      "text-ec806897822a",
      "voice-524c54983482",
      "outputFormat-6291f13adf52",
      "instructions-589fb8cbb087",
      "speed-4d164fbb7f9d",
      "language-61b62537a500",
      "providerOptions-b4ea33bb4d7b",
      "maxRetries-3203a207b457",
      "abortSignal-dde81d3b7308",
      "headers-210ca6223697",
      "telemetry-f8a2081d9c3e",
      "_internal-891f15b39ec6"
    ],
    "StreamingSpeechGenerator_result": [
      "usage-e862f00da64d",
      "warnings-13637bc242f9",
      "responses-261571bff397",
      "providerMetadata-c8051b2e6c0b",
      "audioStream-b358ab4f1af4",
      "fullStream-1187b3d5412c"
    ],
    "StreamingSpeechGenerator_native": [
      "model-f710fabe18e0",
      "text-730665458c8e",
      "voice-a24507351f00",
      "outputFormat-1c52617eb72c",
      "instructions-4b3f21b46179",
      "speed-38cf774e7d2f",
      "language-17c4c3804341",
      "providerOptions-8ef11a06508b",
      "abortSignal-ba9834cb4957",
      "headers-a43707561005",
      "includeRawChunks-90c2b49e91af",
      "onError-50a850676fc2",
      "_internal-33f27e35a0d4"
    ],
    "StreamingTranslator_result": [
      "sourceText-20efa392ede3",
      "translationText-94c108174585",
      "durationInSeconds-517ae82d7988",
      "usage-17ea66e7f260",
      "warnings-279e6968f8af",
      "response-26f85eeed335",
      "providerMetadata-820fb99f87d6",
      "fullStream-16693db7e0f0"
    ],
    "StreamingTranslator_native": [
      "model-2844db232f29",
      "audio-bc4b82bb8b5d",
      "inputAudioFormat-a9437bf10d0a",
      "targetLanguage-f5006a68aa47",
      "sourceLanguage-af6309dbca4a",
      "outputAudioFormat-89e588aef43c",
      "providerOptions-629f88d39640",
      "abortSignal-d9dfce9e4ae0",
      "headers-8bb00513d5db",
      "includeRawChunks-29430afa6810",
      "_internal-0c473c098e24"
    ],
    "VoiceSessionSetup_result": [
      "token-ef6388c67aaf",
      "url-6694c49079ae",
      "expiresAt-b4d04565231e",
      "tools-2d73a7f6a27a"
    ],
    "Telemetry:0": [
      "isEnabled-461f93f561cc",
      "recordInputs-5a9bc04cadf6",
      "recordOutputs-eef63173ee8d",
      "functionId-a8cb2fcd49af",
      "includeRuntimeContext-7be8a823ab05",
      "includeToolsContext-4e95f5357138",
      "integrations-96ef7c9abe2e"
    ],
    "Timeout:0": [],
    "Timeout:1": [
      "totalMs-594fa641341f",
      "stepMs-4e681ef685e4",
      "firstChunkMs-08154ea18be9",
      "chunkMs-ea0876ccf03b",
      "toolMs-b110bb37581e",
      "tools-9d7732e75fb6"
    ],
    "StreamInclude:0": [
      "requestBody-e4b8c5083ebc",
      "requestMessages-f417475096d1",
      "rawChunks-84c188cf4090"
    ],
    "AudioFormat:0": [
      "type-3d37b77be676",
      "rate-9d519651bed3"
    ],
    "SessionTranscription:0": [
      "model-747c04f06434",
      "language-c8af6ab181e6",
      "prompt-198973fe857c"
    ],
    "TurnDetection:0": [],
    "TurnDetection:1": [
      "type-4403e09d8750",
      "threshold-d319cb183c9a",
      "silenceDurationMs-ea7c5a2320c3",
      "prefixPaddingMs-d9ac0b322e22"
    ],
    "DecisionQuestion:0": [
      "type-e23128cc0ea3",
      "instructions-b8948cb7f97e",
      "criteria-25a4abc81557"
    ],
    "DecisionQuestion:1": [
      "type-f0ed6b10b0cb",
      "instructions-716db50b0640",
      "criteria-f2ab0914b0a2"
    ],
    "DecisionQuestion:2": [
      "type-33b2c1d6b3ea",
      "instructions-ec4fde729210"
    ],
    "DecisionQuestion:3": [
      "type-d51d159b0b95",
      "instructions-c1fc06851b28",
      "criteria-4a3e82e16f10"
    ],
    "ModelMessage:0": [
      "role-98fcfc9df349",
      "content-5d96322cd173",
      "providerOptions-c6c4e0593818"
    ],
    "ModelMessage:1": [
      "role-842fd34a266d",
      "content-92937787a683",
      "providerOptions-cf02dd68a7de"
    ],
    "ModelMessage:2": [
      "role-56618d0a1118",
      "content-be1a0de1cdcc",
      "providerOptions-1649f94a4e5e"
    ],
    "ModelMessage:3": [
      "role-27bc21560f98",
      "content-489efe726dd4",
      "providerOptions-fd446947bc10"
    ],
    "ImagePrompt:0": [
      "images-5e3daa468130",
      "text-44720aaced31",
      "mask-67715919181b"
    ],
    "GeneratedFile:0": [
      "base64-c3f892cd6414",
      "uint8Array-0ab6dcaf1c56",
      "mediaType-bd46b3644604",
      "providerMetadata-38a36c15e990"
    ],
    "GeneratedAudioFile:0": [
      "format-abeb330ea542",
      "base64-c3f892cd6414",
      "uint8Array-0ab6dcaf1c56",
      "mediaType-bd46b3644604",
      "providerMetadata-38a36c15e990"
    ],
    "RealtimeToolDefinition:0": [
      "type-2c4b7c1f06e1",
      "name-98415698ff60",
      "description-765dad9c3ae1",
      "parameters-a7ebd2b436da"
    ],
    "OutputObject:0": [
      "schema-6c2c7e02e817",
      "name-06a2b2b44852",
      "description-09f4aee69855"
    ],
    "OutputArray:0": [
      "element-91da8658bc12",
      "minItems-af67e565c2af",
      "maxItems-83b91f99b871",
      "name-0fc0260efcb7",
      "description-4c42d2df1bbb"
    ],
    "OutputChoice:0": [
      "options-6fc25659e8c1",
      "name-71d67ed50215",
      "description-5989d1faa9c5"
    ],
    "OutputJSON:0": [
      "name-29ff40758bf7",
      "description-43c7639c81e5"
    ],
    "RenderTags:0": [
      "blockStart-f5e2528ea25e",
      "blockEnd-0f749e13b000",
      "variableStart-05fdbed68441",
      "variableEnd-f77e2116f6e3",
      "commentStart-b8315042f228",
      "commentEnd-d74f77fd5dec"
    ],
    "RenderWeb:0": [
      "useCache-fea750cb2b63",
      "async-83ca33f9d83e"
    ]
  },
  "properties": {
    "template-902b6327f5ff": {
      "name": "template",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "inputSchema-f335a5a81f68": {
      "name": "inputSchema",
      "type": "SchemaType<Record<string, any>> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "promptType-adaae62fa855": {
      "name": "promptType",
      "type": "TemplatePromptType | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "filters-e21828790709": {
      "name": "filters",
      "type": "Record<string, (input: any, ...args: any[]) => any> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "renderOptions-0b6a6f477332": {
      "name": "renderOptions",
      "type": "ConfigureOptions | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "loader-5d45bab68a1b": {
      "name": "loader",
      "type": "LoaderInput | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "context-9009039f251e": {
      "name": "context",
      "type": "Record<string, any> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "debug-cdff8d93c93d": {
      "name": "debug",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "description-094750903948": {
      "name": "description",
      "type": "string | ((options: { context: any; experimental_sandbox?: SandboxSession; }) => string) | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "tools-05ebb5c95a02": {
      "name": "tools",
      "type": "ToolRegistry | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "toolsContext-492a80518673": {
      "name": "toolsContext",
      "type": "Record<string, unknown> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "direct-c287cb6ac7c7": {
      "name": "direct",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": []
    },
    "template-7349d7682caf": {
      "name": "template",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": []
    },
    "prepared-01eff35c8614": {
      "name": "prepared",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": []
    },
    "script-3ee7336160ef": {
      "name": "script",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "schema-288e8cf2b21a": {
      "name": "schema",
      "type": "SchemaType<unknown> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "promptType-4e6960d1ae5c": {
      "name": "promptType",
      "type": "ScriptPromptType | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "direct-b5cef17f1666": {
      "name": "direct",
      "type": "string | undefined",
      "optional": false,
      "description": "",
      "tags": []
    },
    "prepared-360e241e4dcb": {
      "name": "prepared",
      "type": "string | undefined",
      "optional": false,
      "description": "",
      "tags": []
    },
    "inputSchema-434f89f77423": {
      "name": "inputSchema",
      "type": "any",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "schema-1d2155b590a2": {
      "name": "schema",
      "type": "any",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "execute-5deb85869c1d": {
      "name": "execute",
      "type": "FunctionImplementation<any, any, any, (input: any) => any>",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "context-884c05d5299f": {
      "name": "context",
      "type": "any",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "direct-61182c4fc774": {
      "name": "direct",
      "type": "FunctionImplementation<any, any, any, (input: any) => any>",
      "optional": false,
      "description": "",
      "tags": []
    },
    "prepared-d70b23f5570a": {
      "name": "prepared",
      "type": "FunctionImplementation<any, any, any, (input: any) => any>",
      "optional": false,
      "description": "",
      "tags": []
    },
    "inputSchema-d2ab2b864d21": {
      "name": "inputSchema",
      "type": "SchemaType<Record<string, any>> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/agent.ts"
      }
    },
    "promptType-a87a79942498": {
      "name": "promptType",
      "type": "PromptType | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/agent.ts"
      }
    },
    "tools-d8cac053f1e9": {
      "name": "tools",
      "type": "{ [x: string]: ((Tool<never, never, any> | Tool<any, any, any> | Tool<any, never, any> | Tool<never, any, any>) & Pick<Tool<any, any, any>, \"execute\" | \"onInputAvailable\" | \"onInputStart\" | \"onInputDelta\" | \"needsApproval\">) | null | undefined; } | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/agent.ts"
      }
    },
    "toolsContext-be97e33328f3": {
      "name": "toolsContext",
      "type": "ToolContexts<ToolSet> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/agent.ts"
      }
    },
    "runtimeContext-5279a5b531bf": {
      "name": "runtimeContext",
      "type": "Record<string, unknown> | undefined",
      "optional": true,
      "description": "Runtime context. Treat runtime context as immutable.\nIf you need to mutate runtime context, update it in `prepareStep`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3985,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3985"
      }
    },
    "providerOptions-bdb985c437b4": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3970,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3970"
      }
    },
    "id-7c420ba44547": {
      "name": "id",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/agent.ts"
      }
    },
    "output-960376aadf77": {
      "name": "output",
      "type": "AIOutput | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/agent.ts"
      }
    },
    "maxOutputTokens-28aceb6f8de2": {
      "name": "maxOutputTokens",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of tokens to generate.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 706,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L706"
      }
    },
    "temperature-d5e463222c25": {
      "name": "temperature",
      "type": "number | undefined",
      "optional": true,
      "description": "Temperature setting. The range depends on the provider and model.\n\nIt is recommended to set either `temperature` or `topP`, but not both.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 712,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L712"
      }
    },
    "topP-c18ae9faa20b": {
      "name": "topP",
      "type": "number | undefined",
      "optional": true,
      "description": "Nucleus sampling. This is a number between 0 and 1.\n\nE.g. 0.1 would mean that only tokens with the top 10% probability mass\nare considered.\n\nIt is recommended to set either `temperature` or `topP`, but not both.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 721,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L721"
      }
    },
    "topK-9dca433077cb": {
      "name": "topK",
      "type": "number | undefined",
      "optional": true,
      "description": "Only sample from the top K options for each subsequent token.\n\nUsed to remove \"long tail\" low probability responses.\nRecommended for advanced use cases only. You usually only need to use temperature.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 728,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L728"
      }
    },
    "presencePenalty-ffb8353a33d5": {
      "name": "presencePenalty",
      "type": "number | undefined",
      "optional": true,
      "description": "Presence penalty setting. It affects the likelihood of the model to\nrepeat information that is already in the prompt.\n\nThe presence penalty is a number between -1 (increase repetition)\nand 1 (maximum penalty, decrease repetition). 0 means no penalty.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 736,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L736"
      }
    },
    "frequencyPenalty-24e57c07ecf0": {
      "name": "frequencyPenalty",
      "type": "number | undefined",
      "optional": true,
      "description": "Frequency penalty setting. It affects the likelihood of the model\nto repeatedly use the same words or phrases.\n\nThe frequency penalty is a number between -1 (increase repetition)\nand 1 (maximum penalty, decrease repetition). 0 means no penalty.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 744,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L744"
      }
    },
    "stopSequences-d8033627c3bb": {
      "name": "stopSequences",
      "type": "string[] | undefined",
      "optional": true,
      "description": "Stop sequences.\nIf set, the model will stop generating text when one of the stop sequences is generated.\nProviders may have limits on the number of stop sequences.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 750,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L750"
      }
    },
    "seed-42d63366f1c9": {
      "name": "seed",
      "type": "number | undefined",
      "optional": true,
      "description": "The seed (integer) to use for random sampling. If set and supported\nby the model, calls will generate deterministic results.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 755,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L755"
      }
    },
    "reasoning-50148c4a1de6": {
      "name": "reasoning",
      "type": "\"provider-default\" | \"none\" | \"minimal\" | \"low\" | \"medium\" | \"high\" | \"xhigh\" | \"max\" | undefined",
      "optional": true,
      "description": "Reasoning effort level for the model. Controls how much reasoning\nthe model performs before generating a response.\n\nUse `'provider-default'` to use the provider's default reasoning level.\nUse `'none'` to disable reasoning (if supported by the provider).",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 763,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L763"
      }
    },
    "maxRetries-0ed81bc73d61": {
      "name": "maxRetries",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of retries. Set to 0 to disable retries.",
      "tags": [
        {
          "name": "default",
          "text": "2"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 826,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L826"
      }
    },
    "headers-74f55db49467": {
      "name": "headers",
      "type": "Record<string, string | undefined> | undefined",
      "optional": true,
      "description": "Additional HTTP headers to be sent with the request.\nOnly applicable for HTTP-based providers.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 835,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L835"
      }
    },
    "timeout-d2d66c53fa17": {
      "name": "timeout",
      "type": "TimeoutConfiguration<ToolSet> | undefined",
      "optional": true,
      "description": "Timeout configuration for the request.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 839,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L839"
      }
    },
    "instructions-b0d8abcfc99d": {
      "name": "instructions",
      "type": "Instructions | undefined",
      "optional": true,
      "description": "Instructions to include in the prompt. Can be used with `prompt` or `messages`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 862,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L862"
      }
    },
    "allowSystemInMessages-e1a407f3bbe9": {
      "name": "allowSystemInMessages",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Whether system messages are allowed in the `prompt` or `messages` fields.\n\nWhen disabled, system messages must be provided through the `instructions`\noption.",
      "tags": [
        {
          "name": "default",
          "text": "false"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 877,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L877"
      }
    },
    "prompt-dbcb70464d4d": {
      "name": "prompt",
      "type": "PromptValue | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/agent.ts"
      }
    },
    "model-f5334808405d": {
      "name": "model",
      "type": "LanguageModel",
      "optional": false,
      "description": "The language model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3943,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3943"
      }
    },
    "toolChoice-ee62be34526e": {
      "name": "toolChoice",
      "type": "ToolChoice<ToolSet> | undefined",
      "optional": true,
      "description": "The tool choice strategy. Default: 'auto'.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3947,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3947"
      }
    },
    "telemetry-8764a08784e2": {
      "name": "telemetry",
      "type": "TelemetryOptions<Record<string, unknown>, NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3958,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3958"
      }
    },
    "experimental_sandbox-2582909742ec": {
      "name": "experimental_sandbox",
      "type": "SandboxSession | undefined",
      "optional": true,
      "description": "The sandbox environment that is passed through to tool execution.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3974,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3974"
      }
    },
    "experimental_steering-82714f7fe6df": {
      "name": "experimental_steering",
      "type": "Steering | undefined",
      "optional": true,
      "description": "A steering object created with `experimental_createSteering()`.\nMessages sent with it are added to the generation at the next step\nboundary.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3980,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3980"
      }
    },
    "activeTools-e09d12af5e53": {
      "name": "activeTools",
      "type": "ActiveTools<NoInfer<ToolSet>>",
      "optional": true,
      "description": "Limits the tools that are available for the model to call without\nchanging the tool call and result types in the result.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3990,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3990"
      }
    },
    "toolOrder-c6855d505085": {
      "name": "toolOrder",
      "type": "ToolOrder<NoInfer<ToolSet>>",
      "optional": true,
      "description": "Controls the order in which tools are sent to the provider.\n\nThe list can be partial. Tools not listed in `toolOrder` are sent after\nthe listed tools, sorted alphabetically. This can improve provider-side\ncaching by keeping tool definitions in a stable order.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3998,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3998"
      }
    },
    "toolCallConcurrency-940e6b2336b5": {
      "name": "toolCallConcurrency",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of tool calls that may execute concurrently within a step.\n\nSet to `1` to execute tool calls sequentially in the order they were\ngenerated. By default, all tool calls execute concurrently.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4005,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4005"
      }
    },
    "experimental_toolCallers-ffe6f3c3e609": {
      "name": "experimental_toolCallers",
      "type": "Experimental_ToolCallers<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Configures which caller tools may invoke each tool.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4019,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4019"
      }
    },
    "experimental_toolApprovalSecret-4ff3620966c4": {
      "name": "experimental_toolApprovalSecret",
      "type": "string | Uint8Array<ArrayBufferLike> | undefined",
      "optional": true,
      "description": "Secret for HMAC-signing tool approval requests. When set, the server\nsigns each approval request at issuance and verifies the signature when\nthe approval is replayed, preventing client-forged approvals.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4025,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4025"
      }
    },
    "include-2f0b096d0254": {
      "name": "include",
      "type": "StreamTextInclude | undefined",
      "optional": true,
      "description": "Settings for controlling what data is included in step results.\nDisabling inclusion can help reduce memory usage when processing\nlarge payloads like images.\n\nBy default, request bodies and request messages are excluded.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4214,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4214"
      }
    },
    "streamRetries-2780ace7cb77": {
      "name": "streamRetries",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of automatic retries for provider errors received after\nresponse streaming has started. Each retry reruns only the current model\nstep. Completed earlier steps and their tool results are preserved.\n\nPartial output from a failed attempt that was already emitted cannot be\nretracted and remains in consumer-facing streams. It is excluded from\nthe recovered step result, structured output parsing, response messages,\nand subsequent model steps.\n\nSet to `0` to disable automatic retries while allowing `onError` to\nrequest one retry. When automatic retries are configured, `onError` can\nrequest at most one additional retry after they are exhausted. Omit this\noption to disable all stream retry behavior and preserve incremental tool\nstreaming for existing `onError` observers.",
      "tags": [
        {
          "name": "default",
          "text": "0 (stream retry behavior disabled when omitted)"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4108,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4108"
      }
    },
    "streaming-7ebe1c1cd17f": {
      "name": "streaming",
      "type": "true | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/agent.ts"
      }
    },
    "stopWhen-fb42ba28c06a": {
      "name": "stopWhen",
      "type": "Arrayable<StopCondition<NoInfer<ResolvedTools<{ [x: string]: ((Tool<never, never, any> | Tool<any, any, any> | Tool<any, never, any> | Tool<never, any, any>) & Pick<Tool<any, any, any>, \"execute\" | \"onInputAvailable\" | \"onInputStart\" | \"onInputDelta\" | \"needsApproval\">) | null | undefined; }>>, Record<string, unknown>>>",
      "optional": true,
      "description": "",
      "tags": []
    },
    "toolApproval-6a9876dda4cd": {
      "name": "toolApproval",
      "type": "ToolApprovalConfiguration<ResolvedTools<{ [x: string]: ((Tool<never, never, any> | Tool<any, any, any> | Tool<any, never, any> | Tool<never, any, any>) & Pick<Tool<any, any, any>, \"execute\" | \"onInputAvailable\" | \"onInputStart\" | \"onInputDelta\" | \"needsApproval\">) | null | undefined; }>, Record<string, unknown>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "experimental_download-339211b44f67": {
      "name": "experimental_download",
      "type": "DownloadFunction | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "repairToolCall-5401ceab17c1": {
      "name": "repairToolCall",
      "type": "ToolCallRepairFunction<ResolvedTools<{ [x: string]: ((Tool<never, never, any> | Tool<any, any, any> | Tool<any, never, any> | Tool<never, any, any>) & Pick<Tool<any, any, any>, \"execute\" | \"onInputAvailable\" | \"onInputStart\" | \"onInputDelta\" | \"needsApproval\">) | null | undefined; }>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "experimental_refineToolInput-fdf12acc03d8": {
      "name": "experimental_refineToolInput",
      "type": "ToolInputRefinement<NoInfer<ResolvedTools<{ [x: string]: ((Tool<never, never, any> | Tool<any, any, any> | Tool<any, never, any> | Tool<never, any, any>) & Pick<Tool<any, any, any>, \"execute\" | \"onInputAvailable\" | \"onInputStart\" | \"onInputDelta\" | \"needsApproval\">) | null | undefined; }>>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onStart-c175b325404b": {
      "name": "onStart",
      "type": "GenerateTextOnStartCallback<NoInfer<ResolvedTools<{ [x: string]: ((Tool<never, never, any> | Tool<any, any, any> | Tool<any, never, any> | Tool<never, any, any>) & Pick<Tool<any, any, any>, \"execute\" | \"onInputAvailable\" | \"onInputStart\" | \"onInputDelta\" | \"needsApproval\">) | null | undefined; }>>, NoInfer<Record<string, unknown>>, NoInfer<AIOutput>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onStepStart-9053e2711378": {
      "name": "onStepStart",
      "type": "GenerateTextOnStepStartCallback<NoInfer<ResolvedTools<{ [x: string]: ((Tool<never, never, any> | Tool<any, any, any> | Tool<any, never, any> | Tool<never, any, any>) & Pick<Tool<any, any, any>, \"execute\" | \"onInputAvailable\" | \"onInputStart\" | \"onInputDelta\" | \"needsApproval\">) | null | undefined; }>>, NoInfer<Record<string, unknown>>, NoInfer<AIOutput>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onLanguageModelCallStart-d5f244e3950e": {
      "name": "onLanguageModelCallStart",
      "type": "OnLanguageModelCallStartCallback | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onLanguageModelCallEnd-25e2e9bc83ca": {
      "name": "onLanguageModelCallEnd",
      "type": "OnLanguageModelCallEndCallback<NoInfer<ResolvedTools<{ [x: string]: ((Tool<never, never, any> | Tool<any, any, any> | Tool<any, never, any> | Tool<never, any, any>) & Pick<Tool<any, any, any>, \"execute\" | \"onInputAvailable\" | \"onInputStart\" | \"onInputDelta\" | \"needsApproval\">) | null | undefined; }>>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onToolExecutionStart-81d084f43eb0": {
      "name": "onToolExecutionStart",
      "type": "OnToolExecutionStartCallback<NoInfer<ResolvedTools<{ [x: string]: ((Tool<never, never, any> | Tool<any, any, any> | Tool<any, never, any> | Tool<never, any, any>) & Pick<Tool<any, any, any>, \"execute\" | \"onInputAvailable\" | \"onInputStart\" | \"onInputDelta\" | \"needsApproval\">) | null | undefined; }>>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onToolExecutionEnd-e56d20dd0b14": {
      "name": "onToolExecutionEnd",
      "type": "OnToolExecutionEndCallback<NoInfer<ResolvedTools<{ [x: string]: ((Tool<never, never, any> | Tool<any, any, any> | Tool<any, never, any> | Tool<never, any, any>) & Pick<Tool<any, any, any>, \"execute\" | \"onInputAvailable\" | \"onInputStart\" | \"onInputDelta\" | \"needsApproval\">) | null | undefined; }>>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onStepEnd-8b3fdb23f1d8": {
      "name": "onStepEnd",
      "type": "GenerateTextOnStepEndCallback<NoInfer<ResolvedTools<{ [x: string]: ((Tool<never, never, any> | Tool<any, any, any> | Tool<any, never, any> | Tool<never, any, any>) & Pick<Tool<any, any, any>, \"execute\" | \"onInputAvailable\" | \"onInputStart\" | \"onInputDelta\" | \"needsApproval\">) | null | undefined; }>>, NoInfer<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onStepError-97a24c8aaa0f": {
      "name": "onStepError",
      "type": "GenerateTextOnStepErrorCallback<NoInfer<ResolvedTools<{ [x: string]: ((Tool<never, never, any> | Tool<any, any, any> | Tool<any, never, any> | Tool<never, any, any>) & Pick<Tool<any, any, any>, \"execute\" | \"onInputAvailable\" | \"onInputStart\" | \"onInputDelta\" | \"needsApproval\">) | null | undefined; }>>, NoInfer<Record<string, unknown>>, NoInfer<AIOutput>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onEnd-3644bf4f2d1c": {
      "name": "onEnd",
      "type": "StreamTextOnEndCallback<NoInfer<ResolvedTools<{ [x: string]: ((Tool<never, never, any> | Tool<any, any, any> | Tool<any, never, any> | Tool<never, any, any>) & Pick<Tool<any, any, any>, \"execute\" | \"onInputAvailable\" | \"onInputStart\" | \"onInputDelta\" | \"needsApproval\">) | null | undefined; }>>, NoInfer<Record<string, unknown>>, NoInfer<AIOutput>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "experimental_transform-89cd4ae316b3": {
      "name": "experimental_transform",
      "type": "Arrayable<StreamTextTransform<ResolvedTools<{ [x: string]: ((Tool<never, never, any> | Tool<any, any, any> | Tool<any, never, any> | Tool<never, any, any>) & Pick<Tool<any, any, any>, \"execute\" | \"onInputAvailable\" | \"onInputStart\" | \"onInputDelta\" | \"needsApproval\">) | null | undefined; }>>>",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onChunk-53740e0f058c": {
      "name": "onChunk",
      "type": "StreamTextOnChunkCallback<ResolvedTools<{ [x: string]: ((Tool<never, never, any> | Tool<any, any, any> | Tool<any, never, any> | Tool<never, any, any>) & Pick<Tool<any, any, any>, \"execute\" | \"onInputAvailable\" | \"onInputStart\" | \"onInputDelta\" | \"needsApproval\">) | null | undefined; }>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onError-74cbedca876d": {
      "name": "onError",
      "type": "StreamTextOnErrorCallback | StreamTextOnErrorRetryCallback | StreamTextOnErrorHandler | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onAbort-1aceb31e0923": {
      "name": "onAbort",
      "type": "StreamTextOnAbortCallback<NoInfer<ResolvedTools<{ [x: string]: ((Tool<never, never, any> | Tool<any, any, any> | Tool<any, never, any> | Tool<never, any, any>) & Pick<Tool<any, any, any>, \"execute\" | \"onInputAvailable\" | \"onInputStart\" | \"onInputDelta\" | \"needsApproval\">) | null | undefined; }>>, NoInfer<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "prepareCall-1ce8440c2874": {
      "name": "prepareCall",
      "type": "PrepareCall<Pick<AgentSettings<ToolSet, Record<string, any>, PromptValue, AIOutput, Record<string, unknown>>, \"inputSchema\" | \"context\" | \"tools\" | \"toolsContext\" | \"runtimeContext\" | \"output\">, false> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/agent.ts"
      }
    },
    "prepareStep-b1fc7f13d5d4": {
      "name": "prepareStep",
      "type": "PrepareStep<Pick<AgentSettings<ToolSet, Record<string, any>, PromptValue, AIOutput, Record<string, unknown>>, \"inputSchema\" | \"context\" | \"tools\" | \"toolsContext\" | \"runtimeContext\" | \"output\">, false> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/agent.ts"
      }
    },
    "asTool-dfdd3e4eaf49": {
      "name": "asTool",
      "type": "true | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "stopWhen-e8250c5614a3": {
      "name": "stopWhen",
      "type": "Arrayable<StopCondition<NoInfer<ToolSet>, Record<string, unknown>>>",
      "optional": true,
      "description": "Condition for stopping the generation when there are tool results in the last step.\nWhen the condition is an array, any of the conditions can be met to stop the generation.",
      "tags": [
        {
          "name": "default",
          "text": "isStepCount(1)"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3954,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3954"
      }
    },
    "toolApproval-f04ab75b2254": {
      "name": "toolApproval",
      "type": "ToolApprovalConfiguration<ToolSet, Record<string, unknown>> | undefined",
      "optional": true,
      "description": "Optional tool approval configuration.\n\nThis configuration takes precedence over tool-defined approval settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4015,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4015"
      }
    },
    "experimental_download-162e51e5ff3c": {
      "name": "experimental_download",
      "type": "DownloadFunction | undefined",
      "optional": true,
      "description": "Custom download function to use for URLs.\n\nBy default, files are downloaded if the model does not support the URL for the given media type.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4066,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4066"
      }
    },
    "repairToolCall-1cfd20033b0a": {
      "name": "repairToolCall",
      "type": "ToolCallRepairFunction<ToolSet> | undefined",
      "optional": true,
      "description": "A function that attempts to repair a tool call that failed to parse.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4041,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4041"
      }
    },
    "experimental_refineToolInput-b3ee93fb0d2b": {
      "name": "experimental_refineToolInput",
      "type": "ToolInputRefinement<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Optional mapping of tool names to functions that refine parsed tool inputs.\n\nThe refined input must have the same type shape as the tool input. Refined\ninputs are used for tool execution, stream parts, callbacks, and telemetry.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4054,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4054"
      }
    },
    "onStart-66b9a75d9d1d": {
      "name": "onStart",
      "type": "GenerateTextOnStartCallback<NoInfer<ToolSet>, NoInfer<Record<string, unknown>>, NoInfer<AIOutput>> | undefined",
      "optional": true,
      "description": "Callback that is called when the streamText operation begins,\nbefore any LLM calls are made.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4145,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4145"
      }
    },
    "onStepStart-5585ea699152": {
      "name": "onStepStart",
      "type": "GenerateTextOnStepStartCallback<NoInfer<ToolSet>, NoInfer<Record<string, unknown>>, NoInfer<AIOutput>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step (LLM call) begins,\nbefore the provider is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4157,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4157"
      }
    },
    "onLanguageModelCallStart-8d83021ae3c8": {
      "name": "onLanguageModelCallStart",
      "type": "OnLanguageModelCallStartCallback | undefined",
      "optional": true,
      "description": "Callback that is called immediately before the provider model call begins.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4168,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4168"
      }
    },
    "onLanguageModelCallEnd-94d3ab4bd2e8": {
      "name": "onLanguageModelCallEnd",
      "type": "OnLanguageModelCallEndCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called after the model response has been normalized and parsed,\nbut before any client-side tool execution begins.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4179,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4179"
      }
    },
    "onToolExecutionStart-1954e5a469ba": {
      "name": "onToolExecutionStart",
      "type": "OnToolExecutionStartCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called right before a tool's execute function runs.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4190,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4190"
      }
    },
    "onToolExecutionEnd-ea85b06844b0": {
      "name": "onToolExecutionEnd",
      "type": "OnToolExecutionEndCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called right after a tool's execute function completes (or errors).",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4200,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4200"
      }
    },
    "onStepEnd-8a03a3480e69": {
      "name": "onStepEnd",
      "type": "GenerateTextOnStepEndCallback<NoInfer<ToolSet>, NoInfer<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Callback that is called when each step (LLM call) ends, including intermediate steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4129,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4129"
      }
    },
    "onStepError-64f9d90f19cc": {
      "name": "onStepError",
      "type": "GenerateTextOnStepErrorCallback<NoInfer<ToolSet>, NoInfer<Record<string, unknown>>, NoInfer<AIOutput>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step that started fails before it\nproduces a step result. `onStepEnd` is not called for such a step.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4134,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4134"
      }
    },
    "onEnd-2e786bb451d8": {
      "name": "onEnd",
      "type": "StreamTextOnEndCallback<NoInfer<ToolSet>, NoInfer<Record<string, unknown>>, NoInfer<AIOutput>> | undefined",
      "optional": true,
      "description": "Callback that is called when the LLM response and all request tool executions\n(for tools that have an `execute` function) are finished.\n\nThe usage is the combined usage of all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4115,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4115"
      }
    },
    "experimental_transform-0ec05c4143a3": {
      "name": "experimental_transform",
      "type": "Arrayable<StreamTextTransform<ToolSet>>",
      "optional": true,
      "description": "Optional stream transformations.\nThey are applied in the order they are provided.\nThe stream transformations must maintain the stream structure for streamText to work correctly.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4060,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4060"
      }
    },
    "onChunk-6fbcb2a9372a": {
      "name": "onChunk",
      "type": "StreamTextOnChunkCallback<ToolSet> | undefined",
      "optional": true,
      "description": "Callback that is called for each chunk of the stream.\nThe stream processing will pause until the callback promise is resolved.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4080,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4080"
      }
    },
    "onError-16e40c751f49": {
      "name": "onError",
      "type": "StreamTextOnErrorCallback | StreamTextOnErrorRetryCallback | StreamTextOnErrorHandler | undefined",
      "optional": true,
      "description": "Callback that is invoked when an error occurs during streaming.\nYou can use it to log errors.\nReturn `{ retry: true }` to retry the current model step after a provider\nerror is received from the response stream when `streamRetries` is\nexplicitly configured.\nThe stream processing will pause until the callback promise is resolved.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4089,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4089"
      }
    },
    "onAbort-9e072f29fce0": {
      "name": "onAbort",
      "type": "StreamTextOnAbortCallback<NoInfer<ToolSet>, NoInfer<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4125,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4125"
      }
    },
    "direct-92236f2a65ad": {
      "name": "direct",
      "type": "PromptValue | undefined",
      "optional": false,
      "description": "",
      "tags": []
    },
    "template-cb881cd7cb54": {
      "name": "template",
      "type": "PromptValue",
      "optional": false,
      "description": "",
      "tags": []
    },
    "prepared-3c21b736ebb0": {
      "name": "prepared",
      "type": "PromptValue | undefined",
      "optional": false,
      "description": "",
      "tags": []
    },
    "runtimeContext-0add664a522c": {
      "name": "runtimeContext",
      "type": "Record<string, unknown> | undefined",
      "optional": true,
      "description": "User-defined runtime context. Treat runtime context as immutable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8732,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8732"
      }
    },
    "providerOptions-c53d3bd5265d": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8728,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8728"
      }
    },
    "maxOutputTokens-16305b3096c8": {
      "name": "maxOutputTokens",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum output tokens for supported models. Must be an integer >= 1.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8721,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8721"
      }
    },
    "reasoning-892add36e4d9": {
      "name": "reasoning",
      "type": "\"provider-default\" | \"none\" | \"minimal\" | \"low\" | \"medium\" | \"high\" | \"xhigh\" | \"max\" | undefined",
      "optional": true,
      "description": "Reasoning effort for supported models. Language-model adapters default to none.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8723,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8723"
      }
    },
    "maxRetries-23097e18368b": {
      "name": "maxRetries",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum retries for transient provider failures. Defaults to 2.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8725,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8725"
      }
    },
    "headers-86575131d3c3": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8727,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8727"
      }
    },
    "model-c591403d9d0a": {
      "name": "model",
      "type": "(DecisionModel | undefined) & DecisionModel",
      "optional": false,
      "description": "A decision model instance or an ID resolved by the configured default provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8717,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8717"
      }
    },
    "telemetry-41ea114badea": {
      "name": "telemetry",
      "type": "TelemetryOptions<Record<string, unknown>, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8730,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8730"
      }
    },
    "onStart-5643812436ab": {
      "name": "onStart",
      "type": "Callback<DecideStartEvent<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Called when the decide operation begins.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8734,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8734"
      }
    },
    "onEnd-a03dc449884e": {
      "name": "onEnd",
      "type": "Callback<DecideEndEvent<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Called when the decide operation completes.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8736,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8736"
      }
    },
    "questions-dd5363516405": {
      "name": "questions",
      "type": "Record<string, DecisionModelV4Question>",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8719,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8719"
      }
    },
    "state-f6557702dc32": {
      "name": "state",
      "type": "DecisionState | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "toolContextSchema-d7c206b57ff4": {
      "name": "toolContextSchema",
      "type": "SchemaType<unknown> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "inputSchema-e1f157741580": {
      "name": "inputSchema",
      "type": "SchemaType<Record<string, any>> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/component.ts"
      }
    },
    "tools-f8808df35909": {
      "name": "tools",
      "type": "ToolRegistry | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/component.ts"
      }
    },
    "toolsContext-a026c14e3010": {
      "name": "toolsContext",
      "type": "Record<string, unknown> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/component.ts"
      }
    },
    "promptType-fcb30516c7a6": {
      "name": "promptType",
      "type": "\"text\" | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/component.ts"
      }
    },
    "abortSignal-3e2de4b1ba34": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8726,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8726"
      }
    },
    "model-82af40007353": {
      "name": "model",
      "type": "DecisionModel",
      "optional": false,
      "description": "A decision model instance or an ID resolved by the configured default provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8717,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8717"
      }
    },
    "state-db13ea08a329": {
      "name": "state",
      "type": "DecisionState",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8718,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8718"
      }
    },
    "direct-80c1b590bd26": {
      "name": "direct",
      "type": "DecisionState",
      "optional": false,
      "description": "",
      "tags": []
    },
    "template-b1e3d963012c": {
      "name": "template",
      "type": "string | readonly DecisionStatePart[]",
      "optional": false,
      "description": "",
      "tags": []
    },
    "prepared-37a4f0163687": {
      "name": "prepared",
      "type": "DecisionState",
      "optional": false,
      "description": "",
      "tags": []
    },
    "runtimeContext-b82193f21760": {
      "name": "runtimeContext",
      "type": "Record<string, unknown> | undefined",
      "optional": true,
      "description": "User-defined runtime context. Treat runtime context as immutable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8184,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8184"
      }
    },
    "providerOptions-a94e237310ca": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8190,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8190"
      }
    },
    "maxRetries-21df607005af": {
      "name": "maxRetries",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of retries per embedding model call. Set to 0 to disable retries.",
      "tags": [
        {
          "name": "default",
          "text": "2"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8161,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8161"
      }
    },
    "headers-f7116f3e57a6": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request.\nOnly applicable for HTTP-based providers.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8170,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8170"
      }
    },
    "model-e9e0c47ec797": {
      "name": "model",
      "type": "string | EmbeddingModelV4 | EmbeddingModelV3 | EmbeddingModelV2<string> | (string & EmbeddingModelV4) | (string & EmbeddingModelV3) | (string & EmbeddingModelV2<string>) | (EmbeddingModelV4 & string) | (EmbeddingModelV3 & string) | (EmbeddingModelV2<string> & string)",
      "optional": false,
      "description": "The embedding model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8145,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8145"
      }
    },
    "telemetry-e0229feb9d3a": {
      "name": "telemetry",
      "type": "TelemetryOptions<Record<string, unknown>, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8174,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8174"
      }
    },
    "experimental_telemetry-031d59a19554": {
      "name": "experimental_telemetry",
      "type": "TelemetryOptions<Record<string, unknown>, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `telemetry` instead. This alias will be removed in a future major release."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8180,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8180"
      }
    },
    "onStart-3eefebc5d492": {
      "name": "onStart",
      "type": "Callback<EmbedStartEvent<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embedMany operation begins,\nbefore the embedding model is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8202,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8202"
      }
    },
    "experimental_onStart-3beabf892011": {
      "name": "experimental_onStart",
      "type": "Callback<EmbedStartEvent<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embedMany operation begins,\nbefore the embedding model is called.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8209,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8209"
      }
    },
    "onEnd-5bb5b5ee92e8": {
      "name": "onEnd",
      "type": "Callback<EmbedEndEvent<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embedMany operation completes,\nafter all embedding model calls return.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8214,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8214"
      }
    },
    "dimensions-2ccabb90d619": {
      "name": "dimensions",
      "type": "number | undefined",
      "optional": true,
      "description": "The requested number of dimensions for the output embeddings.\nMust be a positive integer. Support and allowed values depend on the model\nand provider implementation.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8155,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8155"
      }
    },
    "maxParallelCalls-6694df5c0a88": {
      "name": "maxParallelCalls",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of concurrent requests when a request is split into multiple model calls.\nMust be greater than 0 when the model supports parallel calls.",
      "tags": [
        {
          "name": "default",
          "text": "Infinity"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8197,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8197"
      }
    },
    "experimental_onEnd-a59f437a84ba": {
      "name": "experimental_onEnd",
      "type": "Callback<EmbedEndEvent<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embedMany operation completes,\nafter all embedding model calls return.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8221,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8221"
      }
    },
    "input-fb5baefd9ad6": {
      "name": "input",
      "type": "string | string[] | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "abortSignal-2b7c59d4f74b": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8165,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8165"
      }
    },
    "model-01b0663ad509": {
      "name": "model",
      "type": "EmbeddingModel",
      "optional": false,
      "description": "The embedding model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8145,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8145"
      }
    },
    "input-dcc8da217a5c": {
      "name": "input",
      "type": "string | string[]",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/factories/Embedder.ts"
      }
    },
    "direct-fce20620be48": {
      "name": "direct",
      "type": "string | string[]",
      "optional": false,
      "description": "",
      "tags": []
    },
    "prepared-2ea72cf3d6e5": {
      "name": "prepared",
      "type": "string | string[]",
      "optional": false,
      "description": "",
      "tags": []
    },
    "runtimeContext-bfeb4849a32a": {
      "name": "runtimeContext",
      "type": "Record<string, unknown> | undefined",
      "optional": true,
      "description": "User-defined runtime context. Treat runtime context as immutable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10762,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10762"
      }
    },
    "providerOptions-323e9176b870": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10768,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10768"
      }
    },
    "maxRetries-5a3efed0cfd5": {
      "name": "maxRetries",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of retries per reranking model call. Set to 0 to disable retries.",
      "tags": [
        {
          "name": "default",
          "text": "2"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10739,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10739"
      }
    },
    "headers-d3e2a061a8b8": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request.\nOnly applicable for HTTP-based providers.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10748,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10748"
      }
    },
    "model-c5e0815e9abc": {
      "name": "model",
      "type": "string | RerankingModelV4 | RerankingModelV3 | (string & RerankingModelV4) | (string & RerankingModelV3) | (RerankingModelV4 & string) | (RerankingModelV3 & string)",
      "optional": false,
      "description": "The reranking model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10721,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10721"
      }
    },
    "telemetry-7031c717fdc7": {
      "name": "telemetry",
      "type": "TelemetryOptions<Record<string, unknown>, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10752,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10752"
      }
    },
    "experimental_telemetry-6ff335051f6b": {
      "name": "experimental_telemetry",
      "type": "TelemetryOptions<Record<string, unknown>, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `telemetry` instead. This alias will be removed in a future major release."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10758,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10758"
      }
    },
    "onStart-28980c38987c": {
      "name": "onStart",
      "type": "Callback<RerankStartEvent<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the rerank operation begins,\nbefore the reranking model is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10773,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10773"
      }
    },
    "experimental_onStart-b12bd48010fa": {
      "name": "experimental_onStart",
      "type": "Callback<RerankStartEvent<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the rerank operation begins,\nbefore the reranking model is called.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10780,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10780"
      }
    },
    "onEnd-336a122ae41f": {
      "name": "onEnd",
      "type": "Callback<RerankEndEvent<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the rerank operation completes,\nafter the reranking model returns.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10785,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10785"
      }
    },
    "experimental_onEnd-7bae4c05bcee": {
      "name": "experimental_onEnd",
      "type": "Callback<RerankEndEvent<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the rerank operation completes,\nafter the reranking model returns.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10792,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10792"
      }
    },
    "documents-153e8de9ac0a": {
      "name": "documents",
      "type": "(string | JSONObject)[] | undefined",
      "optional": true,
      "description": "The documents that should be reranked.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10725,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10725"
      }
    },
    "topN-2e58a6ef4988": {
      "name": "topN",
      "type": "number | undefined",
      "optional": true,
      "description": "Number of top documents to return.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10733,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10733"
      }
    },
    "query-bf57c694fea9": {
      "name": "query",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "abortSignal-1be52e81fd5e": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10743,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10743"
      }
    },
    "model-38a5e14b7041": {
      "name": "model",
      "type": "RerankingModel",
      "optional": false,
      "description": "The reranking model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10721,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10721"
      }
    },
    "documents-e64a9272b831": {
      "name": "documents",
      "type": "(string | JSONObject)[]",
      "optional": false,
      "description": "The documents that should be reranked.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10725,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10725"
      }
    },
    "query-7008b7b4625a": {
      "name": "query",
      "type": "string",
      "optional": false,
      "description": "The query to rerank the documents against.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10729,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10729"
      }
    },
    "prepared-443e2e85b058": {
      "name": "prepared",
      "type": "string | QueryDocuments",
      "optional": false,
      "description": "",
      "tags": []
    },
    "providerOptions-d0dcb86a4b4b": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options that are passed through to the provider\nas body parameters.\n\nThe outer record is keyed by the provider name, and the inner\nrecord is keyed by the provider-specific metadata key.\n```ts\n{\n\"openai\": {\n\"style\": \"vivid\"\n}\n}\n```",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7665,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7665"
      }
    },
    "seed-2911d722b271": {
      "name": "seed",
      "type": "number | undefined",
      "optional": true,
      "description": "Seed for the image generation. If not provided, the default seed will be used.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7650,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7650"
      }
    },
    "maxRetries-43a557421317": {
      "name": "maxRetries",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of retries per image model call, including retries after\nunclassified empty responses. Empty responses marked as not retryable by\nthe provider are not retried. Set to 0 to disable retries.",
      "tags": [
        {
          "name": "default",
          "text": "2"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7673,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7673"
      }
    },
    "headers-8a1860c91ac4": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request.\nOnly applicable for HTTP-based providers.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7682,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7682"
      }
    },
    "model-11f5ef204b2c": {
      "name": "model",
      "type": "string | ImageModelV4 | ImageModelV3 | ImageModelV2 | (string & ImageModelV4) | (string & ImageModelV3) | (string & ImageModelV2) | (ImageModelV4 & string) | (ImageModelV3 & string) | (ImageModelV2 & string)",
      "optional": false,
      "description": "The image model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7626,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7626"
      }
    },
    "n-f9857b6df04f": {
      "name": "n",
      "type": "number | undefined",
      "optional": true,
      "description": "Number of images to generate.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7634,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7634"
      }
    },
    "maxImagesPerCall-7d962d74cbca": {
      "name": "maxImagesPerCall",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of images to generate in a single API call. If not provided, the model's default will be used.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7638,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7638"
      }
    },
    "size-5a9c136a3a29": {
      "name": "size",
      "type": "`${number}x${number}` | undefined",
      "optional": true,
      "description": "Size of the images to generate. Must have the format `{width}x{height}`. If not provided, the default size will be used.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7642,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7642"
      }
    },
    "aspectRatio-29de3eadc285": {
      "name": "aspectRatio",
      "type": "`${number}:${number}` | undefined",
      "optional": true,
      "description": "Aspect ratio of the images to generate. Must have the format `{width}:{height}`. If not provided, the default aspect ratio will be used.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7646,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7646"
      }
    },
    "images-a9ef46239974": {
      "name": "images",
      "type": "DataContent[] | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7600,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7600"
      }
    },
    "mask-67715919181b": {
      "name": "mask",
      "type": "DataContent | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7602,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7602"
      }
    },
    "prompt-e832a0f8b353": {
      "name": "prompt",
      "type": "GenerateImagePrompt | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "abortSignal-f0f3c7bf9130": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7677,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7677"
      }
    },
    "prompt-48ad41e1e072": {
      "name": "prompt",
      "type": "GenerateImagePrompt",
      "optional": false,
      "description": "The prompt that should be used to generate the image.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7630,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7630"
      }
    },
    "model-b484e382e133": {
      "name": "model",
      "type": "ImageModel",
      "optional": false,
      "description": "The image model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7626,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7626"
      }
    },
    "direct-2d5fd362f21e": {
      "name": "direct",
      "type": "GenerateImagePrompt",
      "optional": false,
      "description": "",
      "tags": []
    },
    "template-2885c0b86495": {
      "name": "template",
      "type": "GenerateImagePrompt",
      "optional": false,
      "description": "",
      "tags": []
    },
    "prepared-02ae7791d4f4": {
      "name": "prepared",
      "type": "GenerateImagePrompt",
      "optional": false,
      "description": "",
      "tags": []
    },
    "providerOptions-6fb067a708e2": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options that are passed through to the provider\nas body parameters.\n\nThe outer record is keyed by the provider name, and the inner\nrecord is keyed by the provider-specific metadata key.\n```ts\n{\n  \"openai\": {\n    \"temperature\": 0\n  }\n}\n```",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10966,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10966"
      }
    },
    "maxRetries-569af71b732f": {
      "name": "maxRetries",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of retries per transcript model call. Set to 0 to disable retries.",
      "tags": [
        {
          "name": "default",
          "text": "2"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10972,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10972"
      }
    },
    "headers-23ed9be29275": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request.\nOnly applicable for HTTP-based providers.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10981,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10981"
      }
    },
    "model-b8a9484641b3": {
      "name": "model",
      "type": "string | TranscriptionModelV4 | TranscriptionModelV3 | TranscriptionModelV2 | (string & TranscriptionModelV4) | (string & TranscriptionModelV3) | (string & TranscriptionModelV2) | (TranscriptionModelV4 & string) | (TranscriptionModelV3 & string) | (TranscriptionModelV2 & string)",
      "optional": false,
      "description": "The transcription model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10947,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10947"
      }
    },
    "telemetry-72cc4604f7aa": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10985,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10985"
      }
    },
    "download-f08788366d4c": {
      "name": "download",
      "type": "((options: { url: URL; abortSignal?: AbortSignal; }) => Promise<{ data: Uint8Array; mediaType: string | undefined; }>) | undefined",
      "optional": true,
      "description": "Custom download function for fetching audio from URLs.\nUse `createDownload()` from `ai` to create a download function with custom size limits.",
      "tags": [
        {
          "name": "default",
          "text": "createDownload() (2 GiB limit)"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10992,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10992"
      }
    },
    "audio-0c1c18aa3172": {
      "name": "audio",
      "type": "DataContent | URL | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "abortSignal-1f5a193f4cfe": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10976,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10976"
      }
    },
    "model-d63e7d77f371": {
      "name": "model",
      "type": "TranscriptionModel",
      "optional": false,
      "description": "The transcription model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10947,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10947"
      }
    },
    "audio-2c7771e7c87b": {
      "name": "audio",
      "type": "DataContent | URL",
      "optional": false,
      "description": "The audio data to transcribe.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10951,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10951"
      }
    },
    "direct-0fa09a3c675a": {
      "name": "direct",
      "type": "DataContent | URL",
      "optional": false,
      "description": "",
      "tags": []
    },
    "prepared-98dc444fb407": {
      "name": "prepared",
      "type": "DataContent | URL",
      "optional": false,
      "description": "",
      "tags": []
    },
    "providerOptions-0e700395c4b1": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11110,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11110"
      }
    },
    "headers-1c3aaeb2734c": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request, if supported by the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11118,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11118"
      }
    },
    "model-93d3f90bcfb6": {
      "name": "model",
      "type": "string | TranscriptionModelV4 | TranscriptionModelV3 | TranscriptionModelV2 | (string & TranscriptionModelV4) | (string & TranscriptionModelV3) | (string & TranscriptionModelV2) | (TranscriptionModelV4 & string) | (TranscriptionModelV3 & string) | (TranscriptionModelV2 & string)",
      "optional": false,
      "description": "The transcription model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11098,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11098"
      }
    },
    "telemetry-237457941031": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11126,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11126"
      }
    },
    "includeRawChunks-7d3f5f2a41a1": {
      "name": "includeRawChunks",
      "type": "boolean | undefined",
      "optional": true,
      "description": "When true, providers should include raw provider chunks in the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11122,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11122"
      }
    },
    "inputAudioFormat-7e0e83a62aca": {
      "name": "inputAudioFormat",
      "type": "SharedV4AudioFormat | undefined",
      "optional": true,
      "description": "The input audio format for the raw audio chunks.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11106,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11106"
      }
    },
    "audio-73f3d8f8ab2d": {
      "name": "audio",
      "type": "ReadableStream<string | Uint8Array<ArrayBufferLike>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "abortSignal-69af4f81640d": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11114,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11114"
      }
    },
    "model-e9ed376d43a6": {
      "name": "model",
      "type": "TranscriptionModel",
      "optional": false,
      "description": "The transcription model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11098,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11098"
      }
    },
    "audio-3b4b6bba6442": {
      "name": "audio",
      "type": "ReadableStream<string | Uint8Array<ArrayBufferLike>>",
      "optional": false,
      "description": "Raw audio chunks to transcribe.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11102,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11102"
      }
    },
    "inputAudioFormat-a530ffc7dab7": {
      "name": "inputAudioFormat",
      "type": "SharedV4AudioFormat",
      "optional": false,
      "description": "The input audio format for the raw audio chunks.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11106,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11106"
      }
    },
    "direct-cb45dbd030e6": {
      "name": "direct",
      "type": "ReadableStream<string | Uint8Array<ArrayBufferLike>>",
      "optional": false,
      "description": "",
      "tags": []
    },
    "prepared-3509297a8ac6": {
      "name": "prepared",
      "type": "ReadableStream<string | Uint8Array<ArrayBufferLike>>",
      "optional": false,
      "description": "",
      "tags": []
    },
    "providerOptions-b4ea33bb4d7b": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options that are passed through to the provider\nas body parameters.\n\nThe outer record is keyed by the provider name, and the inner\nrecord is keyed by the provider-specific metadata key.\n```ts\n{\n\"openai\": {}\n}\n```",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9537,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9537"
      }
    },
    "maxRetries-3203a207b457": {
      "name": "maxRetries",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of retries per speech model call. Set to 0 to disable retries.",
      "tags": [
        {
          "name": "default",
          "text": "2"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9543,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9543"
      }
    },
    "headers-210ca6223697": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request.\nOnly applicable for HTTP-based providers.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9552,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9552"
      }
    },
    "instructions-589fb8cbb087": {
      "name": "instructions",
      "type": "string | undefined",
      "optional": true,
      "description": "Instructions for the speech generation e.g. \"Speak in a slow and steady tone\".",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9515,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9515"
      }
    },
    "model-94567991422d": {
      "name": "model",
      "type": "string | SpeechModelV4 | SpeechModelV3 | SpeechModelV2 | (string & SpeechModelV4) | (string & SpeechModelV3) | (string & SpeechModelV2) | (SpeechModelV4 & string) | (SpeechModelV3 & string) | (SpeechModelV2 & string)",
      "optional": false,
      "description": "The speech model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9499,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9499"
      }
    },
    "telemetry-f8a2081d9c3e": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9556,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9556"
      }
    },
    "voice-524c54983482": {
      "name": "voice",
      "type": "string | undefined",
      "optional": true,
      "description": "The voice to use for speech generation.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9507,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9507"
      }
    },
    "outputFormat-6291f13adf52": {
      "name": "outputFormat",
      "type": "(string & {}) | \"mp3\" | \"wav\" | undefined",
      "optional": true,
      "description": "The desired output format for the audio e.g. \"mp3\", \"wav\", etc.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9511,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9511"
      }
    },
    "speed-4d164fbb7f9d": {
      "name": "speed",
      "type": "number | undefined",
      "optional": true,
      "description": "The speed of the speech generation.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9519,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9519"
      }
    },
    "language-61b62537a500": {
      "name": "language",
      "type": "string | undefined",
      "optional": true,
      "description": "The language for speech generation. This should be an ISO 639-1 language code (e.g. \"en\", \"es\", \"fr\")\nor \"auto\" for automatic language detection. Provider support varies.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9524,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9524"
      }
    },
    "text-9952b743697d": {
      "name": "text",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "text-ec806897822a": {
      "name": "text",
      "type": "string",
      "optional": false,
      "description": "The text to convert to speech.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9503,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9503"
      }
    },
    "abortSignal-dde81d3b7308": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9547,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9547"
      }
    },
    "model-8d9d31f1896c": {
      "name": "model",
      "type": "SpeechModel",
      "optional": false,
      "description": "The speech model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9499,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9499"
      }
    },
    "providerOptions-8ef11a06508b": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9695,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9695"
      }
    },
    "headers-a43707561005": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request, if supported by the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9703,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9703"
      }
    },
    "instructions-4b3f21b46179": {
      "name": "instructions",
      "type": "string | undefined",
      "optional": true,
      "description": "Instructions for the speech generation e.g. \"Speak in a slow and steady tone\".",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9682,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9682"
      }
    },
    "model-e7347b132223": {
      "name": "model",
      "type": "string | SpeechModelV4 | SpeechModelV3 | SpeechModelV2 | (string & SpeechModelV4) | (string & SpeechModelV3) | (string & SpeechModelV2) | (SpeechModelV4 & string) | (SpeechModelV3 & string) | (SpeechModelV2 & string)",
      "optional": false,
      "description": "The speech model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9663,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9663"
      }
    },
    "includeRawChunks-90c2b49e91af": {
      "name": "includeRawChunks",
      "type": "boolean | undefined",
      "optional": true,
      "description": "When true, providers should include raw provider chunks in the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9707,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9707"
      }
    },
    "onError-50a850676fc2": {
      "name": "onError",
      "type": "((event: { error: unknown; }) => void | PromiseLike<void>) | undefined",
      "optional": true,
      "description": "Called for each error part the provider reports. Error parts are not\nfatal: `fullStream` includes them and `audioStream` skips them. The\ncallback is not awaited, and errors it throws are ignored.\nDefaults to logging the error with `console.error`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9714,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9714"
      }
    },
    "voice-a24507351f00": {
      "name": "voice",
      "type": "string | undefined",
      "optional": true,
      "description": "The voice to use for speech generation.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9672,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9672"
      }
    },
    "outputFormat-1c52617eb72c": {
      "name": "outputFormat",
      "type": "SharedV4AudioFormat | undefined",
      "optional": true,
      "description": "The desired format of the output audio chunks, e.g.\n`{ type: 'audio/pcm', rate: 24000 }` or `{ type: 'audio/mpeg' }`.\nSupported formats are provider-specific.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9678,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9678"
      }
    },
    "speed-38cf774e7d2f": {
      "name": "speed",
      "type": "number | undefined",
      "optional": true,
      "description": "The speed of the speech generation.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9686,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9686"
      }
    },
    "language-17c4c3804341": {
      "name": "language",
      "type": "string | undefined",
      "optional": true,
      "description": "The language for speech generation. This should be an ISO 639-1 language code (e.g. \"en\", \"es\", \"fr\")\nor \"auto\" for automatic language detection. Provider support varies.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9691,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9691"
      }
    },
    "text-85a9dc177766": {
      "name": "text",
      "type": "string | Iterable<string | SpeechTextPart> | AsyncIterable<string | SpeechTextPart> | ReadableStream<string | SpeechTextPart> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "text-730665458c8e": {
      "name": "text",
      "type": "string | Iterable<string | SpeechTextPart> | AsyncIterable<string | SpeechTextPart> | ReadableStream<string | SpeechTextPart>",
      "optional": false,
      "description": "The text to convert to speech: a complete string, or an array, iterable,\nor stream of text deltas and/or text parts.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9668,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9668"
      }
    },
    "abortSignal-ba9834cb4957": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9699,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9699"
      }
    },
    "model-f710fabe18e0": {
      "name": "model",
      "type": "SpeechModel",
      "optional": false,
      "description": "The speech model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9663,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9663"
      }
    },
    "direct-5306f56796f6": {
      "name": "direct",
      "type": "string | Iterable<string | SpeechTextPart> | AsyncIterable<string | SpeechTextPart> | ReadableStream<string | SpeechTextPart>",
      "optional": false,
      "description": "",
      "tags": []
    },
    "prepared-b47e988fe35e": {
      "name": "prepared",
      "type": "string | Iterable<string | SpeechTextPart> | AsyncIterable<string | SpeechTextPart> | ReadableStream<string | SpeechTextPart>",
      "optional": false,
      "description": "",
      "tags": []
    },
    "providerOptions-629f88d39640": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11325,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11325"
      }
    },
    "headers-8bb00513d5db": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request, if supported by the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11333,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11333"
      }
    },
    "model-c8d77816a238": {
      "name": "model",
      "type": "(SpeechTranslationModel | undefined) & SpeechTranslationModel",
      "optional": false,
      "description": "The speech translation model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11297,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11297"
      }
    },
    "includeRawChunks-29430afa6810": {
      "name": "includeRawChunks",
      "type": "boolean | undefined",
      "optional": true,
      "description": "When true, providers should include raw provider chunks in the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11337,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11337"
      }
    },
    "inputAudioFormat-2df44b715671": {
      "name": "inputAudioFormat",
      "type": "SharedV4AudioFormat | undefined",
      "optional": true,
      "description": "The input audio format for the raw audio chunks.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11305,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11305"
      }
    },
    "targetLanguage-94fcfd26675f": {
      "name": "targetLanguage",
      "type": "string | undefined",
      "optional": true,
      "description": "The language to translate the audio into, as a BCP-47-style language\ntag (e.g. `en`, `es`, `fr-CA`). Supported values are provider-specific\nand validated by the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11311,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11311"
      }
    },
    "sourceLanguage-af6309dbca4a": {
      "name": "sourceLanguage",
      "type": "string | undefined",
      "optional": true,
      "description": "The language of the source audio, as a BCP-47-style language tag.\nWhen absent, providers auto-detect the source language.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11316,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11316"
      }
    },
    "outputAudioFormat-89e588aef43c": {
      "name": "outputAudioFormat",
      "type": "SharedV4AudioFormat | undefined",
      "optional": true,
      "description": "The desired audio format for translated audio chunks.\nWhen absent, the provider default output format is used.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11321,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11321"
      }
    },
    "abortSignal-d9dfce9e4ae0": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11329,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11329"
      }
    },
    "model-2844db232f29": {
      "name": "model",
      "type": "SpeechTranslationModel",
      "optional": false,
      "description": "The speech translation model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11297,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11297"
      }
    },
    "audio-bc4b82bb8b5d": {
      "name": "audio",
      "type": "ReadableStream<string | Uint8Array<ArrayBufferLike>>",
      "optional": false,
      "description": "Raw audio chunks to translate.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11301,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11301"
      }
    },
    "inputAudioFormat-a9437bf10d0a": {
      "name": "inputAudioFormat",
      "type": "SharedV4AudioFormat",
      "optional": false,
      "description": "The input audio format for the raw audio chunks.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11305,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11305"
      }
    },
    "targetLanguage-f5006a68aa47": {
      "name": "targetLanguage",
      "type": "string",
      "optional": false,
      "description": "The language to translate the audio into, as a BCP-47-style language\ntag (e.g. `en`, `es`, `fr-CA`). Supported values are provider-specific\nand validated by the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11311,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11311"
      }
    },
    "providerOptions-017504595b6e": {
      "name": "providerOptions",
      "type": "Record<string, unknown> | undefined",
      "optional": true,
      "description": "Provider-specific options that are passed through to the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7462,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7462"
      }
    },
    "model-ffb52545b337": {
      "name": "model",
      "type": "RealtimeModelV4",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/factories/VoiceSessionSetup.ts"
      }
    },
    "inputAudioFormat-955d75ed5ca3": {
      "name": "inputAudioFormat",
      "type": "SharedV4AudioFormat | undefined",
      "optional": true,
      "description": "Audio format configuration for input audio.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7380,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7380"
      }
    },
    "voice-7e42c4fa10ac": {
      "name": "voice",
      "type": "string | undefined",
      "optional": true,
      "description": "Voice to use for audio output.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7372,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7372"
      }
    },
    "outputAudioFormat-bc737eb9a538": {
      "name": "outputAudioFormat",
      "type": "SharedV4AudioFormat | undefined",
      "optional": true,
      "description": "Audio format configuration for output audio.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7427,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7427"
      }
    },
    "outputModalities-39bbf6b1aadb": {
      "name": "outputModalities",
      "type": "(\"text\" | \"audio\")[] | undefined",
      "optional": true,
      "description": "Which output modalities the model should produce.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7376,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7376"
      }
    },
    "inputAudioTranscription-bc4eeaf53b51": {
      "name": "inputAudioTranscription",
      "type": "{ model?: string; language?: string; prompt?: string; } | undefined",
      "optional": true,
      "description": "Input audio transcription configuration.\n\nWhen enabled, providers that support input transcription emit normalized\n`input-transcription-completed` events that can be rendered as user\nmessages.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7388,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7388"
      }
    },
    "outputAudioTranscription-d19f1c7d2fa9": {
      "name": "outputAudioTranscription",
      "type": "{ model?: string; language?: string; prompt?: string; } | undefined",
      "optional": true,
      "description": "Output audio transcription configuration.\n\nWhen enabled, providers that support output transcription emit normalized\n`audio-transcript-delta` / `audio-transcript-done` events for the model's\nspoken response. Some providers transcribe output by default; setting this\nmakes the behavior explicit rather than relying on that default.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7410,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7410"
      }
    },
    "turnDetection-8e67b91d87d3": {
      "name": "turnDetection",
      "type": "{ type: \"server-vad\" | \"semantic-vad\" | \"disabled\"; threshold?: number; silenceDurationMs?: number; prefixPaddingMs?: number; } | null | undefined",
      "optional": true,
      "description": "Voice activity detection configuration.\nSet to null or type 'disabled' to turn off VAD (push-to-talk mode).",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7432,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7432"
      }
    },
    "expiresAfterSeconds-f25ee8b0931a": {
      "name": "expiresAfterSeconds",
      "type": "number | undefined",
      "optional": true,
      "description": "Number of seconds until the client secret expires.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7474,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7474"
      }
    },
    "instructions-cda74c669be0": {
      "name": "instructions",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "instructions-4cc81f59e6ac": {
      "name": "instructions",
      "type": "string | undefined",
      "optional": true,
      "description": "System instructions for the model.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7368,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7368"
      }
    },
    "inputSchema-47ed76ea66b3": {
      "name": "inputSchema",
      "type": "SchemaType<Record<string, unknown>>",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "onInputAvailable-0ee077587da3": {
      "name": "onInputAvailable",
      "type": "((options: { input: Record<string, unknown>; } & ToolExecutionOptions<unknown>) => void | PromiseLike<void>) | undefined",
      "optional": true,
      "description": "Optional function that is called when a tool call can be started,\neven if the execute function is not provided.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2282,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L2282"
      }
    },
    "onInputStart-060e54bf784e": {
      "name": "onInputStart",
      "type": "((options: ToolExecutionOptions<unknown>) => void | PromiseLike<void>) | undefined",
      "optional": true,
      "description": "Optional function that is called when the model starts generating the tool input.\nIn non-streaming contexts, it is called immediately before `onInputAvailable`.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2270,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L2270"
      }
    },
    "onInputDelta-ea4168ae0b75": {
      "name": "onInputDelta",
      "type": "((options: { inputTextDelta: string; } & ToolExecutionOptions<unknown>) => void | PromiseLike<void>) | undefined",
      "optional": true,
      "description": "Optional function that is called when an argument streaming delta is available.\nOnly called when the tool is used in a streaming context.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2275,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L2275"
      }
    },
    "needsApproval-e2c793a8ce88": {
      "name": "needsApproval",
      "type": "boolean | ToolNeedsApprovalFunction<Record<string, unknown>, unknown> | undefined",
      "optional": true,
      "description": "Whether the tool needs approval before it can be executed.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Tool approval is handled on a `generateText` / `streamText` level now."
        }
      ],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2265,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L2265"
      }
    },
    "title-6e688f9a6e86": {
      "name": "title",
      "type": "string | undefined",
      "optional": true,
      "description": "An optional title of the tool.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `providerMetadata` for source-specific tool display metadata."
        }
      ],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2229,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L2229"
      }
    },
    "deferLoading-ae9383ee0fa8": {
      "name": "deferLoading",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Defer exposing this tool until it is discovered by `toolSearch`.\nSupports direct calls and local callers that announce tools in conversation\nmessages (code mode with `toolDiscovery: 'conversation'`). Discovered tools\nbecome available on the next model step.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2223,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L2223"
      }
    },
    "providerOptions-42fe4696b43b": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific metadata. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2235,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L2235"
      }
    },
    "metadata-6d9129abab07": {
      "name": "metadata",
      "type": "JSONObject | undefined",
      "optional": true,
      "description": "Optional metadata about the tool itself (e.g. its source).\n\nUnlike `providerOptions`, this metadata is not sent to the language\nmodel. Instead, it is propagated onto the resulting tool call's\n`toolMetadata` so consumers can read it from tool call / result parts\nand UI message parts. This is useful for sources of dynamic tools (e.g.\nan MCP server) to identify themselves.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2245,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L2245"
      }
    },
    "toModelOutput-8f0e85e088c7": {
      "name": "toModelOutput",
      "type": "((options: { toolCallId: string; input: Record<string, unknown>; output: unknown; }) => ToolResultOutput | PromiseLike<ToolResultOutput>) | undefined",
      "optional": true,
      "description": "Optional conversion function that maps the tool result to an output that can be used by the language model.\n\nIf not provided, the tool result will be sent as a JSON object.\n\nThis function is invoked on the server by `convertToModelMessages`, so ensure that you pass the same \"tools\" (ToolSet) to both \"convertToModelMessages\" and \"streamText\" (or other generation APIs).",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2292,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L2292"
      }
    },
    "strict-07a151c197b1": {
      "name": "strict",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Strict mode setting for the tool.\n\nProviders that support strict mode will use this setting to determine\nhow the input should be generated. Strict mode will always produce\nvalid inputs, but it might limit what input schemas are supported.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2332,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L2332"
      }
    },
    "inputExamples-ff69a7242b1e": {
      "name": "inputExamples",
      "type": "{ input: NoInfer<Record<string, unknown>>; }[] | undefined",
      "optional": true,
      "description": "An optional list of input examples that show the language\nmodel what the input should look like.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2337,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L2337"
      }
    },
    "description-e0df7f9e2319": {
      "name": "description",
      "type": "string | ((options: { context: unknown; experimental_sandbox?: SandboxSession; }) => string) | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
    },
    "timeout-1bba377e46d4": {
      "name": "timeout",
      "type": "TimeoutConfiguration<EmptyMap> | undefined",
      "optional": true,
      "description": "Timeout configuration for the request.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 839,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L839"
      }
    },
    "toolChoice-180fe037bbc0": {
      "name": "toolChoice",
      "type": "ToolChoice<EmptyMap> | undefined",
      "optional": true,
      "description": "The tool choice strategy. Default: 'auto'.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3947,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3947"
      }
    },
    "telemetry-678067987faf": {
      "name": "telemetry",
      "type": "TelemetryOptions<Record<string, unknown>, NoInfer<EmptyMap>> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3958,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3958"
      }
    },
    "activeTools-97c193783099": {
      "name": "activeTools",
      "type": "ActiveTools<NoInfer<EmptyMap>>",
      "optional": true,
      "description": "Limits the tools that are available for the model to call without\nchanging the tool call and result types in the result.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3990,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3990"
      }
    },
    "toolOrder-e8ffff15b565": {
      "name": "toolOrder",
      "type": "ToolOrder<NoInfer<EmptyMap>>",
      "optional": true,
      "description": "Controls the order in which tools are sent to the provider.\n\nThe list can be partial. Tools not listed in `toolOrder` are sent after\nthe listed tools, sorted alphabetically. This can improve provider-side\ncaching by keeping tool definitions in a stable order.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3998,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3998"
      }
    },
    "experimental_toolCallers-ff9afda2223d": {
      "name": "experimental_toolCallers",
      "type": "Experimental_ToolCallers<NoInfer<EmptyMap>> | undefined",
      "optional": true,
      "description": "Configures which caller tools may invoke each tool.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4019,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4019"
      }
    },
    "prompt-0bb201e140ef": {
      "name": "prompt",
      "type": "string | SystemModelMessage | UserModelMessage | AssistantModelMessage | ToolModelMessage | ModelMessage[] | (string & SystemModelMessage) | (string & UserModelMessage) | (string & AssistantModelMessage) | (string & ToolModelMessage) | (string & ModelMessage[]) | (SystemModelMessage & string) | (SystemModelMessage & ModelMessage[]) | (UserModelMessage & string) | (UserModelMessage & ModelMessage[]) | (AssistantModelMessage & string) | (AssistantModelMessage & ModelMessage[]) | (ToolModelMessage & string) | (ToolModelMessage & ModelMessage[]) | (ModelMessage[] & string) | (ModelMessage[] & SystemModelMessage) | (ModelMessage[] & UserModelMessage) | (ModelMessage[] & AssistantModelMessage) | (ModelMessage[] & ToolModelMessage) | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/agent.ts"
      }
    },
    "messageHistory-fb9b9d072e86": {
      "name": "messageHistory",
      "type": "readonly ModelMessage[] | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/agent.ts"
      }
    },
    "stopWhen-ff0af44bb75f": {
      "name": "stopWhen",
      "type": "Arrayable<StopCondition<NoInfer<EmptyMap>, Record<string, unknown>>>",
      "optional": true,
      "description": "",
      "tags": []
    },
    "toolApproval-c6b1e240ae25": {
      "name": "toolApproval",
      "type": "ToolApprovalConfiguration<EmptyMap, Record<string, unknown>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "repairToolCall-2a971774557c": {
      "name": "repairToolCall",
      "type": "ToolCallRepairFunction<EmptyMap> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "experimental_refineToolInput-98f7247ec4dd": {
      "name": "experimental_refineToolInput",
      "type": "ToolInputRefinement<NoInfer<EmptyMap>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onStart-64b4743c0ba2": {
      "name": "onStart",
      "type": "GenerateTextOnStartCallback<NoInfer<EmptyMap>, NoInfer<Record<string, unknown>>, NoInfer<Output<string, string, never>>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onStepStart-eb7ccd45b965": {
      "name": "onStepStart",
      "type": "GenerateTextOnStepStartCallback<NoInfer<EmptyMap>, NoInfer<Record<string, unknown>>, NoInfer<Output<string, string, never>>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onLanguageModelCallEnd-6758c6032d86": {
      "name": "onLanguageModelCallEnd",
      "type": "OnLanguageModelCallEndCallback<NoInfer<EmptyMap>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onToolExecutionStart-582c7170e9f4": {
      "name": "onToolExecutionStart",
      "type": "OnToolExecutionStartCallback<NoInfer<EmptyMap>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onToolExecutionEnd-0e3a45072d00": {
      "name": "onToolExecutionEnd",
      "type": "OnToolExecutionEndCallback<NoInfer<EmptyMap>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onStepEnd-41a36140d3f2": {
      "name": "onStepEnd",
      "type": "GenerateTextOnStepEndCallback<NoInfer<EmptyMap>, NoInfer<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onStepError-bcce88d062ae": {
      "name": "onStepError",
      "type": "GenerateTextOnStepErrorCallback<NoInfer<EmptyMap>, NoInfer<Record<string, unknown>>, NoInfer<Output<string, string, never>>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onEnd-457c295e22f5": {
      "name": "onEnd",
      "type": "StreamTextOnEndCallback<NoInfer<EmptyMap>, NoInfer<Record<string, unknown>>, NoInfer<Output<string, string, never>>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "experimental_transform-7216d3f250a7": {
      "name": "experimental_transform",
      "type": "Arrayable<StreamTextTransform<EmptyMap>>",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onChunk-776bfe13cff3": {
      "name": "onChunk",
      "type": "StreamTextOnChunkCallback<EmptyMap> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "onAbort-e8b00af800f1": {
      "name": "onAbort",
      "type": "StreamTextOnAbortCallback<NoInfer<EmptyMap>, NoInfer<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "prepareCall-80fbe84c6775": {
      "name": "prepareCall",
      "type": "PrepareCall<{}, false> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/agent.ts"
      }
    },
    "prepareStep-8ac0218841fa": {
      "name": "prepareStep",
      "type": "PrepareStep<{}, false> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/agent.ts"
      }
    },
    "tools-fdfe05249bc3": {
      "name": "tools",
      "type": "RunTools<{}> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/agent.ts"
      }
    },
    "model-9cc84a88e236": {
      "name": "model",
      "type": "ModelOverride | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/agent.ts"
      }
    },
    "options-37bd75580b6d": {
      "name": "options",
      "type": "unknown",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5352,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5352"
      }
    },
    "prompt-1ffdc31f366f": {
      "name": "prompt",
      "type": "string | ModelMessage[] | undefined",
      "optional": true,
      "description": "A prompt. It can be either a text prompt or a list of messages.\n\nYou can either use `prompt` or `messages` but not both.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5359,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5359"
      }
    },
    "messages-df6f076db158": {
      "name": "messages",
      "type": "ModelMessage[] | undefined",
      "optional": true,
      "description": "A list of messages.\n\nYou can either use `prompt` or `messages` but not both.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5365,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5365"
      }
    },
    "abortSignal-52561c51f595": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5383,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5383"
      }
    },
    "timeout-2b6830ecfea3": {
      "name": "timeout",
      "type": "TimeoutConfiguration<{}> | undefined",
      "optional": true,
      "description": "Timeout in milliseconds. Can be specified as a number or as an object\nwith total, per-step, first-content, inter-content, and tool timeouts.\nFirst-content and inter-content timeouts are only enforced by streaming\ncalls.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5390,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5390"
      }
    },
    "onStart-aef48ea7e7b4": {
      "name": "onStart",
      "type": "GenerateTextOnStartCallback<{}, Context, Output<any, any, any>> | undefined",
      "optional": true,
      "description": "Callback that is called when the agent operation begins, before any LLM calls.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5394,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5394"
      }
    },
    "experimental_onStart-bb23f034eb71": {
      "name": "experimental_onStart",
      "type": "GenerateTextOnStartCallback<{}, Context, Output<any, any, any>> | undefined",
      "optional": true,
      "description": "Callback that is called when the agent operation begins, before any LLM calls.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5400,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5400"
      }
    },
    "onStepStart-4eac7e85c7c3": {
      "name": "onStepStart",
      "type": "GenerateTextOnStepStartCallback<{}, Context, Output<any, any, any>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step (LLM call) begins, before the provider is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5404,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5404"
      }
    },
    "experimental_onStepStart-97ac29c27fbe": {
      "name": "experimental_onStepStart",
      "type": "GenerateTextOnStepStartCallback<{}, Context, Output<any, any, any>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step (LLM call) begins, before the provider is called.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onStepStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5410,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5410"
      }
    },
    "onToolExecutionStart-e4f0d33f9232": {
      "name": "onToolExecutionStart",
      "type": "OnToolExecutionStartCallback<{}> | undefined",
      "optional": true,
      "description": "Callback that is called before each tool execution begins.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5414,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5414"
      }
    },
    "experimental_onToolCallStart-edf35f9005ce": {
      "name": "experimental_onToolCallStart",
      "type": "OnToolExecutionStartCallback<{}> | undefined",
      "optional": true,
      "description": "Callback that is called before each tool execution begins.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onToolExecutionStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5420,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5420"
      }
    },
    "onToolExecutionEnd-7a5b4146deff": {
      "name": "onToolExecutionEnd",
      "type": "OnToolExecutionEndCallback<{}> | undefined",
      "optional": true,
      "description": "Callback that is called after each tool execution completes.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5424,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5424"
      }
    },
    "experimental_onToolCallFinish-3717e6bbaa7d": {
      "name": "experimental_onToolCallFinish",
      "type": "OnToolExecutionEndCallback<{}> | undefined",
      "optional": true,
      "description": "Callback that is called after each tool execution completes.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onToolExecutionEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5430,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5430"
      }
    },
    "onStepEnd-c19ef6fba098": {
      "name": "onStepEnd",
      "type": "GenerateTextOnStepEndCallback<{}, Context> | undefined",
      "optional": true,
      "description": "Callback that is called when each step (LLM call) ends, including intermediate steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5434,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5434"
      }
    },
    "onStepFinish-570883b7dcbd": {
      "name": "onStepFinish",
      "type": "GenerateTextOnStepFinishCallback<{}, Context> | undefined",
      "optional": true,
      "description": "Callback that is called when each step (LLM call) ends, including intermediate steps.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onStepEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5440,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5440"
      }
    },
    "onEnd-f2ea97395729": {
      "name": "onEnd",
      "type": "GenerateTextOnEndCallback<{}, Context> | undefined",
      "optional": true,
      "description": "Callback that is called when all steps are finished and the response is complete.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5444,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5444"
      }
    },
    "onFinish-70e885571273": {
      "name": "onFinish",
      "type": "GenerateTextOnEndCallback<{}, Context> | undefined",
      "optional": true,
      "description": "Callback that is called when all steps are finished and the response is complete.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5450,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5450"
      }
    },
    "experimental_sandbox-7a420260cec2": {
      "name": "experimental_sandbox",
      "type": "SandboxSession | undefined",
      "optional": true,
      "description": "The sandbox environment that is passed through to tool execution.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5454,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5454"
      }
    },
    "timeout-9e14af0b9943": {
      "name": "timeout",
      "type": "TimeoutConfiguration<ToolSet> | undefined",
      "optional": true,
      "description": "Timeout in milliseconds. Can be specified as a number or as an object\nwith total, per-step, first-content, inter-content, and tool timeouts.\nFirst-content and inter-content timeouts are only enforced by streaming\ncalls.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5390,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5390"
      }
    },
    "onStart-9ac541be5597": {
      "name": "onStart",
      "type": "GenerateTextOnStartCallback<ToolSet, Context, Output<any, any, any>> | undefined",
      "optional": true,
      "description": "Callback that is called when the agent operation begins, before any LLM calls.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5394,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5394"
      }
    },
    "experimental_onStart-8b450fd7696a": {
      "name": "experimental_onStart",
      "type": "GenerateTextOnStartCallback<ToolSet, Context, Output<any, any, any>> | undefined",
      "optional": true,
      "description": "Callback that is called when the agent operation begins, before any LLM calls.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5400,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5400"
      }
    },
    "onStepStart-47b571f98d6a": {
      "name": "onStepStart",
      "type": "GenerateTextOnStepStartCallback<ToolSet, Context, Output<any, any, any>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step (LLM call) begins, before the provider is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5404,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5404"
      }
    },
    "experimental_onStepStart-73171b13a668": {
      "name": "experimental_onStepStart",
      "type": "GenerateTextOnStepStartCallback<ToolSet, Context, Output<any, any, any>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step (LLM call) begins, before the provider is called.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onStepStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5410,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5410"
      }
    },
    "onToolExecutionStart-44653cbecfb4": {
      "name": "onToolExecutionStart",
      "type": "OnToolExecutionStartCallback<ToolSet> | undefined",
      "optional": true,
      "description": "Callback that is called before each tool execution begins.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5414,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5414"
      }
    },
    "experimental_onToolCallStart-31c7d68b5570": {
      "name": "experimental_onToolCallStart",
      "type": "OnToolExecutionStartCallback<ToolSet> | undefined",
      "optional": true,
      "description": "Callback that is called before each tool execution begins.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onToolExecutionStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5420,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5420"
      }
    },
    "onToolExecutionEnd-73d3571a0e34": {
      "name": "onToolExecutionEnd",
      "type": "OnToolExecutionEndCallback<ToolSet> | undefined",
      "optional": true,
      "description": "Callback that is called after each tool execution completes.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5424,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5424"
      }
    },
    "experimental_onToolCallFinish-e743e6d45d56": {
      "name": "experimental_onToolCallFinish",
      "type": "OnToolExecutionEndCallback<ToolSet> | undefined",
      "optional": true,
      "description": "Callback that is called after each tool execution completes.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onToolExecutionEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5430,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5430"
      }
    },
    "onStepEnd-38a1e56505af": {
      "name": "onStepEnd",
      "type": "GenerateTextOnStepEndCallback<ToolSet, Context> | undefined",
      "optional": true,
      "description": "Callback that is called when each step (LLM call) ends, including intermediate steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5434,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5434"
      }
    },
    "onStepFinish-749f084a3582": {
      "name": "onStepFinish",
      "type": "GenerateTextOnStepFinishCallback<ToolSet, Context> | undefined",
      "optional": true,
      "description": "Callback that is called when each step (LLM call) ends, including intermediate steps.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onStepEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5440,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5440"
      }
    },
    "onEnd-5c5601675cd4": {
      "name": "onEnd",
      "type": "GenerateTextOnEndCallback<ToolSet, Context> | undefined",
      "optional": true,
      "description": "Callback that is called when all steps are finished and the response is complete.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5444,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5444"
      }
    },
    "onFinish-3a20cbb9bf1e": {
      "name": "onFinish",
      "type": "GenerateTextOnEndCallback<ToolSet, Context> | undefined",
      "optional": true,
      "description": "Callback that is called when all steps are finished and the response is complete.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5450,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5450"
      }
    },
    "experimental_transform-4d7fc66a5495": {
      "name": "experimental_transform",
      "type": "Arrayable<StreamTextTransform<ToolSet>>",
      "optional": true,
      "description": "Optional stream transformations.\nThey are applied in the order they are provided.\nThe stream transformations must maintain the stream structure for streamText to work correctly.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5465,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5465"
      }
    },
    "abortSignal-fc62ed60653c": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 830,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L830"
      }
    },
    "system-172f838ea9ab": {
      "name": "system",
      "type": "Instructions | undefined",
      "optional": true,
      "description": "Instructions to include in the prompt. Can be used with `prompt` or `messages`.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `instructions` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 868,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L868"
      }
    },
    "prompt-da6f2a5e577b": {
      "name": "prompt",
      "type": "string | ModelMessage[] | undefined",
      "optional": true,
      "description": "A prompt. It can be either a text prompt or a list of messages.\n\nYou can either use `prompt` or `messages` but not both.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 884,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L884"
      }
    },
    "messages-4821e5bed3b2": {
      "name": "messages",
      "type": "ModelMessage[] | undefined",
      "optional": true,
      "description": "A list of messages.\n\nYou can either use `prompt` or `messages` but not both.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 890,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L890"
      }
    },
    "tools-c7e657498fc5": {
      "name": "tools",
      "type": "ToolSet | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3768,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3768"
      }
    },
    "toolsContext-84d563e92fb8": {
      "name": "toolsContext",
      "type": "undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3758,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3758"
      }
    },
    "model-bcb922cd8d09": {
      "name": "model",
      "type": "LanguageModel",
      "optional": false,
      "description": "The language model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5597,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5597"
      }
    },
    "toolChoice-e966120430af": {
      "name": "toolChoice",
      "type": "ToolChoice<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "The tool choice strategy. Default: 'auto'.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5601,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5601"
      }
    },
    "stopWhen-58682c71d97a": {
      "name": "stopWhen",
      "type": "Arrayable<StopCondition<NoInfer<ToolSet>, Context>>",
      "optional": true,
      "description": "Condition for stopping the generation when there are tool results in the last step.\nWhen the condition is an array, any of the conditions can be met to stop the generation.",
      "tags": [
        {
          "name": "default",
          "text": "isStepCount(1)"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5608,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5608"
      }
    },
    "telemetry-426b4fc5106b": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5612,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5612"
      }
    },
    "experimental_telemetry-a9e7af1f89df": {
      "name": "experimental_telemetry",
      "type": "TelemetryOptions<Context, NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `telemetry` instead. This alias will be removed in a future major release."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5618,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5618"
      }
    },
    "providerOptions-84c631799d17": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5624,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5624"
      }
    },
    "experimental_sandbox-99c3bd2e8aa3": {
      "name": "experimental_sandbox",
      "type": "SandboxSession | undefined",
      "optional": true,
      "description": "The sandbox environment that is passed through to tool execution.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5628,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5628"
      }
    },
    "experimental_steering-5a09c397514b": {
      "name": "experimental_steering",
      "type": "Steering | undefined",
      "optional": true,
      "description": "A steering object created with `experimental_createSteering()`.\nMessages sent with it are added to the generation at the next step\nboundary.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5634,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5634"
      }
    },
    "runtimeContext-4a749ca4bd3e": {
      "name": "runtimeContext",
      "type": "Context | undefined",
      "optional": true,
      "description": "Runtime context. Treat runtime context as immutable.\nIf you need to mutate runtime context, update it in `prepareStep`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5639,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5639"
      }
    },
    "activeTools-40780df8380f": {
      "name": "activeTools",
      "type": "ActiveTools<NoInfer<ToolSet>>",
      "optional": true,
      "description": "Limits the tools that are available for the model to call without\nchanging the tool call and result types in the result.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5644,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5644"
      }
    },
    "toolOrder-3e1ebf5c6c12": {
      "name": "toolOrder",
      "type": "ToolOrder<NoInfer<ToolSet>>",
      "optional": true,
      "description": "Controls the order in which tools are sent to the provider.\n\nThe list can be partial. Tools not listed in `toolOrder` are sent after\nthe listed tools, sorted alphabetically. This can improve provider-side\ncaching by keeping tool definitions in a stable order.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5652,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5652"
      }
    },
    "toolCallConcurrency-b74f772b74e0": {
      "name": "toolCallConcurrency",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of tool calls that may execute concurrently within a step.\n\nSet to `1` to execute tool calls sequentially in the order they were\ngenerated. By default, all tool calls execute concurrently.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5659,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5659"
      }
    },
    "output-e60b98f327bb": {
      "name": "output",
      "type": "Output<any, any, any> | undefined",
      "optional": true,
      "description": "Optional specification for parsing structured outputs from the LLM response.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5663,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5663"
      }
    },
    "toolApproval-172adab271f3": {
      "name": "toolApproval",
      "type": "ToolApprovalConfiguration<ToolSet, Context> | undefined",
      "optional": true,
      "description": "Optional tool approval configuration.\n\nThis configuration takes precedence over tool-defined approval settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5669,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5669"
      }
    },
    "experimental_toolCallers-1828a8c45edd": {
      "name": "experimental_toolCallers",
      "type": "Experimental_ToolCallers<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Configures which caller tools may invoke each tool.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5673,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5673"
      }
    },
    "experimental_toolApprovalSecret-605bca05f581": {
      "name": "experimental_toolApprovalSecret",
      "type": "string | Uint8Array<ArrayBufferLike> | undefined",
      "optional": true,
      "description": "Secret for HMAC-signing tool approval requests. When set, the server\nsigns each approval request at issuance and verifies the signature when\nthe approval is replayed, preventing client-forged approvals.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5679,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5679"
      }
    },
    "experimental_download-a484b37b0e10": {
      "name": "experimental_download",
      "type": "DownloadFunction | undefined",
      "optional": true,
      "description": "Custom download function to use for URLs.\n\nBy default, files are downloaded if the model does not support the URL for the given media type.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5685,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5685"
      }
    },
    "prepareStep-722de7983b61": {
      "name": "prepareStep",
      "type": "PrepareStepFunction<NoInfer<ToolSet>, Context> | undefined",
      "optional": true,
      "description": "Optional function that you can use to provide different settings for a step.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5689,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5689"
      }
    },
    "repairToolCall-90618d4db5d0": {
      "name": "repairToolCall",
      "type": "ToolCallRepairFunction<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "A function that attempts to repair a tool call that failed to parse.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5693,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5693"
      }
    },
    "experimental_repairToolCall-8b5571b91327": {
      "name": "experimental_repairToolCall",
      "type": "ToolCallRepairFunction<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "A function that attempts to repair a tool call that failed to parse.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `repairToolCall` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5699,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5699"
      }
    },
    "experimental_refineToolInput-47f3c0fd9da8": {
      "name": "experimental_refineToolInput",
      "type": "ToolInputRefinement<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Optional mapping of tool names to functions that refine parsed tool inputs.\n\nThe refined input must have the same type shape as the tool input. Refined\ninputs are used for tool execution, outputs, callbacks, and telemetry.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5706,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5706"
      }
    },
    "onStart-04bef8beb81a": {
      "name": "onStart",
      "type": "GenerateTextOnStartCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the generateText operation begins,\nbefore any LLM calls are made.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5711,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5711"
      }
    },
    "experimental_onStart-e62aaae29cc6": {
      "name": "experimental_onStart",
      "type": "GenerateTextOnStartCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the generateText operation begins,\nbefore any LLM calls are made.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5718,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5718"
      }
    },
    "onStepStart-f84d162aacac": {
      "name": "onStepStart",
      "type": "GenerateTextOnStepStartCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step (LLM call) begins,\nbefore the provider is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5723,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5723"
      }
    },
    "experimental_onStepStart-028c613cdafb": {
      "name": "experimental_onStepStart",
      "type": "GenerateTextOnStepStartCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step (LLM call) begins,\nbefore the provider is called.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onStepStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5730,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5730"
      }
    },
    "onLanguageModelCallStart-5a20308df072": {
      "name": "onLanguageModelCallStart",
      "type": "OnLanguageModelCallStartCallback | undefined",
      "optional": true,
      "description": "Callback that is called immediately before the provider model call begins.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5734,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5734"
      }
    },
    "experimental_onLanguageModelCallStart-220a502fe06c": {
      "name": "experimental_onLanguageModelCallStart",
      "type": "OnLanguageModelCallStartCallback | undefined",
      "optional": true,
      "description": "Callback that is called immediately before the provider model call begins.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onLanguageModelCallStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5740,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5740"
      }
    },
    "onLanguageModelCallEnd-d5815d586cf9": {
      "name": "onLanguageModelCallEnd",
      "type": "OnLanguageModelCallEndCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called after the model response has been normalized and parsed,\nbut before any client-side tool execution begins.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5745,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5745"
      }
    },
    "experimental_onLanguageModelCallEnd-09ab6ee2dbab": {
      "name": "experimental_onLanguageModelCallEnd",
      "type": "OnLanguageModelCallEndCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called after the model response has been normalized and parsed,\nbut before any client-side tool execution begins.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onLanguageModelCallEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5752,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5752"
      }
    },
    "onToolExecutionStart-759b258f7ebb": {
      "name": "onToolExecutionStart",
      "type": "OnToolExecutionStartCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called right before a tool's execute function runs.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5756,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5756"
      }
    },
    "experimental_onToolCallStart-8d8e55310f46": {
      "name": "experimental_onToolCallStart",
      "type": "OnToolExecutionStartCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called right before a tool's execute function runs.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onToolExecutionStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5762,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5762"
      }
    },
    "onToolExecutionEnd-7103c945dc4c": {
      "name": "onToolExecutionEnd",
      "type": "OnToolExecutionEndCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called right after a tool's execute function completes (or errors).",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5766,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5766"
      }
    },
    "experimental_onToolCallFinish-bab0dfda3943": {
      "name": "experimental_onToolCallFinish",
      "type": "OnToolExecutionEndCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called right after a tool's execute function completes (or errors).",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onToolExecutionEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5772,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5772"
      }
    },
    "onStepEnd-7464be587786": {
      "name": "onStepEnd",
      "type": "GenerateTextOnStepEndCallback<NoInfer<ToolSet>, NoInfer<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when each step (LLM call) ends, including intermediate steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5776,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5776"
      }
    },
    "onStepError-ff3b402b51ab": {
      "name": "onStepError",
      "type": "GenerateTextOnStepErrorCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step that started fails before it\nproduces a step result. `onStepEnd` is not called for such a step.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5781,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5781"
      }
    },
    "onStepFinish-08052cbd0975": {
      "name": "onStepFinish",
      "type": "GenerateTextOnStepFinishCallback<NoInfer<ToolSet>, NoInfer<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when each step (LLM call) ends, including intermediate steps.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onStepEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5787,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5787"
      }
    },
    "onEnd-88496c796bd5": {
      "name": "onEnd",
      "type": "GenerateTextOnEndCallback<NoInfer<ToolSet>, NoInfer<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when all steps are finished and the response is complete.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5791,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5791"
      }
    },
    "onFinish-bba008f25f73": {
      "name": "onFinish",
      "type": "GenerateTextOnEndCallback<NoInfer<ToolSet>, NoInfer<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when all steps are finished and the response is complete.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5797,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5797"
      }
    },
    "include-08574c6232c5": {
      "name": "include",
      "type": "GenerateTextInclude | undefined",
      "optional": true,
      "description": "Settings for controlling what data is included in step results.\nDisabling inclusion can help reduce memory usage when processing\nlarge payloads like images.\n\nBy default, request bodies, request messages, and response bodies are\nexcluded.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5806,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5806"
      }
    },
    "experimental_include-61e712cf0599": {
      "name": "experimental_include",
      "type": "GenerateTextInclude | undefined",
      "optional": true,
      "description": "Settings for controlling what data is included in step results.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `include` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5812,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5812"
      }
    },
    "_internal-f6a277d4bac6": {
      "name": "_internal",
      "type": "{ generateId?: IdGenerator; generateCallId?: IdGenerator; now?: () => number; } | undefined",
      "optional": true,
      "description": "Internal. For test use only. May change without notice.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5816,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5816"
      }
    },
    "stopWhen-061b01707f0c": {
      "name": "stopWhen",
      "type": "Arrayable<StopCondition<NoInfer<ToolSet>, Context>>",
      "optional": true,
      "description": "Condition for stopping the generation when there are tool results in the last step.\nWhen the condition is an array, any of the conditions can be met to stop the generation.",
      "tags": [
        {
          "name": "default",
          "text": "isStepCount(1)"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3954,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3954"
      }
    },
    "telemetry-c4d62b940351": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3958,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3958"
      }
    },
    "experimental_telemetry-b6b99a209d23": {
      "name": "experimental_telemetry",
      "type": "TelemetryOptions<Context, NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `telemetry` instead. This alias will be removed in a future major release."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3964,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3964"
      }
    },
    "runtimeContext-ded6f4342986": {
      "name": "runtimeContext",
      "type": "Context | undefined",
      "optional": true,
      "description": "Runtime context. Treat runtime context as immutable.\nIf you need to mutate runtime context, update it in `prepareStep`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3985,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3985"
      }
    },
    "output-fe44a89cb056": {
      "name": "output",
      "type": "Output<any, any, any> | undefined",
      "optional": true,
      "description": "Optional specification for parsing structured outputs from the LLM response.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4009,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4009"
      }
    },
    "toolApproval-ed5d414f0f62": {
      "name": "toolApproval",
      "type": "ToolApprovalConfiguration<ToolSet, Context> | undefined",
      "optional": true,
      "description": "Optional tool approval configuration.\n\nThis configuration takes precedence over tool-defined approval settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4015,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4015"
      }
    },
    "prepareStep-7d67e4ce16c8": {
      "name": "prepareStep",
      "type": "PrepareStepFunction<NoInfer<ToolSet>, Context> | undefined",
      "optional": true,
      "description": "Optional function that you can use to provide different settings for a step.",
      "tags": [
        {
          "name": "param",
          "text": "options - The options for the step."
        },
        {
          "name": "param",
          "text": "options.steps - The steps that have been executed so far."
        },
        {
          "name": "param",
          "text": "options.stepNumber - The number of the step that is being executed."
        },
        {
          "name": "param",
          "text": "options.model - The model that is being used."
        },
        {
          "name": "returns",
          "text": "An object that contains the settings for the step.\nIf you return undefined (or for undefined settings), the settings from the outer level will be used."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4037,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4037"
      }
    },
    "experimental_repairToolCall-e8fd40680c55": {
      "name": "experimental_repairToolCall",
      "type": "ToolCallRepairFunction<ToolSet> | undefined",
      "optional": true,
      "description": "A function that attempts to repair a tool call that failed to parse.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `repairToolCall` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4047,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4047"
      }
    },
    "includeRawChunks-4927cd9740df": {
      "name": "includeRawChunks",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Whether to include raw chunks from the provider in the stream.\nWhen enabled, you will receive raw chunks with type 'raw' that contain the unprocessed data from the provider.\nThis allows access to cutting-edge provider features not yet wrapped by the AI SDK.\nDefaults to false.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `include.rawChunks` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4075,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4075"
      }
    },
    "onEnd-ef461f83e3bb": {
      "name": "onEnd",
      "type": "StreamTextOnEndCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the LLM response and all request tool executions\n(for tools that have an `execute` function) are finished.\n\nThe usage is the combined usage of all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4115,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4115"
      }
    },
    "onFinish-f20459a0ea53": {
      "name": "onFinish",
      "type": "StreamTextOnEndCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the LLM response and all request tool executions\n(for tools that have an `execute` function) are finished.\n\nThe usage is the combined usage of all steps.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4124,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4124"
      }
    },
    "onAbort-c24d17adc5f3": {
      "name": "onAbort",
      "type": "StreamTextOnAbortCallback<NoInfer<ToolSet>, NoInfer<Context>> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4125,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4125"
      }
    },
    "onStepEnd-d8e8f0f2289a": {
      "name": "onStepEnd",
      "type": "GenerateTextOnStepEndCallback<NoInfer<ToolSet>, NoInfer<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when each step (LLM call) ends, including intermediate steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4129,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4129"
      }
    },
    "onStepError-6ac92c5732e1": {
      "name": "onStepError",
      "type": "GenerateTextOnStepErrorCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step that started fails before it\nproduces a step result. `onStepEnd` is not called for such a step.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4134,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4134"
      }
    },
    "onStepFinish-a6df59245cbd": {
      "name": "onStepFinish",
      "type": "GenerateTextOnStepFinishCallback<NoInfer<ToolSet>, NoInfer<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when each step (LLM call) ends, including intermediate steps.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onStepEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4140,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4140"
      }
    },
    "onStart-57baf4db48d0": {
      "name": "onStart",
      "type": "GenerateTextOnStartCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the streamText operation begins,\nbefore any LLM calls are made.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4145,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4145"
      }
    },
    "experimental_onStart-98bf0b5a2745": {
      "name": "experimental_onStart",
      "type": "GenerateTextOnStartCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the streamText operation begins,\nbefore any LLM calls are made.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4152,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4152"
      }
    },
    "onStepStart-9ebb7d08a587": {
      "name": "onStepStart",
      "type": "GenerateTextOnStepStartCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step (LLM call) begins,\nbefore the provider is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4157,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4157"
      }
    },
    "experimental_onStepStart-15e8aea9fae2": {
      "name": "experimental_onStepStart",
      "type": "GenerateTextOnStepStartCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step (LLM call) begins,\nbefore the provider is called.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onStepStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4164,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4164"
      }
    },
    "experimental_onLanguageModelCallStart-491395c8a913": {
      "name": "experimental_onLanguageModelCallStart",
      "type": "OnLanguageModelCallStartCallback | undefined",
      "optional": true,
      "description": "Callback that is called immediately before the provider model call begins.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onLanguageModelCallStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4174,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4174"
      }
    },
    "experimental_onLanguageModelCallEnd-a09d59f7a599": {
      "name": "experimental_onLanguageModelCallEnd",
      "type": "OnLanguageModelCallEndCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called after the model response has been normalized and parsed,\nbut before any client-side tool execution begins.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onLanguageModelCallEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4186,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4186"
      }
    },
    "experimental_onToolCallStart-3976f3ffdb21": {
      "name": "experimental_onToolCallStart",
      "type": "OnToolExecutionStartCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called right before a tool's execute function runs.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onToolExecutionStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4196,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4196"
      }
    },
    "experimental_onToolCallFinish-08b7141b6862": {
      "name": "experimental_onToolCallFinish",
      "type": "OnToolExecutionEndCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called right after a tool's execute function completes (or errors).",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onToolExecutionEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4206,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4206"
      }
    },
    "experimental_include-c911c6b3941e": {
      "name": "experimental_include",
      "type": "StreamTextInclude | undefined",
      "optional": true,
      "description": "Settings for controlling what data is included in step results.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `include` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4220,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4220"
      }
    },
    "_internal-2797c17b47fe": {
      "name": "_internal",
      "type": "{ now?: () => number; generateId?: IdGenerator; generateCallId?: IdGenerator; retention?: StreamTextRetention; } | undefined",
      "optional": true,
      "description": "Internal. For test use only. May change without notice.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4224,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4224"
      }
    },
    "replayAsyncIterables-08bd2e383475": {
      "name": "replayAsyncIterables",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Set false to disable automatic async loop replay. Sequential loops close on early exit. Default: true.",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "autoescape-19ef6c31974b": {
      "name": "autoescape",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "throwOnUndefined-c31e1e20c542": {
      "name": "throwOnUndefined",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "trimBlocks-1cbedc8066bc": {
      "name": "trimBlocks",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "lstripBlocks-d9932524bb24": {
      "name": "lstripBlocks",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "watch-9dc748ac9d7d": {
      "name": "watch",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "noCache-4c9b4c901eb7": {
      "name": "noCache",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "dev-14d5494fcdff": {
      "name": "dev",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "web-284a273e5641": {
      "name": "web",
      "type": "{ useCache?: boolean | undefined; async?: boolean | undefined; } | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "express-fa9408561b49": {
      "name": "express",
      "type": "object | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "tags-3d4ec07f1a22": {
      "name": "tags",
      "type": "{ blockStart?: string | undefined; blockEnd?: string | undefined; variableStart?: string | undefined; variableEnd?: string | undefined; commentStart?: string | undefined; commentEnd?: string | undefined; } | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "abortSignal-2bf31b7f87fc": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "An optional abort signal that indicates that the overall operation should be aborted.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2132,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L2132"
      }
    },
    "experimental_sandbox-0dfa76df5e3e": {
      "name": "experimental_sandbox",
      "type": "SandboxSession | undefined",
      "optional": true,
      "description": "The sandbox environment that the tool is operating in.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2148,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L2148"
      }
    },
    "toolCallId-b3e91af1743a": {
      "name": "toolCallId",
      "type": "string | undefined",
      "optional": true,
      "description": "The ID of the tool call. You can use it e.g. when sending tool-call related information with stream data.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2123,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L2123"
      }
    },
    "messages-f97f28a7fbbb": {
      "name": "messages",
      "type": "ModelMessage[] | undefined",
      "optional": true,
      "description": "Messages that were sent to the language model to initiate the response that contained the tool call.\nThe messages **do not** include the system prompt nor the assistant response that contained the tool call.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2128,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L2128"
      }
    },
    "array-a50da8c00109": {
      "name": "array",
      "type": "<ELEMENT>({ element: inputElementSchema, minItems, maxItems, name, description }: { element: FlexibleSchema<ELEMENT>; minItems?: number; maxItems?: number; name?: string; description?: string; }) => Output<Array<ELEMENT>, Array<ELEMENT>, ELEMENT>",
      "optional": false,
      "description": "Output specification for array generation.\nWhen the model generates a text response, it will return an array of elements.",
      "tags": [
        {
          "name": "param",
          "text": "element - The schema of the array elements to generate."
        },
        {
          "name": "param",
          "text": "minItems - Optional minimum number of elements to generate."
        },
        {
          "name": "param",
          "text": "maxItems - Optional maximum number of elements to generate."
        },
        {
          "name": "param",
          "text": "name - Optional name of the output that should be generated. Used by some providers for additional LLM guidance, e.g. via tool or schema name."
        },
        {
          "name": "param",
          "text": "description - Optional description of the output that should be generated. Used by some providers for additional LLM guidance, e.g. via tool or schema description."
        },
        {
          "name": "returns",
          "text": "An output specification for generating an array of elements."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4313,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4313"
      }
    },
    "choice-89fbb2824793": {
      "name": "choice",
      "type": "<CHOICE extends string>({ options: choiceOptions, name, description }: { options: Array<CHOICE>; name?: string; description?: string; }) => Output<CHOICE, CHOICE, never>",
      "optional": false,
      "description": "Output specification for choice generation.\nWhen the model generates a text response, it will return one of the choice options.",
      "tags": [
        {
          "name": "param",
          "text": "options - The available choices."
        },
        {
          "name": "param",
          "text": "name - Optional name of the output that should be generated. Used by some providers for additional LLM guidance, e.g. via tool or schema name."
        },
        {
          "name": "param",
          "text": "description - Optional description of the output that should be generated. Used by some providers for additional LLM guidance, e.g. via tool or schema description."
        },
        {
          "name": "returns",
          "text": "An output specification for generating a choice."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4344,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4344"
      }
    },
    "json-56015e6681ff": {
      "name": "json",
      "type": "({ name, description }?: { name?: string; description?: string; }) => Output<JSONValue, JSONValue, never>",
      "optional": false,
      "description": "Output specification for unstructured JSON generation.\nWhen the model generates a text response, it will return a JSON object.",
      "tags": [
        {
          "name": "param",
          "text": "name - Optional name of the output that should be generated. Used by some providers for additional LLM guidance, e.g. via tool or schema name."
        },
        {
          "name": "param",
          "text": "description - Optional description of the output that should be generated. Used by some providers for additional LLM guidance, e.g. via tool or schema description."
        },
        {
          "name": "returns",
          "text": "An output specification for generating JSON."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4366,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4366"
      }
    },
    "object-fb3d199946ca": {
      "name": "object",
      "type": "<OBJECT>({ schema: inputSchema, name, description }: { schema: FlexibleSchema<OBJECT>; name?: string; description?: string; }) => Output<OBJECT, DeepPartial<OBJECT>, never>",
      "optional": false,
      "description": "Output specification for typed object generation using schemas.\nWhen the model generates a text response, it will return an object that matches the schema.",
      "tags": [
        {
          "name": "param",
          "text": "schema - The schema of the object to generate."
        },
        {
          "name": "param",
          "text": "name - Optional name of the output that should be generated. Used by some providers for additional LLM guidance, e.g. via tool or schema name."
        },
        {
          "name": "param",
          "text": "description - Optional description of the output that should be generated. Used by some providers for additional LLM guidance, e.g. via tool or schema description."
        },
        {
          "name": "returns",
          "text": "An output specification for generating objects with the specified schema."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4288,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4288"
      }
    },
    "text-2dba2c59564f": {
      "name": "text",
      "type": "() => Output<string, string, never>",
      "optional": false,
      "description": "Output specification for text generation.\nThis is the default output mode that generates plain text.",
      "tags": [
        {
          "name": "returns",
          "text": "An output specification for generating text."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4277,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4277"
      }
    },
    "tools-a0a46f619d2a": {
      "name": "tools",
      "type": "RealtimeModelV4ToolDefinition[] | undefined",
      "optional": true,
      "description": "Tool definitions available to the model in this session.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7458,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7458"
      }
    },
    "sessionId-b384762552aa": {
      "name": "sessionId",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7861,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7861"
      }
    },
    "sdp-6a765cb22ad4": {
      "name": "sdp",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7862,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7862"
      }
    },
    "content-2a8a29548036": {
      "name": "content",
      "type": "ContentPart<ToolSet>[]",
      "optional": false,
      "description": "The content that was generated in all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5224,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5224"
      }
    },
    "text-925a2201a0e9": {
      "name": "text",
      "type": "string",
      "optional": false,
      "description": "The concatenation of all text parts generated in the final step.\nIt is an empty string if the final step contains no text parts.\nInspect `finalStep.content` to distinguish that case.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5230,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5230"
      }
    },
    "reasoning-c999ae832ad1": {
      "name": "reasoning",
      "type": "(ReasoningOutput | ReasoningFileOutput)[]",
      "optional": false,
      "description": "The full reasoning that the model has generated in the last step.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `finalStep.reasoning` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5236,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5236"
      }
    },
    "reasoningText-37eedd3b6264": {
      "name": "reasoningText",
      "type": "string | undefined",
      "optional": false,
      "description": "The reasoning text that the model has generated in the last step. Can be undefined if the model\nhas only generated text.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `finalStep.reasoningText` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5243,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5243"
      }
    },
    "files-0e94b2d13dfd": {
      "name": "files",
      "type": "GeneratedFile[]",
      "optional": false,
      "description": "The files that were generated in all steps.\nEmpty array if no files were generated.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5248,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5248"
      }
    },
    "sources-a83f0411473e": {
      "name": "sources",
      "type": "LanguageModelV4Source[]",
      "optional": false,
      "description": "Sources that have been used as references in all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5252,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5252"
      }
    },
    "toolCalls-b8abddbc1a19": {
      "name": "toolCalls",
      "type": "TypedToolCall<ToolSet>[]",
      "optional": false,
      "description": "The tool calls that were made in all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5256,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5256"
      }
    },
    "staticToolCalls-4700a386356d": {
      "name": "staticToolCalls",
      "type": "(BaseToolCall & { toolName: string; input: any; dynamic?: false | undefined; invalid?: false | undefined; error?: never; title?: string; })[]",
      "optional": false,
      "description": "The static tool calls that were made in all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5260,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5260"
      }
    },
    "dynamicToolCalls-9598dbe74c2d": {
      "name": "dynamicToolCalls",
      "type": "DynamicToolCall[]",
      "optional": false,
      "description": "The dynamic tool calls that were made in all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5264,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5264"
      }
    },
    "toolResults-309dd0a07bcf": {
      "name": "toolResults",
      "type": "TypedToolResult<ToolSet>[]",
      "optional": false,
      "description": "The results of the tool calls from all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5268,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5268"
      }
    },
    "staticToolResults-2edcf41036e7": {
      "name": "staticToolResults",
      "type": "{ type: \"tool-result\"; toolCallId: string; toolName: string; input: any; output: any; providerExecuted?: boolean; providerMetadata?: ProviderMetadata; toolMetadata?: JSONObject; dynamic?: false | undefined; preliminary?: boolean; title?: string; }[]",
      "optional": false,
      "description": "The static tool results that were made in all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5272,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5272"
      }
    },
    "dynamicToolResults-500736a6ee5f": {
      "name": "dynamicToolResults",
      "type": "DynamicToolResult[]",
      "optional": false,
      "description": "The dynamic tool results that were made in all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5276,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5276"
      }
    },
    "finishReason-dfb59b85b501": {
      "name": "finishReason",
      "type": "FinishReason",
      "optional": false,
      "description": "The unified reason why the generation finished.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5280,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5280"
      }
    },
    "rawFinishReason-31c21f78dc95": {
      "name": "rawFinishReason",
      "type": "string | undefined",
      "optional": false,
      "description": "The raw reason why the generation finished (from the provider).",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5284,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5284"
      }
    },
    "usage-24adb70fb568": {
      "name": "usage",
      "type": "LanguageModelUsage",
      "optional": false,
      "description": "The total token usage of all steps.\nWhen there are multiple steps, the usage is the sum of all step usages.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5289,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5289"
      }
    },
    "totalUsage-498de2aec016": {
      "name": "totalUsage",
      "type": "LanguageModelUsage",
      "optional": false,
      "description": "The total token usage of all steps.\nWhen there are multiple steps, the usage is the sum of all step usages.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `usage` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5296,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5296"
      }
    },
    "warnings-2846ee005e14": {
      "name": "warnings",
      "type": "SharedV4Warning[] | undefined",
      "optional": false,
      "description": "Warnings from the model provider (e.g. unsupported settings) in all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5300,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5300"
      }
    },
    "request-221385acc282": {
      "name": "request",
      "type": "LanguageModelRequestMetadata",
      "optional": false,
      "description": "Additional request information from the last step.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `finalStep.request` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5306,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5306"
      }
    },
    "response-e5e32110ad14": {
      "name": "response",
      "type": "LanguageModelResponseMetadata",
      "optional": false,
      "description": "Additional response information from the last step.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `finalStep.response` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5312,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5312"
      }
    },
    "responseMessages-806464dfb85b": {
      "name": "responseMessages",
      "type": "ResponseMessage[]",
      "optional": false,
      "description": "The accumulated response messages of all steps that were generated during the call.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5316,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5316"
      }
    },
    "providerMetadata-cbbb7591ae4c": {
      "name": "providerMetadata",
      "type": "SharedV4ProviderMetadata | undefined",
      "optional": false,
      "description": "Additional provider-specific metadata from the final step. They are passed\nthrough from the provider to the AI SDK and enable provider-specific\nresults that can be fully encapsulated in the provider.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `finalStep.providerMetadata` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5324,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5324"
      }
    },
    "steps-136a8e127e1f": {
      "name": "steps",
      "type": "StepResult<ToolSet, Context>[]",
      "optional": false,
      "description": "Details for all steps.\nYou can use this to get information about intermediate steps,\nsuch as the tool calls or the response headers.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5330,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5330"
      }
    },
    "finalStep-37d35df42bd8": {
      "name": "finalStep",
      "type": "StepResult<ToolSet, Context>",
      "optional": false,
      "description": "The final step. This is a shortcut for `steps.at(-1)`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5334,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5334"
      }
    },
    "output-a77136f8075d": {
      "name": "output",
      "type": "any",
      "optional": false,
      "description": "The generated output according to the `output` specification.",
      "tags": [
        {
          "name": "throws",
          "text": "{NoOutputGeneratedError} When no output is available, for example\nwhen the final step finishes with a `tool-calls` reason, or when it\ncontains no text and does not finish with a `stop` reason."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 5342,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L5342"
      }
    },
    "content-78185f28d35d": {
      "name": "content",
      "type": "PromiseLike<ContentPart<ToolSet>[]>",
      "optional": false,
      "description": "The content that was generated in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2763,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2763"
      }
    },
    "text-ed5e8048e5c8": {
      "name": "text",
      "type": "PromiseLike<string>",
      "optional": false,
      "description": "The full text that has been generated by the final step.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2769,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2769"
      }
    },
    "reasoning-adfeb01c242e": {
      "name": "reasoning",
      "type": "PromiseLike<(ReasoningOutput | ReasoningFileOutput)[]>",
      "optional": false,
      "description": "The full reasoning that the model has generated.\n\nAutomatically consumes the stream.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `finalStep.reasoning` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2777,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2777"
      }
    },
    "reasoningText-8e5d43bfaac9": {
      "name": "reasoningText",
      "type": "PromiseLike<string | undefined>",
      "optional": false,
      "description": "The reasoning that has been generated by the last step.\n\nAutomatically consumes the stream.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `finalStep.reasoningText` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2785,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2785"
      }
    },
    "files-3baf3c0948a7": {
      "name": "files",
      "type": "PromiseLike<GeneratedFile[]>",
      "optional": false,
      "description": "Files that have been generated by the model in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2791,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2791"
      }
    },
    "sources-5c24b516104e": {
      "name": "sources",
      "type": "PromiseLike<LanguageModelV4Source[]>",
      "optional": false,
      "description": "Sources that have been used as references in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2797,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2797"
      }
    },
    "toolCalls-00000473a97a": {
      "name": "toolCalls",
      "type": "PromiseLike<TypedToolCall<ToolSet>[]>",
      "optional": false,
      "description": "The tool calls that have been executed in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2803,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2803"
      }
    },
    "staticToolCalls-fe800df0b657": {
      "name": "staticToolCalls",
      "type": "PromiseLike<(BaseToolCall & { toolName: string; input: any; dynamic?: false | undefined; invalid?: false | undefined; error?: never; title?: string; })[]>",
      "optional": false,
      "description": "The static tool calls that have been executed in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2809,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2809"
      }
    },
    "dynamicToolCalls-b95642b6e21a": {
      "name": "dynamicToolCalls",
      "type": "PromiseLike<DynamicToolCall[]>",
      "optional": false,
      "description": "The dynamic tool calls that have been executed in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2815,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2815"
      }
    },
    "staticToolResults-7eb944588ecf": {
      "name": "staticToolResults",
      "type": "PromiseLike<{ type: \"tool-result\"; toolCallId: string; toolName: string; input: any; output: any; providerExecuted?: boolean; providerMetadata?: ProviderMetadata; toolMetadata?: JSONObject; dynamic?: false | undefined; preliminary?: boolean; title?: string; }[]>",
      "optional": false,
      "description": "The static tool results that have been generated in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2821,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2821"
      }
    },
    "dynamicToolResults-659935885523": {
      "name": "dynamicToolResults",
      "type": "PromiseLike<DynamicToolResult[]>",
      "optional": false,
      "description": "The dynamic tool results that have been generated in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2827,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2827"
      }
    },
    "toolResults-a3b17144d068": {
      "name": "toolResults",
      "type": "PromiseLike<TypedToolResult<ToolSet>[]>",
      "optional": false,
      "description": "The tool results that have been generated in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2833,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2833"
      }
    },
    "finishReason-1b0fe72a0778": {
      "name": "finishReason",
      "type": "PromiseLike<FinishReason>",
      "optional": false,
      "description": "The unified finish reason why the generation finished. Taken from the last step.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2839,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2839"
      }
    },
    "rawFinishReason-c8a69858eb5c": {
      "name": "rawFinishReason",
      "type": "PromiseLike<string | undefined>",
      "optional": false,
      "description": "The raw reason why the generation finished (from the provider). Taken from the last step.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2845,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2845"
      }
    },
    "usage-729563a623ca": {
      "name": "usage",
      "type": "PromiseLike<LanguageModelUsage>",
      "optional": false,
      "description": "The total token usage of the generated response.\nWhen there are multiple steps, the usage is the sum of all step usages.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2852,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2852"
      }
    },
    "totalUsage-75bf30f90be3": {
      "name": "totalUsage",
      "type": "PromiseLike<LanguageModelUsage>",
      "optional": false,
      "description": "The total token usage of the generated response.\nWhen there are multiple steps, the usage is the sum of all step usages.\n\nAutomatically consumes the stream.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `usage` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2861,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2861"
      }
    },
    "warnings-87d9968f8e07": {
      "name": "warnings",
      "type": "PromiseLike<SharedV4Warning[] | undefined>",
      "optional": false,
      "description": "Warnings from the model provider (e.g. unsupported settings) in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2867,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2867"
      }
    },
    "steps-ac71cf637c67": {
      "name": "steps",
      "type": "PromiseLike<StepResult<ToolSet, Context>[]>",
      "optional": false,
      "description": "Details for all steps.\nYou can use this to get information about intermediate steps,\nsuch as the tool calls or the response headers.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2875,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2875"
      }
    },
    "finalStep-f5a197f739f2": {
      "name": "finalStep",
      "type": "PromiseLike<StepResult<ToolSet, Context>>",
      "optional": false,
      "description": "The final step. This is a shortcut for `steps.at(-1)`.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2881,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2881"
      }
    },
    "request-f2c6f88f10d3": {
      "name": "request",
      "type": "PromiseLike<LanguageModelRequestMetadata>",
      "optional": false,
      "description": "Additional request information from the last step.\n\nAutomatically consumes the stream.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `finalStep.request` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2889,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2889"
      }
    },
    "response-61c06f5c4845": {
      "name": "response",
      "type": "PromiseLike<LanguageModelResponseMetadata>",
      "optional": false,
      "description": "Additional response information from the last step.\n\nAutomatically consumes the stream.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `finalStep.response` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2897,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2897"
      }
    },
    "responseMessages-419d83f78ea5": {
      "name": "responseMessages",
      "type": "PromiseLike<ResponseMessage[]>",
      "optional": false,
      "description": "The accumulated response messages of all steps that were generated during the call.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2903,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2903"
      }
    },
    "providerMetadata-7c8da1cc1063": {
      "name": "providerMetadata",
      "type": "PromiseLike<SharedV4ProviderMetadata | undefined>",
      "optional": false,
      "description": "Additional provider-specific metadata from the last step.\nMetadata is passed through from the provider to the AI SDK and\nenables provider-specific results that can be fully encapsulated in the provider.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `finalStep.providerMetadata` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2911,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2911"
      }
    },
    "textStream-942de4eaf2e3": {
      "name": "textStream",
      "type": "AsyncIterableStream<string>",
      "optional": false,
      "description": "A text stream that returns only the generated text deltas. You can use it\nas either an AsyncIterable or a ReadableStream. Error parts are not\nsurfaced in this stream. Use the `onError` callback or `stream` to observe\nthem.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2918,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2918"
      }
    },
    "stream-010421b1bb75": {
      "name": "stream",
      "type": "AsyncIterableStream<TextStreamPart<ToolSet>>",
      "optional": false,
      "description": "A stream with all events, including text deltas, tool calls, tool results, and\nerrors.\nYou can use it as either an AsyncIterable or a ReadableStream.\nOnly errors that stop the stream, such as network errors, are thrown.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2925,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2925"
      }
    },
    "fullStream-fef6926e69b8": {
      "name": "fullStream",
      "type": "AsyncIterableStream<TextStreamPart<ToolSet>>",
      "optional": false,
      "description": "A stream with all events, including text deltas, tool calls, tool results, and\nerrors.\nYou can use it as either an AsyncIterable or a ReadableStream.\nOnly errors that stop the stream, such as network errors, are thrown.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `stream` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2934,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2934"
      }
    },
    "experimental_partialOutputStream-a73b4cb78c17": {
      "name": "experimental_partialOutputStream",
      "type": "AsyncIterableStream<any>",
      "optional": false,
      "description": "A stream of partial outputs. It uses the `output` specification.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `partialOutputStream` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2940,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2940"
      }
    },
    "partialOutputStream-99c9325a20da": {
      "name": "partialOutputStream",
      "type": "AsyncIterableStream<any>",
      "optional": false,
      "description": "A stream of partial parsed outputs. It uses the `output` specification.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2944,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2944"
      }
    },
    "elementStream-b56d509c0449": {
      "name": "elementStream",
      "type": "AsyncIterableStream<any>",
      "optional": false,
      "description": "A stream of individual array elements as they complete.\nOnly available when using `output: Output.array()`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2949,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2949"
      }
    },
    "output-123131f9da41": {
      "name": "output",
      "type": "PromiseLike<any>",
      "optional": false,
      "description": "The complete parsed output. It uses the `output` specification.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2953,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2953"
      }
    },
    "consumeStream-f9c55348e54f": {
      "name": "consumeStream",
      "type": "(options?: ConsumeStreamOptions) => PromiseLike<void>",
      "optional": false,
      "description": "Consumes the stream without processing the parts.\nThis is useful to force the stream to finish.\nIt effectively removes the backpressure and allows the stream to finish,\ntriggering the `onEnd` callback and the promise resolution.\n\nIf an error occurs, it is passed to the optional `onError` callback.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2962,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2962"
      }
    },
    "toUIMessageStream-b8151304fa46": {
      "name": "toUIMessageStream",
      "type": "<UI_MESSAGE extends UIMessage>(options?: UIMessageStreamOptions<UI_MESSAGE>) => AsyncIterableStream<InferUIMessageChunk<UI_MESSAGE>>",
      "optional": false,
      "description": "Converts the result to a UI message stream.",
      "tags": [
        {
          "name": "returns",
          "text": "A UI message stream."
        },
        {
          "name": "deprecated",
          "text": "Use the standalone `toUIMessageStream` helper from\n`'ai'` with `result.stream` instead. This method will be removed\nin the next major release."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2972,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2972"
      }
    },
    "pipeUIMessageStreamToResponse-0c12508e1e68": {
      "name": "pipeUIMessageStreamToResponse",
      "type": "<UI_MESSAGE extends UIMessage>(response: ServerResponse, options?: UIMessageStreamResponseInit & UIMessageStreamOptions<UI_MESSAGE>) => Promise<void>",
      "optional": false,
      "description": "Writes UI message stream output to a Node.js response-like object.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use the standalone `toUIMessageStream` and\n`pipeUIMessageStreamToResponse` helpers from `'ai'` with `result.stream`\ninstead. This method will be removed in the next major release."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2980,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2980"
      }
    },
    "pipeTextStreamToResponse-1d88dc69bf5b": {
      "name": "pipeTextStreamToResponse",
      "type": "(response: ServerResponse, init?: ResponseInit) => Promise<void>",
      "optional": false,
      "description": "Writes text delta output to a Node.js response-like object.\nIt sets a `Content-Type` header to `text/plain; charset=utf-8` and\nwrites each text delta as a separate chunk.",
      "tags": [
        {
          "name": "param",
          "text": "response A Node.js response-like object (ServerResponse)."
        },
        {
          "name": "param",
          "text": "init Optional headers, status code, and status text."
        },
        {
          "name": "deprecated",
          "text": "Use the standalone `toTextStream` and\n`pipeTextStreamToResponse` helpers from `'ai'` with `result.stream`\ninstead. This method will be removed in the next major release."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 2993,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L2993"
      }
    },
    "toUIMessageStreamResponse-e50d56ba1962": {
      "name": "toUIMessageStreamResponse",
      "type": "<UI_MESSAGE extends UIMessage>(options?: UIMessageStreamResponseInit & UIMessageStreamOptions<UI_MESSAGE>) => Response",
      "optional": false,
      "description": "Converts the result to a streamed response object with a stream data part stream.",
      "tags": [
        {
          "name": "returns",
          "text": "A response object."
        },
        {
          "name": "deprecated",
          "text": "Use the standalone `toUIMessageStream` and\n`createUIMessageStreamResponse` helpers from `'ai'` with `result.stream`\ninstead. This method will be removed in the next major release."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3003,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3003"
      }
    },
    "toTextStreamResponse-5ec832758faa": {
      "name": "toTextStreamResponse",
      "type": "(init?: ResponseInit) => Response",
      "optional": false,
      "description": "Creates a simple text stream response.\nEach text delta is encoded as UTF-8 and sent as a separate chunk.\nNon-text-delta events are ignored.",
      "tags": [
        {
          "name": "param",
          "text": "init Optional headers, status code, and status text."
        },
        {
          "name": "deprecated",
          "text": "Use the standalone `toTextStream` and `createTextStreamResponse`\nhelpers from `'ai'` with `result.stream` instead. This method will be\nremoved in the next major release."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3014,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3014"
      }
    },
    "answers-08dc93da3be8": {
      "name": "answers",
      "type": "{ [x: string]: { type: \"score\"; score: number; probabilities?: Record<string, number>; } | { type: \"box\"; box: { top: number; bottom: number; left: number; right: number; }; } | { type: \"boolean\"; probability: number; } | { type: \"choice\"; choice: string; probabilities?: Record<string, number> | undefined; }; }",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 591,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L591"
      }
    },
    "usage-4d2839fc326e": {
      "name": "usage",
      "type": "{ inputTokens: number | undefined; outputTokens: number | undefined; totalTokens: number | undefined; }",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 592,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L592"
      }
    },
    "warnings-09983a0ccdb9": {
      "name": "warnings",
      "type": "SharedV4Warning[]",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 597,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L597"
      }
    },
    "rounding-21207da9926c": {
      "name": "rounding",
      "type": "{ probabilityDecimals?: number; scoreDecimals?: number; } | undefined",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 598,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L598"
      }
    },
    "providerMetadata-f0f9ffbcadb5": {
      "name": "providerMetadata",
      "type": "SharedV4ProviderMetadata | undefined",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 599,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L599"
      }
    },
    "response-1a7dc2392bcd": {
      "name": "response",
      "type": "{ id?: string; timestamp?: Date; modelId?: string; headers?: SharedV4Headers; body?: unknown; } & { timestamp: Date; modelId: string; }",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 600,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L600"
      }
    },
    "telemetry-7b4f0ebaca44": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8730,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8730"
      }
    },
    "runtimeContext-750515b0b35b": {
      "name": "runtimeContext",
      "type": "Context | undefined",
      "optional": true,
      "description": "User-defined runtime context. Treat runtime context as immutable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8732,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8732"
      }
    },
    "onStart-8b18b7c09df5": {
      "name": "onStart",
      "type": "Callback<DecideStartEvent<Context>> | undefined",
      "optional": true,
      "description": "Called when the decide operation begins.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8734,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8734"
      }
    },
    "onEnd-d7aa5cddc6cf": {
      "name": "onEnd",
      "type": "Callback<DecideEndEvent<Context>> | undefined",
      "optional": true,
      "description": "Called when the decide operation completes.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8736,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8736"
      }
    },
    "_internal-99eba0cdff92": {
      "name": "_internal",
      "type": "{ generateCallId?: () => string; } | undefined",
      "optional": true,
      "description": "Internal. For test use only. May change without notice.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8738,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8738"
      }
    },
    "value-d2798f2459dc": {
      "name": "value",
      "type": "string",
      "optional": false,
      "description": "The value that was embedded.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7933,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7933"
      }
    },
    "embedding-28465d16c7d2": {
      "name": "embedding",
      "type": "EmbeddingModelV4Embedding",
      "optional": false,
      "description": "The embedding of the value.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7937,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7937"
      }
    },
    "usage-0f7d9f5a6a3b": {
      "name": "usage",
      "type": "EmbeddingModelUsage",
      "optional": false,
      "description": "The embedding token usage.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7941,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7941"
      }
    },
    "warnings-47b367d54554": {
      "name": "warnings",
      "type": "SharedV4Warning[]",
      "optional": false,
      "description": "Warnings for the call, e.g. unsupported settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7945,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7945"
      }
    },
    "providerMetadata-42cd5ecbd571": {
      "name": "providerMetadata",
      "type": "SharedV4ProviderMetadata | undefined",
      "optional": true,
      "description": "Optional provider-specific metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7949,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7949"
      }
    },
    "response-7af554c6fae8": {
      "name": "response",
      "type": "{ headers?: Record<string, string>; body?: unknown; } | undefined",
      "optional": true,
      "description": "Optional response data.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7953,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7953"
      }
    },
    "model-48aa9f877e2f": {
      "name": "model",
      "type": "EmbeddingModel",
      "optional": false,
      "description": "The embedding model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7991,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7991"
      }
    },
    "value-c37f5640ff7b": {
      "name": "value",
      "type": "string",
      "optional": false,
      "description": "The value that should be embedded.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7995,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7995"
      }
    },
    "dimensions-2a545e83fd43": {
      "name": "dimensions",
      "type": "number | undefined",
      "optional": true,
      "description": "The requested number of dimensions for the output embeddings.\nMust be a positive integer. Support and allowed values depend on the model\nand provider implementation.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8001,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8001"
      }
    },
    "maxRetries-446dc9e70593": {
      "name": "maxRetries",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of retries per embedding model call. Set to 0 to disable retries.",
      "tags": [
        {
          "name": "default",
          "text": "2"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8007,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8007"
      }
    },
    "abortSignal-ba91bd67cbb7": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8011,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8011"
      }
    },
    "headers-1ed650c3b13b": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request.\nOnly applicable for HTTP-based providers.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8016,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8016"
      }
    },
    "providerOptions-84b4899a0815": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8022,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8022"
      }
    },
    "telemetry-39fa616edbc3": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8026,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8026"
      }
    },
    "experimental_telemetry-13341df2875d": {
      "name": "experimental_telemetry",
      "type": "TelemetryOptions<Context, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `telemetry` instead. This alias will be removed in a future major release."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8032,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8032"
      }
    },
    "runtimeContext-5a66a39874dd": {
      "name": "runtimeContext",
      "type": "Context | undefined",
      "optional": true,
      "description": "User-defined runtime context. Treat runtime context as immutable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8036,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8036"
      }
    },
    "onStart-cc3c9aa8dc3f": {
      "name": "onStart",
      "type": "Callback<EmbedStartEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embed operation begins,\nbefore the embedding model is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8041,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8041"
      }
    },
    "experimental_onStart-f2f7f020a9e5": {
      "name": "experimental_onStart",
      "type": "Callback<EmbedStartEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embed operation begins,\nbefore the embedding model is called.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8048,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8048"
      }
    },
    "onEnd-eed8fe22bc47": {
      "name": "onEnd",
      "type": "Callback<EmbedEndEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embed operation completes,\nafter the embedding model returns.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8053,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8053"
      }
    },
    "experimental_onEnd-2c0ae17e5f79": {
      "name": "experimental_onEnd",
      "type": "Callback<EmbedEndEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embed operation completes,\nafter the embedding model returns.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8060,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8060"
      }
    },
    "_internal-de3674fe249f": {
      "name": "_internal",
      "type": "{ generateCallId?: () => string; } | undefined",
      "optional": true,
      "description": "Internal. For test use only. May change without notice.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8064,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8064"
      }
    },
    "values-d66df071b78f": {
      "name": "values",
      "type": "string[]",
      "optional": false,
      "description": "The values that were embedded.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8078,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8078"
      }
    },
    "embeddings-6f1b362870e6": {
      "name": "embeddings",
      "type": "EmbeddingModelV4Embedding[]",
      "optional": false,
      "description": "The embeddings. They are in the same order as the values.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8082,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8082"
      }
    },
    "usage-ff21b5ddb575": {
      "name": "usage",
      "type": "EmbeddingModelUsage",
      "optional": false,
      "description": "The embedding token usage.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8086,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8086"
      }
    },
    "warnings-1d3fccb3d882": {
      "name": "warnings",
      "type": "SharedV4Warning[]",
      "optional": false,
      "description": "Warnings for the call, e.g. unsupported settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8090,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8090"
      }
    },
    "providerMetadata-48bfc7037b5c": {
      "name": "providerMetadata",
      "type": "SharedV4ProviderMetadata | undefined",
      "optional": true,
      "description": "Optional provider-specific metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8094,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8094"
      }
    },
    "responses-ac7be9f9b8c3": {
      "name": "responses",
      "type": "({ headers?: Record<string, string>; body?: unknown; } | undefined)[] | undefined",
      "optional": true,
      "description": "Optional raw response data.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8098,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8098"
      }
    },
    "values-6aa442082344": {
      "name": "values",
      "type": "string[]",
      "optional": false,
      "description": "The values that should be embedded.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8149,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8149"
      }
    },
    "telemetry-4c89c3844737": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8174,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8174"
      }
    },
    "experimental_telemetry-c7ea9dba6c92": {
      "name": "experimental_telemetry",
      "type": "TelemetryOptions<Context, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `telemetry` instead. This alias will be removed in a future major release."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8180,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8180"
      }
    },
    "runtimeContext-9ac3967b5bf5": {
      "name": "runtimeContext",
      "type": "Context | undefined",
      "optional": true,
      "description": "User-defined runtime context. Treat runtime context as immutable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8184,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8184"
      }
    },
    "onStart-d4e8d9c392c1": {
      "name": "onStart",
      "type": "Callback<EmbedStartEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embedMany operation begins,\nbefore the embedding model is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8202,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8202"
      }
    },
    "experimental_onStart-beec57122067": {
      "name": "experimental_onStart",
      "type": "Callback<EmbedStartEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embedMany operation begins,\nbefore the embedding model is called.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8209,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8209"
      }
    },
    "onEnd-6e04994067d5": {
      "name": "onEnd",
      "type": "Callback<EmbedEndEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embedMany operation completes,\nafter all embedding model calls return.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8214,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8214"
      }
    },
    "experimental_onEnd-97a0acabe2fe": {
      "name": "experimental_onEnd",
      "type": "Callback<EmbedEndEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embedMany operation completes,\nafter all embedding model calls return.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8221,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8221"
      }
    },
    "_internal-03883d0a112a": {
      "name": "_internal",
      "type": "{ generateCallId?: () => string; } | undefined",
      "optional": true,
      "description": "Internal. For test use only. May change without notice.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 8225,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L8225"
      }
    },
    "originalDocuments-215eb4fac765": {
      "name": "originalDocuments",
      "type": "(string | JSONObject)[]",
      "optional": false,
      "description": "The original documents that were reranked.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10646,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10646"
      }
    },
    "rerankedDocuments-732cf9cfaede": {
      "name": "rerankedDocuments",
      "type": "(string | JSONObject)[]",
      "optional": false,
      "description": "Reranked documents.\n\nSorted by relevance score in descending order.\n\nCan be less than the original documents if there was a topN limit.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10654,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10654"
      }
    },
    "ranking-dda77c1a65ca": {
      "name": "ranking",
      "type": "{ originalIndex: number; score: number; document: string | JSONObject; }[]",
      "optional": false,
      "description": "The ranking is a list of objects with the original index,\nrelevance score, and the reranked document.\n\nSorted by relevance score in descending order.\n\nCan be less than the original documents if there was a topN limit.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10663,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10663"
      }
    },
    "providerMetadata-6ddff93d9315": {
      "name": "providerMetadata",
      "type": "SharedV4ProviderMetadata | undefined",
      "optional": true,
      "description": "Optional provider-specific metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10671,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10671"
      }
    },
    "response-cb4078ff4fd7": {
      "name": "response",
      "type": "{ id?: string; timestamp: Date; modelId: string; headers?: Record<string, string>; body?: unknown; }",
      "optional": false,
      "description": "Optional raw response data.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10675,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10675"
      }
    },
    "telemetry-0c47e752120d": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10752,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10752"
      }
    },
    "experimental_telemetry-09dd8794b725": {
      "name": "experimental_telemetry",
      "type": "TelemetryOptions<Context, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `telemetry` instead. This alias will be removed in a future major release."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10758,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10758"
      }
    },
    "runtimeContext-b1f87baccfa3": {
      "name": "runtimeContext",
      "type": "Context | undefined",
      "optional": true,
      "description": "User-defined runtime context. Treat runtime context as immutable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10762,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10762"
      }
    },
    "onStart-2e8ca1a184bf": {
      "name": "onStart",
      "type": "Callback<RerankStartEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the rerank operation begins,\nbefore the reranking model is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10773,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10773"
      }
    },
    "experimental_onStart-abc629b14bdc": {
      "name": "experimental_onStart",
      "type": "Callback<RerankStartEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the rerank operation begins,\nbefore the reranking model is called.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onStart` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10780,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10780"
      }
    },
    "onEnd-361d10c86f16": {
      "name": "onEnd",
      "type": "Callback<RerankEndEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the rerank operation completes,\nafter the reranking model returns.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10785,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10785"
      }
    },
    "experimental_onEnd-2567d3ca2920": {
      "name": "experimental_onEnd",
      "type": "Callback<RerankEndEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the rerank operation completes,\nafter the reranking model returns.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `onEnd` instead."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10792,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10792"
      }
    },
    "_internal-29b6970b9db3": {
      "name": "_internal",
      "type": "{ generateCallId?: () => string; } | undefined",
      "optional": true,
      "description": "Internal. For test use only. May change without notice.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10796,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10796"
      }
    },
    "image-a98fbf11406a": {
      "name": "image",
      "type": "GeneratedFile",
      "optional": false,
      "description": "The first image that was generated.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7566,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7566"
      }
    },
    "images-48a4cc2d363e": {
      "name": "images",
      "type": "GeneratedFile[]",
      "optional": false,
      "description": "The images that were generated.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7570,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7570"
      }
    },
    "calls-5b86ccbe82f7": {
      "name": "calls",
      "type": "GenerateImageCall[]",
      "optional": false,
      "description": "The results of the underlying image model calls.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7574,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7574"
      }
    },
    "warnings-0e6fb7a66231": {
      "name": "warnings",
      "type": "SharedV4Warning[]",
      "optional": false,
      "description": "Warnings for the call, e.g. unsupported settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7578,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7578"
      }
    },
    "responses-8658993a1aff": {
      "name": "responses",
      "type": "ImageModelResponseMetadata[]",
      "optional": false,
      "description": "Response metadata from the provider. There may be multiple responses if we made multiple calls to the model.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use `calls` to preserve each response with its corresponding images, metadata, warnings, and usage."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7584,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7584"
      }
    },
    "providerMetadata-fa85bd12bf6d": {
      "name": "providerMetadata",
      "type": "ImageModelProviderMetadata",
      "optional": false,
      "description": "Provider-specific metadata. They are passed through from the provider to the AI SDK and enable provider-specific\nresults that can be fully encapsulated in the provider.",
      "tags": [
        {
          "name": "deprecated",
          "text": "Use the provider metadata in `calls` or on individual `images` to preserve its scope."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7591,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7591"
      }
    },
    "usage-b4dcc0622deb": {
      "name": "usage",
      "type": "ImageModelV4Usage",
      "optional": false,
      "description": "Combined token usage across all underlying provider calls for this image generation.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7595,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7595"
      }
    },
    "text-352c730b4bb8": {
      "name": "text",
      "type": "string",
      "optional": false,
      "description": "The complete transcribed text from the audio.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10899,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10899"
      }
    },
    "segments-428a1f286ac8": {
      "name": "segments",
      "type": "{ readonly text: string; readonly startSecond: number; readonly endSecond: number; }[]",
      "optional": false,
      "description": "Array of transcript segments with timing information.\nEach segment represents a portion of the transcribed text with start and end times.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10904,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10904"
      }
    },
    "language-2f06686a7383": {
      "name": "language",
      "type": "string | undefined",
      "optional": false,
      "description": "The detected language of the audio content, as an ISO-639-1 code (e.g., 'en' for English).\nMay be undefined if the language couldn't be detected.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10922,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10922"
      }
    },
    "durationInSeconds-19431d9e2a62": {
      "name": "durationInSeconds",
      "type": "number | undefined",
      "optional": false,
      "description": "The total duration of the audio file in seconds.\nMay be undefined if the duration couldn't be determined.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10927,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10927"
      }
    },
    "warnings-1e34a2635ebf": {
      "name": "warnings",
      "type": "SharedV4Warning[]",
      "optional": false,
      "description": "Warnings for the call, e.g. unsupported settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10931,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10931"
      }
    },
    "responses-a6bddb02ea18": {
      "name": "responses",
      "type": "TranscriptionModelResponseMetadata[]",
      "optional": false,
      "description": "Response metadata from the provider. There may be multiple responses if we made multiple calls to the model.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10935,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10935"
      }
    },
    "providerMetadata-fb60083c3c2d": {
      "name": "providerMetadata",
      "type": "Record<string, JSONObject>",
      "optional": false,
      "description": "Provider metadata from the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 10939,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L10939"
      }
    },
    "_internal-a4d65510b686": {
      "name": "_internal",
      "type": "{ generateCallId?: () => string; } | undefined",
      "optional": true,
      "description": "Internal. For test use only. May change without notice.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11002,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11002"
      }
    },
    "text-b4b7399b21c2": {
      "name": "text",
      "type": "PromiseLike<string>",
      "optional": false,
      "description": "The final transcribed text.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11040,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11040"
      }
    },
    "segments-33df0823f194": {
      "name": "segments",
      "type": "PromiseLike<{ text: string; startSecond: number; endSecond: number; }[]>",
      "optional": false,
      "description": "Final transcript segments with timing information, if available.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11044,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11044"
      }
    },
    "language-6859a8acc1d2": {
      "name": "language",
      "type": "PromiseLike<string | undefined>",
      "optional": false,
      "description": "The language of the transcript, if available.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11052,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11052"
      }
    },
    "durationInSeconds-24de35d7d0a5": {
      "name": "durationInSeconds",
      "type": "PromiseLike<number | undefined>",
      "optional": false,
      "description": "The duration of the transcript in seconds, if available.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11056,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11056"
      }
    },
    "warnings-8a7a10343ff2": {
      "name": "warnings",
      "type": "PromiseLike<SharedV4Warning[]>",
      "optional": false,
      "description": "Warnings for the call, e.g. unsupported settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11060,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11060"
      }
    },
    "responses-187bc4e8cfa3": {
      "name": "responses",
      "type": "PromiseLike<TranscriptionModelResponseMetadata[]>",
      "optional": false,
      "description": "Response metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11064,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11064"
      }
    },
    "providerMetadata-2ecb679233eb": {
      "name": "providerMetadata",
      "type": "PromiseLike<Record<string, JSONObject>>",
      "optional": false,
      "description": "Additional provider-specific metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11068,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11068"
      }
    },
    "fullStream-007898973bb7": {
      "name": "fullStream",
      "type": "AsyncIterableStream<TranscriptionStreamPart>",
      "optional": false,
      "description": "Full stream of transcription parts.\n\nThis is a single-consumer live stream and can only be accessed once.\nAccess it before any result promise when both stream parts and final\nresults are needed; accessing a result promise first consumes the stream\ninternally and makes `fullStream` unavailable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11077,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11077"
      }
    },
    "_internal-76401c9df9f4": {
      "name": "_internal",
      "type": "{ currentDate?: () => Date; generateCallId?: () => string; } | undefined",
      "optional": true,
      "description": "Internal test hooks.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11130,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11130"
      }
    },
    "audio-090e31c3f07e": {
      "name": "audio",
      "type": "GeneratedAudioFile",
      "optional": false,
      "description": "The generated audio file with the audio data.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9460,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9460"
      }
    },
    "warnings-751664670b6e": {
      "name": "warnings",
      "type": "SharedV4Warning[]",
      "optional": false,
      "description": "Warnings for the call, e.g. unsupported settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9464,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9464"
      }
    },
    "responses-d50a12d4caa1": {
      "name": "responses",
      "type": "SpeechModelResponseMetadata[]",
      "optional": false,
      "description": "Response metadata from the provider. There may be multiple responses if we made multiple calls to the model.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9468,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9468"
      }
    },
    "providerMetadata-d8670c7292b8": {
      "name": "providerMetadata",
      "type": "Record<string, JSONObject>",
      "optional": false,
      "description": "Provider metadata from the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9472,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9472"
      }
    },
    "_internal-891f15b39ec6": {
      "name": "_internal",
      "type": "{ generateCallId?: () => string; } | undefined",
      "optional": true,
      "description": "Internal. For test use only. May change without notice.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9560,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9560"
      }
    },
    "usage-e862f00da64d": {
      "name": "usage",
      "type": "PromiseLike<SpeechModelV4StreamUsage>",
      "optional": false,
      "description": "Usage information reported for the call, if available.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9607,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9607"
      }
    },
    "warnings-13637bc242f9": {
      "name": "warnings",
      "type": "PromiseLike<SharedV4Warning[]>",
      "optional": false,
      "description": "Warnings for the call, e.g. unsupported settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9611,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9611"
      }
    },
    "responses-261571bff397": {
      "name": "responses",
      "type": "PromiseLike<SpeechModelResponseMetadata[]>",
      "optional": false,
      "description": "Response metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9615,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9615"
      }
    },
    "providerMetadata-c8051b2e6c0b": {
      "name": "providerMetadata",
      "type": "PromiseLike<Record<string, JSONObject>>",
      "optional": false,
      "description": "Additional provider-specific metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9619,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9619"
      }
    },
    "audioStream-b358ab4f1af4": {
      "name": "audioStream",
      "type": "AsyncIterableStream<Uint8Array<ArrayBufferLike>>",
      "optional": false,
      "description": "Stream of audio bytes in generation order.\n\n`audioStream` and `fullStream` share one live stream: only one of them\ncan be accessed, and only once. Access it before any result promise;\naccessing a result promise first consumes the stream internally.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9627,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9627"
      }
    },
    "fullStream-1187b3d5412c": {
      "name": "fullStream",
      "type": "AsyncIterableStream<SpeechStreamPart>",
      "optional": false,
      "description": "Full stream of speech parts (audio, raw, and error parts).\n\n`audioStream` and `fullStream` share one live stream: only one of them\ncan be accessed, and only once. Access it before any result promise;\naccessing a result promise first consumes the stream internally.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9635,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9635"
      }
    },
    "_internal-33f27e35a0d4": {
      "name": "_internal",
      "type": "{ currentDate?: () => Date; } | undefined",
      "optional": true,
      "description": "Internal test hooks.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9720,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9720"
      }
    },
    "sourceText-20efa392ede3": {
      "name": "sourceText",
      "type": "PromiseLike<string>",
      "optional": false,
      "description": "The final source-language transcript of the input audio.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11237,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11237"
      }
    },
    "translationText-94c108174585": {
      "name": "translationText",
      "type": "PromiseLike<string>",
      "optional": false,
      "description": "The final translated text in the target language.\n\nMay resolve to an empty string for providers that produce only audio\noutput.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11244,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11244"
      }
    },
    "durationInSeconds-517ae82d7988": {
      "name": "durationInSeconds",
      "type": "PromiseLike<number | undefined>",
      "optional": false,
      "description": "The duration of the source audio in seconds, if available.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11248,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11248"
      }
    },
    "usage-17ea66e7f260": {
      "name": "usage",
      "type": "PromiseLike<SpeechTranslationModelV4Usage | undefined>",
      "optional": false,
      "description": "Usage information for the translation call, if reported by the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11252,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11252"
      }
    },
    "warnings-279e6968f8af": {
      "name": "warnings",
      "type": "PromiseLike<SharedV4Warning[]>",
      "optional": false,
      "description": "Warnings for the call, e.g. unsupported settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11256,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11256"
      }
    },
    "response-26f85eeed335": {
      "name": "response",
      "type": "PromiseLike<SpeechTranslationModelResponseMetadata>",
      "optional": false,
      "description": "Response metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11260,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11260"
      }
    },
    "providerMetadata-820fb99f87d6": {
      "name": "providerMetadata",
      "type": "PromiseLike<Record<string, JSONObject>>",
      "optional": false,
      "description": "Additional provider-specific metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11264,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11264"
      }
    },
    "fullStream-16693db7e0f0": {
      "name": "fullStream",
      "type": "AsyncIterableStream<TranslationStreamPart>",
      "optional": false,
      "description": "Full stream of translation parts.\n\nThis is a single-consumer live stream and can only be accessed once.\nAccess it before any result promise when both stream parts and final\nresults are needed; accessing a result promise first consumes the stream\ninternally and makes `fullStream` unavailable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11273,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11273"
      }
    },
    "_internal-0c473c098e24": {
      "name": "_internal",
      "type": "{ currentDate?: () => Date; } | undefined",
      "optional": true,
      "description": "Internal test hooks.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 11341,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L11341"
      }
    },
    "token-ef6388c67aaf": {
      "name": "token",
      "type": "string",
      "optional": false,
      "description": "The ephemeral token value. Used as a Bearer token or in the\nWebSocket subprotocol header for authentication.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7489,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7489"
      }
    },
    "url-6694c49079ae": {
      "name": "url",
      "type": "string",
      "optional": false,
      "description": "The WebSocket URL to connect to. Includes any provider-specific\nquery parameters (e.g. model ID).",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7494,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7494"
      }
    },
    "expiresAt-b4d04565231e": {
      "name": "expiresAt",
      "type": "number | undefined",
      "optional": true,
      "description": "Unix timestamp (seconds) when this client secret expires.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7498,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7498"
      }
    },
    "tools-2d73a7f6a27a": {
      "name": "tools",
      "type": "RealtimeModelV4ToolDefinition[]",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/factories/VoiceSessionSetup.ts"
      }
    },
    "isEnabled-461f93f561cc": {
      "name": "isEnabled",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Enable or disable telemetry. Enabled by default when a telemetry\nintegration is registered. Set to `false` to opt out.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 1129,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L1129"
      }
    },
    "recordInputs-5a9bc04cadf6": {
      "name": "recordInputs",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Enable or disable input recording. Enabled by default.\n\nYou might want to disable input recording to avoid recording sensitive\ninformation, to reduce data transfers, or to increase performance.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 1136,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L1136"
      }
    },
    "recordOutputs-eef63173ee8d": {
      "name": "recordOutputs",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Enable or disable output recording. Enabled by default.\n\nYou might want to disable output recording to avoid recording sensitive\ninformation, to reduce data transfers, or to increase performance.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 1143,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L1143"
      }
    },
    "functionId-a8cb2fcd49af": {
      "name": "functionId",
      "type": "string | undefined",
      "optional": true,
      "description": "Identifier for this function. Used to group telemetry data by function.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 1147,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L1147"
      }
    },
    "includeRuntimeContext-7be8a823ab05": {
      "name": "includeRuntimeContext",
      "type": "IncludedContext<Context>",
      "optional": true,
      "description": "Top-level runtime context properties that should be included in telemetry.\nRuntime context properties are excluded unless they are explicitly set to `true`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 1152,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L1152"
      }
    },
    "includeToolsContext-4e95f5357138": {
      "name": "includeToolsContext",
      "type": "IncludedToolsContext<ToolSet>",
      "optional": true,
      "description": "Top-level tool context properties that should be included in telemetry,\nconfigured per tool.\n\nTool context properties are excluded unless they are explicitly set to `true`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 1159,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L1159"
      }
    },
    "integrations-96ef7c9abe2e": {
      "name": "integrations",
      "type": "Arrayable<Telemetry>",
      "optional": true,
      "description": "Per-call telemetry integrations that receive lifecycle events during generation.\n\nWhen provided, these integrations will take precedence over the globally registered\nintegrations for this call.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 1166,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L1166"
      }
    },
    "totalMs-594fa641341f": {
      "name": "totalMs",
      "type": "number | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 778,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L778"
      }
    },
    "stepMs-4e681ef685e4": {
      "name": "stepMs",
      "type": "number | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 779,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L779"
      }
    },
    "firstChunkMs-08154ea18be9": {
      "name": "firstChunkMs",
      "type": "number | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 780,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L780"
      }
    },
    "chunkMs-ea0876ccf03b": {
      "name": "chunkMs",
      "type": "number | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 781,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L781"
      }
    },
    "toolMs-b110bb37581e": {
      "name": "toolMs",
      "type": "number | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 782,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L782"
      }
    },
    "tools-9d7732e75fb6": {
      "name": "tools",
      "type": "Partial<Record<`${string}Ms`, number>> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 783,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L783"
      }
    },
    "requestBody-e4b8c5083ebc": {
      "name": "requestBody",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Whether to retain the request body in step results.\nThe request body can be large when sending images or files.",
      "tags": [
        {
          "name": "default",
          "text": "false"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3786,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3786"
      }
    },
    "requestMessages-f417475096d1": {
      "name": "requestMessages",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Whether to retain the request messages in step results.\nThe request messages can be large when sending images or files.",
      "tags": [
        {
          "name": "default",
          "text": "false"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3793,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3793"
      }
    },
    "rawChunks-84c188cf4090": {
      "name": "rawChunks",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Whether to include raw chunks from the provider in the stream.\n\nWhen enabled, you will receive raw chunks with type 'raw' that contain\nthe unprocessed data from the provider.\n\nThis allows access to cutting-edge provider features not yet wrapped by\nthe AI SDK.",
      "tags": [
        {
          "name": "default",
          "text": "false"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 3805,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L3805"
      }
    },
    "type-3d37b77be676": {
      "name": "type",
      "type": "string",
      "optional": false,
      "description": "Audio format type, e.g. `audio/pcm`, `audio/pcmu`, or `audio/pcma`.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 10,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L10"
      }
    },
    "rate-9d519651bed3": {
      "name": "rate",
      "type": "number | undefined",
      "optional": true,
      "description": "Sample rate in Hz. Only applicable for formats that require a rate.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 14,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L14"
      }
    },
    "model-747c04f06434": {
      "name": "model",
      "type": "string | undefined",
      "optional": true,
      "description": "Provider-specific transcription model.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7392,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7392"
      }
    },
    "language-c8af6ab181e6": {
      "name": "language",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional language hint for the input audio.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7396,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7396"
      }
    },
    "prompt-198973fe857c": {
      "name": "prompt",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional prompt to guide transcription.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7400,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7400"
      }
    },
    "type-4403e09d8750": {
      "name": "type",
      "type": "\"server-vad\" | \"semantic-vad\" | \"disabled\"",
      "optional": false,
      "description": "VAD mode. 'server-vad' for automatic detection,\n'semantic-vad' for OpenAI's semantic detection,\n'disabled' to turn off VAD.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7438,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7438"
      }
    },
    "threshold-d319cb183c9a": {
      "name": "threshold",
      "type": "number | undefined",
      "optional": true,
      "description": "VAD activation threshold (0.0-1.0).\nHigher values require louder audio to trigger.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7443,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7443"
      }
    },
    "silenceDurationMs-ea7c5a2320c3": {
      "name": "silenceDurationMs",
      "type": "number | undefined",
      "optional": true,
      "description": "How long the user must be silent (in ms) before\nthe server ends the turn.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7448,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7448"
      }
    },
    "prefixPaddingMs-d9ac0b322e22": {
      "name": "prefixPaddingMs",
      "type": "number | undefined",
      "optional": true,
      "description": "Amount of audio (in ms) to include before the\ndetected start of speech.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7453,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7453"
      }
    },
    "type-e23128cc0ea3": {
      "name": "type",
      "type": "\"choice\"",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2412,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L2412"
      }
    },
    "instructions-b8948cb7f97e": {
      "name": "instructions",
      "type": "DecisionModelV4Input | null | undefined",
      "optional": true,
      "description": "May be omitted or null when supported by the provider and criteria define the judgment.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2414,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L2414"
      }
    },
    "criteria-25a4abc81557": {
      "name": "criteria",
      "type": "Readonly<Record<string, DecisionModelV4Input | null>>",
      "optional": false,
      "description": "Nonempty map of option names to descriptions. Null means no description.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2416,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L2416"
      }
    },
    "type-f0ed6b10b0cb": {
      "name": "type",
      "type": "\"score\"",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2418,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L2418"
      }
    },
    "instructions-716db50b0640": {
      "name": "instructions",
      "type": "DecisionModelV4Input | null | undefined",
      "optional": true,
      "description": "May be omitted or null when supported by the provider and criteria define the judgment.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2420,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L2420"
      }
    },
    "criteria-f2ab0914b0a2": {
      "name": "criteria",
      "type": "readonly (DecisionModelV4Input | null)[]",
      "optional": false,
      "description": "At least one ordered level, indexed from zero. Providers may require more.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2422,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L2422"
      }
    },
    "type-33b2c1d6b3ea": {
      "name": "type",
      "type": "\"box\"",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2424,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L2424"
      }
    },
    "instructions-ec4fde729210": {
      "name": "instructions",
      "type": "DecisionModelV4Input",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2425,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L2425"
      }
    },
    "type-d51d159b0b95": {
      "name": "type",
      "type": "\"boolean\"",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2427,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L2427"
      }
    },
    "instructions-c1fc06851b28": {
      "name": "instructions",
      "type": "DecisionModelV4Input | null | undefined",
      "optional": true,
      "description": "May be omitted or null when supported by the provider and criteria define the judgment.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2429,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L2429"
      }
    },
    "criteria-4a3e82e16f10": {
      "name": "criteria",
      "type": "{ readonly true?: DecisionModelV4Input | null; readonly false?: DecisionModelV4Input | null; } | undefined",
      "optional": true,
      "description": "At least one non-null description is required when instructions are absent.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2431,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L2431"
      }
    },
    "role-98fcfc9df349": {
      "name": "role",
      "type": "\"system\"",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1758,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L1758"
      }
    },
    "content-5d96322cd173": {
      "name": "content",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1759,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L1759"
      }
    },
    "providerOptions-c6c4e0593818": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific metadata. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1765,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L1765"
      }
    },
    "role-842fd34a266d": {
      "name": "role",
      "type": "\"user\"",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1824,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L1824"
      }
    },
    "content-92937787a683": {
      "name": "content",
      "type": "UserContent",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1825,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L1825"
      }
    },
    "providerOptions-cf02dd68a7de": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific metadata. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1831,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L1831"
      }
    },
    "role-56618d0a1118": {
      "name": "role",
      "type": "\"assistant\"",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1734,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L1734"
      }
    },
    "content-be1a0de1cdcc": {
      "name": "content",
      "type": "AssistantContent",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1735,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L1735"
      }
    },
    "providerOptions-1649f94a4e5e": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific metadata. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1741,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L1741"
      }
    },
    "role-27bc21560f98": {
      "name": "role",
      "type": "\"tool\"",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1805,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L1805"
      }
    },
    "content-489efe726dd4": {
      "name": "content",
      "type": "ToolContent",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1806,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L1806"
      }
    },
    "providerOptions-fd446947bc10": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific metadata. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1812,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.74",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.74/dist/index.d.ts#L1812"
      }
    },
    "images-5e3daa468130": {
      "name": "images",
      "type": "DataContent[]",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7600,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7600"
      }
    },
    "text-44720aaced31": {
      "name": "text",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 7601,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L7601"
      }
    },
    "base64-c3f892cd6414": {
      "name": "base64",
      "type": "string",
      "optional": false,
      "description": "File as a base64 encoded string.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 1203,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L1203"
      }
    },
    "uint8Array-0ab6dcaf1c56": {
      "name": "uint8Array",
      "type": "Uint8Array<ArrayBufferLike>",
      "optional": false,
      "description": "File as a Uint8Array.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 1207,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L1207"
      }
    },
    "mediaType-bd46b3644604": {
      "name": "mediaType",
      "type": "string",
      "optional": false,
      "description": "The IANA media type of the file.",
      "tags": [
        {
          "name": "see",
          "text": "https://www.iana.org/assignments/media-types/media-types.xhtml"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 1213,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L1213"
      }
    },
    "providerMetadata-38a36c15e990": {
      "name": "providerMetadata",
      "type": "Record<string, JSONObject> | undefined",
      "optional": true,
      "description": "Provider-specific metadata for this file.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 1217,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L1217"
      }
    },
    "format-abeb330ea542": {
      "name": "format",
      "type": "string",
      "optional": false,
      "description": "Audio format of the file (e.g., 'mp3', 'wav', etc.)",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 9448,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L9448"
      }
    },
    "type-2c4b7c1f06e1": {
      "name": "type",
      "type": "\"function\"",
      "optional": false,
      "description": "The type of the tool (always 'function').",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7343,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7343"
      }
    },
    "name-98415698ff60": {
      "name": "name",
      "type": "string",
      "optional": false,
      "description": "The name of the tool. Unique within the session.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7347,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7347"
      }
    },
    "description-765dad9c3ae1": {
      "name": "description",
      "type": "string | undefined",
      "optional": true,
      "description": "A description of what the tool does. The model uses this to decide\nwhether to call the tool.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7352,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7352"
      }
    },
    "parameters-a7ebd2b436da": {
      "name": "parameters",
      "type": "JSONSchema7",
      "optional": false,
      "description": "JSON Schema describing the parameters the tool expects.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7356,
        "package": "@ai-sdk/provider",
        "version": "4.0.35",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.35/dist/index.d.ts#L7356"
      }
    },
    "schema-6c2c7e02e817": {
      "name": "schema",
      "type": "FlexibleSchema<unknown>",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4289,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4289"
      }
    },
    "name-06a2b2b44852": {
      "name": "name",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional name of the output that should be generated.\nUsed by some providers for additional LLM guidance, e.g. via tool or schema name.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4294,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4294"
      }
    },
    "description-09f4aee69855": {
      "name": "description",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional description of the output that should be generated.\nUsed by some providers for additional LLM guidance, e.g. via tool or schema description.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4299,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4299"
      }
    },
    "element-91da8658bc12": {
      "name": "element",
      "type": "FlexibleSchema<unknown>",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4314,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4314"
      }
    },
    "minItems-af67e565c2af": {
      "name": "minItems",
      "type": "number | undefined",
      "optional": true,
      "description": "Optional minimum number of elements to generate.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4318,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4318"
      }
    },
    "maxItems-83b91f99b871": {
      "name": "maxItems",
      "type": "number | undefined",
      "optional": true,
      "description": "Optional maximum number of elements to generate.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4322,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4322"
      }
    },
    "name-0fc0260efcb7": {
      "name": "name",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional name of the output that should be generated.\nUsed by some providers for additional LLM guidance, e.g. via tool or schema name.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4327,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4327"
      }
    },
    "description-4c42d2df1bbb": {
      "name": "description",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional description of the output that should be generated.\nUsed by some providers for additional LLM guidance, e.g. via tool or schema description.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4332,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4332"
      }
    },
    "options-6fc25659e8c1": {
      "name": "options",
      "type": "string[]",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4345,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4345"
      }
    },
    "name-71d67ed50215": {
      "name": "name",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional name of the output that should be generated.\nUsed by some providers for additional LLM guidance, e.g. via tool or schema name.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4350,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4350"
      }
    },
    "description-5989d1faa9c5": {
      "name": "description",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional description of the output that should be generated.\nUsed by some providers for additional LLM guidance, e.g. via tool or schema description.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4355,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4355"
      }
    },
    "name-29ff40758bf7": {
      "name": "name",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional name of the output that should be generated.\nUsed by some providers for additional LLM guidance, e.g. via tool or schema name.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4371,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4371"
      }
    },
    "description-43c7639c81e5": {
      "name": "description",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional description of the output that should be generated.\nUsed by some providers for additional LLM guidance, e.g. via tool or schema description.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index.d.ts",
        "line": 4376,
        "package": "ai",
        "version": "7.0.162",
        "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4376"
      }
    },
    "blockStart-f5e2528ea25e": {
      "name": "blockStart",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "blockEnd-0f749e13b000": {
      "name": "blockEnd",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "variableStart-05fdbed68441": {
      "name": "variableStart",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "variableEnd-f77e2116f6e3": {
      "name": "variableEnd",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "commentStart-b8315042f228": {
      "name": "commentStart",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "commentEnd-d74f77fd5dec": {
      "name": "commentEnd",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "useCache-fea750cb2b63": {
      "name": "useCache",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    },
    "async-83ca33f9d83e": {
      "name": "async",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "../cascada/dist/types/index.d.ts"
      }
    }
  },
  "details": {
    "Telemetry": {
      "type": "Telemetry",
      "variants": [
        {
          "type": "Telemetry",
          "shape": "Telemetry:0"
        }
      ]
    },
    "Timeout": {
      "type": "Timeout",
      "variants": [
        {
          "type": "number",
          "shape": "Timeout:0"
        },
        {
          "type": "{ totalMs?: number; stepMs?: number; firstChunkMs?: number; chunkMs?: number; toolMs?: number; tools?: Partial<Record<`${string}Ms`, number>> | undefined; }",
          "shape": "Timeout:1"
        }
      ]
    },
    "StreamInclude": {
      "type": "import(\"ai\").StreamTextInclude",
      "variants": [
        {
          "type": "import(\"ai\").StreamTextInclude",
          "shape": "StreamInclude:0"
        }
      ]
    },
    "AudioFormat": {
      "type": "import(\"@ai-sdk/provider\").SharedV4AudioFormat",
      "variants": [
        {
          "type": "import(\"@ai-sdk/provider\").SharedV4AudioFormat",
          "shape": "AudioFormat:0"
        }
      ]
    },
    "SessionTranscription": {
      "type": "{ model?: string; language?: string; prompt?: string; }",
      "variants": [
        {
          "type": "{ model?: string; language?: string; prompt?: string; }",
          "shape": "SessionTranscription:0"
        }
      ]
    },
    "TurnDetection": {
      "type": "TurnDetection",
      "variants": [
        {
          "type": "null",
          "shape": "TurnDetection:0"
        },
        {
          "type": "{ type: \"server-vad\" | \"semantic-vad\" | \"disabled\"; threshold?: number; silenceDurationMs?: number; prefixPaddingMs?: number; }",
          "shape": "TurnDetection:1"
        }
      ]
    },
    "DecisionQuestion": {
      "type": "import(\"ai\").Experimental_DecisionQuestion",
      "variants": [
        {
          "type": "{ readonly type: \"choice\"; readonly instructions?: import(\"@ai-sdk/provider\").Experimental_DecisionModelV4Input | null; readonly criteria: Readonly<Record<string, import(\"@ai-sdk/provider\").Experimental_DecisionModelV4Input | null>>; }",
          "shape": "DecisionQuestion:0"
        },
        {
          "type": "{ readonly type: \"score\"; readonly instructions?: import(\"@ai-sdk/provider\").Experimental_DecisionModelV4Input | null; readonly criteria: readonly (import(\"@ai-sdk/provider\").Experimental_DecisionModelV4Input | null)[]; }",
          "shape": "DecisionQuestion:1"
        },
        {
          "type": "{ readonly type: \"box\"; readonly instructions: import(\"@ai-sdk/provider\").Experimental_DecisionModelV4Input; }",
          "shape": "DecisionQuestion:2"
        },
        {
          "type": "{ readonly type: \"boolean\"; readonly instructions?: import(\"@ai-sdk/provider\").Experimental_DecisionModelV4Input | null; readonly criteria?: { readonly true?: import(\"@ai-sdk/provider\").Experimental_DecisionModelV4Input | null; readonly false?: import(\"@ai-sdk/provider\").Experimental_DecisionModelV4Input | null; }; }",
          "shape": "DecisionQuestion:3"
        }
      ]
    },
    "ModelMessage": {
      "type": "import(\"ai\").ModelMessage",
      "variants": [
        {
          "type": "import(\"ai\").SystemModelMessage",
          "shape": "ModelMessage:0"
        },
        {
          "type": "import(\"ai\").UserModelMessage",
          "shape": "ModelMessage:1"
        },
        {
          "type": "import(\"ai\").AssistantModelMessage",
          "shape": "ModelMessage:2"
        },
        {
          "type": "import(\"ai\").ToolModelMessage",
          "shape": "ModelMessage:3"
        }
      ]
    },
    "ImagePrompt": {
      "type": "{ images: Array<import(\"ai\").DataContent>; text?: string; mask?: import(\"ai\").DataContent; }",
      "variants": [
        {
          "type": "{ images: Array<import(\"ai\").DataContent>; text?: string; mask?: import(\"ai\").DataContent; }",
          "shape": "ImagePrompt:0"
        }
      ]
    },
    "GeneratedFile": {
      "type": "import(\"ai\").GeneratedFile",
      "variants": [
        {
          "type": "import(\"ai\").GeneratedFile",
          "shape": "GeneratedFile:0"
        }
      ]
    },
    "GeneratedAudioFile": {
      "type": "import(\"ai\").GeneratedAudioFile",
      "variants": [
        {
          "type": "import(\"ai\").GeneratedAudioFile",
          "shape": "GeneratedAudioFile:0"
        }
      ]
    },
    "RealtimeToolDefinition": {
      "type": "import(\"@ai-sdk/provider\").Experimental_RealtimeModelV4ToolDefinition",
      "variants": [
        {
          "type": "import(\"@ai-sdk/provider\").Experimental_RealtimeModelV4ToolDefinition",
          "shape": "RealtimeToolDefinition:0"
        }
      ]
    },
    "OutputObject": {
      "type": "{ schema: import(\"ai\").FlexibleSchema<unknown>; name?: string; description?: string; }",
      "variants": [
        {
          "type": "{ schema: import(\"ai\").FlexibleSchema<unknown>; name?: string; description?: string; }",
          "shape": "OutputObject:0"
        }
      ]
    },
    "OutputArray": {
      "type": "{ element: import(\"ai\").FlexibleSchema<unknown>; minItems?: number; maxItems?: number; name?: string; description?: string; }",
      "variants": [
        {
          "type": "{ element: import(\"ai\").FlexibleSchema<unknown>; minItems?: number; maxItems?: number; name?: string; description?: string; }",
          "shape": "OutputArray:0"
        }
      ]
    },
    "OutputChoice": {
      "type": "{ options: string[]; name?: string; description?: string; }",
      "variants": [
        {
          "type": "{ options: string[]; name?: string; description?: string; }",
          "shape": "OutputChoice:0"
        }
      ]
    },
    "OutputJSON": {
      "type": "{ name?: string; description?: string; }",
      "variants": [
        {
          "type": "{ name?: string; description?: string; }",
          "shape": "OutputJSON:0"
        }
      ]
    },
    "RenderTags": {
      "type": "{ blockStart?: string | undefined; blockEnd?: string | undefined; variableStart?: string | undefined; variableEnd?: string | undefined; commentStart?: string | undefined; commentEnd?: string | undefined; }",
      "variants": [
        {
          "type": "{ blockStart?: string | undefined; blockEnd?: string | undefined; variableStart?: string | undefined; variableEnd?: string | undefined; commentStart?: string | undefined; commentEnd?: string | undefined; }",
          "shape": "RenderTags:0"
        }
      ]
    },
    "RenderWeb": {
      "type": "{ useCache?: boolean | undefined; async?: boolean | undefined; }",
      "variants": [
        {
          "type": "{ useCache?: boolean | undefined; async?: boolean | undefined; }",
          "shape": "RenderWeb:0"
        }
      ]
    }
  },
  "documentation": {
    "Decision_result": {
      "answers": {
        "description": "One typed answer per question ID, with literal Choice option inference.",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/14-decide.mdx",
          "line": 66,
          "package": "ai",
          "version": "7.0.162",
          "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/14-decide.mdx#L12",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/decide"
        }
      },
      "usage": {
        "description": "`inputTokens`, `outputTokens`, and `totalTokens`, each possibly undefined.",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/14-decide.mdx",
          "line": 67,
          "package": "ai",
          "version": "7.0.162",
          "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/14-decide.mdx#L12",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/decide"
        }
      },
      "warnings": {
        "description": "Provider warnings, also passed to the SDK warning logger.",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/14-decide.mdx",
          "line": 68,
          "package": "ai",
          "version": "7.0.162",
          "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/14-decide.mdx#L12",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/decide"
        }
      },
      "rounding": {
        "description": "Optional provider-declared decimal precision for probabilities and scores.",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/14-decide.mdx",
          "line": 69,
          "package": "ai",
          "version": "7.0.162",
          "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/14-decide.mdx#L12",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/decide"
        }
      },
      "providerMetadata": {
        "description": "Optional provider-specific metadata.",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/14-decide.mdx",
          "line": 70,
          "package": "ai",
          "version": "7.0.162",
          "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/14-decide.mdx#L12",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/decide"
        }
      },
      "response": {
        "description": "Timestamp, model ID, and optional response ID, headers, and body.",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/14-decide.mdx",
          "line": 71,
          "package": "ai",
          "version": "7.0.162",
          "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/14-decide.mdx#L12",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/decide"
        }
      }
    },
    "OutputObject:0": {
      "schema": {
        "description": "The schema of the object to generate.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index.d.ts",
          "line": 4288,
          "package": "ai",
          "version": "7.0.162",
          "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4288"
        }
      }
    },
    "OutputArray:0": {
      "element": {
        "description": "The schema of the array elements to generate.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index.d.ts",
          "line": 4313,
          "package": "ai",
          "version": "7.0.162",
          "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4313"
        }
      }
    },
    "OutputChoice:0": {
      "options": {
        "description": "The available choices.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index.d.ts",
          "line": 4344,
          "package": "ai",
          "version": "7.0.162",
          "url": "https://unpkg.com/ai@7.0.162/dist/index.d.ts#L4344"
        }
      }
    },
    "OutputJSON:0": {}
  }
};
