// Generated from installed public declarations. AI SDK: Apache-2.0; Cascada: BSD-2-Clause.
// Modified by Casai: extracted, deduplicated and grouped for documentation. See THIRD_PARTY.md for notices and licenses.
export default {
  "packages": {
    "casai": "0.6.2",
    "ai": "7.0.183",
    "@ai-sdk/provider-utils": "5.0.85",
    "@ai-sdk/provider": "4.0.39",
    "cascada-engine": "0.7.0"
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
        "async-template",
        "async-template-name",
        "async-script",
        "async-script-name",
        "text",
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
        "async-template",
        "async-template-name",
        "async-script",
        "async-script-name",
        "text",
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
        "async-template",
        "async-template-name",
        "async-script",
        "async-script-name",
        "text",
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
        "async-template",
        "async-template-name",
        "async-script",
        "async-script-name",
        "text",
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
        "async-template",
        "async-template-name",
        "async-script",
        "async-script-name",
        "text",
        "text-name"
      ],
      "required": [
        "model"
      ]
    },
    "Transcriber": {
      "name": "Transcriber",
      "main": "audio",
      "defaultMode": "text",
      "modifiers": {
        "withAudio": "text",
        "loadsAudio": "audio-resource",
        "withScript": "async-script",
        "withFunction": "function",
        "loadsScript": "async-script-name"
      },
      "toolModes": [
        "function",
        "async-script",
        "async-script-name",
        "text",
        "audio-resource"
      ],
      "required": [
        "model"
      ],
      "asStream": true
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
        "async-template",
        "async-template-name",
        "async-script",
        "async-script-name",
        "text",
        "text-name"
      ],
      "required": [
        "model"
      ],
      "asStream": true
    },
    "Translator": {
      "name": "Translator",
      "defaultMode": "text",
      "main": "audio",
      "modifiers": {
        "withAudio": "text",
        "loadsAudio": "audio-resource",
        "withScript": "async-script",
        "withFunction": "function",
        "loadsScript": "async-script-name"
      },
      "toolModes": [
        "function",
        "async-script",
        "async-script-name",
        "text",
        "audio-resource"
      ],
      "required": [
        "model"
      ],
      "toolRequired": [
        "inputAudioFormat",
        "targetLanguage"
      ],
      "asStream": true
    },
    "VoiceAgentBackend": {
      "name": "VoiceAgentBackend",
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
    },
    "TranscriberStream": {
      "name": "Transcriber",
      "main": "audio",
      "defaultMode": "text",
      "modifiers": {
        "withAudio": "text",
        "loadsAudio": "audio-resource",
        "withScript": "async-script",
        "withFunction": "function",
        "loadsScript": "async-script-name"
      },
      "toolModes": [
        "function",
        "async-script",
        "async-script-name",
        "text",
        "audio-resource"
      ],
      "required": [
        "model"
      ],
      "asStream": true
    },
    "SpeechGeneratorStream": {
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
        "async-template",
        "async-template-name",
        "async-script",
        "async-script-name",
        "text",
        "text-name"
      ],
      "required": [
        "model"
      ],
      "asStream": true
    },
    "TranslatorStream": {
      "name": "Translator",
      "defaultMode": "text",
      "main": "audio",
      "modifiers": {
        "withAudio": "text",
        "loadsAudio": "audio-resource",
        "withScript": "async-script",
        "withFunction": "function",
        "loadsScript": "async-script-name"
      },
      "toolModes": [
        "function",
        "async-script",
        "async-script-name",
        "text",
        "audio-resource"
      ],
      "required": [
        "model"
      ],
      "toolRequired": [
        "inputAudioFormat",
        "targetLanguage"
      ],
      "asStream": true
    },
    "VoiceAgentClient": {
      "name": "VoiceAgentClient",
      "main": null,
      "defaultMode": null,
      "modifiers": {},
      "toolModes": [],
      "required": [
        "model",
        "api"
      ],
      "fixedSettings": [
        "model"
      ]
    },
    "VideoGenerator": {
      "name": "VideoGenerator",
      "main": "prompt",
      "defaultMode": "text",
      "structured": "image",
      "modifiers": {
        "withText": "text",
        "withTemplate": "async-template",
        "withScript": "async-script",
        "withFunction": "function",
        "loadsText": "text-name",
        "loadsTemplate": "async-template-name",
        "loadsScript": "async-script-name"
      },
      "toolModes": [
        "text",
        "async-template",
        "async-script",
        "function",
        "text-name",
        "async-template-name",
        "async-script-name"
      ],
      "required": [
        "model"
      ]
    }
  },
  "shapes": {
    "Template_config": [
      "inputSchema-f335a5a81f68",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "tools-05ebb5c95a02",
      "toolsContext-492a80518673",
      "template-902b6327f5ff"
    ],
    "Template_settings": [
      "template-902b6327f5ff",
      "inputSchema-f335a5a81f68",
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
      "inputSchema-f335a5a81f68",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "tools-05ebb5c95a02",
      "toolsContext-492a80518673",
      "schema-288e8cf2b21a",
      "script-56e0c02bea00"
    ],
    "Script_settings": [
      "script-3ee7336160ef",
      "schema-288e8cf2b21a",
      "inputSchema-f335a5a81f68",
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
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "tools-d8cac053f1e9",
      "toolsContext-be97e33328f3",
      "runtimeContext-c62c730fa462",
      "providerOptions-6db661b2b6a7",
      "id-7c420ba44547",
      "output-960376aadf77",
      "maxOutputTokens-3750aae06b78",
      "temperature-c970b1ef9f50",
      "topP-8c117ff138cd",
      "topK-07df4c014c42",
      "presencePenalty-27e20b4c1aa5",
      "frequencyPenalty-32bb1198f9f5",
      "stopSequences-2eefa8740e8d",
      "seed-c03ecfd73f92",
      "reasoning-b90f40e6fd96",
      "maxRetries-0aedd6c52d2f",
      "headers-b4f0a59701e0",
      "timeout-439a1a41320c",
      "instructions-7a09e697e800",
      "allowSystemInMessages-48822b7d4b46",
      "prompt-dbcb70464d4d",
      "model-13928364de1c",
      "toolChoice-f6a9fedbe1b4",
      "telemetry-76723a22b41f",
      "experimental_sandbox-bd7685f3dca4",
      "experimental_steering-a70a6a3f26bf",
      "activeTools-7a4674c83084",
      "toolOrder-e46202be091c",
      "toolCallConcurrency-769ff7ccf7bf",
      "experimental_toolCallers-8a752bb63e36",
      "experimental_toolApprovalSecret-5573519278c4",
      "include-74de729ed750",
      "streamRetries-ca6a5025c0f4",
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
      "onWarning-297284192218",
      "onEnd-3644bf4f2d1c",
      "experimental_transform-89cd4ae316b3",
      "onChunk-53740e0f058c",
      "onError-74cbedca876d",
      "onAbort-1aceb31e0923",
      "prepareCall-1ce8440c2874",
      "prepareStep-b1fc7f13d5d4"
    ],
    "LLMAgent_settings": [
      "runtimeContext-c62c730fa462",
      "providerOptions-6db661b2b6a7",
      "maxOutputTokens-3750aae06b78",
      "temperature-c970b1ef9f50",
      "topP-8c117ff138cd",
      "topK-07df4c014c42",
      "presencePenalty-27e20b4c1aa5",
      "frequencyPenalty-32bb1198f9f5",
      "stopSequences-2eefa8740e8d",
      "seed-c03ecfd73f92",
      "reasoning-b90f40e6fd96",
      "maxRetries-0aedd6c52d2f",
      "headers-b4f0a59701e0",
      "timeout-439a1a41320c",
      "instructions-7a09e697e800",
      "allowSystemInMessages-48822b7d4b46",
      "model-13928364de1c",
      "toolChoice-f6a9fedbe1b4",
      "stopWhen-a9b64708c252",
      "telemetry-76723a22b41f",
      "experimental_sandbox-bd7685f3dca4",
      "experimental_steering-a70a6a3f26bf",
      "activeTools-7a4674c83084",
      "toolOrder-e46202be091c",
      "toolCallConcurrency-769ff7ccf7bf",
      "toolApproval-665a216dd014",
      "experimental_toolCallers-8a752bb63e36",
      "experimental_toolApprovalSecret-5573519278c4",
      "experimental_download-393316c82a64",
      "repairToolCall-4ef13c129648",
      "experimental_refineToolInput-52f1527d50cb",
      "onStart-42f1d1a13de4",
      "onStepStart-067e2bce6aa3",
      "onLanguageModelCallStart-dece0ed4d633",
      "onLanguageModelCallEnd-411f0968c4d3",
      "onToolExecutionStart-4db0a212fd81",
      "onToolExecutionEnd-7870e85a04eb",
      "onStepEnd-ba0cc25c5ad8",
      "onStepError-4c8aed2d1926",
      "onWarning-191f1b180e1d",
      "onEnd-c8c7c2a69e22",
      "include-74de729ed750",
      "experimental_transform-b422736429cc",
      "onChunk-480ac277c91c",
      "onError-a7cf8c7fafff",
      "streamRetries-ca6a5025c0f4",
      "onAbort-cdaba3ea32c8",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "id-7c420ba44547",
      "output-960376aadf77",
      "prompt-dbcb70464d4d",
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
      "runtimeContext-8a3992767dfe",
      "providerOptions-29e64ad26a6f",
      "maxOutputTokens-498165f4e1a0",
      "reasoning-27d347c98943",
      "maxRetries-3fefe762577b",
      "headers-a3d764ab0c98",
      "model-b7ad5611d42d",
      "telemetry-4c63aa57ec78",
      "experimental_download-f84372d2c444",
      "onStart-6da1bb86471a",
      "onEnd-0f1f14485409",
      "questions-d277213afc57",
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
      "toolsContext-a026c14e3010"
    ],
    "Decision_settings": [
      "runtimeContext-8a3992767dfe",
      "providerOptions-29e64ad26a6f",
      "maxOutputTokens-498165f4e1a0",
      "reasoning-27d347c98943",
      "maxRetries-3fefe762577b",
      "abortSignal-3a1691fafbe4",
      "headers-a3d764ab0c98",
      "model-63f39539b350",
      "telemetry-4c63aa57ec78",
      "experimental_download-f84372d2c444",
      "onStart-6da1bb86471a",
      "onEnd-0f1f14485409",
      "questions-d277213afc57",
      "state-39541375053d"
    ],
    "Decision_inputs": [
      "direct-80c1b590bd26",
      "template-b1e3d963012c",
      "prepared-37a4f0163687"
    ],
    "Embedder_config": [
      "runtimeContext-d4297944fc22",
      "providerOptions-0bb12806283e",
      "maxRetries-1be77b6e9667",
      "headers-f9a6d9652a0a",
      "model-6ce7e7fa24a7",
      "telemetry-782f21ecc894",
      "experimental_telemetry-6118399298d7",
      "onStart-59e1fe0d9bb3",
      "experimental_onStart-409901f14373",
      "onEnd-8a2f9fb05c9a",
      "dimensions-a7263b5ea914",
      "maxParallelCalls-63a7ab93a66d",
      "experimental_onEnd-6a0e5dc8aa36",
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
      "toolsContext-a026c14e3010"
    ],
    "Embedder_settings": [
      "runtimeContext-d4297944fc22",
      "providerOptions-0bb12806283e",
      "maxRetries-1be77b6e9667",
      "abortSignal-6f1530bb4f0a",
      "headers-f9a6d9652a0a",
      "model-2ee72b6f6776",
      "telemetry-782f21ecc894",
      "experimental_telemetry-6118399298d7",
      "onStart-59e1fe0d9bb3",
      "experimental_onStart-409901f14373",
      "onEnd-8a2f9fb05c9a",
      "dimensions-a7263b5ea914",
      "maxParallelCalls-63a7ab93a66d",
      "experimental_onEnd-6a0e5dc8aa36",
      "input-dcc8da217a5c"
    ],
    "Embedder_inputs": [
      "direct-fce20620be48",
      "template-7349d7682caf",
      "prepared-2ea72cf3d6e5"
    ],
    "Reranker_config": [
      "runtimeContext-fbc34eb108be",
      "providerOptions-bacef9bb6be2",
      "maxRetries-1030d178c8ef",
      "headers-5dcd71a1709f",
      "model-c3cf2da0831a",
      "telemetry-9d80befce824",
      "experimental_telemetry-e56a04459ef3",
      "onStart-8f853f83ded6",
      "experimental_onStart-cbc7a2641424",
      "onEnd-87a30dcfc57c",
      "experimental_onEnd-3c1307881f56",
      "documents-978d56ce17e3",
      "topN-b63f89c590b9",
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
      "toolsContext-a026c14e3010"
    ],
    "Reranker_settings": [
      "runtimeContext-fbc34eb108be",
      "providerOptions-bacef9bb6be2",
      "maxRetries-1030d178c8ef",
      "abortSignal-73bfcea75c49",
      "headers-5dcd71a1709f",
      "model-b9a9ad1e277f",
      "telemetry-9d80befce824",
      "experimental_telemetry-e56a04459ef3",
      "onStart-8f853f83ded6",
      "experimental_onStart-cbc7a2641424",
      "onEnd-87a30dcfc57c",
      "experimental_onEnd-3c1307881f56",
      "documents-a7b7ca1305a3",
      "query-71c9c0183347",
      "topN-b63f89c590b9"
    ],
    "Reranker_inputs": [
      "direct-c287cb6ac7c7",
      "template-7349d7682caf",
      "prepared-443e2e85b058"
    ],
    "ImageGenerator_config": [
      "providerOptions-5fcc54204c7d",
      "seed-f61917bfc1e4",
      "maxRetries-c66620af033c",
      "headers-1770c8ac0413",
      "model-bc27ce67cf0a",
      "n-71f8e80752c9",
      "maxImagesPerCall-07ad01192bf4",
      "size-a1ddd9b66299",
      "aspectRatio-0e953591963c",
      "images-7acfa9f82d1f",
      "mask-fb29f1c10bf2",
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
      "toolsContext-a026c14e3010"
    ],
    "ImageGenerator_settings": [
      "providerOptions-5fcc54204c7d",
      "seed-f61917bfc1e4",
      "maxRetries-c66620af033c",
      "abortSignal-af0f2d8911dc",
      "headers-1770c8ac0413",
      "prompt-cd1596b0bae6",
      "model-3c08b406693e",
      "n-71f8e80752c9",
      "maxImagesPerCall-07ad01192bf4",
      "size-a1ddd9b66299",
      "aspectRatio-0e953591963c",
      "images-7acfa9f82d1f",
      "mask-fb29f1c10bf2"
    ],
    "ImageGenerator_inputs": [
      "direct-2d5fd362f21e",
      "template-2885c0b86495",
      "prepared-02ae7791d4f4"
    ],
    "Transcriber_config": [
      "providerOptions-f1407026e059",
      "maxRetries-517add5497ce",
      "headers-7886326ddcda",
      "model-331c2d5419c7",
      "telemetry-e6a01e9dfd10",
      "maxPreparedAudioBytes-595959558a15",
      "sourceFormat-160cb13602cb",
      "timestampGranularities-f8ab98382618",
      "download-7fc28372c55f",
      "audio-c74e517980be",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "toolContextSchema-d7c206b57ff4",
      "inputSchema-e1f157741580",
      "tools-f8808df35909",
      "toolsContext-a026c14e3010"
    ],
    "Transcriber_settings": [
      "providerOptions-f1407026e059",
      "maxRetries-517add5497ce",
      "abortSignal-8b753a971039",
      "headers-7886326ddcda",
      "model-ab2d60d092c3",
      "telemetry-e6a01e9dfd10",
      "timestampGranularities-f8ab98382618",
      "download-7fc28372c55f",
      "maxPreparedAudioBytes-595959558a15",
      "sourceFormat-160cb13602cb",
      "audio-f4a50ca734b1"
    ],
    "Transcriber_inputs": [
      "direct-7bcd58c5299d",
      "prepared-b09ea79bc187"
    ],
    "SpeechGenerator_config": [
      "providerOptions-0391eeeaef21",
      "language-80fcf25fd716",
      "maxRetries-49b0652defa9",
      "headers-06589cfe4fcf",
      "instructions-3d37a40068de",
      "model-abbda6b55254",
      "telemetry-0bd86804edb7",
      "voice-077d0f0f81a8",
      "outputFormat-69479cff1acd",
      "speed-d74265e616d8",
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
      "toolsContext-a026c14e3010"
    ],
    "SpeechGenerator_settings": [
      "text-3e3b88fecf0f",
      "providerOptions-0391eeeaef21",
      "language-80fcf25fd716",
      "maxRetries-49b0652defa9",
      "abortSignal-2a56d4719602",
      "headers-06589cfe4fcf",
      "instructions-3d37a40068de",
      "model-1dce7990aa0b",
      "telemetry-0bd86804edb7",
      "voice-077d0f0f81a8",
      "outputFormat-69479cff1acd",
      "speed-d74265e616d8"
    ],
    "SpeechGenerator_inputs": [
      "direct-5306f56796f6",
      "prepared-b47e988fe35e",
      "template-7349d7682caf"
    ],
    "Translator_config": [
      "providerOptions-90a5d6a9f1ee",
      "headers-7d47ca76d094",
      "model-4789518cab57",
      "inputAudioFormat-d8322f89357f",
      "targetLanguage-8f57c47fbc72",
      "outputAudioFormat-d539c234392c",
      "maxPreparedAudioBytes-595959558a15",
      "sourceFormat-160cb13602cb",
      "sourceLanguage-ebb4e1b916d2",
      "audio-c563898406e8",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "toolContextSchema-d7c206b57ff4",
      "inputSchema-e1f157741580",
      "tools-f8808df35909",
      "toolsContext-a026c14e3010"
    ],
    "Translator_settings": [
      "providerOptions-90a5d6a9f1ee",
      "abortSignal-c0f42bc55266",
      "headers-7d47ca76d094",
      "model-246db9799f69",
      "audio-87d9e2ee44af",
      "inputAudioFormat-afb9527b3706",
      "targetLanguage-f0a3ad97c84b",
      "outputAudioFormat-d539c234392c",
      "maxPreparedAudioBytes-595959558a15",
      "sourceFormat-160cb13602cb",
      "sourceLanguage-ebb4e1b916d2"
    ],
    "Translator_inputs": [
      "direct-1d822026b786",
      "prepared-8ec1b7b87830"
    ],
    "VoiceAgentBackend_config": [
      "providerOptions-207d34914c15",
      "model-c2646b18c643",
      "inputAudioFormat-9303f715c7b4",
      "voice-a1f8a990e4c3",
      "outputModalities-c669f792f5d9",
      "inputAudioTranscription-b199469fe309",
      "outputAudioTranscription-3df77a6d2390",
      "outputAudioFormat-40273b9f1c57",
      "turnDetection-a9c515125296",
      "expiresAfterSeconds-7125d4863dda",
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
      "toolsContext-a026c14e3010"
    ],
    "VoiceAgentBackend_settings": [
      "providerOptions-207d34914c15",
      "instructions-0c459c58ac82",
      "inputAudioFormat-9303f715c7b4",
      "voice-a1f8a990e4c3",
      "outputModalities-c669f792f5d9",
      "inputAudioTranscription-b199469fe309",
      "outputAudioTranscription-3df77a6d2390",
      "outputAudioFormat-40273b9f1c57",
      "turnDetection-a9c515125296",
      "expiresAfterSeconds-7125d4863dda",
      "model-c2646b18c643"
    ],
    "VoiceAgentBackend_inputs": [
      "direct-b5cef17f1666",
      "template-7349d7682caf",
      "prepared-360e241e4dcb"
    ],
    "Tool": [
      "inputSchema-47ed76ea66b3",
      "toolContextSchema-d7c206b57ff4",
      "onInputAvailable-2fcbe53a40cf",
      "onInputStart-6db43b699e4e",
      "onInputDelta-dc6151fa688a",
      "needsApproval-1e0f61adeb0d",
      "title-a1c2f6247831",
      "deferLoading-fec45f07f745",
      "providerOptions-618cf384fe38",
      "metadata-c2317f76c82b",
      "toModelOutput-2b05fcc61141",
      "strict-4241d63003b7",
      "inputExamples-e42b4f96dfae",
      "description-e0df7f9e2319"
    ],
    "AgentRun": [
      "debug-cdff8d93c93d",
      "description-094750903948",
      "runtimeContext-c62c730fa462",
      "providerOptions-6db661b2b6a7",
      "maxOutputTokens-3750aae06b78",
      "temperature-c970b1ef9f50",
      "topP-8c117ff138cd",
      "topK-07df4c014c42",
      "presencePenalty-27e20b4c1aa5",
      "frequencyPenalty-32bb1198f9f5",
      "stopSequences-2eefa8740e8d",
      "seed-c03ecfd73f92",
      "reasoning-b90f40e6fd96",
      "maxRetries-0aedd6c52d2f",
      "headers-b4f0a59701e0",
      "timeout-0e724f13b50a",
      "instructions-7a09e697e800",
      "allowSystemInMessages-48822b7d4b46",
      "toolChoice-58cffc8c1041",
      "telemetry-5d1adc753c55",
      "experimental_sandbox-bd7685f3dca4",
      "experimental_steering-a70a6a3f26bf",
      "activeTools-06cfc51a0db3",
      "toolOrder-2a0e343c93b1",
      "toolCallConcurrency-769ff7ccf7bf",
      "experimental_toolCallers-fd1a321c4fd1",
      "experimental_toolApprovalSecret-5573519278c4",
      "include-74de729ed750",
      "streamRetries-ca6a5025c0f4",
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
      "onWarning-297284192218",
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
      "options-8fa395032d9b",
      "prompt-8d7ea27bd026",
      "messages-ed6c2b4b81e2",
      "abortSignal-8472d497301f",
      "timeout-3d7a5c777cdf",
      "onStart-8ab79d0f0fb2",
      "experimental_onStart-bdf9f9b7d2a9",
      "onStepStart-8051895eff4f",
      "experimental_onStepStart-e7ff155c4cc6",
      "onToolExecutionStart-0efd83b85d7c",
      "experimental_onToolCallStart-f78192135695",
      "onToolExecutionEnd-b14c42f13960",
      "experimental_onToolCallFinish-fbaaccdc74be",
      "onStepEnd-5ba9136cedb9",
      "onStepFinish-108a1b0e5530",
      "onEnd-5adcd5ed4951",
      "onFinish-64c97cab1f90",
      "experimental_sandbox-ca9e32143b76"
    ],
    "NativeStream": [
      "options-8fa395032d9b",
      "prompt-8d7ea27bd026",
      "messages-ed6c2b4b81e2",
      "abortSignal-8472d497301f",
      "timeout-ba7665ff386c",
      "onStart-38c32622c842",
      "experimental_onStart-d03a46de5ea8",
      "onStepStart-61964b5201ef",
      "experimental_onStepStart-b6023181e588",
      "onToolExecutionStart-b0f5666b9163",
      "experimental_onToolCallStart-c0d4f80bf7e9",
      "onToolExecutionEnd-d0cb63f0a4eb",
      "experimental_onToolCallFinish-6975a1e4c99c",
      "onStepEnd-e2a3cff813fa",
      "onStepFinish-ea5fa4554781",
      "onEnd-974d471b67c6",
      "onFinish-512100d5c453",
      "experimental_sandbox-ca9e32143b76",
      "experimental_transform-7db3258bd060"
    ],
    "GenerateSettings": [
      "maxOutputTokens-3750aae06b78",
      "temperature-c970b1ef9f50",
      "topP-8c117ff138cd",
      "topK-07df4c014c42",
      "presencePenalty-27e20b4c1aa5",
      "frequencyPenalty-32bb1198f9f5",
      "stopSequences-2eefa8740e8d",
      "seed-c03ecfd73f92",
      "reasoning-b90f40e6fd96",
      "maxRetries-0aedd6c52d2f",
      "abortSignal-332106eb39a3",
      "headers-b4f0a59701e0",
      "timeout-439a1a41320c",
      "instructions-7a09e697e800",
      "system-77b926aa15b3",
      "allowSystemInMessages-48822b7d4b46",
      "prompt-9441b69dcea1",
      "messages-43bee1c696a9",
      "tools-5efdda627cc8",
      "model-09a947404281",
      "toolChoice-427c5a9308b0",
      "stopWhen-5eaba03d41fc",
      "telemetry-83a18a73674f",
      "experimental_telemetry-308f34bd840d",
      "providerOptions-bd08c56812f2",
      "experimental_sandbox-37021c1de022",
      "experimental_steering-460ceb38c418",
      "runtimeContext-afa54abaf1a9",
      "activeTools-f03d9ff9a732",
      "toolOrder-2d0fea3811dd",
      "toolCallConcurrency-bc88af60dd58",
      "output-0c868bea346c",
      "toolApproval-d051fbd5a943",
      "experimental_toolCallers-2a0384aa9261",
      "experimental_toolApprovalSecret-396b6f71c894",
      "experimental_download-598dda901e60",
      "prepareStep-aafaa9f826d3",
      "repairToolCall-6d6832910cc0",
      "experimental_repairToolCall-d304098a1b19",
      "experimental_refineToolInput-b39b71a0bddd",
      "onStart-89fac7e39631",
      "experimental_onStart-5921bc4f853e",
      "onStepStart-220427497ee7",
      "experimental_onStepStart-0a99f50815e7",
      "onLanguageModelCallStart-81f4947eef8c",
      "experimental_onLanguageModelCallStart-efe693c1dc1b",
      "onLanguageModelCallEnd-fa88d24172ce",
      "experimental_onLanguageModelCallEnd-48f9fd5c2d62",
      "onToolExecutionStart-a060181acc9b",
      "experimental_onToolCallStart-6fe11ac760e4",
      "onToolExecutionEnd-478ae59f9ea8",
      "experimental_onToolCallFinish-2ef361bbbc6c",
      "onStepEnd-2aaf83f6abe4",
      "onStepError-63d00bbd0ad0",
      "onWarning-b25f03d5708f",
      "onStepFinish-c3f5f84cadd0",
      "onEnd-f5cf86d09704",
      "onFinish-addf70b8ab33",
      "include-f5921751b4c7",
      "experimental_include-66b1c9615325",
      "_internal-4f7a05af8f2b"
    ],
    "StreamSettings": [
      "maxOutputTokens-3750aae06b78",
      "temperature-c970b1ef9f50",
      "topP-8c117ff138cd",
      "topK-07df4c014c42",
      "presencePenalty-27e20b4c1aa5",
      "frequencyPenalty-32bb1198f9f5",
      "stopSequences-2eefa8740e8d",
      "seed-c03ecfd73f92",
      "reasoning-b90f40e6fd96",
      "maxRetries-0aedd6c52d2f",
      "abortSignal-332106eb39a3",
      "headers-b4f0a59701e0",
      "timeout-439a1a41320c",
      "instructions-7a09e697e800",
      "system-77b926aa15b3",
      "allowSystemInMessages-48822b7d4b46",
      "prompt-9441b69dcea1",
      "messages-43bee1c696a9",
      "tools-5efdda627cc8",
      "model-13928364de1c",
      "toolChoice-f6a9fedbe1b4",
      "stopWhen-1269c94bf274",
      "telemetry-7f5176f31df4",
      "experimental_telemetry-4f7675b48d9c",
      "providerOptions-6db661b2b6a7",
      "experimental_sandbox-bd7685f3dca4",
      "experimental_steering-a70a6a3f26bf",
      "runtimeContext-6fe9258c1451",
      "activeTools-7a4674c83084",
      "toolOrder-e46202be091c",
      "toolCallConcurrency-769ff7ccf7bf",
      "output-56ac795cb09d",
      "toolApproval-e6f9c22d9b3c",
      "experimental_toolCallers-8a752bb63e36",
      "experimental_toolApprovalSecret-5573519278c4",
      "prepareStep-d9f1f942f148",
      "repairToolCall-4ef13c129648",
      "experimental_repairToolCall-2aa1d06c3008",
      "experimental_refineToolInput-52f1527d50cb",
      "experimental_transform-b422736429cc",
      "experimental_download-393316c82a64",
      "includeRawChunks-eb80fd3d4f31",
      "onChunk-480ac277c91c",
      "onError-a7cf8c7fafff",
      "streamRetries-ca6a5025c0f4",
      "onEnd-fe63bb2f27cd",
      "onFinish-c4bddcf07443",
      "onAbort-a9107997a88b",
      "onStepEnd-195f794ee38b",
      "onStepError-4d72b82e99ae",
      "onWarning-191f1b180e1d",
      "onStepFinish-58089e235735",
      "onStart-0ec99fbf5859",
      "experimental_onStart-0d26a8d8a29b",
      "onStepStart-d30a78139419",
      "experimental_onStepStart-9068893fd70f",
      "onLanguageModelCallStart-dece0ed4d633",
      "experimental_onLanguageModelCallStart-39509eb3527f",
      "onLanguageModelCallEnd-411f0968c4d3",
      "experimental_onLanguageModelCallEnd-1343c276d17a",
      "onToolExecutionStart-4db0a212fd81",
      "experimental_onToolCallStart-c8484c1add9d",
      "onToolExecutionEnd-7870e85a04eb",
      "experimental_onToolCallFinish-988da25c5643",
      "include-74de729ed750",
      "experimental_include-6f60b3b599e8",
      "_internal-aaa986384177"
    ],
    "RenderOptions": [
      "replayAsyncIterables-1922b83c46d7",
      "autoescape-0fd82da2d919",
      "throwOnUndefined-fa7eeddad50a",
      "trimBlocks-a103e1e5c1c7",
      "lstripBlocks-360a57b29864",
      "watch-6c8d7c97cb8b",
      "noCache-c16665203f1a",
      "dev-c66bed597c2b",
      "web-026db73498ee",
      "express-6645ad524cc8",
      "tags-b567e55e7b4a"
    ],
    "ExecutionOptions": [
      "abortSignal-c02e8d90cdb1",
      "experimental_sandbox-2c067d8f8a99",
      "toolCallId-2f21e5d47936",
      "messages-09b7b90bc227"
    ],
    "Output": [
      "array-8ef7a1a38be3",
      "choice-40a88fdac013",
      "json-7cf712295f6b",
      "object-297d79bfd094",
      "text-5150d90812b9"
    ],
    "SessionConfig": [
      "instructions-0c459c58ac82",
      "voice-a1f8a990e4c3",
      "outputModalities-c669f792f5d9",
      "inputAudioFormat-9303f715c7b4",
      "inputAudioTranscription-b199469fe309",
      "outputAudioTranscription-3df77a6d2390",
      "outputAudioFormat-40273b9f1c57",
      "turnDetection-a9c515125296",
      "tools-5b3941793a8a",
      "providerOptions-207d34914c15"
    ],
    "VoiceSessionConfig_result": [
      "instructions-0c459c58ac82",
      "voice-a1f8a990e4c3",
      "outputModalities-c669f792f5d9",
      "inputAudioFormat-9303f715c7b4",
      "inputAudioTranscription-b199469fe309",
      "outputAudioTranscription-3df77a6d2390",
      "outputAudioFormat-40273b9f1c57",
      "turnDetection-a9c515125296",
      "tools-5b3941793a8a",
      "providerOptions-207d34914c15"
    ],
    "VoiceWebRTC_result": [
      "sessionId-b6fc27964320",
      "sdp-fcadac34b4d5"
    ],
    "LLMAgent_result": [
      "content-422e8740c5ce",
      "text-0571a906f1c8",
      "reasoning-5c68a3f61406",
      "reasoningText-680764399433",
      "files-f05da7bef5bd",
      "sources-0a2f6b60c182",
      "toolCalls-069ebdd0ca5a",
      "staticToolCalls-882a07a64732",
      "dynamicToolCalls-3b90509703b5",
      "toolResults-c5f99b80b2d0",
      "staticToolResults-627995dc28d7",
      "dynamicToolResults-5a02069c1994",
      "finishReason-5565b4913800",
      "rawFinishReason-afbf2b9573a4",
      "stoppedBy-d38eb1c0a082",
      "usage-082e2510cd29",
      "totalUsage-ed2630036869",
      "warnings-f58b24a208a7",
      "request-c3b04b1c5cd8",
      "response-38f289615619",
      "responseMessages-7bccbd62b234",
      "providerMetadata-0788c47db8e0",
      "steps-2cb49aa694a9",
      "finalStep-8efda235ab02",
      "output-c06c5091c887"
    ],
    "LLMAgent_native": [
      "maxOutputTokens-3750aae06b78",
      "temperature-c970b1ef9f50",
      "topP-8c117ff138cd",
      "topK-07df4c014c42",
      "presencePenalty-27e20b4c1aa5",
      "frequencyPenalty-32bb1198f9f5",
      "stopSequences-2eefa8740e8d",
      "seed-c03ecfd73f92",
      "reasoning-b90f40e6fd96",
      "maxRetries-0aedd6c52d2f",
      "abortSignal-332106eb39a3",
      "headers-b4f0a59701e0",
      "timeout-439a1a41320c",
      "instructions-7a09e697e800",
      "system-77b926aa15b3",
      "allowSystemInMessages-48822b7d4b46",
      "prompt-9441b69dcea1",
      "messages-43bee1c696a9",
      "tools-5efdda627cc8",
      "model-09a947404281",
      "toolChoice-427c5a9308b0",
      "stopWhen-5eaba03d41fc",
      "telemetry-83a18a73674f",
      "experimental_telemetry-308f34bd840d",
      "providerOptions-bd08c56812f2",
      "experimental_sandbox-37021c1de022",
      "experimental_steering-460ceb38c418",
      "runtimeContext-afa54abaf1a9",
      "activeTools-f03d9ff9a732",
      "toolOrder-2d0fea3811dd",
      "toolCallConcurrency-bc88af60dd58",
      "output-0c868bea346c",
      "toolApproval-d051fbd5a943",
      "experimental_toolCallers-2a0384aa9261",
      "experimental_toolApprovalSecret-396b6f71c894",
      "experimental_download-598dda901e60",
      "prepareStep-aafaa9f826d3",
      "repairToolCall-6d6832910cc0",
      "experimental_repairToolCall-d304098a1b19",
      "experimental_refineToolInput-b39b71a0bddd",
      "onStart-89fac7e39631",
      "experimental_onStart-5921bc4f853e",
      "onStepStart-220427497ee7",
      "experimental_onStepStart-0a99f50815e7",
      "onLanguageModelCallStart-81f4947eef8c",
      "experimental_onLanguageModelCallStart-efe693c1dc1b",
      "onLanguageModelCallEnd-fa88d24172ce",
      "experimental_onLanguageModelCallEnd-48f9fd5c2d62",
      "onToolExecutionStart-a060181acc9b",
      "experimental_onToolCallStart-6fe11ac760e4",
      "onToolExecutionEnd-478ae59f9ea8",
      "experimental_onToolCallFinish-2ef361bbbc6c",
      "onStepEnd-2aaf83f6abe4",
      "onStepError-63d00bbd0ad0",
      "onWarning-b25f03d5708f",
      "onStepFinish-c3f5f84cadd0",
      "onEnd-f5cf86d09704",
      "onFinish-addf70b8ab33",
      "include-f5921751b4c7",
      "experimental_include-66b1c9615325",
      "_internal-4f7a05af8f2b"
    ],
    "LLMAgentStream_result": [
      "content-3bb18539321d",
      "text-f837ea5e2d60",
      "reasoning-d05298f5ca7a",
      "reasoningText-d8433e7073da",
      "files-b82909e8d764",
      "sources-625a7cf84149",
      "toolCalls-36a4ce1b7f06",
      "staticToolCalls-28c3437fab0e",
      "dynamicToolCalls-9bb558f55dc2",
      "staticToolResults-2b18447d33df",
      "dynamicToolResults-6a83f67e3ee0",
      "toolResults-d4aa36739dbf",
      "finishReason-190b97cf2d40",
      "rawFinishReason-9cee1c499f44",
      "stoppedBy-620114570de0",
      "usage-262b991a348f",
      "totalUsage-ad85e58240c3",
      "warnings-fb6f20b742d6",
      "steps-d38bb78314bb",
      "finalStep-51d42e47f875",
      "request-1fff5b788637",
      "response-51d80af81228",
      "responseMessages-b2afdbcdc003",
      "providerMetadata-facc55bb2227",
      "textStream-de96764d739a",
      "stream-cc0b8d1f2662",
      "fullStream-86f6451b42a0",
      "experimental_partialOutputStream-21f12f5a7a2a",
      "partialOutputStream-0da8c7a6719d",
      "elementStream-62d00c30607b",
      "output-7d43e76672f8",
      "consumeStream-c5445bbfbd84",
      "toUIMessageStream-3fb623239137",
      "pipeUIMessageStreamToResponse-927c75d19e66",
      "pipeTextStreamToResponse-eb28c26f6dae",
      "toUIMessageStreamResponse-b7491de6db9c",
      "toTextStreamResponse-9609adab2f14"
    ],
    "LLMAgentStream_native": [
      "maxOutputTokens-3750aae06b78",
      "temperature-c970b1ef9f50",
      "topP-8c117ff138cd",
      "topK-07df4c014c42",
      "presencePenalty-27e20b4c1aa5",
      "frequencyPenalty-32bb1198f9f5",
      "stopSequences-2eefa8740e8d",
      "seed-c03ecfd73f92",
      "reasoning-b90f40e6fd96",
      "maxRetries-0aedd6c52d2f",
      "abortSignal-332106eb39a3",
      "headers-b4f0a59701e0",
      "timeout-439a1a41320c",
      "instructions-7a09e697e800",
      "system-77b926aa15b3",
      "allowSystemInMessages-48822b7d4b46",
      "prompt-9441b69dcea1",
      "messages-43bee1c696a9",
      "tools-5efdda627cc8",
      "model-13928364de1c",
      "toolChoice-f6a9fedbe1b4",
      "stopWhen-1269c94bf274",
      "telemetry-7f5176f31df4",
      "experimental_telemetry-4f7675b48d9c",
      "providerOptions-6db661b2b6a7",
      "experimental_sandbox-bd7685f3dca4",
      "experimental_steering-a70a6a3f26bf",
      "runtimeContext-6fe9258c1451",
      "activeTools-7a4674c83084",
      "toolOrder-e46202be091c",
      "toolCallConcurrency-769ff7ccf7bf",
      "output-56ac795cb09d",
      "toolApproval-e6f9c22d9b3c",
      "experimental_toolCallers-8a752bb63e36",
      "experimental_toolApprovalSecret-5573519278c4",
      "prepareStep-d9f1f942f148",
      "repairToolCall-4ef13c129648",
      "experimental_repairToolCall-2aa1d06c3008",
      "experimental_refineToolInput-52f1527d50cb",
      "experimental_transform-b422736429cc",
      "experimental_download-393316c82a64",
      "includeRawChunks-eb80fd3d4f31",
      "onChunk-480ac277c91c",
      "onError-a7cf8c7fafff",
      "streamRetries-ca6a5025c0f4",
      "onEnd-fe63bb2f27cd",
      "onFinish-c4bddcf07443",
      "onAbort-a9107997a88b",
      "onStepEnd-195f794ee38b",
      "onStepError-4d72b82e99ae",
      "onWarning-191f1b180e1d",
      "onStepFinish-58089e235735",
      "onStart-0ec99fbf5859",
      "experimental_onStart-0d26a8d8a29b",
      "onStepStart-d30a78139419",
      "experimental_onStepStart-9068893fd70f",
      "onLanguageModelCallStart-dece0ed4d633",
      "experimental_onLanguageModelCallStart-39509eb3527f",
      "onLanguageModelCallEnd-411f0968c4d3",
      "experimental_onLanguageModelCallEnd-1343c276d17a",
      "onToolExecutionStart-4db0a212fd81",
      "experimental_onToolCallStart-c8484c1add9d",
      "onToolExecutionEnd-7870e85a04eb",
      "experimental_onToolCallFinish-988da25c5643",
      "include-74de729ed750",
      "experimental_include-6f60b3b599e8",
      "_internal-aaa986384177"
    ],
    "Decision_result": [
      "answers-5d2c27d79165",
      "usage-36fee081ac33",
      "warnings-31275a50bb91",
      "rounding-39b85d47b535",
      "providerMetadata-060f40b90631",
      "response-de27d2902b72"
    ],
    "Decision_native": [
      "model-63f39539b350",
      "state-39541375053d",
      "questions-d277213afc57",
      "maxOutputTokens-498165f4e1a0",
      "reasoning-27d347c98943",
      "maxRetries-3fefe762577b",
      "abortSignal-3a1691fafbe4",
      "experimental_download-f84372d2c444",
      "headers-a3d764ab0c98",
      "providerOptions-29e64ad26a6f",
      "telemetry-9291651c3fe8",
      "runtimeContext-7cc2d639bf30",
      "onStart-cceb4f677102",
      "onEnd-5893d60da45f",
      "_internal-520e614a2e41"
    ],
    "Embedder_result": [
      "value-267137ec08d3",
      "embedding-65d263a57072",
      "usage-283ce5bbc803",
      "warnings-9def7fc64c29",
      "providerMetadata-af0af49d95db",
      "response-9d0349a46e5a"
    ],
    "Embedder_native": [
      "model-76b4cbf21b98",
      "value-22aa5692a8af",
      "dimensions-e514b862730a",
      "maxRetries-d23ecfad0a44",
      "abortSignal-e088cfdd3cdf",
      "headers-a20e795c7853",
      "providerOptions-39824388b056",
      "telemetry-10826561b3e1",
      "experimental_telemetry-e74ee2b9fcdc",
      "runtimeContext-61b600fdf2c8",
      "onStart-6d612661bf33",
      "experimental_onStart-2cbc389016a9",
      "onEnd-38c1e8e2a05b",
      "experimental_onEnd-543602355965",
      "_internal-e9119d745ea6"
    ],
    "EmbedderBatch_result": [
      "values-c70ebde5be4d",
      "embeddings-299f182a53eb",
      "usage-5ca1bbf243a6",
      "warnings-2c64605cff39",
      "providerMetadata-c43f9e32e19f",
      "responses-5610a35af93c"
    ],
    "EmbedderBatch_native": [
      "model-2ee72b6f6776",
      "values-c00b4b75a6e0",
      "dimensions-a7263b5ea914",
      "maxRetries-1be77b6e9667",
      "abortSignal-6f1530bb4f0a",
      "headers-f9a6d9652a0a",
      "telemetry-f87efb2ebd64",
      "experimental_telemetry-5f7fa89c66df",
      "runtimeContext-39ec8adb999c",
      "providerOptions-0bb12806283e",
      "maxParallelCalls-63a7ab93a66d",
      "onStart-73681b15b77d",
      "experimental_onStart-306575194bd2",
      "onEnd-e8cf2834155b",
      "experimental_onEnd-44bb7f891cee",
      "_internal-eb195a17669b"
    ],
    "Reranker_result": [
      "originalDocuments-9f043fe9ca5c",
      "rerankedDocuments-fdbdaca0e2c3",
      "ranking-7ea16195ac0f",
      "providerMetadata-95aa0960db07",
      "response-91617290e4bb"
    ],
    "Reranker_native": [
      "model-b9a9ad1e277f",
      "documents-a7b7ca1305a3",
      "query-71c9c0183347",
      "topN-b63f89c590b9",
      "maxRetries-1030d178c8ef",
      "abortSignal-73bfcea75c49",
      "headers-5dcd71a1709f",
      "telemetry-ee49554ed0e5",
      "experimental_telemetry-b33dd8e2e035",
      "runtimeContext-0f19f2ea43f6",
      "providerOptions-bacef9bb6be2",
      "onStart-5eefc83bf86c",
      "experimental_onStart-bd28ea61bcd4",
      "onEnd-7c56a1017c9e",
      "experimental_onEnd-db0ab05e7ebc",
      "_internal-c375e9af425c"
    ],
    "ImageGenerator_result": [
      "image-da0e2f95650e",
      "images-c7aed60b2aae",
      "calls-79f7c98ae7f3",
      "warnings-9451ed79941f",
      "responses-77f321677647",
      "providerMetadata-a5b6c27f2597",
      "usage-91f93992ca10"
    ],
    "ImageGenerator_native": [
      "model-3c08b406693e",
      "prompt-cd1596b0bae6",
      "n-71f8e80752c9",
      "maxImagesPerCall-07ad01192bf4",
      "size-a1ddd9b66299",
      "aspectRatio-0e953591963c",
      "seed-f61917bfc1e4",
      "providerOptions-5fcc54204c7d",
      "maxRetries-c66620af033c",
      "abortSignal-af0f2d8911dc",
      "headers-1770c8ac0413"
    ],
    "Transcriber_result": [
      "text-318f1f081df8",
      "segments-d6de43be1331",
      "words-b968f7b0610c",
      "language-bd16149257f1",
      "durationInSeconds-5a79b1d0d6c4",
      "warnings-afea3598daa0",
      "responses-531227d69d28",
      "providerMetadata-84dee28b573d"
    ],
    "Transcriber_native": [
      "model-ab2d60d092c3",
      "audio-fd25cf70163c",
      "providerOptions-f1407026e059",
      "timestampGranularities-f8ab98382618",
      "maxRetries-517add5497ce",
      "abortSignal-8b753a971039",
      "headers-7886326ddcda",
      "telemetry-e6a01e9dfd10",
      "download-7fc28372c55f",
      "_internal-194d66d6d32a"
    ],
    "TranscriberStream_result": [
      "text-1bc039232e18",
      "segments-979b8df5fb67",
      "language-97beb2cda6dd",
      "durationInSeconds-2f843fd46f4c",
      "warnings-66e7596b6f06",
      "responses-7987ad6e2cf4",
      "providerMetadata-0b276ba673b5",
      "fullStream-a67f32488d3c"
    ],
    "TranscriberStream_native": [
      "model-bbb32b07b213",
      "audio-1bdfa22ed156",
      "inputAudioFormat-19cad07cd365",
      "providerOptions-9043462897ad",
      "abortSignal-a3d4d3abbebf",
      "headers-1a57a9e1d4c6",
      "includeRawChunks-13081a3282bf",
      "telemetry-d00e1797bb15",
      "_internal-35f66ec5d264"
    ],
    "SpeechGenerator_result": [
      "audioFormat-0fe6713e23a4",
      "usage-bf7204927792",
      "audio-7ce2a3fad473",
      "warnings-944bb856819d",
      "responses-7c8eab2136aa",
      "providerMetadata-c33d96fb37e7"
    ],
    "SpeechGenerator_native": [
      "model-1dce7990aa0b",
      "text-3e3b88fecf0f",
      "voice-077d0f0f81a8",
      "outputFormat-69479cff1acd",
      "instructions-3d37a40068de",
      "speed-d74265e616d8",
      "language-80fcf25fd716",
      "providerOptions-0391eeeaef21",
      "maxRetries-49b0652defa9",
      "abortSignal-2a56d4719602",
      "headers-06589cfe4fcf",
      "telemetry-0bd86804edb7",
      "_internal-3d141dbfafc1"
    ],
    "SpeechGeneratorStream_result": [
      "usage-3c3d8394afcf",
      "warnings-d62aba44d83a",
      "responses-a9e279aac120",
      "providerMetadata-8f92fa4e2f43",
      "audioStream-279e0dafa704",
      "fullStream-901aea0f7971"
    ],
    "SpeechGeneratorStream_native": [
      "model-e6d4a0cfc90e",
      "text-8ed8613d6668",
      "voice-f499169ed7e6",
      "outputFormat-2ecdbf569d98",
      "instructions-66bc5d503547",
      "speed-e728ceb3fd45",
      "language-522bbc56a6db",
      "providerOptions-e3f548cd88dc",
      "abortSignal-cb0726a306ce",
      "headers-9e46900dfea7",
      "includeRawChunks-b6af0ee1e0ce",
      "onError-f4612e490bdd",
      "_internal-316c49cdb97e"
    ],
    "Translator_result": [
      "providerMetadata-a1890558f6d7",
      "warnings-2a1d84032a96",
      "response-473e4f6faa96",
      "usage-66baaa2fd138",
      "sourceText-61a4fc8c3ce4",
      "translationText-5685980a9448",
      "durationInSeconds-3e9796df05cf",
      "audio-e6a2faccc8b9"
    ],
    "Translator_native": [
      "model-246db9799f69",
      "audio-5b5e7f868414",
      "inputAudioFormat-afb9527b3706",
      "targetLanguage-f0a3ad97c84b",
      "sourceLanguage-ebb4e1b916d2",
      "outputAudioFormat-d539c234392c",
      "providerOptions-90a5d6a9f1ee",
      "abortSignal-c0f42bc55266",
      "headers-7d47ca76d094",
      "includeRawChunks-ad5b6d5c09d6",
      "_internal-5e396fa59f87"
    ],
    "TranslatorStream_result": [
      "sourceText-25121e0dd1ec",
      "translationText-1bfe97fa77bb",
      "durationInSeconds-1e32aeb17c6a",
      "usage-aac6602e6c0b",
      "warnings-a57e15823f1c",
      "response-659653107089",
      "providerMetadata-0e82bcbf8ee1",
      "fullStream-f5a7dc341b54"
    ],
    "TranslatorStream_native": [
      "model-246db9799f69",
      "audio-5b5e7f868414",
      "inputAudioFormat-afb9527b3706",
      "targetLanguage-f0a3ad97c84b",
      "sourceLanguage-ebb4e1b916d2",
      "outputAudioFormat-d539c234392c",
      "providerOptions-90a5d6a9f1ee",
      "abortSignal-c0f42bc55266",
      "headers-7d47ca76d094",
      "includeRawChunks-ad5b6d5c09d6",
      "_internal-5e396fa59f87"
    ],
    "VoiceAgentBackend_result": [
      "token-e6b1ecaa2a1c",
      "url-458a55b0cd01",
      "expiresAt-42284c9a4224",
      "tools-77941a98285d"
    ],
    "TranscriberStream_config": [
      "providerOptions-9043462897ad",
      "headers-1a57a9e1d4c6",
      "model-14cf8ce98262",
      "telemetry-d00e1797bb15",
      "includeRawChunks-13081a3282bf",
      "inputAudioFormat-62bc6c075147",
      "maxPreparedAudioBytes-595959558a15",
      "sourceFormat-160cb13602cb",
      "audio-eabc6c56abd0",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "toolContextSchema-d7c206b57ff4",
      "inputSchema-e1f157741580",
      "tools-f8808df35909",
      "toolsContext-a026c14e3010"
    ],
    "TranscriberStream_settings": [
      "providerOptions-9043462897ad",
      "abortSignal-a3d4d3abbebf",
      "headers-1a57a9e1d4c6",
      "model-bbb32b07b213",
      "telemetry-d00e1797bb15",
      "includeRawChunks-13081a3282bf",
      "inputAudioFormat-6a9bbf3af99e",
      "maxPreparedAudioBytes-595959558a15",
      "sourceFormat-160cb13602cb",
      "audio-4e06c305d82e"
    ],
    "TranscriberStream_inputs": [
      "direct-340c3e0b0658",
      "prepared-2b72789340ee"
    ],
    "SpeechGeneratorStream_config": [
      "providerOptions-e3f548cd88dc",
      "language-522bbc56a6db",
      "headers-9e46900dfea7",
      "instructions-66bc5d503547",
      "model-b07c96a69452",
      "includeRawChunks-b6af0ee1e0ce",
      "onError-f4612e490bdd",
      "voice-f499169ed7e6",
      "outputFormat-2ecdbf569d98",
      "speed-e728ceb3fd45",
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
      "toolsContext-a026c14e3010"
    ],
    "SpeechGeneratorStream_settings": [
      "text-8ed8613d6668",
      "providerOptions-e3f548cd88dc",
      "language-522bbc56a6db",
      "abortSignal-cb0726a306ce",
      "headers-9e46900dfea7",
      "instructions-66bc5d503547",
      "model-e6d4a0cfc90e",
      "includeRawChunks-b6af0ee1e0ce",
      "onError-f4612e490bdd",
      "voice-f499169ed7e6",
      "outputFormat-2ecdbf569d98",
      "speed-e728ceb3fd45"
    ],
    "SpeechGeneratorStream_inputs": [
      "direct-5306f56796f6",
      "prepared-b47e988fe35e",
      "template-7349d7682caf"
    ],
    "TranslatorStream_config": [
      "providerOptions-90a5d6a9f1ee",
      "headers-7d47ca76d094",
      "model-4789518cab57",
      "includeRawChunks-ad5b6d5c09d6",
      "inputAudioFormat-d8322f89357f",
      "targetLanguage-8f57c47fbc72",
      "outputAudioFormat-d539c234392c",
      "maxPreparedAudioBytes-595959558a15",
      "sourceFormat-160cb13602cb",
      "sourceLanguage-ebb4e1b916d2",
      "audio-c563898406e8",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "toolContextSchema-d7c206b57ff4",
      "inputSchema-e1f157741580",
      "tools-f8808df35909",
      "toolsContext-a026c14e3010"
    ],
    "TranslatorStream_settings": [
      "providerOptions-90a5d6a9f1ee",
      "abortSignal-c0f42bc55266",
      "headers-7d47ca76d094",
      "model-246db9799f69",
      "includeRawChunks-ad5b6d5c09d6",
      "inputAudioFormat-afb9527b3706",
      "targetLanguage-f0a3ad97c84b",
      "outputAudioFormat-d539c234392c",
      "sourceLanguage-ebb4e1b916d2",
      "maxPreparedAudioBytes-595959558a15",
      "sourceFormat-160cb13602cb",
      "audio-87d9e2ee44af"
    ],
    "TranslatorStream_inputs": [
      "direct-1d822026b786",
      "prepared-8ec1b7b87830"
    ],
    "TranscriberLive_native": [
      "model-bbb32b07b213",
      "audio-1bdfa22ed156",
      "inputAudioFormat-19cad07cd365",
      "providerOptions-9043462897ad",
      "abortSignal-a3d4d3abbebf",
      "headers-1a57a9e1d4c6",
      "includeRawChunks-13081a3282bf",
      "telemetry-d00e1797bb15",
      "_internal-35f66ec5d264"
    ],
    "TranscriberFile_settings": [
      "providerOptions-f1407026e059",
      "maxRetries-517add5497ce",
      "abortSignal-8b753a971039",
      "headers-7886326ddcda",
      "model-ab2d60d092c3",
      "telemetry-e6a01e9dfd10",
      "timestampGranularities-f8ab98382618",
      "download-7fc28372c55f",
      "maxPreparedAudioBytes-595959558a15",
      "sourceFormat-160cb13602cb",
      "audio-f4a50ca734b1"
    ],
    "TranscriberRaw_settings": [
      "providerOptions-9043462897ad",
      "abortSignal-a3d4d3abbebf",
      "headers-1a57a9e1d4c6",
      "model-bbb32b07b213",
      "telemetry-d00e1797bb15",
      "audio-68daa1e68956",
      "inputAudioFormat-19cad07cd365",
      "maxPreparedAudioBytes-595959558a15",
      "sourceFormat-160cb13602cb"
    ],
    "TranscriberRaw_config": [
      "providerOptions-9043462897ad",
      "headers-1a57a9e1d4c6",
      "model-14cf8ce98262",
      "telemetry-d00e1797bb15",
      "inputAudioFormat-19cad07cd365",
      "maxPreparedAudioBytes-595959558a15",
      "sourceFormat-160cb13602cb",
      "audio-c563898406e8",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "toolContextSchema-d7c206b57ff4",
      "inputSchema-e1f157741580",
      "tools-f8808df35909",
      "toolsContext-a026c14e3010"
    ],
    "SpeechGeneratorComplete_settings": [
      "text-3e3b88fecf0f",
      "providerOptions-0391eeeaef21",
      "language-80fcf25fd716",
      "maxRetries-49b0652defa9",
      "abortSignal-2a56d4719602",
      "headers-06589cfe4fcf",
      "instructions-3d37a40068de",
      "model-1dce7990aa0b",
      "telemetry-0bd86804edb7",
      "voice-077d0f0f81a8",
      "outputFormat-69479cff1acd",
      "speed-d74265e616d8"
    ],
    "SpeechGeneratorCollected_settings": [
      "text-8ed8613d6668",
      "providerOptions-e3f548cd88dc",
      "language-522bbc56a6db",
      "abortSignal-cb0726a306ce",
      "headers-9e46900dfea7",
      "instructions-66bc5d503547",
      "model-e6d4a0cfc90e",
      "onError-f4612e490bdd",
      "voice-f499169ed7e6",
      "outputFormat-2ecdbf569d98",
      "speed-e728ceb3fd45"
    ],
    "SpeechGeneratorCollected_config": [
      "providerOptions-e3f548cd88dc",
      "language-522bbc56a6db",
      "headers-9e46900dfea7",
      "instructions-66bc5d503547",
      "model-b07c96a69452",
      "onError-f4612e490bdd",
      "voice-f499169ed7e6",
      "outputFormat-27a92d87c4ab",
      "speed-e728ceb3fd45",
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
      "toolsContext-a026c14e3010"
    ],
    "SpeechGeneratorFormat_properties": [
      "outputFormat-7fda4f42871a"
    ],
    "AudioPreparation_config": [
      "inputAudioFormat-9d5855cee1c6",
      "mediaSettings-9a4327368f34",
      "fileAudioTarget-d18884450161"
    ],
    "RawAudioPreparation_config": [
      "inputAudioFormat-9d5855cee1c6",
      "mediaSettings-9a4327368f34"
    ],
    "VoiceAgentClient_config": [
      "model-3cede7036f63",
      "api-004ee8b5cab2",
      "sessionConfig-804ef3dffb30",
      "sampleRate-06aa2a8f8a8a",
      "maxEvents-a020baa464f5",
      "startupTimeoutMs-5cf4778f802f",
      "closeTimeoutMs-dbae777eaefe",
      "rtcDisconnectTimeoutMs-5b12df24e922",
      "maxPlaybackBufferSeconds-8afa607e6747",
      "onToolCall-d762db2d3ad5",
      "onEvent-d3f764d51701",
      "onError-9823c2477456"
    ],
    "VoiceAgentClient_settings": [
      "model-3cede7036f63",
      "api-004ee8b5cab2",
      "sessionConfig-804ef3dffb30",
      "sampleRate-06aa2a8f8a8a",
      "maxEvents-a020baa464f5",
      "startupTimeoutMs-5cf4778f802f",
      "closeTimeoutMs-dbae777eaefe",
      "rtcDisconnectTimeoutMs-5b12df24e922",
      "maxPlaybackBufferSeconds-8afa607e6747",
      "onToolCall-d762db2d3ad5",
      "onEvent-d3f764d51701",
      "onError-9823c2477456"
    ],
    "VoiceAgentClient_native": [
      "model-3cede7036f63",
      "api-004ee8b5cab2",
      "sessionConfig-804ef3dffb30",
      "sampleRate-06aa2a8f8a8a",
      "maxEvents-a020baa464f5",
      "startupTimeoutMs-5cf4778f802f",
      "closeTimeoutMs-dbae777eaefe",
      "rtcDisconnectTimeoutMs-5b12df24e922",
      "maxPlaybackBufferSeconds-8afa607e6747",
      "onToolCall-d762db2d3ad5",
      "onEvent-d3f764d51701",
      "onError-9823c2477456"
    ],
    "VoiceAgentClient_inputs": [],
    "VoiceAgentClient_result": [
      "onError-83ded9ab73dc",
      "onToolCall-59c4a4fdd7d4",
      "onEvent-2722b9792dd9",
      "connect-2e34b6dfb576",
      "disconnect-8faaa298371c",
      "close-8098641beab2",
      "sendEvent-d7ab1dd558cb",
      "sendTextMessage-7a502c92f929",
      "sendAudio-484a8c1d0aea",
      "commitAudio-c2343307b0b1",
      "clearAudioBuffer-86dceda18774",
      "requestResponse-c5bb6481365f",
      "cancelResponse-30f3c048c45e",
      "addToolOutput-0ecdc6214901",
      "startAudioCapture-53bd14e6dc4d",
      "resumeAudioCapture-21fe42d0a4dc",
      "stopAudioCapture-911c0523c2a8",
      "stopPlayback-74887f5363db",
      "resumePlayback-9d2aac23aa6c",
      "dispose-9930092e1c54",
      "getSnapshot-b4938edff73b",
      "subscribe-d65210706930"
    ],
    "VideoGenerator_settings": [
      "model-1644b8d10c7b",
      "prompt-e17accdd497c",
      "n-0e1734c45c1b",
      "maxVideosPerCall-37fbd8bcda34",
      "aspectRatio-948f9ae032db",
      "resolution-33812f50a8dc",
      "duration-d1bf4adf1e2f",
      "fps-13af020e6f72",
      "seed-f298ceb2dae3",
      "frameImages-d0dc09d1f531",
      "inputReferences-52c60c20d4bd",
      "generateAudio-b8009fcb76f2",
      "providerOptions-7adf4abd4a86",
      "maxRetries-b1d66fe01336",
      "abortSignal-f9406684db67",
      "headers-373272238360",
      "download-c3f8ee06633e",
      "poll-54be9abbdfff",
      "webhook-e748ef3211c8"
    ],
    "VideoGenerator_native": [
      "model-1644b8d10c7b",
      "prompt-e17accdd497c",
      "n-0e1734c45c1b",
      "maxVideosPerCall-37fbd8bcda34",
      "aspectRatio-948f9ae032db",
      "resolution-33812f50a8dc",
      "duration-d1bf4adf1e2f",
      "fps-13af020e6f72",
      "seed-f298ceb2dae3",
      "frameImages-d0dc09d1f531",
      "inputReferences-52c60c20d4bd",
      "generateAudio-b8009fcb76f2",
      "providerOptions-7adf4abd4a86",
      "maxRetries-b1d66fe01336",
      "abortSignal-f9406684db67",
      "headers-373272238360",
      "download-c3f8ee06633e",
      "poll-54be9abbdfff",
      "webhook-e748ef3211c8"
    ],
    "VideoGenerator_config": [
      "inputSchema-e1f157741580",
      "filters-e21828790709",
      "renderOptions-0b6a6f477332",
      "loader-5d45bab68a1b",
      "context-9009039f251e",
      "debug-cdff8d93c93d",
      "description-094750903948",
      "tools-f8808df35909",
      "toolsContext-a026c14e3010",
      "toolContextSchema-d7c206b57ff4",
      "providerOptions-7adf4abd4a86",
      "seed-f298ceb2dae3",
      "maxRetries-b1d66fe01336",
      "headers-373272238360",
      "prompt-8b4b5c5d39e6",
      "model-305ceb93ef2e",
      "n-0e1734c45c1b",
      "aspectRatio-948f9ae032db",
      "download-c3f8ee06633e",
      "maxVideosPerCall-37fbd8bcda34",
      "resolution-33812f50a8dc",
      "duration-d1bf4adf1e2f",
      "fps-13af020e6f72",
      "frameImages-d0dc09d1f531",
      "inputReferences-52c60c20d4bd",
      "generateAudio-b8009fcb76f2",
      "poll-54be9abbdfff",
      "webhook-e748ef3211c8"
    ],
    "VideoGenerator_inputs": [
      "direct-4ea07477228e",
      "prepared-220b47dc8244",
      "template-698edd69db01"
    ],
    "VideoGenerator_result": [
      "video-c15f2929aaf4",
      "videos-47e9b9273a30",
      "uploadedVideos-ebe75695ab76",
      "warnings-634e28fe31f2",
      "responses-e3f1546b4f67",
      "providerMetadata-8dbafc46c0ef"
    ],
    "Telemetry:0": [
      "isEnabled-4303a363fa95",
      "recordInputs-0a82b3d21ba3",
      "recordOutputs-5f49a76c4a9f",
      "functionId-a4b8d24d4f63",
      "includeRuntimeContext-5fea5b0822f3",
      "includeToolsContext-c4636a1e46ee",
      "integrations-d89adf68950c"
    ],
    "Timeout:0": [],
    "Timeout:1": [
      "totalMs-c758378cc4ae",
      "stepMs-b5087914c082",
      "firstChunkMs-d0c3163365d4",
      "chunkMs-444ae491f56e",
      "toolMs-c3b651c82a34",
      "tools-969e8dc7d0ef"
    ],
    "StreamInclude:0": [
      "requestBody-169af9ec369a",
      "requestMessages-50596f598ef0",
      "rawChunks-b65de217e6f5"
    ],
    "AudioFormat:0": [
      "type-520be97089d4",
      "rate-48f2f297bd7c"
    ],
    "SessionTranscription:0": [
      "model-2ef98e561f36",
      "language-18a70eefc7b3",
      "prompt-e49009ec511f"
    ],
    "TurnDetection:0": [],
    "TurnDetection:1": [
      "type-594fa7028e72",
      "threshold-ad4f6014a792",
      "silenceDurationMs-8d1a937380ac",
      "prefixPaddingMs-4c2039317d05"
    ],
    "DecisionQuestion:0": [
      "type-d9cc1b1b4cea",
      "instructions-b85d3fcd5c41",
      "criteria-dd60dbfe042f"
    ],
    "DecisionQuestion:1": [
      "type-37d3b7e0b6c6",
      "instructions-0204b262592e",
      "criteria-9cbb40284e16"
    ],
    "DecisionQuestion:2": [
      "type-7764ff728a6b",
      "instructions-7b8cd13ccfae"
    ],
    "DecisionQuestion:3": [
      "type-eab546a1fe04",
      "instructions-c32a70cdf6d3",
      "criteria-a8b5f9bd5ab6"
    ],
    "ModelMessage:0": [
      "role-e8ac0434d928",
      "content-a89592356ea7",
      "providerOptions-35d879148cd3"
    ],
    "ModelMessage:1": [
      "role-5892097e9456",
      "content-cde6417447fa",
      "providerOptions-a36c5ad2658a"
    ],
    "ModelMessage:2": [
      "role-cf6cb44e4f5c",
      "content-8dd1c49edc02",
      "providerOptions-9f578ecc5664"
    ],
    "ModelMessage:3": [
      "role-89ef2f80a629",
      "content-3a3ba09e66af",
      "providerOptions-138a787c7cd4"
    ],
    "ImagePrompt:0": [
      "images-52c5df12a02a",
      "text-c84fbf89238b",
      "mask-fb29f1c10bf2"
    ],
    "GeneratedFile:0": [
      "base64-26c8c3a9f599",
      "uint8Array-c4b76402b232",
      "mediaType-78e64d225ca0",
      "providerMetadata-3fe90f6dfdf1"
    ],
    "GeneratedAudioFile:0": [
      "format-139984da674d",
      "base64-26c8c3a9f599",
      "uint8Array-c4b76402b232",
      "mediaType-78e64d225ca0",
      "providerMetadata-3fe90f6dfdf1"
    ],
    "RealtimeToolDefinition:0": [
      "type-344ec4cbdca5",
      "name-89aa96fc9795",
      "description-5bb69e58655c",
      "parameters-b0610345bc98"
    ],
    "OutputObject:0": [
      "name-35787766c1d5",
      "description-4a79d6adae24"
    ],
    "OutputArray:0": [
      "minItems-5beefdc5780d",
      "maxItems-c1b7134bf00b",
      "name-4272e3098922",
      "description-60944453acb2"
    ],
    "OutputChoice:0": [
      "options-5bffe0fac6e0",
      "name-c03509a2880a",
      "description-f355a51a2c75"
    ],
    "OutputJSON:0": [
      "name-aa1bf6fcd790",
      "description-2016aef5a551"
    ],
    "RenderTags:0": [
      "blockStart-2d9e8e293c8e",
      "blockEnd-92457faa33e6",
      "variableStart-2604c83110e3",
      "variableEnd-c69d53ced37c",
      "commentStart-d075610c694f",
      "commentEnd-15c1f3fdf84e"
    ],
    "RenderWeb:0": [
      "useCache-dfe9d6549f5e",
      "async-4c6c34746bff"
    ],
    "PcmSourceFormat:0": [
      "sampleRate-e218b27f2dde",
      "channels-be4c78da1440",
      "encoding-eb246eac9517"
    ],
    "MediaSettings:0": [
      "track-98df75e50d51",
      "format-73ad4ac5e40e",
      "options-0d1056e36318"
    ],
    "FileAudioTarget:0": [
      "alternatives-59b9f94fb784",
      "maxBytes-fca8f7c77776",
      "maxDurationSeconds-f26f5bb9cf39",
      "format-3830762ed05e",
      "codec-1ed700c3b786",
      "rate-1a21e41da923",
      "channels-bc7a34f98268",
      "sampleFormat-44a58aaa5de6"
    ],
    "FileAudioFormat:0": [
      "format-3830762ed05e",
      "codec-1ed700c3b786",
      "rate-1a21e41da923",
      "channels-bc7a34f98268",
      "sampleFormat-44a58aaa5de6"
    ],
    "SpeechAudioFormat:0": [
      "type-520be97089d4",
      "rate-48f2f297bd7c"
    ],
    "SpeechTextPart:0": [
      "type-17b1a9c6f9c0",
      "text-35313fd999c0",
      "voice-ea3881c36735",
      "providerOptions-d997f62f10fd"
    ],
    "VoiceClientApi:0": [
      "token-ff44ef0e9f93"
    ],
    "VoiceClientApi:1": [
      "session-c137b9a57c19"
    ],
    "VoiceClientApi:2": [
      "provider-e4bb1895a7a5"
    ],
    "VoiceClientApi:3": [
      "websocket-83ad98a2fc71",
      "protocols-f227a70717dd"
    ],
    "VoiceClientSnapshot:0": [
      "status-289bf725948e",
      "messages-dcfe426366ef",
      "events-ee664420eb67",
      "isCapturing-b1ff0fcb936c",
      "isPlaying-02b364321726",
      "session-6b48c13d0e88"
    ],
    "VoiceClientSessionConfig:0": [
      "instructions-0c459c58ac82",
      "voice-a1f8a990e4c3",
      "outputModalities-c669f792f5d9",
      "inputAudioFormat-9303f715c7b4",
      "inputAudioTranscription-b199469fe309",
      "outputAudioTranscription-3df77a6d2390",
      "outputAudioFormat-40273b9f1c57",
      "turnDetection-a9c515125296",
      "tools-5b3941793a8a",
      "providerOptions-207d34914c15"
    ],
    "VideoPrompt:0": [
      "image-2854a78b2db2",
      "text-64465629c511"
    ],
    "VideoPoll:0": [
      "intervalMs-7a1241a53a7d",
      "timeoutMs-f98c899096c4",
      "delay-e8a6d15cb5e2"
    ],
    "VideoFrame:0": [
      "image-bd169cdf0d49",
      "frameType-cc8ada441ee4"
    ],
    "VideoReference:0": [
      "data-e9ce5d90d43e",
      "mediaType-75156914873a"
    ]
  },
  "properties": {
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
    "script-56e0c02bea00": {
      "name": "script",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/types/config.ts"
      }
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
    "runtimeContext-c62c730fa462": {
      "name": "runtimeContext",
      "type": "Record<string, unknown> | undefined",
      "optional": true,
      "description": "Runtime context. Treat runtime context as immutable.\nIf you need to mutate runtime context, update it in `prepareStep`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4395,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4395"
      }
    },
    "providerOptions-6db661b2b6a7": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4380,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4380"
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
    "maxOutputTokens-3750aae06b78": {
      "name": "maxOutputTokens",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of tokens to generate.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 916,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L916"
      }
    },
    "temperature-c970b1ef9f50": {
      "name": "temperature",
      "type": "number | undefined",
      "optional": true,
      "description": "Temperature setting. The range depends on the provider and model.\n\nIt is recommended to set either `temperature` or `topP`, but not both.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 922,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L922"
      }
    },
    "topP-8c117ff138cd": {
      "name": "topP",
      "type": "number | undefined",
      "optional": true,
      "description": "Nucleus sampling. This is a number between 0 and 1.\n\nE.g. 0.1 would mean that only tokens with the top 10% probability mass\nare considered.\n\nIt is recommended to set either `temperature` or `topP`, but not both.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 931,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L931"
      }
    },
    "topK-07df4c014c42": {
      "name": "topK",
      "type": "number | undefined",
      "optional": true,
      "description": "Only sample from the top K options for each subsequent token.\n\nUsed to remove \"long tail\" low probability responses.\nRecommended for advanced use cases only. You usually only need to use temperature.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 938,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L938"
      }
    },
    "presencePenalty-27e20b4c1aa5": {
      "name": "presencePenalty",
      "type": "number | undefined",
      "optional": true,
      "description": "Presence penalty setting. It affects the likelihood of the model to\nrepeat information that is already in the prompt.\n\nThe presence penalty is a number between -1 (increase repetition)\nand 1 (maximum penalty, decrease repetition). 0 means no penalty.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 946,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L946"
      }
    },
    "frequencyPenalty-32bb1198f9f5": {
      "name": "frequencyPenalty",
      "type": "number | undefined",
      "optional": true,
      "description": "Frequency penalty setting. It affects the likelihood of the model\nto repeatedly use the same words or phrases.\n\nThe frequency penalty is a number between -1 (increase repetition)\nand 1 (maximum penalty, decrease repetition). 0 means no penalty.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 954,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L954"
      }
    },
    "stopSequences-2eefa8740e8d": {
      "name": "stopSequences",
      "type": "string[] | undefined",
      "optional": true,
      "description": "Stop sequences.\nIf set, the model will stop generating text when one of the stop sequences is generated.\nProviders may have limits on the number of stop sequences.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 960,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L960"
      }
    },
    "seed-c03ecfd73f92": {
      "name": "seed",
      "type": "number | undefined",
      "optional": true,
      "description": "The seed (integer) to use for random sampling. If set and supported\nby the model, calls will generate deterministic results.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 965,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L965"
      }
    },
    "reasoning-b90f40e6fd96": {
      "name": "reasoning",
      "type": "\"provider-default\" | \"none\" | \"minimal\" | \"low\" | \"medium\" | \"high\" | \"xhigh\" | \"max\" | undefined",
      "optional": true,
      "description": "Reasoning effort level for the model. Controls how much reasoning\nthe model performs before generating a response.\n\nUse `'provider-default'` to use the provider's default reasoning level.\nUse `'none'` to disable reasoning (if supported by the provider).",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 973,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L973"
      }
    },
    "maxRetries-0aedd6c52d2f": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1036,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1036"
      }
    },
    "headers-b4f0a59701e0": {
      "name": "headers",
      "type": "Record<string, string | undefined> | undefined",
      "optional": true,
      "description": "Additional HTTP headers to be sent with the request.\nOnly applicable for HTTP-based providers.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1045,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1045"
      }
    },
    "timeout-439a1a41320c": {
      "name": "timeout",
      "type": "TimeoutConfiguration<ToolSet> | undefined",
      "optional": true,
      "description": "Timeout configuration for the request.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1049,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1049"
      }
    },
    "instructions-7a09e697e800": {
      "name": "instructions",
      "type": "Instructions | undefined",
      "optional": true,
      "description": "Instructions to include in the prompt. Can be used with `prompt` or `messages`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1072,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1072"
      }
    },
    "allowSystemInMessages-48822b7d4b46": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1087,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1087"
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
    "model-13928364de1c": {
      "name": "model",
      "type": "LanguageModel",
      "optional": false,
      "description": "The language model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4353,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4353"
      }
    },
    "toolChoice-f6a9fedbe1b4": {
      "name": "toolChoice",
      "type": "ToolChoice<ToolSet> | undefined",
      "optional": true,
      "description": "The tool choice strategy. Default: 'auto'.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4357,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4357"
      }
    },
    "telemetry-76723a22b41f": {
      "name": "telemetry",
      "type": "TelemetryOptions<Record<string, unknown>, NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4368,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4368"
      }
    },
    "experimental_sandbox-bd7685f3dca4": {
      "name": "experimental_sandbox",
      "type": "SandboxSession | undefined",
      "optional": true,
      "description": "The sandbox environment that is passed through to tool execution.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4384,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4384"
      }
    },
    "experimental_steering-a70a6a3f26bf": {
      "name": "experimental_steering",
      "type": "Steering | undefined",
      "optional": true,
      "description": "A steering object created with `experimental_createSteering()`.\nMessages sent with it are added to the generation at the next step\nboundary.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4390,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4390"
      }
    },
    "activeTools-7a4674c83084": {
      "name": "activeTools",
      "type": "ActiveTools<NoInfer<ToolSet>>",
      "optional": true,
      "description": "Limits the tools that are available for the model to call without\nchanging the tool call and result types in the result.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4400,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4400"
      }
    },
    "toolOrder-e46202be091c": {
      "name": "toolOrder",
      "type": "ToolOrder<NoInfer<ToolSet>>",
      "optional": true,
      "description": "Controls the order in which tools are sent to the provider.\n\nThe list can be partial. Tools not listed in `toolOrder` are sent after\nthe listed tools, sorted alphabetically. This can improve provider-side\ncaching by keeping tool definitions in a stable order.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4408,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4408"
      }
    },
    "toolCallConcurrency-769ff7ccf7bf": {
      "name": "toolCallConcurrency",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of tool calls that may execute concurrently within a step.\n\nSet to `1` to execute tool calls sequentially in the order they were\ngenerated. By default, all tool calls execute concurrently.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4415,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4415"
      }
    },
    "experimental_toolCallers-8a752bb63e36": {
      "name": "experimental_toolCallers",
      "type": "Experimental_ToolCallers<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Configures which caller tools may invoke each tool.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4429,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4429"
      }
    },
    "experimental_toolApprovalSecret-5573519278c4": {
      "name": "experimental_toolApprovalSecret",
      "type": "string | Uint8Array<ArrayBufferLike> | undefined",
      "optional": true,
      "description": "Secret for HMAC-signing tool approval requests. When set, the server\nsigns approval requests at issuance and verifies the signature when\nthe approval is replayed, preventing client-forged approvals.\nApproval requests for automatically denied tool calls are not signed.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4436,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4436"
      }
    },
    "include-74de729ed750": {
      "name": "include",
      "type": "StreamTextInclude | undefined",
      "optional": true,
      "description": "Settings for controlling what data is included in step results.\nDisabling inclusion can help reduce memory usage when processing\nlarge payloads like images.\n\nBy default, request bodies and request messages are excluded.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4634,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4634"
      }
    },
    "streamRetries-ca6a5025c0f4": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4522,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4522"
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
    "onWarning-297284192218": {
      "name": "onWarning",
      "type": "LogWarningsFunction | undefined",
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
    "stopWhen-a9b64708c252": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4364,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4364"
      }
    },
    "toolApproval-665a216dd014": {
      "name": "toolApproval",
      "type": "ToolApprovalConfiguration<ToolSet, Record<string, unknown>> | undefined",
      "optional": true,
      "description": "Optional tool approval configuration.\n\nThis configuration takes precedence over tool-defined approval settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4425,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4425"
      }
    },
    "experimental_download-393316c82a64": {
      "name": "experimental_download",
      "type": "DownloadFunction | undefined",
      "optional": true,
      "description": "Custom download function to use for URLs in the prompt and for\ngenerated file URLs returned by the model.\n\nBy default, prompt files are downloaded if the model does not support\nthe URL for the given media type. Generated file URLs are always\ndownloaded; returning `null` for them is an error.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4480,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4480"
      }
    },
    "repairToolCall-4ef13c129648": {
      "name": "repairToolCall",
      "type": "ToolCallRepairFunction<ToolSet> | undefined",
      "optional": true,
      "description": "A function that attempts to repair a tool call that failed to parse.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4452,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4452"
      }
    },
    "experimental_refineToolInput-52f1527d50cb": {
      "name": "experimental_refineToolInput",
      "type": "ToolInputRefinement<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Optional mapping of tool names to functions that refine parsed tool inputs.\n\nThe refined input must have the same type shape as the tool input. Refined\ninputs are used for tool execution, stream parts, callbacks, and telemetry.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4465,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4465"
      }
    },
    "onStart-42f1d1a13de4": {
      "name": "onStart",
      "type": "GenerateTextOnStartCallback<NoInfer<ToolSet>, NoInfer<Record<string, unknown>>, NoInfer<AIOutput>> | undefined",
      "optional": true,
      "description": "Callback that is called when the streamText operation begins,\nbefore any LLM calls are made.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4565,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4565"
      }
    },
    "onStepStart-067e2bce6aa3": {
      "name": "onStepStart",
      "type": "GenerateTextOnStepStartCallback<NoInfer<ToolSet>, NoInfer<Record<string, unknown>>, NoInfer<AIOutput>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step (LLM call) begins,\nbefore the provider is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4577,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4577"
      }
    },
    "onLanguageModelCallStart-dece0ed4d633": {
      "name": "onLanguageModelCallStart",
      "type": "OnLanguageModelCallStartCallback | undefined",
      "optional": true,
      "description": "Callback that is called immediately before the provider model call begins.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4588,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4588"
      }
    },
    "onLanguageModelCallEnd-411f0968c4d3": {
      "name": "onLanguageModelCallEnd",
      "type": "OnLanguageModelCallEndCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called after the model response has been normalized and parsed,\nbut before any client-side tool execution begins.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4599,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4599"
      }
    },
    "onToolExecutionStart-4db0a212fd81": {
      "name": "onToolExecutionStart",
      "type": "OnToolExecutionStartCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called right before a tool's execute function runs.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4610,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4610"
      }
    },
    "onToolExecutionEnd-7870e85a04eb": {
      "name": "onToolExecutionEnd",
      "type": "OnToolExecutionEndCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called right after a tool's execute function completes (or errors).",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4620,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4620"
      }
    },
    "onStepEnd-ba0cc25c5ad8": {
      "name": "onStepEnd",
      "type": "GenerateTextOnStepEndCallback<NoInfer<ToolSet>, NoInfer<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Callback that is called when each step (LLM call) ends, including intermediate steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4543,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4543"
      }
    },
    "onStepError-4c8aed2d1926": {
      "name": "onStepError",
      "type": "GenerateTextOnStepErrorCallback<NoInfer<ToolSet>, NoInfer<Record<string, unknown>>, NoInfer<AIOutput>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step that started fails before it\nproduces a step result. `onStepEnd` is not called for such a step.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4548,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4548"
      }
    },
    "onWarning-191f1b180e1d": {
      "name": "onWarning",
      "type": "LogWarningsFunction | undefined",
      "optional": true,
      "description": "Callback that receives the warnings of the call, e.g. unsupported\nsettings or deprecated prompt parts. When it is set, the warnings are\nnot sent to the global warning logger (`AI_SDK_LOG_WARNINGS`).",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4554,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4554"
      }
    },
    "onEnd-c8c7c2a69e22": {
      "name": "onEnd",
      "type": "StreamTextOnEndCallback<NoInfer<ToolSet>, NoInfer<Record<string, unknown>>, NoInfer<AIOutput>> | undefined",
      "optional": true,
      "description": "Callback that is called when the LLM response and all request tool executions\n(for tools that have an `execute` function) are finished.\n\nThe usage is the combined usage of all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4529,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4529"
      }
    },
    "experimental_transform-b422736429cc": {
      "name": "experimental_transform",
      "type": "Arrayable<StreamTextTransform<ToolSet>>",
      "optional": true,
      "description": "Optional stream transformations.\nThey are applied in the order they are provided.\nThe stream transformations must maintain the stream structure for streamText to work correctly.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4471,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4471"
      }
    },
    "onChunk-480ac277c91c": {
      "name": "onChunk",
      "type": "StreamTextOnChunkCallback<ToolSet> | undefined",
      "optional": true,
      "description": "Callback that is called for each chunk of the stream.\nThe stream processing will pause until the callback promise is resolved.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4494,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4494"
      }
    },
    "onError-a7cf8c7fafff": {
      "name": "onError",
      "type": "StreamTextOnErrorCallback | StreamTextOnErrorRetryCallback | StreamTextOnErrorHandler | undefined",
      "optional": true,
      "description": "Callback that is invoked when an error occurs during streaming.\nYou can use it to log errors.\nReturn `{ retry: true }` to retry the current model step after a provider\nerror is received from the response stream when `streamRetries` is\nexplicitly configured.\nThe stream processing will pause until the callback promise is resolved.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4503,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4503"
      }
    },
    "onAbort-cdaba3ea32c8": {
      "name": "onAbort",
      "type": "StreamTextOnAbortCallback<NoInfer<ToolSet>, NoInfer<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4539,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4539"
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
    "runtimeContext-8a3992767dfe": {
      "name": "runtimeContext",
      "type": "Record<string, unknown> | undefined",
      "optional": true,
      "description": "User-defined runtime context. Treat runtime context as immutable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9387,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9387"
      }
    },
    "providerOptions-29e64ad26a6f": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9383,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9383"
      }
    },
    "maxOutputTokens-498165f4e1a0": {
      "name": "maxOutputTokens",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum output tokens for supported models. Must be an integer >= 1.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9371,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9371"
      }
    },
    "reasoning-27d347c98943": {
      "name": "reasoning",
      "type": "\"provider-default\" | \"none\" | \"minimal\" | \"low\" | \"medium\" | \"high\" | \"xhigh\" | \"max\" | undefined",
      "optional": true,
      "description": "Reasoning effort for supported models. Language-model adapters default to none.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9373,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9373"
      }
    },
    "maxRetries-3fefe762577b": {
      "name": "maxRetries",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum retries for transient provider failures. Defaults to 2.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9375,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9375"
      }
    },
    "headers-a3d764ab0c98": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9382,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9382"
      }
    },
    "model-b7ad5611d42d": {
      "name": "model",
      "type": "(DecisionModel | undefined) & DecisionModel",
      "optional": false,
      "description": "A decision model instance or an ID resolved by the configured default provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9367,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9367"
      }
    },
    "telemetry-4c63aa57ec78": {
      "name": "telemetry",
      "type": "TelemetryOptions<Record<string, unknown>, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9385,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9385"
      }
    },
    "experimental_download-f84372d2c444": {
      "name": "experimental_download",
      "type": "DownloadFunction | undefined",
      "optional": true,
      "description": "Download function required for URL-backed file state. Use createDownload({ fetch })\nwith a DNS-protected transport for untrusted URLs. The model's fetch is not used.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9381,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9381"
      }
    },
    "onStart-6da1bb86471a": {
      "name": "onStart",
      "type": "Callback<DecideStartEvent<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Called when the decide operation begins.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9389,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9389"
      }
    },
    "onEnd-0f1f14485409": {
      "name": "onEnd",
      "type": "Callback<DecideEndEvent<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Called when the decide operation completes.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9391,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9391"
      }
    },
    "questions-d277213afc57": {
      "name": "questions",
      "type": "Record<string, DecisionModelV4Question>",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9369,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9369"
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
    "abortSignal-3a1691fafbe4": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9376,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9376"
      }
    },
    "model-63f39539b350": {
      "name": "model",
      "type": "DecisionModel",
      "optional": false,
      "description": "A decision model instance or an ID resolved by the configured default provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9367,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9367"
      }
    },
    "state-39541375053d": {
      "name": "state",
      "type": "DecisionState",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9368,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9368"
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
    "runtimeContext-d4297944fc22": {
      "name": "runtimeContext",
      "type": "Record<string, unknown> | undefined",
      "optional": true,
      "description": "User-defined runtime context. Treat runtime context as immutable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8834,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8834"
      }
    },
    "providerOptions-0bb12806283e": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8840,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8840"
      }
    },
    "maxRetries-1be77b6e9667": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8811,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8811"
      }
    },
    "headers-f9a6d9652a0a": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request.\nOnly applicable for HTTP-based providers.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8820,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8820"
      }
    },
    "model-6ce7e7fa24a7": {
      "name": "model",
      "type": "string | EmbeddingModelV4 | EmbeddingModelV3 | EmbeddingModelV2<string> | (string & EmbeddingModelV4) | (string & EmbeddingModelV3) | (string & EmbeddingModelV2<string>) | (EmbeddingModelV4 & string) | (EmbeddingModelV3 & string) | (EmbeddingModelV2<string> & string)",
      "optional": false,
      "description": "The embedding model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8795,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8795"
      }
    },
    "telemetry-782f21ecc894": {
      "name": "telemetry",
      "type": "TelemetryOptions<Record<string, unknown>, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8824,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8824"
      }
    },
    "experimental_telemetry-6118399298d7": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8830,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8830"
      }
    },
    "onStart-59e1fe0d9bb3": {
      "name": "onStart",
      "type": "Callback<EmbedStartEvent<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embedMany operation begins,\nbefore the embedding model is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8852,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8852"
      }
    },
    "experimental_onStart-409901f14373": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8859,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8859"
      }
    },
    "onEnd-8a2f9fb05c9a": {
      "name": "onEnd",
      "type": "Callback<EmbedEndEvent<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embedMany operation completes,\nafter all embedding model calls return.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8864,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8864"
      }
    },
    "dimensions-a7263b5ea914": {
      "name": "dimensions",
      "type": "number | undefined",
      "optional": true,
      "description": "The requested number of dimensions for the output embeddings.\nMust be a positive integer. Support and allowed values depend on the model\nand provider implementation.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8805,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8805"
      }
    },
    "maxParallelCalls-63a7ab93a66d": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8847,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8847"
      }
    },
    "experimental_onEnd-6a0e5dc8aa36": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8871,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8871"
      }
    },
    "input-fb5baefd9ad6": {
      "name": "input",
      "type": "string | string[] | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "abortSignal-6f1530bb4f0a": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8815,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8815"
      }
    },
    "model-2ee72b6f6776": {
      "name": "model",
      "type": "EmbeddingModel",
      "optional": false,
      "description": "The embedding model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8795,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8795"
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
    "runtimeContext-fbc34eb108be": {
      "name": "runtimeContext",
      "type": "Record<string, unknown> | undefined",
      "optional": true,
      "description": "User-defined runtime context. Treat runtime context as immutable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11482,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11482"
      }
    },
    "providerOptions-bacef9bb6be2": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11488,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11488"
      }
    },
    "maxRetries-1030d178c8ef": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11459,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11459"
      }
    },
    "headers-5dcd71a1709f": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request.\nOnly applicable for HTTP-based providers.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11468,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11468"
      }
    },
    "model-c3cf2da0831a": {
      "name": "model",
      "type": "string | RerankingModelV4 | RerankingModelV3 | (string & RerankingModelV4) | (string & RerankingModelV3) | (RerankingModelV4 & string) | (RerankingModelV3 & string)",
      "optional": false,
      "description": "The reranking model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11441,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11441"
      }
    },
    "telemetry-9d80befce824": {
      "name": "telemetry",
      "type": "TelemetryOptions<Record<string, unknown>, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11472,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11472"
      }
    },
    "experimental_telemetry-e56a04459ef3": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11478,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11478"
      }
    },
    "onStart-8f853f83ded6": {
      "name": "onStart",
      "type": "Callback<RerankStartEvent<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the rerank operation begins,\nbefore the reranking model is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11493,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11493"
      }
    },
    "experimental_onStart-cbc7a2641424": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11500,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11500"
      }
    },
    "onEnd-87a30dcfc57c": {
      "name": "onEnd",
      "type": "Callback<RerankEndEvent<Record<string, unknown>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the rerank operation completes,\nafter the reranking model returns.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11505,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11505"
      }
    },
    "experimental_onEnd-3c1307881f56": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11512,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11512"
      }
    },
    "documents-978d56ce17e3": {
      "name": "documents",
      "type": "(string | JSONObject)[] | undefined",
      "optional": true,
      "description": "The documents that should be reranked.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11445,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11445"
      }
    },
    "topN-b63f89c590b9": {
      "name": "topN",
      "type": "number | undefined",
      "optional": true,
      "description": "Number of top documents to return.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11453,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11453"
      }
    },
    "query-bf57c694fea9": {
      "name": "query",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "abortSignal-73bfcea75c49": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11463,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11463"
      }
    },
    "model-b9a9ad1e277f": {
      "name": "model",
      "type": "RerankingModel",
      "optional": false,
      "description": "The reranking model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11441,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11441"
      }
    },
    "documents-a7b7ca1305a3": {
      "name": "documents",
      "type": "(string | JSONObject)[]",
      "optional": false,
      "description": "The documents that should be reranked.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11445,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11445"
      }
    },
    "query-71c9c0183347": {
      "name": "query",
      "type": "string",
      "optional": false,
      "description": "The query to rerank the documents against.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11449,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11449"
      }
    },
    "prepared-443e2e85b058": {
      "name": "prepared",
      "type": "string | QueryDocuments",
      "optional": false,
      "description": "",
      "tags": []
    },
    "providerOptions-5fcc54204c7d": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options that are passed through to the provider\nas body parameters.\n\nThe outer record is keyed by the provider name, and the inner\nrecord is keyed by the provider-specific metadata key.\n```ts\n{\n\"openai\": {\n\"style\": \"vivid\"\n}\n}\n```",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8280,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8280"
      }
    },
    "seed-f61917bfc1e4": {
      "name": "seed",
      "type": "number | undefined",
      "optional": true,
      "description": "Seed for the image generation. If not provided, the default seed will be used.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8265,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8265"
      }
    },
    "maxRetries-c66620af033c": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8288,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8288"
      }
    },
    "headers-1770c8ac0413": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request.\nOnly applicable for HTTP-based providers.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8297,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8297"
      }
    },
    "model-bc27ce67cf0a": {
      "name": "model",
      "type": "string | ImageModelV4 | ImageModelV3 | ImageModelV2 | (string & ImageModelV4) | (string & ImageModelV3) | (string & ImageModelV2) | (ImageModelV4 & string) | (ImageModelV3 & string) | (ImageModelV2 & string)",
      "optional": false,
      "description": "The image model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8241,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8241"
      }
    },
    "n-71f8e80752c9": {
      "name": "n",
      "type": "number | undefined",
      "optional": true,
      "description": "Number of images to generate.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8249,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8249"
      }
    },
    "maxImagesPerCall-07ad01192bf4": {
      "name": "maxImagesPerCall",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of images to generate in a single API call. If not provided, the model's default will be used.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8253,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8253"
      }
    },
    "size-a1ddd9b66299": {
      "name": "size",
      "type": "`${number}x${number}` | undefined",
      "optional": true,
      "description": "Size of the images to generate. Must have the format `{width}x{height}`. If not provided, the default size will be used.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8257,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8257"
      }
    },
    "aspectRatio-0e953591963c": {
      "name": "aspectRatio",
      "type": "`${number}:${number}` | undefined",
      "optional": true,
      "description": "Aspect ratio of the images to generate. Must have the format `{width}:{height}`. If not provided, the default aspect ratio will be used.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8261,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8261"
      }
    },
    "images-7acfa9f82d1f": {
      "name": "images",
      "type": "DataContent[] | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8215,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8215"
      }
    },
    "mask-fb29f1c10bf2": {
      "name": "mask",
      "type": "DataContent | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8217,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8217"
      }
    },
    "prompt-e832a0f8b353": {
      "name": "prompt",
      "type": "GenerateImagePrompt | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "abortSignal-af0f2d8911dc": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8292,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8292"
      }
    },
    "prompt-cd1596b0bae6": {
      "name": "prompt",
      "type": "GenerateImagePrompt",
      "optional": false,
      "description": "The prompt that should be used to generate the image.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8245,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8245"
      }
    },
    "model-3c08b406693e": {
      "name": "model",
      "type": "ImageModel",
      "optional": false,
      "description": "The image model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8241,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8241"
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
    "providerOptions-f1407026e059": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options that are passed through to the provider\nas body parameters.\n\nThe outer record is keyed by the provider name, and the inner\nrecord is keyed by the provider-specific metadata key.\n```ts\n{\n  \"openai\": {\n    \"temperature\": 0\n  }\n}\n```",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11705,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11705"
      }
    },
    "maxRetries-517add5497ce": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11720,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11720"
      }
    },
    "headers-7886326ddcda": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request.\nOnly applicable for HTTP-based providers.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11729,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11729"
      }
    },
    "model-331c2d5419c7": {
      "name": "model",
      "type": "string | TranscriptionModelV4 | TranscriptionModelV3 | TranscriptionModelV2 | (string & TranscriptionModelV4) | (string & TranscriptionModelV3) | (string & TranscriptionModelV2) | (TranscriptionModelV4 & string) | (TranscriptionModelV3 & string) | (TranscriptionModelV2 & string)",
      "optional": false,
      "description": "The transcription model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11686,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11686"
      }
    },
    "telemetry-e6a01e9dfd10": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11733,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11733"
      }
    },
    "maxPreparedAudioBytes-595959558a15": {
      "name": "maxPreparedAudioBytes",
      "type": "number | undefined",
      "optional": true,
      "description": "Byte budget for recording preparation and decoded PCM sent to an encoder. Defaults to 32 MiB.",
      "tags": [],
      "source": {
        "path": "src/audio.ts"
      }
    },
    "sourceFormat-160cb13602cb": {
      "name": "sourceFormat",
      "type": "PcmSourceFormat | undefined",
      "optional": true,
      "description": "Original layout of headerless PCM. Omit for WAV or Web Audio AudioBuffer. Numeric sample arrays supply their encoding.",
      "tags": [],
      "source": {
        "path": "src/audio.ts"
      }
    },
    "timestampGranularities-f8ab98382618": {
      "name": "timestampGranularities",
      "type": "TranscriptionModelV4TimestampGranularity[] | undefined",
      "optional": true,
      "description": "Word and segment timings to request.\n\nSupported adapters map this onto the provider's native control when the\nmatching provider option is omitted. An explicit provider option wins.\nSupported adapters warn when they cannot return a requested granularity.\nAn empty array requests no shared timing granularity; provider defaults may vary.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11714,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11714"
      }
    },
    "download-7fc28372c55f": {
      "name": "download",
      "type": "((options: { url: URL; abortSignal?: AbortSignal; }) => Promise<{ data: Uint8Array; mediaType: string | undefined; }>) | undefined",
      "optional": true,
      "description": "Custom download function for fetching audio from URLs.\nProviding this option forces local downloading even when the provider\nsupports native URL transcription.\nUse `createDownload()` from `ai` to create a download function with custom size limits.",
      "tags": [
        {
          "name": "default",
          "text": "createDownload() (2 GiB limit)"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11742,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11742"
      }
    },
    "audio-c74e517980be": {
      "name": "audio",
      "type": "string | ArrayBuffer | Uint8Array<ArrayBufferLike> | Buffer<ArrayBufferLike> | URL | Uint8Array<ArrayBufferLike> | Blob | Int16Array<ArrayBufferLike> | Int32Array<ArrayBufferLike> | Float32Array<ArrayBufferLike> | Float64Array<ArrayBufferLike> | AudioBufferSource | TranscriptionFile | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "abortSignal-8b753a971039": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11724,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11724"
      }
    },
    "model-ab2d60d092c3": {
      "name": "model",
      "type": "TranscriptionModel",
      "optional": false,
      "description": "The transcription model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11686,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11686"
      }
    },
    "audio-f4a50ca734b1": {
      "name": "audio",
      "type": "string | ArrayBuffer | Uint8Array<ArrayBufferLike> | Buffer<ArrayBufferLike> | URL | Uint8Array<ArrayBufferLike> | Blob | Int16Array<ArrayBufferLike> | Int32Array<ArrayBufferLike> | Float32Array<ArrayBufferLike> | Float64Array<ArrayBufferLike> | AudioBufferSource | TranscriptionFile",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/factories/Transcriber.ts"
      }
    },
    "direct-7bcd58c5299d": {
      "name": "direct",
      "type": "string | Uint8Array<ArrayBufferLike> | Buffer<ArrayBufferLike> | URL | TranscriptionFile | RawAudio",
      "optional": false,
      "description": "",
      "tags": []
    },
    "prepared-b09ea79bc187": {
      "name": "prepared",
      "type": "string | Uint8Array<ArrayBufferLike> | Buffer<ArrayBufferLike> | URL | TranscriptionFile | RawAudio",
      "optional": false,
      "description": "",
      "tags": []
    },
    "providerOptions-0391eeeaef21": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options that are passed through to the provider\nas body parameters.\n\nThe outer record is keyed by the provider name, and the inner\nrecord is keyed by the provider-specific metadata key.\n```ts\n{\n\"openai\": {}\n}\n```",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10232,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10232"
      }
    },
    "language-80fcf25fd716": {
      "name": "language",
      "type": "string | undefined",
      "optional": true,
      "description": "The language for speech generation. This should be an ISO 639-1 language code (e.g. \"en\", \"es\", \"fr\")\nor \"auto\" for automatic language detection. Provider support varies.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10219,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10219"
      }
    },
    "maxRetries-49b0652defa9": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10238,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10238"
      }
    },
    "headers-06589cfe4fcf": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request.\nOnly applicable for HTTP-based providers.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10247,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10247"
      }
    },
    "instructions-3d37a40068de": {
      "name": "instructions",
      "type": "string | undefined",
      "optional": true,
      "description": "Instructions for the speech generation e.g. \"Speak in a slow and steady tone\".",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10210,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10210"
      }
    },
    "model-abbda6b55254": {
      "name": "model",
      "type": "string | SpeechModelV4 | SpeechModelV3 | SpeechModelV2 | (string & SpeechModelV4) | (string & SpeechModelV3) | (string & SpeechModelV2) | (SpeechModelV4 & string) | (SpeechModelV3 & string) | (SpeechModelV2 & string)",
      "optional": false,
      "description": "The speech model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10194,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10194"
      }
    },
    "telemetry-0bd86804edb7": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10251,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10251"
      }
    },
    "voice-077d0f0f81a8": {
      "name": "voice",
      "type": "string | undefined",
      "optional": true,
      "description": "The voice to use for speech generation.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10202,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10202"
      }
    },
    "outputFormat-69479cff1acd": {
      "name": "outputFormat",
      "type": "(string & {}) | \"mp3\" | \"wav\" | undefined",
      "optional": true,
      "description": "The desired output format for the audio e.g. \"mp3\", \"wav\", etc.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10206,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10206"
      }
    },
    "speed-d74265e616d8": {
      "name": "speed",
      "type": "number | undefined",
      "optional": true,
      "description": "The speed of the speech generation.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10214,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10214"
      }
    },
    "text-9952b743697d": {
      "name": "text",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "text-3e3b88fecf0f": {
      "name": "text",
      "type": "string",
      "optional": false,
      "description": "The text to convert to speech.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10198,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10198"
      }
    },
    "abortSignal-2a56d4719602": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10242,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10242"
      }
    },
    "model-1dce7990aa0b": {
      "name": "model",
      "type": "SpeechModel",
      "optional": false,
      "description": "The speech model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10194,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10194"
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
    "providerOptions-90a5d6a9f1ee": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 12066,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12066"
      }
    },
    "headers-7d47ca76d094": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request, if supported by the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 12074,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12074"
      }
    },
    "model-4789518cab57": {
      "name": "model",
      "type": "(SpeechTranslationModel | undefined) & SpeechTranslationModel",
      "optional": false,
      "description": "The speech translation model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 12038,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12038"
      }
    },
    "inputAudioFormat-d8322f89357f": {
      "name": "inputAudioFormat",
      "type": "SharedV4AudioFormat | undefined",
      "optional": true,
      "description": "The input audio format for the raw audio chunks.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 12046,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12046"
      }
    },
    "targetLanguage-8f57c47fbc72": {
      "name": "targetLanguage",
      "type": "string | undefined",
      "optional": true,
      "description": "The language to translate the audio into, as a BCP-47-style language\ntag (e.g. `en`, `es`, `fr-CA`). Supported values are provider-specific\nand validated by the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 12052,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12052"
      }
    },
    "outputAudioFormat-d539c234392c": {
      "name": "outputAudioFormat",
      "type": "SharedV4AudioFormat | undefined",
      "optional": true,
      "description": "The desired audio format for translated audio chunks.\nWhen absent, the provider default output format is used.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 12062,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12062"
      }
    },
    "sourceLanguage-ebb4e1b916d2": {
      "name": "sourceLanguage",
      "type": "string | undefined",
      "optional": true,
      "description": "The language of the source audio, as a BCP-47-style language tag.\nWhen absent, providers auto-detect the source language.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 12057,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12057"
      }
    },
    "audio-c563898406e8": {
      "name": "audio",
      "type": "RawAudio | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "abortSignal-c0f42bc55266": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 12070,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12070"
      }
    },
    "model-246db9799f69": {
      "name": "model",
      "type": "SpeechTranslationModel",
      "optional": false,
      "description": "The speech translation model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 12038,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12038"
      }
    },
    "audio-87d9e2ee44af": {
      "name": "audio",
      "type": "RawAudio",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/factories/Translator.ts"
      }
    },
    "inputAudioFormat-afb9527b3706": {
      "name": "inputAudioFormat",
      "type": "SharedV4AudioFormat",
      "optional": false,
      "description": "The input audio format for the raw audio chunks.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 12046,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12046"
      }
    },
    "targetLanguage-f0a3ad97c84b": {
      "name": "targetLanguage",
      "type": "string",
      "optional": false,
      "description": "The language to translate the audio into, as a BCP-47-style language\ntag (e.g. `en`, `es`, `fr-CA`). Supported values are provider-specific\nand validated by the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 12052,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12052"
      }
    },
    "direct-1d822026b786": {
      "name": "direct",
      "type": "RawAudio",
      "optional": false,
      "description": "",
      "tags": []
    },
    "prepared-8ec1b7b87830": {
      "name": "prepared",
      "type": "RawAudio",
      "optional": false,
      "description": "",
      "tags": []
    },
    "providerOptions-207d34914c15": {
      "name": "providerOptions",
      "type": "Record<string, unknown> | undefined",
      "optional": true,
      "description": "Provider-specific options that are passed through to the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7739,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7739"
      }
    },
    "model-c2646b18c643": {
      "name": "model",
      "type": "RealtimeModelV4",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/factories/VoiceAgentBackend.ts"
      }
    },
    "inputAudioFormat-9303f715c7b4": {
      "name": "inputAudioFormat",
      "type": "SharedV4AudioFormat | undefined",
      "optional": true,
      "description": "Audio format configuration for input audio.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7657,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7657"
      }
    },
    "voice-a1f8a990e4c3": {
      "name": "voice",
      "type": "string | undefined",
      "optional": true,
      "description": "Voice to use for audio output.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7649,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7649"
      }
    },
    "outputModalities-c669f792f5d9": {
      "name": "outputModalities",
      "type": "(\"text\" | \"audio\")[] | undefined",
      "optional": true,
      "description": "Which output modalities the model should produce.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7653,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7653"
      }
    },
    "inputAudioTranscription-b199469fe309": {
      "name": "inputAudioTranscription",
      "type": "{ model?: string; language?: string; prompt?: string; } | undefined",
      "optional": true,
      "description": "Input audio transcription configuration.\n\nWhen enabled, providers that support input transcription emit normalized\n`input-transcription-completed` events that can be rendered as user\nmessages.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7665,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7665"
      }
    },
    "outputAudioTranscription-3df77a6d2390": {
      "name": "outputAudioTranscription",
      "type": "{ model?: string; language?: string; prompt?: string; } | undefined",
      "optional": true,
      "description": "Output audio transcription configuration.\n\nWhen enabled, providers that support output transcription emit normalized\n`audio-transcript-delta` / `audio-transcript-done` events for the model's\nspoken response. Some providers transcribe output by default; setting this\nmakes the behavior explicit rather than relying on that default.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7687,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7687"
      }
    },
    "outputAudioFormat-40273b9f1c57": {
      "name": "outputAudioFormat",
      "type": "SharedV4AudioFormat | undefined",
      "optional": true,
      "description": "Audio format configuration for output audio.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7704,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7704"
      }
    },
    "turnDetection-a9c515125296": {
      "name": "turnDetection",
      "type": "{ type: \"server-vad\" | \"semantic-vad\" | \"disabled\"; threshold?: number; silenceDurationMs?: number; prefixPaddingMs?: number; } | null | undefined",
      "optional": true,
      "description": "Voice activity detection configuration.\nSet to null or type 'disabled' to turn off VAD (push-to-talk mode).",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7709,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7709"
      }
    },
    "expiresAfterSeconds-7125d4863dda": {
      "name": "expiresAfterSeconds",
      "type": "number | undefined",
      "optional": true,
      "description": "Number of seconds until the client secret expires.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7751,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7751"
      }
    },
    "instructions-cda74c669be0": {
      "name": "instructions",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "instructions-0c459c58ac82": {
      "name": "instructions",
      "type": "string | undefined",
      "optional": true,
      "description": "System instructions for the model.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7645,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7645"
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
    "onInputAvailable-2fcbe53a40cf": {
      "name": "onInputAvailable",
      "type": "((options: { input: Record<string, unknown>; } & ToolExecutionOptions<unknown>) => void | PromiseLike<void>) | undefined",
      "optional": true,
      "description": "Optional function that is called when a tool call can be started,\neven if the execute function is not provided.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2398,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L2398"
      }
    },
    "onInputStart-6db43b699e4e": {
      "name": "onInputStart",
      "type": "((options: ToolExecutionOptions<unknown>) => void | PromiseLike<void>) | undefined",
      "optional": true,
      "description": "Optional function that is called when the model starts generating the tool input.\nIn non-streaming contexts, it is called immediately before `onInputAvailable`.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2386,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L2386"
      }
    },
    "onInputDelta-dc6151fa688a": {
      "name": "onInputDelta",
      "type": "((options: { inputTextDelta: string; } & ToolExecutionOptions<unknown>) => void | PromiseLike<void>) | undefined",
      "optional": true,
      "description": "Optional function that is called when an argument streaming delta is available.\nOnly called when the tool is used in a streaming context.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2391,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L2391"
      }
    },
    "needsApproval-1e0f61adeb0d": {
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
        "line": 2381,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L2381"
      }
    },
    "title-a1c2f6247831": {
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
        "line": 2345,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L2345"
      }
    },
    "deferLoading-fec45f07f745": {
      "name": "deferLoading",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Defer exposing this tool until it is discovered by `toolSearch`.\nSupports direct calls and local callers that announce tools in conversation\nmessages (code mode with `toolDiscovery: 'conversation'`). Discovered tools\nbecome available on the next model step.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2339,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L2339"
      }
    },
    "providerOptions-618cf384fe38": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific metadata. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2351,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L2351"
      }
    },
    "metadata-c2317f76c82b": {
      "name": "metadata",
      "type": "JSONObject | undefined",
      "optional": true,
      "description": "Optional metadata about the tool itself (e.g. its source).\n\nUnlike `providerOptions`, this metadata is not sent to the language\nmodel. Instead, it is propagated onto the resulting tool call's\n`toolMetadata` so consumers can read it from tool call / result parts\nand UI message parts. This is useful for sources of dynamic tools (e.g.\nan MCP server) to identify themselves.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2361,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L2361"
      }
    },
    "toModelOutput-2b05fcc61141": {
      "name": "toModelOutput",
      "type": "((options: { toolCallId: string; input: Record<string, unknown>; output: unknown; }) => ToolResultOutput | PromiseLike<ToolResultOutput>) | undefined",
      "optional": true,
      "description": "Optional conversion function that maps the tool result to an output that can be used by the language model.\n\nIf not provided, the tool result will be sent as a JSON object.\n\nThis function is invoked on the server by `convertToModelMessages`, so ensure that you pass the same \"tools\" (ToolSet) to both \"convertToModelMessages\" and \"streamText\" (or other generation APIs).",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2408,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L2408"
      }
    },
    "strict-4241d63003b7": {
      "name": "strict",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Strict mode setting for the tool.\n\nProviders that support strict mode will use this setting to determine\nhow the input should be generated. Strict mode will always produce\nvalid inputs, but it might limit what input schemas are supported.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2448,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L2448"
      }
    },
    "inputExamples-e42b4f96dfae": {
      "name": "inputExamples",
      "type": "{ input: NoInfer<Record<string, unknown>>; }[] | undefined",
      "optional": true,
      "description": "An optional list of input examples that show the language\nmodel what the input should look like.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2453,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L2453"
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
    "timeout-0e724f13b50a": {
      "name": "timeout",
      "type": "TimeoutConfiguration<EmptyMap> | undefined",
      "optional": true,
      "description": "Timeout configuration for the request.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1049,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1049"
      }
    },
    "toolChoice-58cffc8c1041": {
      "name": "toolChoice",
      "type": "ToolChoice<EmptyMap> | undefined",
      "optional": true,
      "description": "The tool choice strategy. Default: 'auto'.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4357,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4357"
      }
    },
    "telemetry-5d1adc753c55": {
      "name": "telemetry",
      "type": "TelemetryOptions<Record<string, unknown>, NoInfer<EmptyMap>> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4368,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4368"
      }
    },
    "activeTools-06cfc51a0db3": {
      "name": "activeTools",
      "type": "ActiveTools<NoInfer<EmptyMap>>",
      "optional": true,
      "description": "Limits the tools that are available for the model to call without\nchanging the tool call and result types in the result.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4400,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4400"
      }
    },
    "toolOrder-2a0e343c93b1": {
      "name": "toolOrder",
      "type": "ToolOrder<NoInfer<EmptyMap>>",
      "optional": true,
      "description": "Controls the order in which tools are sent to the provider.\n\nThe list can be partial. Tools not listed in `toolOrder` are sent after\nthe listed tools, sorted alphabetically. This can improve provider-side\ncaching by keeping tool definitions in a stable order.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4408,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4408"
      }
    },
    "experimental_toolCallers-fd1a321c4fd1": {
      "name": "experimental_toolCallers",
      "type": "Experimental_ToolCallers<NoInfer<EmptyMap>> | undefined",
      "optional": true,
      "description": "Configures which caller tools may invoke each tool.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4429,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4429"
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
    "options-8fa395032d9b": {
      "name": "options",
      "type": "unknown",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6034,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6034"
      }
    },
    "prompt-8d7ea27bd026": {
      "name": "prompt",
      "type": "string | ModelMessage[] | undefined",
      "optional": true,
      "description": "A prompt. It can be either a text prompt or a list of messages.\n\nYou can either use `prompt` or `messages` but not both.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6041,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6041"
      }
    },
    "messages-ed6c2b4b81e2": {
      "name": "messages",
      "type": "ModelMessage[] | undefined",
      "optional": true,
      "description": "A list of messages.\n\nYou can either use `prompt` or `messages` but not both.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6047,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6047"
      }
    },
    "abortSignal-8472d497301f": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6065,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6065"
      }
    },
    "timeout-3d7a5c777cdf": {
      "name": "timeout",
      "type": "TimeoutConfiguration<{}> | undefined",
      "optional": true,
      "description": "Timeout in milliseconds. Can be specified as a number or as an object\nwith total, per-step, first-content, inter-content, and tool timeouts.\nFirst-content and inter-content timeouts are only enforced by streaming\ncalls.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6072,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6072"
      }
    },
    "onStart-8ab79d0f0fb2": {
      "name": "onStart",
      "type": "GenerateTextOnStartCallback<{}, Context, Output<any, any, any>> | undefined",
      "optional": true,
      "description": "Callback that is called when the agent operation begins, before any LLM calls.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6076,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6076"
      }
    },
    "experimental_onStart-bdf9f9b7d2a9": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6082,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6082"
      }
    },
    "onStepStart-8051895eff4f": {
      "name": "onStepStart",
      "type": "GenerateTextOnStepStartCallback<{}, Context, Output<any, any, any>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step (LLM call) begins, before the provider is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6086,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6086"
      }
    },
    "experimental_onStepStart-e7ff155c4cc6": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6092,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6092"
      }
    },
    "onToolExecutionStart-0efd83b85d7c": {
      "name": "onToolExecutionStart",
      "type": "OnToolExecutionStartCallback<{}> | undefined",
      "optional": true,
      "description": "Callback that is called before each tool execution begins.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6096,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6096"
      }
    },
    "experimental_onToolCallStart-f78192135695": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6102,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6102"
      }
    },
    "onToolExecutionEnd-b14c42f13960": {
      "name": "onToolExecutionEnd",
      "type": "OnToolExecutionEndCallback<{}> | undefined",
      "optional": true,
      "description": "Callback that is called after each tool execution completes.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6106,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6106"
      }
    },
    "experimental_onToolCallFinish-fbaaccdc74be": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6112,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6112"
      }
    },
    "onStepEnd-5ba9136cedb9": {
      "name": "onStepEnd",
      "type": "GenerateTextOnStepEndCallback<{}, Context> | undefined",
      "optional": true,
      "description": "Callback that is called when each step (LLM call) ends, including intermediate steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6116,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6116"
      }
    },
    "onStepFinish-108a1b0e5530": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6122,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6122"
      }
    },
    "onEnd-5adcd5ed4951": {
      "name": "onEnd",
      "type": "GenerateTextOnEndCallback<{}, Context> | undefined",
      "optional": true,
      "description": "Callback that is called when all steps are finished and the response is complete.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6126,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6126"
      }
    },
    "onFinish-64c97cab1f90": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6132,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6132"
      }
    },
    "experimental_sandbox-ca9e32143b76": {
      "name": "experimental_sandbox",
      "type": "SandboxSession | undefined",
      "optional": true,
      "description": "The sandbox environment that is passed through to tool execution.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6136,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6136"
      }
    },
    "timeout-ba7665ff386c": {
      "name": "timeout",
      "type": "TimeoutConfiguration<ToolSet> | undefined",
      "optional": true,
      "description": "Timeout in milliseconds. Can be specified as a number or as an object\nwith total, per-step, first-content, inter-content, and tool timeouts.\nFirst-content and inter-content timeouts are only enforced by streaming\ncalls.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6072,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6072"
      }
    },
    "onStart-38c32622c842": {
      "name": "onStart",
      "type": "GenerateTextOnStartCallback<ToolSet, Context, Output<any, any, any>> | undefined",
      "optional": true,
      "description": "Callback that is called when the agent operation begins, before any LLM calls.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6076,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6076"
      }
    },
    "experimental_onStart-d03a46de5ea8": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6082,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6082"
      }
    },
    "onStepStart-61964b5201ef": {
      "name": "onStepStart",
      "type": "GenerateTextOnStepStartCallback<ToolSet, Context, Output<any, any, any>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step (LLM call) begins, before the provider is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6086,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6086"
      }
    },
    "experimental_onStepStart-b6023181e588": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6092,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6092"
      }
    },
    "onToolExecutionStart-b0f5666b9163": {
      "name": "onToolExecutionStart",
      "type": "OnToolExecutionStartCallback<ToolSet> | undefined",
      "optional": true,
      "description": "Callback that is called before each tool execution begins.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6096,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6096"
      }
    },
    "experimental_onToolCallStart-c0d4f80bf7e9": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6102,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6102"
      }
    },
    "onToolExecutionEnd-d0cb63f0a4eb": {
      "name": "onToolExecutionEnd",
      "type": "OnToolExecutionEndCallback<ToolSet> | undefined",
      "optional": true,
      "description": "Callback that is called after each tool execution completes.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6106,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6106"
      }
    },
    "experimental_onToolCallFinish-6975a1e4c99c": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6112,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6112"
      }
    },
    "onStepEnd-e2a3cff813fa": {
      "name": "onStepEnd",
      "type": "GenerateTextOnStepEndCallback<ToolSet, Context> | undefined",
      "optional": true,
      "description": "Callback that is called when each step (LLM call) ends, including intermediate steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6116,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6116"
      }
    },
    "onStepFinish-ea5fa4554781": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6122,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6122"
      }
    },
    "onEnd-974d471b67c6": {
      "name": "onEnd",
      "type": "GenerateTextOnEndCallback<ToolSet, Context> | undefined",
      "optional": true,
      "description": "Callback that is called when all steps are finished and the response is complete.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6126,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6126"
      }
    },
    "onFinish-512100d5c453": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6132,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6132"
      }
    },
    "experimental_transform-7db3258bd060": {
      "name": "experimental_transform",
      "type": "Arrayable<StreamTextTransform<ToolSet>>",
      "optional": true,
      "description": "Optional stream transformations.\nThey are applied in the order they are provided.\nThe stream transformations must maintain the stream structure for streamText to work correctly.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6147,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6147"
      }
    },
    "abortSignal-332106eb39a3": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1040,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1040"
      }
    },
    "system-77b926aa15b3": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1078,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1078"
      }
    },
    "prompt-9441b69dcea1": {
      "name": "prompt",
      "type": "string | ModelMessage[] | undefined",
      "optional": true,
      "description": "A prompt. It can be either a text prompt or a list of messages.\n\nYou can either use `prompt` or `messages` but not both.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1094,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1094"
      }
    },
    "messages-43bee1c696a9": {
      "name": "messages",
      "type": "ModelMessage[] | undefined",
      "optional": true,
      "description": "A list of messages.\n\nYou can either use `prompt` or `messages` but not both.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1100,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1100"
      }
    },
    "tools-5efdda627cc8": {
      "name": "tools",
      "type": "ToolSet | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4177,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4177"
      }
    },
    "model-09a947404281": {
      "name": "model",
      "type": "LanguageModel",
      "optional": false,
      "description": "The language model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6280,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6280"
      }
    },
    "toolChoice-427c5a9308b0": {
      "name": "toolChoice",
      "type": "ToolChoice<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "The tool choice strategy. Default: 'auto'.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6284,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6284"
      }
    },
    "stopWhen-5eaba03d41fc": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6291,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6291"
      }
    },
    "telemetry-83a18a73674f": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6295,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6295"
      }
    },
    "experimental_telemetry-308f34bd840d": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6301,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6301"
      }
    },
    "providerOptions-bd08c56812f2": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6307,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6307"
      }
    },
    "experimental_sandbox-37021c1de022": {
      "name": "experimental_sandbox",
      "type": "SandboxSession | undefined",
      "optional": true,
      "description": "The sandbox environment that is passed through to tool execution.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6311,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6311"
      }
    },
    "experimental_steering-460ceb38c418": {
      "name": "experimental_steering",
      "type": "Steering | undefined",
      "optional": true,
      "description": "A steering object created with `experimental_createSteering()`.\nMessages sent with it are added to the generation at the next step\nboundary.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6317,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6317"
      }
    },
    "runtimeContext-afa54abaf1a9": {
      "name": "runtimeContext",
      "type": "Context | undefined",
      "optional": true,
      "description": "Runtime context. Treat runtime context as immutable.\nIf you need to mutate runtime context, update it in `prepareStep`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6322,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6322"
      }
    },
    "activeTools-f03d9ff9a732": {
      "name": "activeTools",
      "type": "ActiveTools<NoInfer<ToolSet>>",
      "optional": true,
      "description": "Limits the tools that are available for the model to call without\nchanging the tool call and result types in the result.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6327,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6327"
      }
    },
    "toolOrder-2d0fea3811dd": {
      "name": "toolOrder",
      "type": "ToolOrder<NoInfer<ToolSet>>",
      "optional": true,
      "description": "Controls the order in which tools are sent to the provider.\n\nThe list can be partial. Tools not listed in `toolOrder` are sent after\nthe listed tools, sorted alphabetically. This can improve provider-side\ncaching by keeping tool definitions in a stable order.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6335,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6335"
      }
    },
    "toolCallConcurrency-bc88af60dd58": {
      "name": "toolCallConcurrency",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of tool calls that may execute concurrently within a step.\n\nSet to `1` to execute tool calls sequentially in the order they were\ngenerated. By default, all tool calls execute concurrently.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6342,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6342"
      }
    },
    "output-0c868bea346c": {
      "name": "output",
      "type": "Output<any, any, any> | undefined",
      "optional": true,
      "description": "Optional specification for parsing structured outputs from the LLM response.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6346,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6346"
      }
    },
    "toolApproval-d051fbd5a943": {
      "name": "toolApproval",
      "type": "ToolApprovalConfiguration<ToolSet, Context> | undefined",
      "optional": true,
      "description": "Optional tool approval configuration.\n\nThis configuration takes precedence over tool-defined approval settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6352,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6352"
      }
    },
    "experimental_toolCallers-2a0384aa9261": {
      "name": "experimental_toolCallers",
      "type": "Experimental_ToolCallers<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Configures which caller tools may invoke each tool.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6356,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6356"
      }
    },
    "experimental_toolApprovalSecret-396b6f71c894": {
      "name": "experimental_toolApprovalSecret",
      "type": "string | Uint8Array<ArrayBufferLike> | undefined",
      "optional": true,
      "description": "Secret for HMAC-signing tool approval requests. When set, the server\nsigns approval requests at issuance and verifies the signature when\nthe approval is replayed, preventing client-forged approvals.\nApproval requests for automatically denied tool calls are not signed.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6363,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6363"
      }
    },
    "experimental_download-598dda901e60": {
      "name": "experimental_download",
      "type": "DownloadFunction | undefined",
      "optional": true,
      "description": "Custom download function to use for URLs in the prompt and for\ngenerated file URLs returned by the model.\n\nBy default, prompt files are downloaded if the model does not support\nthe URL for the given media type. Generated file URLs are always\ndownloaded; returning `null` for them is an error.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6372,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6372"
      }
    },
    "prepareStep-aafaa9f826d3": {
      "name": "prepareStep",
      "type": "PrepareStepFunction<NoInfer<ToolSet>, Context> | undefined",
      "optional": true,
      "description": "Optional function that you can use to provide different settings for a step.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6376,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6376"
      }
    },
    "repairToolCall-6d6832910cc0": {
      "name": "repairToolCall",
      "type": "ToolCallRepairFunction<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "A function that attempts to repair a tool call that failed to parse.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6380,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6380"
      }
    },
    "experimental_repairToolCall-d304098a1b19": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6386,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6386"
      }
    },
    "experimental_refineToolInput-b39b71a0bddd": {
      "name": "experimental_refineToolInput",
      "type": "ToolInputRefinement<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Optional mapping of tool names to functions that refine parsed tool inputs.\n\nThe refined input must have the same type shape as the tool input. Refined\ninputs are used for tool execution, outputs, callbacks, and telemetry.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6393,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6393"
      }
    },
    "onStart-89fac7e39631": {
      "name": "onStart",
      "type": "GenerateTextOnStartCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the generateText operation begins,\nbefore any LLM calls are made.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6398,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6398"
      }
    },
    "experimental_onStart-5921bc4f853e": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6405,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6405"
      }
    },
    "onStepStart-220427497ee7": {
      "name": "onStepStart",
      "type": "GenerateTextOnStepStartCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step (LLM call) begins,\nbefore the provider is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6410,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6410"
      }
    },
    "experimental_onStepStart-0a99f50815e7": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6417,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6417"
      }
    },
    "onLanguageModelCallStart-81f4947eef8c": {
      "name": "onLanguageModelCallStart",
      "type": "OnLanguageModelCallStartCallback | undefined",
      "optional": true,
      "description": "Callback that is called immediately before the provider model call begins.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6421,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6421"
      }
    },
    "experimental_onLanguageModelCallStart-efe693c1dc1b": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6427,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6427"
      }
    },
    "onLanguageModelCallEnd-fa88d24172ce": {
      "name": "onLanguageModelCallEnd",
      "type": "OnLanguageModelCallEndCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called after the model response has been normalized and parsed,\nbut before any client-side tool execution begins.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6432,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6432"
      }
    },
    "experimental_onLanguageModelCallEnd-48f9fd5c2d62": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6439,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6439"
      }
    },
    "onToolExecutionStart-a060181acc9b": {
      "name": "onToolExecutionStart",
      "type": "OnToolExecutionStartCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called right before a tool's execute function runs.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6443,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6443"
      }
    },
    "experimental_onToolCallStart-6fe11ac760e4": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6449,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6449"
      }
    },
    "onToolExecutionEnd-478ae59f9ea8": {
      "name": "onToolExecutionEnd",
      "type": "OnToolExecutionEndCallback<NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Callback that is called right after a tool's execute function completes (or errors).",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6453,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6453"
      }
    },
    "experimental_onToolCallFinish-2ef361bbbc6c": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6459,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6459"
      }
    },
    "onStepEnd-2aaf83f6abe4": {
      "name": "onStepEnd",
      "type": "GenerateTextOnStepEndCallback<NoInfer<ToolSet>, NoInfer<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when each step (LLM call) ends, including intermediate steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6463,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6463"
      }
    },
    "onStepError-63d00bbd0ad0": {
      "name": "onStepError",
      "type": "GenerateTextOnStepErrorCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step that started fails before it\nproduces a step result. `onStepEnd` is not called for such a step.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6468,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6468"
      }
    },
    "onWarning-b25f03d5708f": {
      "name": "onWarning",
      "type": "LogWarningsFunction | undefined",
      "optional": true,
      "description": "Callback that receives the warnings of the call, e.g. unsupported\nsettings or deprecated prompt parts. When it is set, the warnings are\nnot sent to the global warning logger (`AI_SDK_LOG_WARNINGS`).",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6474,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6474"
      }
    },
    "onStepFinish-c3f5f84cadd0": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6480,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6480"
      }
    },
    "onEnd-f5cf86d09704": {
      "name": "onEnd",
      "type": "GenerateTextOnEndCallback<NoInfer<ToolSet>, NoInfer<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when all steps are finished and the response is complete.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6484,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6484"
      }
    },
    "onFinish-addf70b8ab33": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6490,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6490"
      }
    },
    "include-f5921751b4c7": {
      "name": "include",
      "type": "GenerateTextInclude | undefined",
      "optional": true,
      "description": "Settings for controlling what data is included in step results.\nDisabling inclusion can help reduce memory usage when processing\nlarge payloads like images.\n\nBy default, request bodies, request messages, and response bodies are\nexcluded.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6499,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6499"
      }
    },
    "experimental_include-66b1c9615325": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6505,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6505"
      }
    },
    "_internal-4f7a05af8f2b": {
      "name": "_internal",
      "type": "{ generateId?: IdGenerator; generateCallId?: IdGenerator; now?: () => number; } | undefined",
      "optional": true,
      "description": "Internal. For test use only. May change without notice.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6509,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6509"
      }
    },
    "stopWhen-1269c94bf274": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4364,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4364"
      }
    },
    "telemetry-7f5176f31df4": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, NoInfer<ToolSet>> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4368,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4368"
      }
    },
    "experimental_telemetry-4f7675b48d9c": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4374,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4374"
      }
    },
    "runtimeContext-6fe9258c1451": {
      "name": "runtimeContext",
      "type": "Context | undefined",
      "optional": true,
      "description": "Runtime context. Treat runtime context as immutable.\nIf you need to mutate runtime context, update it in `prepareStep`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4395,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4395"
      }
    },
    "output-56ac795cb09d": {
      "name": "output",
      "type": "Output<any, any, any> | undefined",
      "optional": true,
      "description": "Optional specification for parsing structured outputs from the LLM response.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4419,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4419"
      }
    },
    "toolApproval-e6f9c22d9b3c": {
      "name": "toolApproval",
      "type": "ToolApprovalConfiguration<ToolSet, Context> | undefined",
      "optional": true,
      "description": "Optional tool approval configuration.\n\nThis configuration takes precedence over tool-defined approval settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4425,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4425"
      }
    },
    "prepareStep-d9f1f942f148": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4448,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4448"
      }
    },
    "experimental_repairToolCall-2aa1d06c3008": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4458,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4458"
      }
    },
    "includeRawChunks-eb80fd3d4f31": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4489,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4489"
      }
    },
    "onEnd-fe63bb2f27cd": {
      "name": "onEnd",
      "type": "StreamTextOnEndCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the LLM response and all request tool executions\n(for tools that have an `execute` function) are finished.\n\nThe usage is the combined usage of all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4529,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4529"
      }
    },
    "onFinish-c4bddcf07443": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4538,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4538"
      }
    },
    "onAbort-a9107997a88b": {
      "name": "onAbort",
      "type": "StreamTextOnAbortCallback<NoInfer<ToolSet>, NoInfer<Context>> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4539,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4539"
      }
    },
    "onStepEnd-195f794ee38b": {
      "name": "onStepEnd",
      "type": "GenerateTextOnStepEndCallback<NoInfer<ToolSet>, NoInfer<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when each step (LLM call) ends, including intermediate steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4543,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4543"
      }
    },
    "onStepError-4d72b82e99ae": {
      "name": "onStepError",
      "type": "GenerateTextOnStepErrorCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step that started fails before it\nproduces a step result. `onStepEnd` is not called for such a step.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4548,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4548"
      }
    },
    "onStepFinish-58089e235735": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4560,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4560"
      }
    },
    "onStart-0ec99fbf5859": {
      "name": "onStart",
      "type": "GenerateTextOnStartCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when the streamText operation begins,\nbefore any LLM calls are made.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4565,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4565"
      }
    },
    "experimental_onStart-0d26a8d8a29b": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4572,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4572"
      }
    },
    "onStepStart-d30a78139419": {
      "name": "onStepStart",
      "type": "GenerateTextOnStepStartCallback<NoInfer<ToolSet>, NoInfer<Context>, NoInfer<Output<any, any, any>>> | undefined",
      "optional": true,
      "description": "Callback that is called when a step (LLM call) begins,\nbefore the provider is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4577,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4577"
      }
    },
    "experimental_onStepStart-9068893fd70f": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4584,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4584"
      }
    },
    "experimental_onLanguageModelCallStart-39509eb3527f": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4594,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4594"
      }
    },
    "experimental_onLanguageModelCallEnd-1343c276d17a": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4606,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4606"
      }
    },
    "experimental_onToolCallStart-c8484c1add9d": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4616,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4616"
      }
    },
    "experimental_onToolCallFinish-988da25c5643": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4626,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4626"
      }
    },
    "experimental_include-6f60b3b599e8": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4640,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4640"
      }
    },
    "_internal-aaa986384177": {
      "name": "_internal",
      "type": "{ now?: () => number; generateId?: IdGenerator; generateCallId?: IdGenerator; retention?: StreamTextRetention; } | undefined",
      "optional": true,
      "description": "Internal. For test use only. May change without notice.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4644,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4644"
      }
    },
    "replayAsyncIterables-1922b83c46d7": {
      "name": "replayAsyncIterables",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Set false to disable automatic async loop replay. Sequential loops close on early exit. Default: true.",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 111,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L111"
      }
    },
    "autoescape-0fd82da2d919": {
      "name": "autoescape",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 112,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L112"
      }
    },
    "throwOnUndefined-fa7eeddad50a": {
      "name": "throwOnUndefined",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 113,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L113"
      }
    },
    "trimBlocks-a103e1e5c1c7": {
      "name": "trimBlocks",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 114,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L114"
      }
    },
    "lstripBlocks-360a57b29864": {
      "name": "lstripBlocks",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 115,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L115"
      }
    },
    "watch-6c8d7c97cb8b": {
      "name": "watch",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 116,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L116"
      }
    },
    "noCache-c16665203f1a": {
      "name": "noCache",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 117,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L117"
      }
    },
    "dev-c66bed597c2b": {
      "name": "dev",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 118,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L118"
      }
    },
    "web-026db73498ee": {
      "name": "web",
      "type": "{ useCache?: boolean | undefined; async?: boolean | undefined; } | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 119,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L119"
      }
    },
    "express-6645ad524cc8": {
      "name": "express",
      "type": "object | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 125,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L125"
      }
    },
    "tags-b567e55e7b4a": {
      "name": "tags",
      "type": "{ blockStart?: string | undefined; blockEnd?: string | undefined; variableStart?: string | undefined; variableEnd?: string | undefined; commentStart?: string | undefined; commentEnd?: string | undefined; } | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 126,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L126"
      }
    },
    "abortSignal-c02e8d90cdb1": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "An optional abort signal that indicates that the overall operation should be aborted.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2248,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L2248"
      }
    },
    "experimental_sandbox-2c067d8f8a99": {
      "name": "experimental_sandbox",
      "type": "SandboxSession | undefined",
      "optional": true,
      "description": "The sandbox environment that the tool is operating in.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2264,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L2264"
      }
    },
    "toolCallId-2f21e5d47936": {
      "name": "toolCallId",
      "type": "string | undefined",
      "optional": true,
      "description": "The ID of the tool call. You can use it e.g. when sending tool-call related information with stream data.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2239,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L2239"
      }
    },
    "messages-09b7b90bc227": {
      "name": "messages",
      "type": "ModelMessage[] | undefined",
      "optional": true,
      "description": "Messages that were sent to the language model to initiate the response that contained the tool call.\nThe messages **do not** include the system prompt nor the assistant response that contained the tool call.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 2244,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L2244"
      }
    },
    "array-8ef7a1a38be3": {
      "name": "array",
      "type": "{ <ELEMENT>(options: ArrayOptions<FlexibleSchema<ELEMENT>>): Output<Array<ELEMENT>, Array<ELEMENT>, ELEMENT>; <OUTPUT = never, SCHEMA = FlexibleSchema<OUTPUT>>(options: ArrayOptions<ValidatedSchema<SCHEMA>>): Output<Array<ResolveOutput<OUTPUT, SCHEMA>>, Array<ResolveOutput<OUTPUT, SCHEMA>>, ResolveOutput<OUTPUT, SCHEMA>>; }",
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4764,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4764"
      }
    },
    "choice-40a88fdac013": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4776,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4776"
      }
    },
    "json-7cf712295f6b": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4798,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4798"
      }
    },
    "object-297d79bfd094": {
      "name": "object",
      "type": "{ <OBJECT>(options: ObjectOptions<FlexibleSchema<OBJECT>>): Output<OBJECT, DeepPartial<OBJECT>, never>; <OUTPUT = never, SCHEMA = FlexibleSchema<OUTPUT>>(options: ObjectOptions<ValidatedSchema<SCHEMA>>): Output<ResolveOutput<OUTPUT, SCHEMA>, DeepPartial<ResolveOutput<OUTPUT, SCHEMA>>, never>; }",
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4726,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4726"
      }
    },
    "text-5150d90812b9": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4697,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4697"
      }
    },
    "tools-5b3941793a8a": {
      "name": "tools",
      "type": "RealtimeModelV4ToolDefinition[] | undefined",
      "optional": true,
      "description": "Tool definitions available to the model in this session.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7735,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7735"
      }
    },
    "sessionId-b6fc27964320": {
      "name": "sessionId",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 8268,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L8268"
      }
    },
    "sdp-fcadac34b4d5": {
      "name": "sdp",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 8269,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L8269"
      }
    },
    "content-422e8740c5ce": {
      "name": "content",
      "type": "ContentPart<ToolSet>[]",
      "optional": false,
      "description": "The content that was generated in all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5899,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5899"
      }
    },
    "text-0571a906f1c8": {
      "name": "text",
      "type": "string",
      "optional": false,
      "description": "The concatenation of all text parts generated in the final step.\nIt is an empty string if the final step contains no text parts.\nInspect `finalStep.content` to distinguish that case.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5905,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5905"
      }
    },
    "reasoning-5c68a3f61406": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5911,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5911"
      }
    },
    "reasoningText-680764399433": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5918,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5918"
      }
    },
    "files-f05da7bef5bd": {
      "name": "files",
      "type": "GeneratedFile[]",
      "optional": false,
      "description": "The files that were generated in all steps.\nEmpty array if no files were generated.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5923,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5923"
      }
    },
    "sources-0a2f6b60c182": {
      "name": "sources",
      "type": "LanguageModelV4Source[]",
      "optional": false,
      "description": "Sources that have been used as references in all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5927,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5927"
      }
    },
    "toolCalls-069ebdd0ca5a": {
      "name": "toolCalls",
      "type": "TypedToolCall<ToolSet>[]",
      "optional": false,
      "description": "The tool calls that were made in all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5931,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5931"
      }
    },
    "staticToolCalls-882a07a64732": {
      "name": "staticToolCalls",
      "type": "(BaseToolCall & { toolName: string; input: any; dynamic?: false | undefined; invalid?: false | undefined; error?: never; title?: string; })[]",
      "optional": false,
      "description": "The static tool calls that were made in all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5935,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5935"
      }
    },
    "dynamicToolCalls-3b90509703b5": {
      "name": "dynamicToolCalls",
      "type": "DynamicToolCall[]",
      "optional": false,
      "description": "The dynamic tool calls that were made in all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5939,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5939"
      }
    },
    "toolResults-c5f99b80b2d0": {
      "name": "toolResults",
      "type": "TypedToolResult<ToolSet>[]",
      "optional": false,
      "description": "The results of the tool calls from all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5943,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5943"
      }
    },
    "staticToolResults-627995dc28d7": {
      "name": "staticToolResults",
      "type": "{ type: \"tool-result\"; toolCallId: string; toolName: string; input: any; output: any; providerExecuted?: boolean; providerMetadata?: ProviderMetadata; toolMetadata?: JSONObject; dynamic?: false | undefined; preliminary?: boolean; title?: string; }[]",
      "optional": false,
      "description": "The static tool results that were made in all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5947,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5947"
      }
    },
    "dynamicToolResults-5a02069c1994": {
      "name": "dynamicToolResults",
      "type": "DynamicToolResult[]",
      "optional": false,
      "description": "The dynamic tool results that were made in all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5951,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5951"
      }
    },
    "finishReason-5565b4913800": {
      "name": "finishReason",
      "type": "FinishReason",
      "optional": false,
      "description": "The unified reason why the generation finished.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5955,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5955"
      }
    },
    "rawFinishReason-afbf2b9573a4": {
      "name": "rawFinishReason",
      "type": "string | undefined",
      "optional": false,
      "description": "The raw reason why the generation finished (from the provider).",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5959,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5959"
      }
    },
    "stoppedBy-d38eb1c0a082": {
      "name": "stoppedBy",
      "type": "StoppedBy | undefined",
      "optional": true,
      "description": "Why the generation stopped its tool loop. Unlike `finishReason`, which\ndescribes the last model call, it tells whether the model, a stop\ncondition, a tool without an `execute` function, or a tool approval ended\nthe loop. `generateText` and `ToolLoopAgent` always set it.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5966,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5966"
      }
    },
    "usage-082e2510cd29": {
      "name": "usage",
      "type": "LanguageModelUsage",
      "optional": false,
      "description": "The total token usage of all steps.\nWhen there are multiple steps, the usage is the sum of all step usages.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5971,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5971"
      }
    },
    "totalUsage-ed2630036869": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5978,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5978"
      }
    },
    "warnings-f58b24a208a7": {
      "name": "warnings",
      "type": "SharedV4Warning[] | undefined",
      "optional": false,
      "description": "Warnings from the model provider (e.g. unsupported settings) in all steps.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5982,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5982"
      }
    },
    "request-c3b04b1c5cd8": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5988,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5988"
      }
    },
    "response-38f289615619": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5994,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5994"
      }
    },
    "responseMessages-7bccbd62b234": {
      "name": "responseMessages",
      "type": "ResponseMessage[]",
      "optional": false,
      "description": "The accumulated response messages of all steps that were generated during the call.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 5998,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L5998"
      }
    },
    "providerMetadata-0788c47db8e0": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6006,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6006"
      }
    },
    "steps-2cb49aa694a9": {
      "name": "steps",
      "type": "StepResult<ToolSet, Context>[]",
      "optional": false,
      "description": "Details for all steps.\nYou can use this to get information about intermediate steps,\nsuch as the tool calls or the response headers.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6012,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6012"
      }
    },
    "finalStep-8efda235ab02": {
      "name": "finalStep",
      "type": "StepResult<ToolSet, Context>",
      "optional": false,
      "description": "The final step. This is a shortcut for `steps.at(-1)`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6016,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6016"
      }
    },
    "output-c06c5091c887": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 6024,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L6024"
      }
    },
    "content-3bb18539321d": {
      "name": "content",
      "type": "PromiseLike<ContentPart<ToolSet>[]>",
      "optional": false,
      "description": "The content that was generated in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3122,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3122"
      }
    },
    "text-f837ea5e2d60": {
      "name": "text",
      "type": "PromiseLike<string>",
      "optional": false,
      "description": "The full text that has been generated by the final step.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3128,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3128"
      }
    },
    "reasoning-d05298f5ca7a": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3136,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3136"
      }
    },
    "reasoningText-d8433e7073da": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3144,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3144"
      }
    },
    "files-b82909e8d764": {
      "name": "files",
      "type": "PromiseLike<GeneratedFile[]>",
      "optional": false,
      "description": "Files that have been generated by the model in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3150,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3150"
      }
    },
    "sources-625a7cf84149": {
      "name": "sources",
      "type": "PromiseLike<LanguageModelV4Source[]>",
      "optional": false,
      "description": "Sources that have been used as references in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3156,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3156"
      }
    },
    "toolCalls-36a4ce1b7f06": {
      "name": "toolCalls",
      "type": "PromiseLike<TypedToolCall<ToolSet>[]>",
      "optional": false,
      "description": "The tool calls that have been executed in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3162,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3162"
      }
    },
    "staticToolCalls-28c3437fab0e": {
      "name": "staticToolCalls",
      "type": "PromiseLike<(BaseToolCall & { toolName: string; input: any; dynamic?: false | undefined; invalid?: false | undefined; error?: never; title?: string; })[]>",
      "optional": false,
      "description": "The static tool calls that have been executed in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3168,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3168"
      }
    },
    "dynamicToolCalls-9bb558f55dc2": {
      "name": "dynamicToolCalls",
      "type": "PromiseLike<DynamicToolCall[]>",
      "optional": false,
      "description": "The dynamic tool calls that have been executed in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3174,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3174"
      }
    },
    "staticToolResults-2b18447d33df": {
      "name": "staticToolResults",
      "type": "PromiseLike<{ type: \"tool-result\"; toolCallId: string; toolName: string; input: any; output: any; providerExecuted?: boolean; providerMetadata?: ProviderMetadata; toolMetadata?: JSONObject; dynamic?: false | undefined; preliminary?: boolean; title?: string; }[]>",
      "optional": false,
      "description": "The static tool results that have been generated in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3180,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3180"
      }
    },
    "dynamicToolResults-6a83f67e3ee0": {
      "name": "dynamicToolResults",
      "type": "PromiseLike<DynamicToolResult[]>",
      "optional": false,
      "description": "The dynamic tool results that have been generated in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3186,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3186"
      }
    },
    "toolResults-d4aa36739dbf": {
      "name": "toolResults",
      "type": "PromiseLike<TypedToolResult<ToolSet>[]>",
      "optional": false,
      "description": "The tool results that have been generated in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3192,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3192"
      }
    },
    "finishReason-190b97cf2d40": {
      "name": "finishReason",
      "type": "PromiseLike<FinishReason>",
      "optional": false,
      "description": "The unified finish reason why the generation finished. Taken from the last step.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3198,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3198"
      }
    },
    "rawFinishReason-9cee1c499f44": {
      "name": "rawFinishReason",
      "type": "PromiseLike<string | undefined>",
      "optional": false,
      "description": "The raw reason why the generation finished (from the provider). Taken from the last step.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3204,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3204"
      }
    },
    "stoppedBy-620114570de0": {
      "name": "stoppedBy",
      "type": "PromiseLike<StoppedBy | undefined> | undefined",
      "optional": true,
      "description": "Why the generation stopped its tool loop. Unlike `finishReason`, which\ndescribes the last model call, it tells whether the model, a stop\ncondition, a tool without an `execute` function, or a tool approval ended\nthe loop. `streamText` and `ToolLoopAgent` always set it. Like\n`finishReason`, it rejects when the stream is aborted.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3214,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3214"
      }
    },
    "usage-262b991a348f": {
      "name": "usage",
      "type": "PromiseLike<LanguageModelUsage>",
      "optional": false,
      "description": "The total token usage of the generated response.\nWhen there are multiple steps, the usage is the sum of all step usages.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3221,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3221"
      }
    },
    "totalUsage-ad85e58240c3": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3230,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3230"
      }
    },
    "warnings-fb6f20b742d6": {
      "name": "warnings",
      "type": "PromiseLike<SharedV4Warning[] | undefined>",
      "optional": false,
      "description": "Warnings from the model provider (e.g. unsupported settings) in all steps.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3236,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3236"
      }
    },
    "steps-d38bb78314bb": {
      "name": "steps",
      "type": "PromiseLike<StepResult<ToolSet, Context>[]>",
      "optional": false,
      "description": "Details for all steps.\nYou can use this to get information about intermediate steps,\nsuch as the tool calls or the response headers.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3244,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3244"
      }
    },
    "finalStep-51d42e47f875": {
      "name": "finalStep",
      "type": "PromiseLike<StepResult<ToolSet, Context>>",
      "optional": false,
      "description": "The final step. This is a shortcut for `steps.at(-1)`.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3250,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3250"
      }
    },
    "request-1fff5b788637": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3258,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3258"
      }
    },
    "response-51d80af81228": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3266,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3266"
      }
    },
    "responseMessages-b2afdbcdc003": {
      "name": "responseMessages",
      "type": "PromiseLike<ResponseMessage[]>",
      "optional": false,
      "description": "The accumulated response messages of all steps that were generated during the call.\n\nAutomatically consumes the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3272,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3272"
      }
    },
    "providerMetadata-facc55bb2227": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3280,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3280"
      }
    },
    "textStream-de96764d739a": {
      "name": "textStream",
      "type": "AsyncIterableStream<string>",
      "optional": false,
      "description": "A text stream that returns only the generated text deltas. You can use it\nas either an AsyncIterable or a ReadableStream. Error parts are not\nsurfaced in this stream. Use the `onError` callback or `stream` to observe\nthem.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3287,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3287"
      }
    },
    "stream-cc0b8d1f2662": {
      "name": "stream",
      "type": "AsyncIterableStream<TextStreamPart<ToolSet>>",
      "optional": false,
      "description": "A stream with all events, including text deltas, tool calls, tool results, and\nerrors.\nYou can use it as either an AsyncIterable or a ReadableStream.\nOnly errors that stop the stream, such as network errors, are thrown.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3294,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3294"
      }
    },
    "fullStream-86f6451b42a0": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3303,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3303"
      }
    },
    "experimental_partialOutputStream-21f12f5a7a2a": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3309,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3309"
      }
    },
    "partialOutputStream-0da8c7a6719d": {
      "name": "partialOutputStream",
      "type": "AsyncIterableStream<any>",
      "optional": false,
      "description": "A stream of partial parsed outputs. It uses the `output` specification.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3313,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3313"
      }
    },
    "elementStream-62d00c30607b": {
      "name": "elementStream",
      "type": "AsyncIterableStream<any>",
      "optional": false,
      "description": "A stream of individual array elements as they complete.\nOnly available when using `output: Output.array()`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3318,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3318"
      }
    },
    "output-7d43e76672f8": {
      "name": "output",
      "type": "PromiseLike<any>",
      "optional": false,
      "description": "The complete parsed output. It uses the `output` specification.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3322,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3322"
      }
    },
    "consumeStream-c5445bbfbd84": {
      "name": "consumeStream",
      "type": "(options?: ConsumeStreamOptions) => PromiseLike<void>",
      "optional": false,
      "description": "Consumes the stream without processing the parts.\nThis is useful to force the stream to finish.\nIt effectively removes the backpressure and allows the stream to finish,\ntriggering the `onEnd` callback and the promise resolution.\n\nIf an error occurs, it is passed to the optional `onError` callback.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3331,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3331"
      }
    },
    "toUIMessageStream-3fb623239137": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3341,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3341"
      }
    },
    "pipeUIMessageStreamToResponse-927c75d19e66": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3349,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3349"
      }
    },
    "pipeTextStreamToResponse-eb28c26f6dae": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3362,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3362"
      }
    },
    "toUIMessageStreamResponse-b7491de6db9c": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3372,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3372"
      }
    },
    "toTextStreamResponse-9609adab2f14": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 3383,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L3383"
      }
    },
    "answers-5d2c27d79165": {
      "name": "answers",
      "type": "{ [x: string]: { type: \"score\"; score: number; probabilities?: Record<string, number>; } | { type: \"box\"; box: { top: number; bottom: number; left: number; right: number; }; } | { type: \"boolean\"; probability: number; } | { type: \"choice\"; choice: string; probabilities?: Record<string, number> | undefined; }; }",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 669,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L669"
      }
    },
    "usage-36fee081ac33": {
      "name": "usage",
      "type": "{ inputTokens: number | undefined; outputTokens: number | undefined; totalTokens: number | undefined; }",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 670,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L670"
      }
    },
    "warnings-31275a50bb91": {
      "name": "warnings",
      "type": "SharedV4Warning[]",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 675,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L675"
      }
    },
    "rounding-39b85d47b535": {
      "name": "rounding",
      "type": "{ probabilityDecimals?: number; scoreDecimals?: number; } | undefined",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 676,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L676"
      }
    },
    "providerMetadata-060f40b90631": {
      "name": "providerMetadata",
      "type": "SharedV4ProviderMetadata | undefined",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 677,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L677"
      }
    },
    "response-de27d2902b72": {
      "name": "response",
      "type": "{ id?: string; timestamp?: Date; modelId?: string; headers?: SharedV4Headers; body?: unknown; } & { timestamp: Date; modelId: string; }",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 678,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L678"
      }
    },
    "telemetry-9291651c3fe8": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9385,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9385"
      }
    },
    "runtimeContext-7cc2d639bf30": {
      "name": "runtimeContext",
      "type": "Context | undefined",
      "optional": true,
      "description": "User-defined runtime context. Treat runtime context as immutable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9387,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9387"
      }
    },
    "onStart-cceb4f677102": {
      "name": "onStart",
      "type": "Callback<DecideStartEvent<Context>> | undefined",
      "optional": true,
      "description": "Called when the decide operation begins.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9389,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9389"
      }
    },
    "onEnd-5893d60da45f": {
      "name": "onEnd",
      "type": "Callback<DecideEndEvent<Context>> | undefined",
      "optional": true,
      "description": "Called when the decide operation completes.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9391,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9391"
      }
    },
    "_internal-520e614a2e41": {
      "name": "_internal",
      "type": "{ generateCallId?: () => string; } | undefined",
      "optional": true,
      "description": "Internal. For test use only. May change without notice.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 9393,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L9393"
      }
    },
    "value-267137ec08d3": {
      "name": "value",
      "type": "string",
      "optional": false,
      "description": "The value that was embedded.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8583,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8583"
      }
    },
    "embedding-65d263a57072": {
      "name": "embedding",
      "type": "EmbeddingModelV4Embedding",
      "optional": false,
      "description": "The embedding of the value.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8587,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8587"
      }
    },
    "usage-283ce5bbc803": {
      "name": "usage",
      "type": "EmbeddingModelUsage",
      "optional": false,
      "description": "The embedding token usage.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8591,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8591"
      }
    },
    "warnings-9def7fc64c29": {
      "name": "warnings",
      "type": "SharedV4Warning[]",
      "optional": false,
      "description": "Warnings for the call, e.g. unsupported settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8595,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8595"
      }
    },
    "providerMetadata-af0af49d95db": {
      "name": "providerMetadata",
      "type": "SharedV4ProviderMetadata | undefined",
      "optional": true,
      "description": "Optional provider-specific metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8599,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8599"
      }
    },
    "response-9d0349a46e5a": {
      "name": "response",
      "type": "{ headers?: Record<string, string>; body?: unknown; } | undefined",
      "optional": true,
      "description": "Optional response data.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8603,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8603"
      }
    },
    "model-76b4cbf21b98": {
      "name": "model",
      "type": "EmbeddingModel",
      "optional": false,
      "description": "The embedding model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8641,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8641"
      }
    },
    "value-22aa5692a8af": {
      "name": "value",
      "type": "string",
      "optional": false,
      "description": "The value that should be embedded.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8645,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8645"
      }
    },
    "dimensions-e514b862730a": {
      "name": "dimensions",
      "type": "number | undefined",
      "optional": true,
      "description": "The requested number of dimensions for the output embeddings.\nMust be a positive integer. Support and allowed values depend on the model\nand provider implementation.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8651,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8651"
      }
    },
    "maxRetries-d23ecfad0a44": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8657,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8657"
      }
    },
    "abortSignal-e088cfdd3cdf": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8661,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8661"
      }
    },
    "headers-a20e795c7853": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request.\nOnly applicable for HTTP-based providers.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8666,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8666"
      }
    },
    "providerOptions-39824388b056": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8672,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8672"
      }
    },
    "telemetry-10826561b3e1": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8676,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8676"
      }
    },
    "experimental_telemetry-e74ee2b9fcdc": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8682,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8682"
      }
    },
    "runtimeContext-61b600fdf2c8": {
      "name": "runtimeContext",
      "type": "Context | undefined",
      "optional": true,
      "description": "User-defined runtime context. Treat runtime context as immutable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8686,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8686"
      }
    },
    "onStart-6d612661bf33": {
      "name": "onStart",
      "type": "Callback<EmbedStartEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embed operation begins,\nbefore the embedding model is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8691,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8691"
      }
    },
    "experimental_onStart-2cbc389016a9": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8698,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8698"
      }
    },
    "onEnd-38c1e8e2a05b": {
      "name": "onEnd",
      "type": "Callback<EmbedEndEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embed operation completes,\nafter the embedding model returns.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8703,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8703"
      }
    },
    "experimental_onEnd-543602355965": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8710,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8710"
      }
    },
    "_internal-e9119d745ea6": {
      "name": "_internal",
      "type": "{ generateCallId?: () => string; } | undefined",
      "optional": true,
      "description": "Internal. For test use only. May change without notice.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8714,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8714"
      }
    },
    "values-c70ebde5be4d": {
      "name": "values",
      "type": "string[]",
      "optional": false,
      "description": "The values that were embedded.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8728,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8728"
      }
    },
    "embeddings-299f182a53eb": {
      "name": "embeddings",
      "type": "EmbeddingModelV4Embedding[]",
      "optional": false,
      "description": "The embeddings. They are in the same order as the values.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8732,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8732"
      }
    },
    "usage-5ca1bbf243a6": {
      "name": "usage",
      "type": "EmbeddingModelUsage",
      "optional": false,
      "description": "The embedding token usage.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8736,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8736"
      }
    },
    "warnings-2c64605cff39": {
      "name": "warnings",
      "type": "SharedV4Warning[]",
      "optional": false,
      "description": "Warnings for the call, e.g. unsupported settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8740,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8740"
      }
    },
    "providerMetadata-c43f9e32e19f": {
      "name": "providerMetadata",
      "type": "SharedV4ProviderMetadata | undefined",
      "optional": true,
      "description": "Optional provider-specific metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8744,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8744"
      }
    },
    "responses-5610a35af93c": {
      "name": "responses",
      "type": "({ headers?: Record<string, string>; body?: unknown; } | undefined)[] | undefined",
      "optional": true,
      "description": "Optional raw response data.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8748,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8748"
      }
    },
    "values-c00b4b75a6e0": {
      "name": "values",
      "type": "string[]",
      "optional": false,
      "description": "The values that should be embedded.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8799,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8799"
      }
    },
    "telemetry-f87efb2ebd64": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8824,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8824"
      }
    },
    "experimental_telemetry-5f7fa89c66df": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8830,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8830"
      }
    },
    "runtimeContext-39ec8adb999c": {
      "name": "runtimeContext",
      "type": "Context | undefined",
      "optional": true,
      "description": "User-defined runtime context. Treat runtime context as immutable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8834,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8834"
      }
    },
    "onStart-73681b15b77d": {
      "name": "onStart",
      "type": "Callback<EmbedStartEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embedMany operation begins,\nbefore the embedding model is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8852,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8852"
      }
    },
    "experimental_onStart-306575194bd2": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8859,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8859"
      }
    },
    "onEnd-e8cf2834155b": {
      "name": "onEnd",
      "type": "Callback<EmbedEndEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the embedMany operation completes,\nafter all embedding model calls return.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8864,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8864"
      }
    },
    "experimental_onEnd-44bb7f891cee": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8871,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8871"
      }
    },
    "_internal-eb195a17669b": {
      "name": "_internal",
      "type": "{ generateCallId?: () => string; } | undefined",
      "optional": true,
      "description": "Internal. For test use only. May change without notice.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8875,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8875"
      }
    },
    "originalDocuments-9f043fe9ca5c": {
      "name": "originalDocuments",
      "type": "(string | JSONObject)[]",
      "optional": false,
      "description": "The original documents that were reranked.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11366,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11366"
      }
    },
    "rerankedDocuments-fdbdaca0e2c3": {
      "name": "rerankedDocuments",
      "type": "(string | JSONObject)[]",
      "optional": false,
      "description": "Reranked documents.\n\nSorted by relevance score in descending order.\n\nCan be less than the original documents if there was a topN limit.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11374,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11374"
      }
    },
    "ranking-7ea16195ac0f": {
      "name": "ranking",
      "type": "{ originalIndex: number; score: number; document: string | JSONObject; }[]",
      "optional": false,
      "description": "The ranking is a list of objects with the original index,\nrelevance score, and the reranked document.\n\nSorted by relevance score in descending order.\n\nCan be less than the original documents if there was a topN limit.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11383,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11383"
      }
    },
    "providerMetadata-95aa0960db07": {
      "name": "providerMetadata",
      "type": "SharedV4ProviderMetadata | undefined",
      "optional": true,
      "description": "Optional provider-specific metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11391,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11391"
      }
    },
    "response-91617290e4bb": {
      "name": "response",
      "type": "{ id?: string; timestamp: Date; modelId: string; headers?: Record<string, string>; body?: unknown; }",
      "optional": false,
      "description": "Optional raw response data.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11395,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11395"
      }
    },
    "telemetry-ee49554ed0e5": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11472,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11472"
      }
    },
    "experimental_telemetry-b33dd8e2e035": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11478,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11478"
      }
    },
    "runtimeContext-0f19f2ea43f6": {
      "name": "runtimeContext",
      "type": "Context | undefined",
      "optional": true,
      "description": "User-defined runtime context. Treat runtime context as immutable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11482,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11482"
      }
    },
    "onStart-5eefc83bf86c": {
      "name": "onStart",
      "type": "Callback<RerankStartEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the rerank operation begins,\nbefore the reranking model is called.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11493,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11493"
      }
    },
    "experimental_onStart-bd28ea61bcd4": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11500,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11500"
      }
    },
    "onEnd-7c56a1017c9e": {
      "name": "onEnd",
      "type": "Callback<RerankEndEvent<Context>> | undefined",
      "optional": true,
      "description": "Callback that is called when the rerank operation completes,\nafter the reranking model returns.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11505,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11505"
      }
    },
    "experimental_onEnd-db0ab05e7ebc": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11512,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11512"
      }
    },
    "_internal-c375e9af425c": {
      "name": "_internal",
      "type": "{ generateCallId?: () => string; } | undefined",
      "optional": true,
      "description": "Internal. For test use only. May change without notice.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11516,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11516"
      }
    },
    "image-da0e2f95650e": {
      "name": "image",
      "type": "GeneratedFile",
      "optional": false,
      "description": "The first image that was generated.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8181,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8181"
      }
    },
    "images-c7aed60b2aae": {
      "name": "images",
      "type": "GeneratedFile[]",
      "optional": false,
      "description": "The images that were generated.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8185,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8185"
      }
    },
    "calls-79f7c98ae7f3": {
      "name": "calls",
      "type": "GenerateImageCall[]",
      "optional": false,
      "description": "The results of the underlying image model calls.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8189,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8189"
      }
    },
    "warnings-9451ed79941f": {
      "name": "warnings",
      "type": "SharedV4Warning[]",
      "optional": false,
      "description": "Warnings for the call, e.g. unsupported settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8193,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8193"
      }
    },
    "responses-77f321677647": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8199,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8199"
      }
    },
    "providerMetadata-a5b6c27f2597": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8206,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8206"
      }
    },
    "usage-91f93992ca10": {
      "name": "usage",
      "type": "ImageModelV4Usage",
      "optional": false,
      "description": "Combined token usage across all underlying provider calls for this image generation.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8210,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8210"
      }
    },
    "text-318f1f081df8": {
      "name": "text",
      "type": "string",
      "optional": false,
      "description": "The complete transcribed text from the audio.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11619,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11619"
      }
    },
    "segments-d6de43be1331": {
      "name": "segments",
      "type": "{ readonly text: string; readonly startSecond: number; readonly endSecond: number; }[]",
      "optional": false,
      "description": "Array of transcript segments with timing information.\nEach segment represents a portion of the transcribed text with start and end times.\nSegments retain the provider's behavior and may represent individual words.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11625,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11625"
      }
    },
    "words-b968f7b0610c": {
      "name": "words",
      "type": "{ readonly text: string; readonly startSecond: number; readonly endSecond: number; }[] | undefined",
      "optional": true,
      "description": "Word-level timings returned by the provider, whether explicitly requested\nor returned by default. Undefined when the provider does not return them.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11643,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11643"
      }
    },
    "language-bd16149257f1": {
      "name": "language",
      "type": "string | undefined",
      "optional": false,
      "description": "The detected language of the audio content, as an ISO-639-1 code (e.g., 'en' for English).\nMay be undefined if the language couldn't be detected.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11661,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11661"
      }
    },
    "durationInSeconds-5a79b1d0d6c4": {
      "name": "durationInSeconds",
      "type": "number | undefined",
      "optional": false,
      "description": "The total duration of the audio file in seconds.\nMay be undefined if the duration couldn't be determined.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11666,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11666"
      }
    },
    "warnings-afea3598daa0": {
      "name": "warnings",
      "type": "SharedV4Warning[]",
      "optional": false,
      "description": "Warnings for the call, e.g. unsupported settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11670,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11670"
      }
    },
    "responses-531227d69d28": {
      "name": "responses",
      "type": "TranscriptionModelResponseMetadata[]",
      "optional": false,
      "description": "Response metadata from the provider. There may be multiple responses if we made multiple calls to the model.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11674,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11674"
      }
    },
    "providerMetadata-84dee28b573d": {
      "name": "providerMetadata",
      "type": "Record<string, JSONObject>",
      "optional": false,
      "description": "Provider metadata from the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11678,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11678"
      }
    },
    "audio-fd25cf70163c": {
      "name": "audio",
      "type": "DataContent | URL",
      "optional": false,
      "description": "The audio data to transcribe.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11690,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11690"
      }
    },
    "_internal-194d66d6d32a": {
      "name": "_internal",
      "type": "{ generateCallId?: () => string; } | undefined",
      "optional": true,
      "description": "Internal. For test use only. May change without notice.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11752,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11752"
      }
    },
    "text-1bc039232e18": {
      "name": "text",
      "type": "PromiseLike<string>",
      "optional": false,
      "description": "The final transcribed text.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11790,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11790"
      }
    },
    "segments-979b8df5fb67": {
      "name": "segments",
      "type": "PromiseLike<{ text: string; startSecond: number; endSecond: number; }[]>",
      "optional": false,
      "description": "Final transcript segments with timing information, if available.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11794,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11794"
      }
    },
    "language-97beb2cda6dd": {
      "name": "language",
      "type": "PromiseLike<string | undefined>",
      "optional": false,
      "description": "The language of the transcript, if available.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11802,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11802"
      }
    },
    "durationInSeconds-2f843fd46f4c": {
      "name": "durationInSeconds",
      "type": "PromiseLike<number | undefined>",
      "optional": false,
      "description": "The duration of the transcript in seconds, if available.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11806,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11806"
      }
    },
    "warnings-66e7596b6f06": {
      "name": "warnings",
      "type": "PromiseLike<SharedV4Warning[]>",
      "optional": false,
      "description": "Warnings for the call, e.g. unsupported settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11810,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11810"
      }
    },
    "responses-7987ad6e2cf4": {
      "name": "responses",
      "type": "PromiseLike<TranscriptionModelResponseMetadata[]>",
      "optional": false,
      "description": "Response metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11814,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11814"
      }
    },
    "providerMetadata-0b276ba673b5": {
      "name": "providerMetadata",
      "type": "PromiseLike<Record<string, JSONObject>>",
      "optional": false,
      "description": "Additional provider-specific metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11818,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11818"
      }
    },
    "fullStream-a67f32488d3c": {
      "name": "fullStream",
      "type": "AsyncIterableStream<TranscriptionStreamPart>",
      "optional": false,
      "description": "Full stream of transcription parts.\n\nThis is a single-consumer live stream and can only be accessed once.\nAccess it before any result promise when both stream parts and final\nresults are needed; accessing a result promise first consumes the stream\ninternally and makes `fullStream` unavailable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11827,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11827"
      }
    },
    "model-bbb32b07b213": {
      "name": "model",
      "type": "TranscriptionModel",
      "optional": false,
      "description": "The transcription model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11848,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11848"
      }
    },
    "audio-1bdfa22ed156": {
      "name": "audio",
      "type": "ReadableStream<string | Uint8Array<ArrayBufferLike>>",
      "optional": false,
      "description": "Raw audio chunks to transcribe.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11852,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11852"
      }
    },
    "inputAudioFormat-19cad07cd365": {
      "name": "inputAudioFormat",
      "type": "SharedV4AudioFormat",
      "optional": false,
      "description": "The input audio format for the raw audio chunks.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11856,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11856"
      }
    },
    "providerOptions-9043462897ad": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11860,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11860"
      }
    },
    "abortSignal-a3d4d3abbebf": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11864,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11864"
      }
    },
    "headers-1a57a9e1d4c6": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request, if supported by the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11868,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11868"
      }
    },
    "includeRawChunks-13081a3282bf": {
      "name": "includeRawChunks",
      "type": "boolean | undefined",
      "optional": true,
      "description": "When true, providers should include raw provider chunks in the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11872,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11872"
      }
    },
    "telemetry-d00e1797bb15": {
      "name": "telemetry",
      "type": "TelemetryOptions<Context, ToolSet> | undefined",
      "optional": true,
      "description": "Optional telemetry configuration.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11876,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11876"
      }
    },
    "_internal-35f66ec5d264": {
      "name": "_internal",
      "type": "{ currentDate?: () => Date; generateCallId?: () => string; } | undefined",
      "optional": true,
      "description": "Internal test hooks.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11880,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11880"
      }
    },
    "audioFormat-0fe6713e23a4": {
      "name": "audioFormat",
      "type": "SharedV4AudioFormat | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/factories/SpeechGenerator.ts"
      }
    },
    "usage-bf7204927792": {
      "name": "usage",
      "type": "SpeechModelV4StreamUsage | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/factories/SpeechGenerator.ts"
      }
    },
    "audio-7ce2a3fad473": {
      "name": "audio",
      "type": "GeneratedAudioFile",
      "optional": false,
      "description": "The generated audio file with the audio data.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10155,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10155"
      }
    },
    "warnings-944bb856819d": {
      "name": "warnings",
      "type": "SharedV4Warning[]",
      "optional": false,
      "description": "Warnings for the call, e.g. unsupported settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10159,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10159"
      }
    },
    "responses-7c8eab2136aa": {
      "name": "responses",
      "type": "SpeechModelResponseMetadata[]",
      "optional": false,
      "description": "Response metadata from the provider. There may be multiple responses if we made multiple calls to the model.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10163,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10163"
      }
    },
    "providerMetadata-c33d96fb37e7": {
      "name": "providerMetadata",
      "type": "Record<string, JSONObject>",
      "optional": false,
      "description": "Provider metadata from the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10167,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10167"
      }
    },
    "_internal-3d141dbfafc1": {
      "name": "_internal",
      "type": "{ generateCallId?: () => string; } | undefined",
      "optional": true,
      "description": "Internal. For test use only. May change without notice.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10255,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10255"
      }
    },
    "usage-3c3d8394afcf": {
      "name": "usage",
      "type": "PromiseLike<SpeechModelV4StreamUsage>",
      "optional": false,
      "description": "Usage information reported for the call, if available.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10302,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10302"
      }
    },
    "warnings-d62aba44d83a": {
      "name": "warnings",
      "type": "PromiseLike<SharedV4Warning[]>",
      "optional": false,
      "description": "Warnings for the call, e.g. unsupported settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10306,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10306"
      }
    },
    "responses-a9e279aac120": {
      "name": "responses",
      "type": "PromiseLike<SpeechModelResponseMetadata[]>",
      "optional": false,
      "description": "Response metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10310,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10310"
      }
    },
    "providerMetadata-8f92fa4e2f43": {
      "name": "providerMetadata",
      "type": "PromiseLike<Record<string, JSONObject>>",
      "optional": false,
      "description": "Additional provider-specific metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10314,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10314"
      }
    },
    "audioStream-279e0dafa704": {
      "name": "audioStream",
      "type": "AsyncIterableStream<Uint8Array<ArrayBufferLike>>",
      "optional": false,
      "description": "Stream of audio bytes in generation order.\n\n`audioStream` and `fullStream` share one live stream: only one of them\ncan be accessed, and only once. Access it before any result promise;\naccessing a result promise first consumes the stream internally.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10322,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10322"
      }
    },
    "fullStream-901aea0f7971": {
      "name": "fullStream",
      "type": "AsyncIterableStream<SpeechStreamPart>",
      "optional": false,
      "description": "Full stream of speech parts (audio, raw, and error parts).\n\n`audioStream` and `fullStream` share one live stream: only one of them\ncan be accessed, and only once. Access it before any result promise;\naccessing a result promise first consumes the stream internally.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10330,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10330"
      }
    },
    "model-e6d4a0cfc90e": {
      "name": "model",
      "type": "SpeechModel",
      "optional": false,
      "description": "The speech model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10358,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10358"
      }
    },
    "text-8ed8613d6668": {
      "name": "text",
      "type": "string | Iterable<string | SpeechTextPart> | AsyncIterable<string | SpeechTextPart> | ReadableStream<string | SpeechTextPart>",
      "optional": false,
      "description": "The text to convert to speech: a complete string, or an array, iterable,\nor stream of text deltas and/or text parts.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10363,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10363"
      }
    },
    "voice-f499169ed7e6": {
      "name": "voice",
      "type": "string | undefined",
      "optional": true,
      "description": "The voice to use for speech generation.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10367,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10367"
      }
    },
    "outputFormat-2ecdbf569d98": {
      "name": "outputFormat",
      "type": "SharedV4AudioFormat | undefined",
      "optional": true,
      "description": "The desired format of the output audio chunks, e.g.\n`{ type: 'audio/pcm', rate: 24000 }` or `{ type: 'audio/mpeg' }`.\nSupported formats are provider-specific.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10373,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10373"
      }
    },
    "instructions-66bc5d503547": {
      "name": "instructions",
      "type": "string | undefined",
      "optional": true,
      "description": "Instructions for the speech generation e.g. \"Speak in a slow and steady tone\".",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10377,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10377"
      }
    },
    "speed-e728ceb3fd45": {
      "name": "speed",
      "type": "number | undefined",
      "optional": true,
      "description": "The speed of the speech generation.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10381,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10381"
      }
    },
    "language-522bbc56a6db": {
      "name": "language",
      "type": "string | undefined",
      "optional": true,
      "description": "The language for speech generation. This should be an ISO 639-1 language code (e.g. \"en\", \"es\", \"fr\")\nor \"auto\" for automatic language detection. Provider support varies.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10386,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10386"
      }
    },
    "providerOptions-e3f548cd88dc": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10390,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10390"
      }
    },
    "abortSignal-cb0726a306ce": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10394,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10394"
      }
    },
    "headers-9e46900dfea7": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request, if supported by the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10398,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10398"
      }
    },
    "includeRawChunks-b6af0ee1e0ce": {
      "name": "includeRawChunks",
      "type": "boolean | undefined",
      "optional": true,
      "description": "When true, providers should include raw provider chunks in the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10402,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10402"
      }
    },
    "onError-f4612e490bdd": {
      "name": "onError",
      "type": "((event: { error: unknown; }) => void | PromiseLike<void>) | undefined",
      "optional": true,
      "description": "Called for each error part the provider reports. Error parts are not\nfatal: `fullStream` includes them and `audioStream` skips them. The\ncallback is not awaited, and errors it throws are ignored.\nDefaults to logging the error with `console.error`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10409,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10409"
      }
    },
    "_internal-316c49cdb97e": {
      "name": "_internal",
      "type": "{ currentDate?: () => Date; } | undefined",
      "optional": true,
      "description": "Internal test hooks.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10415,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10415"
      }
    },
    "providerMetadata-a1890558f6d7": {
      "name": "providerMetadata",
      "type": "Record<string, JSONObject>",
      "optional": false,
      "description": "",
      "tags": []
    },
    "warnings-2a1d84032a96": {
      "name": "warnings",
      "type": "SharedV4Warning[]",
      "optional": false,
      "description": "",
      "tags": []
    },
    "response-473e4f6faa96": {
      "name": "response",
      "type": "SpeechTranslationModelResponseMetadata",
      "optional": false,
      "description": "",
      "tags": []
    },
    "usage-66baaa2fd138": {
      "name": "usage",
      "type": "SpeechTranslationModelV4Usage | undefined",
      "optional": false,
      "description": "",
      "tags": []
    },
    "sourceText-61a4fc8c3ce4": {
      "name": "sourceText",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": []
    },
    "translationText-5685980a9448": {
      "name": "translationText",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": []
    },
    "durationInSeconds-3e9796df05cf": {
      "name": "durationInSeconds",
      "type": "number | undefined",
      "optional": false,
      "description": "",
      "tags": []
    },
    "audio-e6a2faccc8b9": {
      "name": "audio",
      "type": "Uint8Array<ArrayBuffer>",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/factories/Translator.ts"
      }
    },
    "audio-5b5e7f868414": {
      "name": "audio",
      "type": "ReadableStream<string | Uint8Array<ArrayBufferLike>>",
      "optional": false,
      "description": "Raw audio chunks to translate.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 12042,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12042"
      }
    },
    "includeRawChunks-ad5b6d5c09d6": {
      "name": "includeRawChunks",
      "type": "boolean | undefined",
      "optional": true,
      "description": "When true, providers should include raw provider chunks in the stream.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 12078,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12078"
      }
    },
    "_internal-5e396fa59f87": {
      "name": "_internal",
      "type": "{ currentDate?: () => Date; } | undefined",
      "optional": true,
      "description": "Internal test hooks.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 12082,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12082"
      }
    },
    "sourceText-25121e0dd1ec": {
      "name": "sourceText",
      "type": "PromiseLike<string>",
      "optional": false,
      "description": "The final source-language transcript of the input audio.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11978,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11978"
      }
    },
    "translationText-1bfe97fa77bb": {
      "name": "translationText",
      "type": "PromiseLike<string>",
      "optional": false,
      "description": "The final translated text in the target language.\n\nMay resolve to an empty string for providers that produce only audio\noutput.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11985,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11985"
      }
    },
    "durationInSeconds-1e32aeb17c6a": {
      "name": "durationInSeconds",
      "type": "PromiseLike<number | undefined>",
      "optional": false,
      "description": "The duration of the source audio in seconds, if available.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11989,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11989"
      }
    },
    "usage-aac6602e6c0b": {
      "name": "usage",
      "type": "PromiseLike<SpeechTranslationModelV4Usage | undefined>",
      "optional": false,
      "description": "Usage information for the translation call, if reported by the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11993,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11993"
      }
    },
    "warnings-a57e15823f1c": {
      "name": "warnings",
      "type": "PromiseLike<SharedV4Warning[]>",
      "optional": false,
      "description": "Warnings for the call, e.g. unsupported settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11997,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11997"
      }
    },
    "response-659653107089": {
      "name": "response",
      "type": "PromiseLike<SpeechTranslationModelResponseMetadata>",
      "optional": false,
      "description": "Response metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 12001,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12001"
      }
    },
    "providerMetadata-0e82bcbf8ee1": {
      "name": "providerMetadata",
      "type": "PromiseLike<Record<string, JSONObject>>",
      "optional": false,
      "description": "Additional provider-specific metadata.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 12005,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12005"
      }
    },
    "fullStream-f5a7dc341b54": {
      "name": "fullStream",
      "type": "AsyncIterableStream<TranslationStreamPart>",
      "optional": false,
      "description": "Full stream of translation parts.\n\nThis is a single-consumer live stream and can only be accessed once.\nAccess it before any result promise when both stream parts and final\nresults are needed; accessing a result promise first consumes the stream\ninternally and makes `fullStream` unavailable.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 12014,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12014"
      }
    },
    "token-e6b1ecaa2a1c": {
      "name": "token",
      "type": "string",
      "optional": false,
      "description": "The ephemeral token value. Used as a Bearer token or in the\nWebSocket subprotocol header for authentication.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7766,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7766"
      }
    },
    "url-458a55b0cd01": {
      "name": "url",
      "type": "string",
      "optional": false,
      "description": "The WebSocket URL to connect to. Includes any provider-specific\nquery parameters (e.g. model ID).",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7771,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7771"
      }
    },
    "expiresAt-42284c9a4224": {
      "name": "expiresAt",
      "type": "number | undefined",
      "optional": true,
      "description": "Unix timestamp (seconds) when this client secret expires.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7775,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7775"
      }
    },
    "tools-77941a98285d": {
      "name": "tools",
      "type": "RealtimeModelV4ToolDefinition[]",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/factories/VoiceAgentBackend.ts"
      }
    },
    "model-14cf8ce98262": {
      "name": "model",
      "type": "string | TranscriptionModelV4 | TranscriptionModelV3 | TranscriptionModelV2 | (string & TranscriptionModelV4) | (string & TranscriptionModelV3) | (string & TranscriptionModelV2) | (TranscriptionModelV4 & string) | (TranscriptionModelV3 & string) | (TranscriptionModelV2 & string)",
      "optional": false,
      "description": "The transcription model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11848,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11848"
      }
    },
    "inputAudioFormat-62bc6c075147": {
      "name": "inputAudioFormat",
      "type": "SharedV4AudioFormat | undefined",
      "optional": true,
      "description": "The input audio format for the raw audio chunks.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11856,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11856"
      }
    },
    "audio-eabc6c56abd0": {
      "name": "audio",
      "type": "ArrayBuffer | Uint8Array<ArrayBufferLike> | Blob | Int16Array<ArrayBufferLike> | Int32Array<ArrayBufferLike> | Float32Array<ArrayBufferLike> | Float64Array<ArrayBufferLike> | AudioBufferSource | TranscriptionFile | ReadableStream<string | Uint8Array<ArrayBufferLike>> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "inputAudioFormat-6a9bbf3af99e": {
      "name": "inputAudioFormat",
      "type": "SharedV4AudioFormat | undefined",
      "optional": true,
      "description": "The input audio format for the raw audio chunks.",
      "tags": [],
      "source": {
        "path": "src/factories/Transcriber.ts"
      }
    },
    "audio-4e06c305d82e": {
      "name": "audio",
      "type": "ArrayBuffer | Uint8Array<ArrayBufferLike> | Blob | Int16Array<ArrayBufferLike> | Int32Array<ArrayBufferLike> | Float32Array<ArrayBufferLike> | Float64Array<ArrayBufferLike> | AudioBufferSource | TranscriptionFile | ReadableStream<string | Uint8Array<ArrayBufferLike>>",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/factories/Transcriber.ts"
      }
    },
    "direct-340c3e0b0658": {
      "name": "direct",
      "type": "ArrayBuffer | Uint8Array<ArrayBufferLike> | Blob | Int16Array<ArrayBufferLike> | Int32Array<ArrayBufferLike> | Float32Array<ArrayBufferLike> | Float64Array<ArrayBufferLike> | AudioBufferSource | TranscriptionFile | ReadableStream<string | Uint8Array<ArrayBufferLike>>",
      "optional": false,
      "description": "",
      "tags": []
    },
    "prepared-2b72789340ee": {
      "name": "prepared",
      "type": "ArrayBuffer | Uint8Array<ArrayBufferLike> | Blob | Int16Array<ArrayBufferLike> | Int32Array<ArrayBufferLike> | Float32Array<ArrayBufferLike> | Float64Array<ArrayBufferLike> | AudioBufferSource | TranscriptionFile | ReadableStream<string | Uint8Array<ArrayBufferLike>>",
      "optional": false,
      "description": "",
      "tags": []
    },
    "model-b07c96a69452": {
      "name": "model",
      "type": "string | SpeechModelV4 | SpeechModelV3 | SpeechModelV2 | (string & SpeechModelV4) | (string & SpeechModelV3) | (string & SpeechModelV2) | (SpeechModelV4 & string) | (SpeechModelV3 & string) | (SpeechModelV2 & string)",
      "optional": false,
      "description": "The speech model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10358,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10358"
      }
    },
    "text-85a9dc177766": {
      "name": "text",
      "type": "string | Iterable<string | SpeechTextPart> | AsyncIterable<string | SpeechTextPart> | ReadableStream<string | SpeechTextPart> | undefined",
      "optional": true,
      "description": "",
      "tags": []
    },
    "audio-68daa1e68956": {
      "name": "audio",
      "type": "RawAudio",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/factories/Transcriber.ts"
      }
    },
    "outputFormat-27a92d87c4ab": {
      "name": "outputFormat",
      "type": "SharedV4AudioFormat",
      "optional": false,
      "description": "The desired format of the output audio chunks, e.g.\n`{ type: 'audio/pcm', rate: 24000 }` or `{ type: 'audio/mpeg' }`.\nSupported formats are provider-specific.",
      "tags": [],
      "source": {
        "path": "src/factories/SpeechGenerator.ts"
      }
    },
    "outputFormat-7fda4f42871a": {
      "name": "outputFormat",
      "type": "(string & {}) | SharedV4AudioFormat | \"mp3\" | \"wav\" | undefined",
      "optional": true,
      "description": "The desired output format for the audio e.g. \"mp3\", \"wav\", etc.\nThe desired format of the output audio chunks, e.g.\n`{ type: 'audio/pcm', rate: 24000 }` or `{ type: 'audio/mpeg' }`.\nSupported formats are provider-specific.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10206,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10206"
      }
    },
    "inputAudioFormat-9d5855cee1c6": {
      "name": "inputAudioFormat",
      "type": "(LoadedPcmFormat & { type: \"audio/pcm\"; rate: number; }) | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/factories/Transcriber.ts"
      }
    },
    "mediaSettings-9a4327368f34": {
      "name": "mediaSettings",
      "type": "MediaSettings | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/factories/Transcriber.ts"
      }
    },
    "fileAudioTarget-d18884450161": {
      "name": "fileAudioTarget",
      "type": "FileAudioTarget | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/factories/Transcriber.ts"
      }
    },
    "model-3cede7036f63": {
      "name": "model",
      "type": "RealtimeModelV4",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11048,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11048"
      }
    },
    "api-004ee8b5cab2": {
      "name": "api",
      "type": "{ token: string; session?: never; websocket?: never; protocols?: never; provider?: never; } | { session: string; token?: never; websocket?: never; protocols?: never; provider?: never; } | { provider: string; token?: never; session?: never; websocket?: never; protocols?: never; } | { websocket: string; protocols?: string[]; token?: never; session?: never; provider?: never; }",
      "optional": false,
      "description": "Application endpoints for token, SDP, provider-managed, or relay connections.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11050,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11050"
      }
    },
    "sessionConfig-804ef3dffb30": {
      "name": "sessionConfig",
      "type": "Partial<RealtimeModelV4SessionConfig> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11075,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11075"
      }
    },
    "sampleRate-06aa2a8f8a8a": {
      "name": "sampleRate",
      "type": "number | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11076,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11076"
      }
    },
    "maxEvents-a020baa464f5": {
      "name": "maxEvents",
      "type": "number | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11077,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11077"
      }
    },
    "startupTimeoutMs-5cf4778f802f": {
      "name": "startupTimeoutMs",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum time to establish transport and receive readiness. Default: 30s.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11079,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11079"
      }
    },
    "closeTimeoutMs-dbae777eaefe": {
      "name": "closeTimeoutMs",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum wait for final usage after close(). Default: 15s.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11081,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11081"
      }
    },
    "rtcDisconnectTimeoutMs-5b12df24e922": {
      "name": "rtcDisconnectTimeoutMs",
      "type": "number | undefined",
      "optional": true,
      "description": "WebRTC peer disconnect recovery grace period. Default: 5s.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11083,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11083"
      }
    },
    "maxPlaybackBufferSeconds-8afa607e6747": {
      "name": "maxPlaybackBufferSeconds",
      "type": "number | undefined",
      "optional": true,
      "description": "Continuous PCM only: pause at this budget until resumePlayback(). Default: 2s.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11085,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11085"
      }
    },
    "onToolCall-d762db2d3ad5": {
      "name": "onToolCall",
      "type": "((args: { toolCall: { toolCallId: string; toolName: string; args: unknown; }; }) => Promise<unknown> | unknown | undefined) | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11086,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11086"
      }
    },
    "onEvent-d3f764d51701": {
      "name": "onEvent",
      "type": "((event: RealtimeServerEvent) => void) | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11093,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11093"
      }
    },
    "onError-9823c2477456": {
      "name": "onError",
      "type": "((error: Error) => void) | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11094,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11094"
      }
    },
    "onError-83ded9ab73dc": {
      "name": "onError",
      "type": "((error: Error) => void) | undefined",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11102,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11102"
      }
    },
    "onToolCall-59c4a4fdd7d4": {
      "name": "onToolCall",
      "type": "((args: { toolCall: { toolCallId: string; toolName: string; args: unknown; }; }) => Promise<unknown> | unknown | undefined) | undefined",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11100,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11100"
      }
    },
    "onEvent-2722b9792dd9": {
      "name": "onEvent",
      "type": "((event: RealtimeServerEvent) => void) | undefined",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11101,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11101"
      }
    },
    "connect-2e34b6dfb576": {
      "name": "connect",
      "type": "{ (): Promise<void>; (options: { stream?: MediaStream; capture?: boolean; }): Promise<void>; }",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11123,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11123"
      }
    },
    "disconnect-8faaa298371c": {
      "name": "disconnect",
      "type": "() => void",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11134,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11134"
      }
    },
    "close-8098641beab2": {
      "name": "close",
      "type": "(options?: { eventId?: string; }) => Promise<void>",
      "optional": false,
      "description": "Wait for provider cleanup or supported session-close finalization.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11136,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11136"
      }
    },
    "sendEvent-d7ab1dd558cb": {
      "name": "sendEvent",
      "type": "(event: RealtimeClientEvent) => Promise<void>",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11140,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11140"
      }
    },
    "sendTextMessage-7a502c92f929": {
      "name": "sendTextMessage",
      "type": "(text: string) => void",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11141,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11141"
      }
    },
    "sendAudio-484a8c1d0aea": {
      "name": "sendAudio",
      "type": "(audio: string) => void",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11142,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11142"
      }
    },
    "commitAudio-c2343307b0b1": {
      "name": "commitAudio",
      "type": "() => void",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11143,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11143"
      }
    },
    "clearAudioBuffer-86dceda18774": {
      "name": "clearAudioBuffer",
      "type": "() => void",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11144,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11144"
      }
    },
    "requestResponse-c5bb6481365f": {
      "name": "requestResponse",
      "type": "(options?: { modalities?: string[]; }) => void",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11145,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11145"
      }
    },
    "cancelResponse-30f3c048c45e": {
      "name": "cancelResponse",
      "type": "() => void",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11148,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11148"
      }
    },
    "addToolOutput-0ecdc6214901": {
      "name": "addToolOutput",
      "type": "(callId: string, result: unknown) => void",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11150,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11150"
      }
    },
    "startAudioCapture-53bd14e6dc4d": {
      "name": "startAudioCapture",
      "type": "(stream: MediaStream) => void",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11152,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11152"
      }
    },
    "resumeAudioCapture-21fe42d0a4dc": {
      "name": "resumeAudioCapture",
      "type": "() => Promise<void>",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11153,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11153"
      }
    },
    "stopAudioCapture-911c0523c2a8": {
      "name": "stopAudioCapture",
      "type": "() => void",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11154,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11154"
      }
    },
    "stopPlayback-74887f5363db": {
      "name": "stopPlayback",
      "type": "() => void",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11155,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11155"
      }
    },
    "resumePlayback-9d2aac23aa6c": {
      "name": "resumePlayback",
      "type": "() => Promise<void>",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11156,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11156"
      }
    },
    "dispose-9930092e1c54": {
      "name": "dispose",
      "type": "() => void",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11157,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11157"
      }
    },
    "getSnapshot-b4938edff73b": {
      "name": "getSnapshot",
      "type": "() => Readonly<import(\"ai\").Experimental_RealtimeState>",
      "optional": false,
      "description": "",
      "tags": []
    },
    "subscribe-d65210706930": {
      "name": "subscribe",
      "type": "(listener: () => void) => () => void",
      "optional": false,
      "description": "",
      "tags": []
    },
    "model-1644b8d10c7b": {
      "name": "model",
      "type": "VideoModel",
      "optional": false,
      "description": "The video model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10517,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10517"
      }
    },
    "prompt-e17accdd497c": {
      "name": "prompt",
      "type": "GenerateVideoPrompt",
      "optional": false,
      "description": "The prompt that should be used to generate the video.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10521,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10521"
      }
    },
    "n-0e1734c45c1b": {
      "name": "n",
      "type": "number | undefined",
      "optional": true,
      "description": "Number of videos to generate.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10525,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10525"
      }
    },
    "maxVideosPerCall-37fbd8bcda34": {
      "name": "maxVideosPerCall",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of videos per API call. If not provided, the model's default will be used.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10529,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10529"
      }
    },
    "aspectRatio-948f9ae032db": {
      "name": "aspectRatio",
      "type": "`${number}:${number}` | \"adaptive\" | undefined",
      "optional": true,
      "description": "Aspect ratio of the videos to generate. Must have the format\n`{width}:{height}`, or `'adaptive'` to inherit the ratio from the input media.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10534,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10534"
      }
    },
    "resolution-33812f50a8dc": {
      "name": "resolution",
      "type": "`${number}x${number}` | undefined",
      "optional": true,
      "description": "Resolution of the videos to generate. Must have the format `{width}x${height}`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10538,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10538"
      }
    },
    "duration-d1bf4adf1e2f": {
      "name": "duration",
      "type": "number | undefined",
      "optional": true,
      "description": "Duration of the video in seconds.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10542,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10542"
      }
    },
    "fps-13af020e6f72": {
      "name": "fps",
      "type": "number | undefined",
      "optional": true,
      "description": "Frames per second for the video.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10546,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10546"
      }
    },
    "seed-f298ceb2dae3": {
      "name": "seed",
      "type": "number | undefined",
      "optional": true,
      "description": "Seed for the video generation.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10550,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10550"
      }
    },
    "frameImages-d0dc09d1f531": {
      "name": "frameImages",
      "type": "{ image: DataContent; frameType: VideoModelV4FrameType; }[] | undefined",
      "optional": true,
      "description": "Role-tagged image inputs for image-to-video and first-last-frame generation.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10554,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10554"
      }
    },
    "inputReferences-52c60c20d4bd": {
      "name": "inputReferences",
      "type": "(DataContent | { data: DataContent; mediaType?: string; })[] | undefined",
      "optional": true,
      "description": "Reference inputs for reference-to-video generation.\n\nEach entry may be a plain image/video ({@link DataContent}), or an object\nform that carries an explicit `mediaType`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10570,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10570"
      }
    },
    "generateAudio-b8009fcb76f2": {
      "name": "generateAudio",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Whether the model should generate audio alongside the video.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10584,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10584"
      }
    },
    "providerOptions-7adf4abd4a86": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options that are passed through to the provider\nas body parameters.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10589,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10589"
      }
    },
    "maxRetries-b1d66fe01336": {
      "name": "maxRetries",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum number of retries per video model call. Set to 0 to disable retries.",
      "tags": [
        {
          "name": "default",
          "text": "2"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10595,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10595"
      }
    },
    "abortSignal-f9406684db67": {
      "name": "abortSignal",
      "type": "AbortSignal | undefined",
      "optional": true,
      "description": "Abort signal.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10599,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10599"
      }
    },
    "headers-373272238360": {
      "name": "headers",
      "type": "Record<string, string> | undefined",
      "optional": true,
      "description": "Additional headers to include in the request.\nOnly applicable for HTTP-based providers.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10604,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10604"
      }
    },
    "download-c3f8ee06633e": {
      "name": "download",
      "type": "((options: { url: URL; abortSignal?: AbortSignal; }) => Promise<{ data: Uint8Array; mediaType: string | undefined; }>) | undefined",
      "optional": true,
      "description": "Custom download function for fetching videos from URLs.\nUse `createDownload()` from `ai` to create a download function with custom size limits.",
      "tags": [
        {
          "name": "default",
          "text": "createDownload() (2 GiB limit)"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10611,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10611"
      }
    },
    "poll-54be9abbdfff": {
      "name": "poll",
      "type": "GenerateVideoPollOptions | undefined",
      "optional": true,
      "description": "Polling configuration for models that support the asynchronous\nstart/status flow. When provided and the model implements `doStart`\nand `doStatus`, the SDK will orchestrate polling automatically.\n\nThis option can be combined with `webhook`: `timeoutMs` limits the webhook\nwait, and the polling settings apply if the model does not support\nwebhooks.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10627,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10627"
      }
    },
    "webhook-e748ef3211c8": {
      "name": "webhook",
      "type": "GenerateVideoWebhookFactory | undefined",
      "optional": true,
      "description": "Webhook factory for models that support the asynchronous\nstart/status flow. When provided and the model implements `doStart`\nand `doStatus`, the SDK will use webhooks instead of polling.\n\nThe factory should return a URL for the provider to send notifications to,\nand a `received` promise that resolves when the notification arrives.\n`poll` can also be provided to configure the webhook timeout and polling\nfallback.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10638,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10638"
      }
    },
    "prompt-8b4b5c5d39e6": {
      "name": "prompt",
      "type": "GenerateVideoPrompt | undefined",
      "optional": true,
      "description": "The prompt that should be used to generate the video.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10521,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10521"
      }
    },
    "model-305ceb93ef2e": {
      "name": "model",
      "type": "string | VideoModelV4 | VideoModelV3 | (string & VideoModelV4) | (string & VideoModelV3) | (VideoModelV4 & string) | (VideoModelV3 & string)",
      "optional": false,
      "description": "The video model to use.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10517,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10517"
      }
    },
    "direct-4ea07477228e": {
      "name": "direct",
      "type": "GenerateVideoPrompt",
      "optional": false,
      "description": "",
      "tags": []
    },
    "prepared-220b47dc8244": {
      "name": "prepared",
      "type": "GenerateVideoPrompt",
      "optional": false,
      "description": "",
      "tags": []
    },
    "template-698edd69db01": {
      "name": "template",
      "type": "GenerateVideoPrompt",
      "optional": false,
      "description": "",
      "tags": []
    },
    "video-c15f2929aaf4": {
      "name": "video",
      "type": "GeneratedFile",
      "optional": false,
      "description": "The first video available to the SDK.",
      "tags": [
        {
          "name": "throws",
          "text": "{NoVideoGeneratedError} When all videos were delivered directly\nto caller-managed storage. Use `uploadedVideos` to handle upload-only results."
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10442,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10442"
      }
    },
    "videos-47e9b9273a30": {
      "name": "videos",
      "type": "GeneratedFile[]",
      "optional": false,
      "description": "All videos available to the SDK, excluding videos uploaded by the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10446,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10446"
      }
    },
    "uploadedVideos-ebe75695ab76": {
      "name": "uploadedVideos",
      "type": "number",
      "optional": false,
      "description": "Number of videos delivered directly to caller-managed storage.\nThese videos are not downloaded and are not included in `videos`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10451,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10451"
      }
    },
    "warnings-634e28fe31f2": {
      "name": "warnings",
      "type": "SharedV4Warning[]",
      "optional": false,
      "description": "Warnings for the call, e.g. unsupported settings.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10455,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10455"
      }
    },
    "responses-e3f1546b4f67": {
      "name": "responses",
      "type": "VideoModelResponseMetadata[]",
      "optional": false,
      "description": "Response metadata from the provider.\nMay contain multiple responses if multiple calls were made.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10460,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10460"
      }
    },
    "providerMetadata-8dbafc46c0ef": {
      "name": "providerMetadata",
      "type": "SharedV4ProviderMetadata",
      "optional": false,
      "description": "Provider-specific metadata passed through from the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10464,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10464"
      }
    },
    "isEnabled-4303a363fa95": {
      "name": "isEnabled",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Enable or disable telemetry. Enabled by default when a telemetry\nintegration is registered. Set to `false` to opt out.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1350,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1350"
      }
    },
    "recordInputs-0a82b3d21ba3": {
      "name": "recordInputs",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Enable or disable input recording. Enabled by default.\n\nYou might want to disable input recording to avoid recording sensitive\ninformation, to reduce data transfers, or to increase performance.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1357,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1357"
      }
    },
    "recordOutputs-5f49a76c4a9f": {
      "name": "recordOutputs",
      "type": "boolean | undefined",
      "optional": true,
      "description": "Enable or disable output recording. Enabled by default.\n\nYou might want to disable output recording to avoid recording sensitive\ninformation, to reduce data transfers, or to increase performance.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1364,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1364"
      }
    },
    "functionId-a4b8d24d4f63": {
      "name": "functionId",
      "type": "string | undefined",
      "optional": true,
      "description": "Identifier for this function. Used to group telemetry data by function.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1368,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1368"
      }
    },
    "includeRuntimeContext-5fea5b0822f3": {
      "name": "includeRuntimeContext",
      "type": "IncludedContext<Context>",
      "optional": true,
      "description": "Top-level runtime context properties that should be included in telemetry.\nRuntime context properties are excluded unless they are explicitly set to `true`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1373,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1373"
      }
    },
    "includeToolsContext-c4636a1e46ee": {
      "name": "includeToolsContext",
      "type": "IncludedToolsContext<ToolSet>",
      "optional": true,
      "description": "Top-level tool context properties that should be included in telemetry,\nconfigured per tool.\n\nTool context properties are excluded unless they are explicitly set to `true`.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1380,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1380"
      }
    },
    "integrations-d89adf68950c": {
      "name": "integrations",
      "type": "Arrayable<Telemetry>",
      "optional": true,
      "description": "Per-call telemetry integrations that receive lifecycle events during generation.\n\nWhen provided, these integrations will take precedence over the globally registered\nintegrations for this call.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1387,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1387"
      }
    },
    "totalMs-c758378cc4ae": {
      "name": "totalMs",
      "type": "number | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 988,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L988"
      }
    },
    "stepMs-b5087914c082": {
      "name": "stepMs",
      "type": "number | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 989,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L989"
      }
    },
    "firstChunkMs-d0c3163365d4": {
      "name": "firstChunkMs",
      "type": "number | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 990,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L990"
      }
    },
    "chunkMs-444ae491f56e": {
      "name": "chunkMs",
      "type": "number | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 991,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L991"
      }
    },
    "toolMs-c3b651c82a34": {
      "name": "toolMs",
      "type": "number | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 992,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L992"
      }
    },
    "tools-969e8dc7d0ef": {
      "name": "tools",
      "type": "Partial<Record<`${string}Ms`, number>> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 993,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L993"
      }
    },
    "requestBody-169af9ec369a": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4195,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4195"
      }
    },
    "requestMessages-50596f598ef0": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4202,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4202"
      }
    },
    "rawChunks-b65de217e6f5": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4214,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4214"
      }
    },
    "type-520be97089d4": {
      "name": "type",
      "type": "string",
      "optional": false,
      "description": "Audio format type, e.g. `audio/pcm`, `audio/pcmu`, or `audio/pcma`.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 10,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L10"
      }
    },
    "rate-48f2f297bd7c": {
      "name": "rate",
      "type": "number | undefined",
      "optional": true,
      "description": "Sample rate in Hz. Only applicable for formats that require a rate.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 14,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L14"
      }
    },
    "model-2ef98e561f36": {
      "name": "model",
      "type": "string | undefined",
      "optional": true,
      "description": "Provider-specific transcription model.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7669,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7669"
      }
    },
    "language-18a70eefc7b3": {
      "name": "language",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional language hint for the input audio.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7673,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7673"
      }
    },
    "prompt-e49009ec511f": {
      "name": "prompt",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional prompt to guide transcription.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7677,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7677"
      }
    },
    "type-594fa7028e72": {
      "name": "type",
      "type": "\"server-vad\" | \"semantic-vad\" | \"disabled\"",
      "optional": false,
      "description": "VAD mode. 'server-vad' for automatic detection,\n'semantic-vad' for OpenAI's semantic detection,\n'disabled' to turn off VAD.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7715,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7715"
      }
    },
    "threshold-ad4f6014a792": {
      "name": "threshold",
      "type": "number | undefined",
      "optional": true,
      "description": "VAD activation threshold (0.0-1.0).\nHigher values require louder audio to trigger.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7720,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7720"
      }
    },
    "silenceDurationMs-8d1a937380ac": {
      "name": "silenceDurationMs",
      "type": "number | undefined",
      "optional": true,
      "description": "How long the user must be silent (in ms) before\nthe server ends the turn.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7725,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7725"
      }
    },
    "prefixPaddingMs-4c2039317d05": {
      "name": "prefixPaddingMs",
      "type": "number | undefined",
      "optional": true,
      "description": "Amount of audio (in ms) to include before the\ndetected start of speech.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7730,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7730"
      }
    },
    "type-d9cc1b1b4cea": {
      "name": "type",
      "type": "\"choice\"",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2454,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L2454"
      }
    },
    "instructions-b85d3fcd5c41": {
      "name": "instructions",
      "type": "DecisionModelV4Input | null | undefined",
      "optional": true,
      "description": "May be omitted or null when supported by the provider and criteria define the judgment.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2456,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L2456"
      }
    },
    "criteria-dd60dbfe042f": {
      "name": "criteria",
      "type": "Readonly<Record<string, DecisionModelV4Input | null>>",
      "optional": false,
      "description": "Nonempty map of option names to descriptions. Null means no description.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2458,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L2458"
      }
    },
    "type-37d3b7e0b6c6": {
      "name": "type",
      "type": "\"score\"",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2460,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L2460"
      }
    },
    "instructions-0204b262592e": {
      "name": "instructions",
      "type": "DecisionModelV4Input | null | undefined",
      "optional": true,
      "description": "May be omitted or null when supported by the provider and criteria define the judgment.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2462,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L2462"
      }
    },
    "criteria-9cbb40284e16": {
      "name": "criteria",
      "type": "readonly (DecisionModelV4Input | null)[]",
      "optional": false,
      "description": "At least one ordered level, indexed from zero. Providers may require more.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2464,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L2464"
      }
    },
    "type-7764ff728a6b": {
      "name": "type",
      "type": "\"box\"",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2466,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L2466"
      }
    },
    "instructions-7b8cd13ccfae": {
      "name": "instructions",
      "type": "DecisionModelV4Input | null | undefined",
      "optional": true,
      "description": "May be omitted or null when supported by the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2468,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L2468"
      }
    },
    "type-eab546a1fe04": {
      "name": "type",
      "type": "\"boolean\"",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2470,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L2470"
      }
    },
    "instructions-c32a70cdf6d3": {
      "name": "instructions",
      "type": "DecisionModelV4Input | null | undefined",
      "optional": true,
      "description": "May be omitted or null when supported by the provider and criteria define the judgment.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2472,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L2472"
      }
    },
    "criteria-a8b5f9bd5ab6": {
      "name": "criteria",
      "type": "{ readonly true?: DecisionModelV4Input | null; readonly false?: DecisionModelV4Input | null; } | null | undefined",
      "optional": true,
      "description": "At least one non-null description is required when instructions are absent.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 2474,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L2474"
      }
    },
    "role-e8ac0434d928": {
      "name": "role",
      "type": "\"system\"",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1857,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L1857"
      }
    },
    "content-a89592356ea7": {
      "name": "content",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1858,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L1858"
      }
    },
    "providerOptions-35d879148cd3": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific metadata. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1864,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L1864"
      }
    },
    "role-5892097e9456": {
      "name": "role",
      "type": "\"user\"",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1923,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L1923"
      }
    },
    "content-cde6417447fa": {
      "name": "content",
      "type": "UserContent",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1924,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L1924"
      }
    },
    "providerOptions-a36c5ad2658a": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific metadata. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1930,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L1930"
      }
    },
    "role-cf6cb44e4f5c": {
      "name": "role",
      "type": "\"assistant\"",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1833,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L1833"
      }
    },
    "content-8dd1c49edc02": {
      "name": "content",
      "type": "AssistantContent",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1834,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L1834"
      }
    },
    "providerOptions-9f578ecc5664": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific metadata. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1840,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L1840"
      }
    },
    "role-89ef2f80a629": {
      "name": "role",
      "type": "\"tool\"",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1904,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L1904"
      }
    },
    "content-3a3ba09e66af": {
      "name": "content",
      "type": "ToolContent",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1905,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L1905"
      }
    },
    "providerOptions-138a787c7cd4": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific metadata. They are passed through\nto the provider from the AI SDK and enable provider-specific\nfunctionality that can be fully encapsulated in the provider.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider-utils/dist/index.d.ts",
        "line": 1911,
        "package": "@ai-sdk/provider-utils",
        "version": "5.0.85",
        "url": "https://unpkg.com/@ai-sdk/provider-utils@5.0.85/dist/index.d.ts#L1911"
      }
    },
    "images-52c5df12a02a": {
      "name": "images",
      "type": "DataContent[]",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8215,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8215"
      }
    },
    "text-c84fbf89238b": {
      "name": "text",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 8216,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L8216"
      }
    },
    "base64-26c8c3a9f599": {
      "name": "base64",
      "type": "string",
      "optional": false,
      "description": "File as a base64 encoded string.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1398,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1398"
      }
    },
    "uint8Array-c4b76402b232": {
      "name": "uint8Array",
      "type": "Uint8Array<ArrayBufferLike>",
      "optional": false,
      "description": "File as a Uint8Array.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1402,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1402"
      }
    },
    "mediaType-78e64d225ca0": {
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
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1408,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1408"
      }
    },
    "providerMetadata-3fe90f6dfdf1": {
      "name": "providerMetadata",
      "type": "Record<string, JSONObject> | undefined",
      "optional": true,
      "description": "Provider-specific metadata for this file.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 1412,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L1412"
      }
    },
    "format-139984da674d": {
      "name": "format",
      "type": "string",
      "optional": false,
      "description": "Audio format of the file (e.g., 'mp3', 'wav', etc.)",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10143,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10143"
      }
    },
    "type-344ec4cbdca5": {
      "name": "type",
      "type": "\"function\"",
      "optional": false,
      "description": "The type of the tool (always 'function').",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7620,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7620"
      }
    },
    "name-89aa96fc9795": {
      "name": "name",
      "type": "string",
      "optional": false,
      "description": "The name of the tool. Unique within the session.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7624,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7624"
      }
    },
    "description-5bb69e58655c": {
      "name": "description",
      "type": "string | undefined",
      "optional": true,
      "description": "A description of what the tool does. The model uses this to decide\nwhether to call the tool.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7629,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7629"
      }
    },
    "parameters-b0610345bc98": {
      "name": "parameters",
      "type": "JSONSchema7",
      "optional": false,
      "description": "JSON Schema describing the parameters the tool expects.",
      "tags": [],
      "source": {
        "path": "node_modules/@ai-sdk/provider/dist/index.d.ts",
        "line": 7633,
        "package": "@ai-sdk/provider",
        "version": "4.0.39",
        "url": "https://unpkg.com/@ai-sdk/provider@4.0.39/dist/index.d.ts#L7633"
      }
    },
    "name-35787766c1d5": {
      "name": "name",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional name of the output that should be generated.\nUsed by some providers for additional LLM guidance, e.g. via tool or schema name.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4709,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4709"
      }
    },
    "description-4a79d6adae24": {
      "name": "description",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional description of the output that should be generated.\nUsed by some providers for additional LLM guidance, e.g. via tool or schema description.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4714,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4714"
      }
    },
    "minItems-5beefdc5780d": {
      "name": "minItems",
      "type": "number | undefined",
      "optional": true,
      "description": "Optional minimum number of elements to generate.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4736,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4736"
      }
    },
    "maxItems-c1b7134bf00b": {
      "name": "maxItems",
      "type": "number | undefined",
      "optional": true,
      "description": "Optional maximum number of elements to generate.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4740,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4740"
      }
    },
    "name-4272e3098922": {
      "name": "name",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional name of the output that should be generated.\nUsed by some providers for additional LLM guidance, e.g. via tool or schema name.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4745,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4745"
      }
    },
    "description-60944453acb2": {
      "name": "description",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional description of the output that should be generated.\nUsed by some providers for additional LLM guidance, e.g. via tool or schema description.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4750,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4750"
      }
    },
    "options-5bffe0fac6e0": {
      "name": "options",
      "type": "string[]",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4777,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4777"
      }
    },
    "name-c03509a2880a": {
      "name": "name",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional name of the output that should be generated.\nUsed by some providers for additional LLM guidance, e.g. via tool or schema name.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4782,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4782"
      }
    },
    "description-f355a51a2c75": {
      "name": "description",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional description of the output that should be generated.\nUsed by some providers for additional LLM guidance, e.g. via tool or schema description.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4787,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4787"
      }
    },
    "name-aa1bf6fcd790": {
      "name": "name",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional name of the output that should be generated.\nUsed by some providers for additional LLM guidance, e.g. via tool or schema name.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4803,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4803"
      }
    },
    "description-2016aef5a551": {
      "name": "description",
      "type": "string | undefined",
      "optional": true,
      "description": "Optional description of the output that should be generated.\nUsed by some providers for additional LLM guidance, e.g. via tool or schema description.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 4808,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4808"
      }
    },
    "blockStart-2d9e8e293c8e": {
      "name": "blockStart",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 128,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L128"
      }
    },
    "blockEnd-92457faa33e6": {
      "name": "blockEnd",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 129,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L129"
      }
    },
    "variableStart-2604c83110e3": {
      "name": "variableStart",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 130,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L130"
      }
    },
    "variableEnd-c69d53ced37c": {
      "name": "variableEnd",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 131,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L131"
      }
    },
    "commentStart-d075610c694f": {
      "name": "commentStart",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 132,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L132"
      }
    },
    "commentEnd-15c1f3fdf84e": {
      "name": "commentEnd",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 133,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L133"
      }
    },
    "useCache-dfe9d6549f5e": {
      "name": "useCache",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 121,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L121"
      }
    },
    "async-4c6c34746bff": {
      "name": "async",
      "type": "boolean | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/cascada-engine/dist/types/index.d.ts",
        "line": 122,
        "package": "cascada-engine",
        "version": "0.7.0",
        "url": "https://unpkg.com/cascada-engine@0.7.0/dist/types/index.d.ts#L122"
      }
    },
    "sampleRate-e218b27f2dde": {
      "name": "sampleRate",
      "type": "number",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/audio/pcm.ts"
      }
    },
    "channels-be4c78da1440": {
      "name": "channels",
      "type": "number",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/audio/pcm.ts"
      }
    },
    "encoding-eb246eac9517": {
      "name": "encoding",
      "type": "\"pcm_u8\" | \"pcm_s16le\" | \"pcm_s24le\" | \"pcm_s32le\" | \"pcm_f32le\" | \"pcm_f64le\" | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/audio/pcm.ts"
      }
    },
    "track-98df75e50d51": {
      "name": "track",
      "type": "number | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/audio/preparation.ts"
      }
    },
    "format-73ad4ac5e40e": {
      "name": "format",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/audio/preparation.ts"
      }
    },
    "options-0d1056e36318": {
      "name": "options",
      "type": "Record<string, string | number | bigint | boolean | null | undefined> | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "src/audio/preparation.ts"
      }
    },
    "alternatives-59b9f94fb784": {
      "name": "alternatives",
      "type": "readonly FileAudioFormat[] | undefined",
      "optional": true,
      "description": "Additional accepted formats that may be copied; otherwise convert to the primary format.",
      "tags": [],
      "source": {
        "path": "src/audio/preparation.ts"
      }
    },
    "maxBytes-fca8f7c77776": {
      "name": "maxBytes",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum completed encoded file size in bytes, including its container headers.",
      "tags": [],
      "source": {
        "path": "src/audio/preparation.ts"
      }
    },
    "maxDurationSeconds-f26f5bb9cf39": {
      "name": "maxDurationSeconds",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum selected/encoded audio duration in seconds, including codec padding.",
      "tags": [],
      "source": {
        "path": "src/audio/preparation.ts"
      }
    },
    "format-3830762ed05e": {
      "name": "format",
      "type": "string",
      "optional": false,
      "description": "Use wav, flac, ogg, opus, mp3, mp4, ipod, adts or webm for file transcription.",
      "tags": [],
      "source": {
        "path": "src/audio/preparation.ts"
      }
    },
    "codec-1ed700c3b786": {
      "name": "codec",
      "type": "string",
      "optional": false,
      "description": "Native audio encoder name; also identifies compatible source audio for copying.",
      "tags": [],
      "source": {
        "path": "src/audio/preparation.ts"
      }
    },
    "rate-1a21e41da923": {
      "name": "rate",
      "type": "number | undefined",
      "optional": true,
      "description": "Required sample rate in Hz; omit to preserve the source rate where the encoder supports it.",
      "tags": [],
      "source": {
        "path": "src/audio/preparation.ts"
      }
    },
    "channels-bc7a34f98268": {
      "name": "channels",
      "type": "number | undefined",
      "optional": true,
      "description": "Required channel count; omit to preserve the source channel layout where supported.",
      "tags": [],
      "source": {
        "path": "src/audio/preparation.ts"
      }
    },
    "sampleFormat-44a58aaa5de6": {
      "name": "sampleFormat",
      "type": "string | undefined",
      "optional": true,
      "description": "Native sample format name, such as s16 or s32; omit for the encoder's native choice.",
      "tags": [],
      "source": {
        "path": "src/audio/preparation.ts"
      }
    },
    "type-17b1a9c6f9c0": {
      "name": "type",
      "type": "\"text\"",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10266,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10266"
      }
    },
    "text-35313fd999c0": {
      "name": "text",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10267,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10267"
      }
    },
    "voice-ea3881c36735": {
      "name": "voice",
      "type": "string | undefined",
      "optional": true,
      "description": "The voice that speaks this part (provider-specific, like the call's\n`voice`). Single-voice providers reject a voice that differs from the\ncall's voice.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10273,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10273"
      }
    },
    "providerOptions-d997f62f10fd": {
      "name": "providerOptions",
      "type": "SharedV4ProviderOptions | undefined",
      "optional": true,
      "description": "Additional provider-specific options for this part.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10277,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10277"
      }
    },
    "token-ff44ef0e9f93": {
      "name": "token",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11051,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11051"
      }
    },
    "session-c137b9a57c19": {
      "name": "session",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11057,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11057"
      }
    },
    "provider-e4bb1895a7a5": {
      "name": "provider",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11063,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11063"
      }
    },
    "websocket-83ad98a2fc71": {
      "name": "websocket",
      "type": "string",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11069,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11069"
      }
    },
    "protocols-f227a70717dd": {
      "name": "protocols",
      "type": "string[] | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11070,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11070"
      }
    },
    "status-289bf725948e": {
      "name": "status",
      "type": "RealtimeStatus",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11038,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11038"
      }
    },
    "messages-dcfe426366ef": {
      "name": "messages",
      "type": "UIMessage<unknown, UIDataTypes, UITools>[]",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11039,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11039"
      }
    },
    "events-ee664420eb67": {
      "name": "events",
      "type": "RealtimeModelV4ServerEvent[]",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11040,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11040"
      }
    },
    "isCapturing-b1ff0fcb936c": {
      "name": "isCapturing",
      "type": "boolean",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11041,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11041"
      }
    },
    "isPlaying-02b364321726": {
      "name": "isPlaying",
      "type": "boolean",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11042,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11042"
      }
    },
    "session-6b48c13d0e88": {
      "name": "session",
      "type": "RealtimeSessionState | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 11043,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11043"
      }
    },
    "image-2854a78b2db2": {
      "name": "image",
      "type": "DataContent",
      "optional": false,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10469,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10469"
      }
    },
    "text-64465629c511": {
      "name": "text",
      "type": "string | undefined",
      "optional": true,
      "description": "",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10470,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10470"
      }
    },
    "intervalMs-7a1241a53a7d": {
      "name": "intervalMs",
      "type": "number | undefined",
      "optional": true,
      "description": "Interval between status checks in milliseconds.",
      "tags": [
        {
          "name": "default",
          "text": "5000"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10486,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10486"
      }
    },
    "timeoutMs-f98c899096c4": {
      "name": "timeoutMs",
      "type": "number | undefined",
      "optional": true,
      "description": "Maximum time to wait for completion in milliseconds.",
      "tags": [
        {
          "name": "default",
          "text": "600000 (10 minutes)"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10492,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10492"
      }
    },
    "delay-e8a6d15cb5e2": {
      "name": "delay",
      "type": "((delayInMs: number, options?: { abortSignal?: AbortSignal; }) => PromiseLike<void>) | undefined",
      "optional": true,
      "description": "Custom delay implementation for polling intervals and webhook timeouts.\nThis can be used with durable workflow sleep functions.",
      "tags": [
        {
          "name": "default",
          "text": "the built-in timer-based delay"
        }
      ],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10499,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10499"
      }
    },
    "image-bd169cdf0d49": {
      "name": "image",
      "type": "DataContent",
      "optional": false,
      "description": "The image for this frame.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10558,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10558"
      }
    },
    "frameType-cc8ada441ee4": {
      "name": "frameType",
      "type": "VideoModelV4FrameType",
      "optional": false,
      "description": "Which frame this image represents.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10562,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10562"
      }
    },
    "data-e9ce5d90d43e": {
      "name": "data",
      "type": "DataContent",
      "optional": false,
      "description": "The reference image or video.",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10574,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10574"
      }
    },
    "mediaType-75156914873a": {
      "name": "mediaType",
      "type": "string | undefined",
      "optional": true,
      "description": "The media type of the reference (e.g. 'image/png',\n'video/mp4').",
      "tags": [],
      "source": {
        "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
        "line": 10579,
        "package": "ai",
        "version": "7.0.183",
        "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10579"
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
          "type": "{ readonly type: \"box\"; readonly instructions?: import(\"@ai-sdk/provider\").Experimental_DecisionModelV4Input | null; }",
          "shape": "DecisionQuestion:2"
        },
        {
          "type": "{ readonly type: \"boolean\"; readonly instructions?: import(\"@ai-sdk/provider\").Experimental_DecisionModelV4Input | null; readonly criteria?: { readonly true?: import(\"@ai-sdk/provider\").Experimental_DecisionModelV4Input | null; readonly false?: import(\"@ai-sdk/provider\").Experimental_DecisionModelV4Input | null; } | null; }",
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
      "type": "{ schema: never; name?: string; description?: string; }",
      "variants": [
        {
          "type": "{ schema: never; name?: string; description?: string; }",
          "shape": "OutputObject:0"
        }
      ]
    },
    "OutputArray": {
      "type": "{ element: never; minItems?: number; maxItems?: number; name?: string; description?: string; }",
      "variants": [
        {
          "type": "{ element: never; minItems?: number; maxItems?: number; name?: string; description?: string; }",
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
    },
    "PcmSourceFormat": {
      "type": "import(\"../src/audio/pcm.js\").PcmSourceFormat",
      "variants": [
        {
          "type": "import(\"../src/audio/pcm.js\").PcmSourceFormat",
          "shape": "PcmSourceFormat:0"
        }
      ]
    },
    "MediaSettings": {
      "type": "import(\"../src/audio/preparation.js\").MediaSettings",
      "variants": [
        {
          "type": "import(\"../src/audio/preparation.js\").MediaSettings",
          "shape": "MediaSettings:0"
        }
      ]
    },
    "FileAudioTarget": {
      "type": "import(\"../src/audio/preparation.js\").FileAudioTarget",
      "variants": [
        {
          "type": "import(\"../src/audio/preparation.js\").FileAudioTarget",
          "shape": "FileAudioTarget:0"
        }
      ]
    },
    "FileAudioFormat": {
      "type": "import(\"../src/audio/preparation.js\").FileAudioFormat",
      "variants": [
        {
          "type": "import(\"../src/audio/preparation.js\").FileAudioFormat",
          "shape": "FileAudioFormat:0"
        }
      ]
    },
    "SpeechAudioFormat": {
      "type": "import(\"@ai-sdk/provider\").SharedV4AudioFormat",
      "variants": [
        {
          "type": "import(\"@ai-sdk/provider\").SharedV4AudioFormat",
          "shape": "SpeechAudioFormat:0"
        }
      ]
    },
    "SpeechTextPart": {
      "type": "import(\"ai\").Experimental_SpeechTextPart",
      "variants": [
        {
          "type": "import(\"ai\").Experimental_SpeechTextPart",
          "shape": "SpeechTextPart:0"
        }
      ]
    },
    "VoiceClientApi": {
      "type": "{ token: string; session?: never; websocket?: never; protocols?: never; provider?: never; } | { session: string; token?: never; websocket?: never; protocols?: never; provider?: never; } | { provider: string; token?: never; session?: never; websocket?: never; protocols?: never; } | { websocket: string; protocols?: string[]; token?: never; session?: never; provider?: never; }",
      "variants": [
        {
          "type": "{ token: string; session?: never; websocket?: never; protocols?: never; provider?: never; }",
          "shape": "VoiceClientApi:0"
        },
        {
          "type": "{ session: string; token?: never; websocket?: never; protocols?: never; provider?: never; }",
          "shape": "VoiceClientApi:1"
        },
        {
          "type": "{ provider: string; token?: never; session?: never; websocket?: never; protocols?: never; }",
          "shape": "VoiceClientApi:2"
        },
        {
          "type": "{ websocket: string; protocols?: string[]; token?: never; session?: never; provider?: never; }",
          "shape": "VoiceClientApi:3"
        }
      ]
    },
    "VoiceClientSnapshot": {
      "type": "Readonly<import(\"ai\").Experimental_RealtimeState>",
      "variants": [
        {
          "type": "Readonly<import(\"ai\").Experimental_RealtimeState>",
          "shape": "VoiceClientSnapshot:0"
        }
      ]
    },
    "VoiceClientSessionConfig": {
      "type": "import(\"@ai-sdk/provider\").Experimental_RealtimeModelV4SessionConfig",
      "variants": [
        {
          "type": "import(\"@ai-sdk/provider\").Experimental_RealtimeModelV4SessionConfig",
          "shape": "VoiceClientSessionConfig:0"
        }
      ]
    },
    "VideoPrompt": {
      "type": "{ image: import(\"ai\").DataContent; text?: string; }",
      "variants": [
        {
          "type": "{ image: import(\"ai\").DataContent; text?: string; }",
          "shape": "VideoPrompt:0"
        }
      ]
    },
    "VideoPoll": {
      "type": "{ intervalMs?: number; timeoutMs?: number; delay?: (delayInMs: number, options?: { abortSignal?: AbortSignal; }) => PromiseLike<void>; }",
      "variants": [
        {
          "type": "{ intervalMs?: number; timeoutMs?: number; delay?: (delayInMs: number, options?: { abortSignal?: AbortSignal; }) => PromiseLike<void>; }",
          "shape": "VideoPoll:0"
        }
      ]
    },
    "VideoFrame": {
      "type": "{ image: import(\"ai\").DataContent; frameType: import(\"@ai-sdk/provider\").Experimental_VideoModelV4FrameType; }",
      "variants": [
        {
          "type": "{ image: import(\"ai\").DataContent; frameType: import(\"@ai-sdk/provider\").Experimental_VideoModelV4FrameType; }",
          "shape": "VideoFrame:0"
        }
      ]
    },
    "VideoReference": {
      "type": "{ data: import(\"ai\").DataContent; mediaType?: string; }",
      "variants": [
        {
          "type": "{ data: import(\"ai\").DataContent; mediaType?: string; }",
          "shape": "VideoReference:0"
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
          "line": 71,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/01-ai-sdk-core/14-decide.mdx#L12",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/decide"
        }
      },
      "usage": {
        "description": "`inputTokens`, `outputTokens`, and `totalTokens`, each possibly undefined.",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/14-decide.mdx",
          "line": 72,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/01-ai-sdk-core/14-decide.mdx#L12",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/decide"
        }
      },
      "warnings": {
        "description": "Provider warnings, also passed to the SDK warning logger.",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/14-decide.mdx",
          "line": 73,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/01-ai-sdk-core/14-decide.mdx#L12",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/decide"
        }
      },
      "rounding": {
        "description": "Optional provider-declared decimal precision for probabilities and scores.",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/14-decide.mdx",
          "line": 74,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/01-ai-sdk-core/14-decide.mdx#L12",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/decide"
        }
      },
      "providerMetadata": {
        "description": "Optional provider-specific metadata.",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/14-decide.mdx",
          "line": 75,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/01-ai-sdk-core/14-decide.mdx#L12",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/decide"
        }
      },
      "response": {
        "description": "Timestamp, model ID, and optional response ID, headers, and body.",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/14-decide.mdx",
          "line": 76,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/01-ai-sdk-core/14-decide.mdx#L12",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/decide"
        }
      }
    },
    "OutputObject:0": {},
    "OutputArray:0": {},
    "OutputChoice:0": {
      "options": {
        "description": "The available choices.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
          "line": 4776,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L4776"
        }
      }
    },
    "OutputJSON:0": {},
    "SpeechGenerator_result": {
      "usage": {
        "description": "Usage information reported for the call, if available.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
          "line": 10302,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10302"
        },
        "descriptionOrigin": "ai"
      },
      "warnings": {
        "description": "Warnings for the call, e.g. unsupported settings.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
          "line": 10306,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10306"
        },
        "descriptionOrigin": "ai"
      },
      "responses": {
        "description": "Response metadata.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
          "line": 10310,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10310"
        },
        "descriptionOrigin": "ai"
      },
      "providerMetadata": {
        "description": "Additional provider-specific metadata.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
          "line": 10314,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10314"
        },
        "descriptionOrigin": "ai"
      },
      "audioStream": {
        "description": "Stream of audio bytes in generation order.\n\n`audioStream` and `fullStream` share one live stream: only one of them\ncan be accessed, and only once. Access it before any result promise;\naccessing a result promise first consumes the stream internally.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
          "line": 10322,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10322"
        },
        "descriptionOrigin": "ai"
      },
      "fullStream": {
        "description": "Full stream of speech parts (audio, raw, and error parts).\n\n`audioStream` and `fullStream` share one live stream: only one of them\ncan be accessed, and only once. Access it before any result promise;\naccessing a result promise first consumes the stream internally.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
          "line": 10330,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L10330"
        },
        "descriptionOrigin": "ai"
      }
    },
    "Translator_result": {
      "sourceText": {
        "description": "The final source-language transcript of the input audio.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
          "line": 11978,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11978"
        },
        "descriptionOrigin": "ai"
      },
      "translationText": {
        "description": "The final translated text in the target language.\n\nMay resolve to an empty string for providers that produce only audio\noutput.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
          "line": 11985,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11985"
        },
        "descriptionOrigin": "ai"
      },
      "durationInSeconds": {
        "description": "The duration of the source audio in seconds, if available.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
          "line": 11989,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11989"
        },
        "descriptionOrigin": "ai"
      },
      "usage": {
        "description": "Usage information for the translation call, if reported by the provider.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
          "line": 11993,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11993"
        },
        "descriptionOrigin": "ai"
      },
      "warnings": {
        "description": "Warnings for the call, e.g. unsupported settings.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
          "line": 11997,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L11997"
        },
        "descriptionOrigin": "ai"
      },
      "response": {
        "description": "Response metadata.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
          "line": 12001,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12001"
        },
        "descriptionOrigin": "ai"
      },
      "providerMetadata": {
        "description": "Additional provider-specific metadata.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
          "line": 12005,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12005"
        },
        "descriptionOrigin": "ai"
      },
      "fullStream": {
        "description": "Full stream of translation parts.\n\nThis is a single-consumer live stream and can only be accessed once.\nAccess it before any result promise when both stream parts and final\nresults are needed; accessing a result promise first consumes the stream\ninternally and makes `fullStream` unavailable.",
        "descriptionSource": {
          "path": "node_modules/ai/dist/index-D1zb0Eh5.d.ts",
          "line": 12014,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/dist/index-D1zb0Eh5.d.ts#L12014"
        },
        "descriptionOrigin": "ai"
      }
    },
    "VoiceAgentClient_config": {
      "model": {
        "description": "The realtime model to connect to.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 269,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L269",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "api": {
        "description": "Choose one supported connection mechanism: token setup, a WebSocket relay, a WebRTC SDP endpoint, or a provider-managed session endpoint. Conversation semantics and connection capabilities are independent.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 275,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L275",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "sessionConfig": {
        "description": "Provider-neutral session configuration, such as instructions, voice, audio formats, input audio transcription, turn detection, tools, and providerOptions.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 324,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L324",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "sampleRate": {
        "description": "Default audio sample rate used when inputAudioFormat.rate or outputAudioFormat.rate is not specified. Defaults to 24000.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 331,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L331",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "maxEvents": {
        "description": "Maximum number of provider events to keep in the events array. Defaults to 500.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 338,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L338",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "startupTimeoutMs": {
        "description": "Readiness deadline, including transport setup. Defaults to 30000.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 345,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L345",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "closeTimeoutMs": {
        "description": "Deadline for confirmed provider finalization after graceful close. Defaults to 15000.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 352,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L352",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "rtcDisconnectTimeoutMs": {
        "description": "WebRTC peer disconnect recovery grace period. Defaults to 5000. Failed ICE terminates immediately.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 359,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L359",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "maxPlaybackBufferSeconds": {
        "description": "Continuous WebSocket PCM playback budget before reporting a recoverable gap and pausing playback. Defaults to 2. Unsupported with WebRTC.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 366,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L366",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "onToolCall": {
        "description": "Turn-based tools only. Return a value to automatically submit it as tool output, or return undefined and call addToolOutput manually later. Live client delegations are application-handled through session metadata and events.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 373,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L373",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "onEvent": {
        "description": "Called for every normalized realtime server event.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 379,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L379",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "onError": {
        "description": "Called when the realtime session encounters an error.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 385,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L385",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      }
    },
    "VoiceAgentClient_settings": {
      "model": {
        "description": "The realtime model to connect to.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 269,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L269",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "api": {
        "description": "Choose one supported connection mechanism: token setup, a WebSocket relay, a WebRTC SDP endpoint, or a provider-managed session endpoint. Conversation semantics and connection capabilities are independent.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 275,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L275",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "sessionConfig": {
        "description": "Provider-neutral session configuration, such as instructions, voice, audio formats, input audio transcription, turn detection, tools, and providerOptions.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 324,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L324",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "sampleRate": {
        "description": "Default audio sample rate used when inputAudioFormat.rate or outputAudioFormat.rate is not specified. Defaults to 24000.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 331,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L331",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "maxEvents": {
        "description": "Maximum number of provider events to keep in the events array. Defaults to 500.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 338,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L338",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "startupTimeoutMs": {
        "description": "Readiness deadline, including transport setup. Defaults to 30000.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 345,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L345",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "closeTimeoutMs": {
        "description": "Deadline for confirmed provider finalization after graceful close. Defaults to 15000.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 352,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L352",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "rtcDisconnectTimeoutMs": {
        "description": "WebRTC peer disconnect recovery grace period. Defaults to 5000. Failed ICE terminates immediately.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 359,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L359",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "maxPlaybackBufferSeconds": {
        "description": "Continuous WebSocket PCM playback budget before reporting a recoverable gap and pausing playback. Defaults to 2. Unsupported with WebRTC.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 366,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L366",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "onToolCall": {
        "description": "Turn-based tools only. Return a value to automatically submit it as tool output, or return undefined and call addToolOutput manually later. Live client delegations are application-handled through session metadata and events.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 373,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L373",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "onEvent": {
        "description": "Called for every normalized realtime server event.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 379,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L379",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "onError": {
        "description": "Called when the realtime session encounters an error.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 385,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L385",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      }
    },
    "VoiceAgentClient_native": {
      "model": {
        "description": "The realtime model to connect to.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 269,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L269",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "api": {
        "description": "Choose one supported connection mechanism: token setup, a WebSocket relay, a WebRTC SDP endpoint, or a provider-managed session endpoint. Conversation semantics and connection capabilities are independent.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 275,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L275",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "sessionConfig": {
        "description": "Provider-neutral session configuration, such as instructions, voice, audio formats, input audio transcription, turn detection, tools, and providerOptions.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 324,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L324",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "sampleRate": {
        "description": "Default audio sample rate used when inputAudioFormat.rate or outputAudioFormat.rate is not specified. Defaults to 24000.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 331,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L331",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "maxEvents": {
        "description": "Maximum number of provider events to keep in the events array. Defaults to 500.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 338,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L338",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "startupTimeoutMs": {
        "description": "Readiness deadline, including transport setup. Defaults to 30000.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 345,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L345",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "closeTimeoutMs": {
        "description": "Deadline for confirmed provider finalization after graceful close. Defaults to 15000.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 352,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L352",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "rtcDisconnectTimeoutMs": {
        "description": "WebRTC peer disconnect recovery grace period. Defaults to 5000. Failed ICE terminates immediately.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 359,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L359",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "maxPlaybackBufferSeconds": {
        "description": "Continuous WebSocket PCM playback budget before reporting a recoverable gap and pausing playback. Defaults to 2. Unsupported with WebRTC.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 366,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L366",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "onToolCall": {
        "description": "Turn-based tools only. Return a value to automatically submit it as tool output, or return undefined and call addToolOutput manually later. Live client delegations are application-handled through session metadata and events.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 373,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L373",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "onEvent": {
        "description": "Called for every normalized realtime server event.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 379,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L379",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "onError": {
        "description": "Called when the realtime session encounters an error.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 385,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L385",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      }
    },
    "VoiceAgentClient_result": {
      "onError": {
        "description": "Called when the realtime session encounters an error.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 385,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L385",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "onToolCall": {
        "description": "Turn-based tools only. Return a value to automatically submit it as tool output, or return undefined and call addToolOutput manually later. Live client delegations are application-handled through session metadata and events.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 373,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L373",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "onEvent": {
        "description": "Called for every normalized realtime server event.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 379,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L379",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "connect": {
        "description": "Starts the selected connection. Continuous Live and Mistral sessions acquire microphone audio by default; capture: false opts out. Supplied tracks remain caller-owned on these paths. The zero-argument overload remains usable as an event handler.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 432,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L432",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "disconnect": {
        "description": "Immediately releases transports and owned media. Provider-owned transports initiate server cleanup without awaiting it. Preserves latest usage as unconfirmed unless a terminal provider event was received.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 444,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L444",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "close": {
        "description": "Stops capture/submissions and waits for bounded graceful finalization where supported. Provider-owned transports await session cleanup. For Live, inspect session.finalization for usage confirmation; models without acknowledged close disconnect immediately.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 438,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L438",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "sendEvent": {
        "description": "Sends a normalized command in order. Resolves on local serialization/submission, not provider acceptance. Validation can throw synchronously; asynchronous send failures reject and are reported through onError. Live context/results use context-append with a known client delegation ID or null.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 456,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L456",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "sendTextMessage": {
        "description": "Turn-based only: sends user text and requests a response. Continuous Live sessions reject this control. The application owns its text conversation and supplies Live context through sendEvent.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 462,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L462",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "sendAudio": {
        "description": "Sends a base64-encoded audio chunk to the provider input audio buffer over WebSocket. WebRTC uses media tracks and rejects JSON audio commands.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 468,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L468",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "commitAudio": {
        "description": "Turn-based only: commits the provider input audio buffer.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 473,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L473",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "clearAudioBuffer": {
        "description": "Turn-based only: clears the provider input audio buffer.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 478,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L478",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "requestResponse": {
        "description": "Turn-based only: requests a new model response.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 483,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L483",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "cancelResponse": {
        "description": "Turn-based only: cancels the active model response.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 488,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L488",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "addToolOutput": {
        "description": "Turn-based only: submits a tool result back to the realtime provider. Continuous Live sessions reject this control; append application-handled client delegation results with sendEvent instead.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 450,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L450",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "startAudioCapture": {
        "description": "Starts or replaces capture with the supplied MediaStream. Live paths borrow tracks; the existing legacy capture API retains ownership of its supplied stream. Async attachment failures are reported through onError.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 494,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L494",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "resumeAudioCapture": {
        "description": "Restarts capture, reusing a supplied Live stream or acquiring a fresh SDK-owned microphone. Does not reconnect the provider.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 506,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L506",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "stopAudioCapture": {
        "description": "Stops local capture and releases SDK-owned microphone tracks. Caller-owned Live tracks are only detached. Does not change the provider input-mute state.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 500,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L500",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "stopPlayback": {
        "description": "Stops queued model audio playback.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 511,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L511",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "resumePlayback": {
        "description": "Retries browser playback after interruption, suspension, or buffer overflow. Discarded stale audio is not replayed.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 517,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L517",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      }
    },
    "VoiceClientApi:0": {
      "token": {
        "description": "The setup endpoint that returns an Experimental_RealtimeSetupResponse.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 285,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L285",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      }
    },
    "VoiceClientApi:1": {
      "session": {
        "description": "Application WebRTC setup endpoint. Accepts JSON { sdp, sessionConfig } and returns JSON { sdp, sessionId }.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 292,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L292",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      }
    },
    "VoiceClientApi:2": {
      "provider": {
        "description": "Application endpoint for a provider-owned transport. Mistral uses POST to create a session and DELETE with a sessionId query parameter to close it.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 299,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L299",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      }
    },
    "VoiceClientApi:3": {
      "websocket": {
        "description": "Application-owned raw-protocol relay URL. Use wss in production; never put provider credentials in the URL.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 306,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L306",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "protocols": {
        "description": "Optional relay subprotocols, supported only with websocket.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 313,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L313",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      }
    },
    "VoiceClientSnapshot:0": {
      "status": {
        "description": "The current connection status.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 397,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L397",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "messages": {
        "description": "Messages assembled from turn-based response text, transcript, and tool events. Continuous Live transcript fragments are exposed separately through session.transcripts.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 403,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L403",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "events": {
        "description": "Recent normalized provider events for inspection or debug UI.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 409,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L409",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "isCapturing": {
        "description": "Capture state observed through SDK controls and events on the selected audio track. External changes to borrowed tracks may require an explicit refresh; see Capture ownership.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 415,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L415",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "isPlaying": {
        "description": "Whether model audio playback is active.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 420,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L420",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      },
      "session": {
        "description": "Session lifecycle metadata where supported: sessionId, transcript fragments, client delegation metadata, cumulative voice usage, input mute, terminationReason, and pending/confirmed/unconfirmed finalization. Transcript fragments may overlap or arrive late; they are not complete turns.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx",
          "line": 426,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/02-ai-sdk-ui/05-use-realtime.mdx#L426",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-realtime"
        }
      }
    },
    "VideoPrompt:0": {
      "image": {
        "description": "Input image for image-to-video generation. Can be a URL string, base64-encoded string, a `Uint8Array`, an `ArrayBuffer`, or a `Buffer`.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/13-generate-video.mdx",
          "line": 64,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/01-ai-sdk-core/13-generate-video.mdx#L64",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-video"
        }
      },
      "text": {
        "description": "The text prompt.",
        "descriptionOrigin": "ai",
        "descriptionSource": {
          "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/13-generate-video.mdx",
          "line": 69,
          "package": "ai",
          "version": "7.0.183",
          "url": "https://unpkg.com/ai@7.0.183/docs/07-reference/01-ai-sdk-core/13-generate-video.mdx#L69",
          "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-video"
        }
      }
    }
  }
};
