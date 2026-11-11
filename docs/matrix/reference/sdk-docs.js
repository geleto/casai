// Generated from AI SDK documentation (Apache-2.0). See THIRD_PARTY.md.
// Modified by Casai: extracted opening paragraphs, joined wrapped lines and resolved documentation links.
export default {
  "generateText": {
    "description": "Generates text and calls tools for a given prompt using a language model.",
    "source": {
      "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/01-generate-text.mdx",
      "line": 8,
      "package": "ai",
      "version": "7.0.162",
      "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/01-generate-text.mdx#L8",
      "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text"
    }
  },
  "streamText": {
    "description": "Streams text generations from a language model.",
    "source": {
      "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/02-stream-text.mdx",
      "line": 8,
      "package": "ai",
      "version": "7.0.162",
      "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/02-stream-text.mdx#L8",
      "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text"
    }
  },
  "embed": {
    "description": "Generate an embedding for a single value using an embedding model.",
    "source": {
      "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/05-embed.mdx",
      "line": 8,
      "package": "ai",
      "version": "7.0.162",
      "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/05-embed.mdx#L8",
      "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/embed"
    }
  },
  "embedMany": {
    "description": "Embed several values using an embedding model.",
    "source": {
      "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/06-embed-many.mdx",
      "line": 8,
      "package": "ai",
      "version": "7.0.162",
      "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/06-embed-many.mdx#L8",
      "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/embed-many"
    }
  },
  "rerank": {
    "description": "Rerank a set of documents based on their relevance to a query using a reranking model.",
    "source": {
      "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/06-rerank.mdx",
      "line": 8,
      "package": "ai",
      "version": "7.0.162",
      "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/06-rerank.mdx#L8",
      "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/rerank"
    }
  },
  "generateImage": {
    "description": "Generates images based on a given prompt using an image model.",
    "source": {
      "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/10-generate-image.mdx",
      "line": 8,
      "package": "ai",
      "version": "7.0.162",
      "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/10-generate-image.mdx#L8",
      "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-image"
    }
  },
  "transcribe": {
    "description": "Generates a transcript from an audio file.",
    "source": {
      "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/11-transcribe.mdx",
      "line": 8,
      "package": "ai",
      "version": "7.0.162",
      "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/11-transcribe.mdx#L8",
      "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/transcribe"
    }
  },
  "experimental_streamTranscribe": {
    "description": "Streams a transcript from live raw audio using a transcription model with streaming support.",
    "source": {
      "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/11-stream-transcribe.mdx",
      "line": 12,
      "package": "ai",
      "version": "7.0.162",
      "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/11-stream-transcribe.mdx#L12",
      "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-transcribe"
    }
  },
  "generateSpeech": {
    "description": "Generates speech audio from text.",
    "source": {
      "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/12-generate-speech.mdx",
      "line": 8,
      "package": "ai",
      "version": "7.0.162",
      "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/12-generate-speech.mdx#L8",
      "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-speech"
    }
  },
  "experimental_streamSpeech": {
    "description": "Streams speech audio from text, or from an array or stream of text deltas and text parts, using a speech model with streaming support.",
    "source": {
      "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/12-stream-speech.mdx",
      "line": 12,
      "package": "ai",
      "version": "7.0.162",
      "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/12-stream-speech.mdx#L12",
      "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-speech"
    }
  },
  "experimental_streamTranslate": {
    "description": "Streams a speech-to-speech translation from live raw audio. Models translate live source audio into target-language audio and text.",
    "source": {
      "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/11-stream-translate.mdx",
      "line": 12,
      "package": "ai",
      "version": "7.0.162",
      "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/11-stream-translate.mdx#L12",
      "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-translate"
    }
  },
  "experimental_decide": {
    "description": "Decides answers to a nonempty map of `choice`, `score`, `boolean`, and `box` questions against one state. See [Decisions](https://ai-sdk.dev/docs/ai-sdk-core/decisions) for examples and semantics.",
    "source": {
      "path": "node_modules/ai/docs/07-reference/01-ai-sdk-core/14-decide.mdx",
      "line": 12,
      "package": "ai",
      "version": "7.0.162",
      "url": "https://unpkg.com/ai@7.0.162/docs/07-reference/01-ai-sdk-core/14-decide.mdx#L12",
      "documentation": "https://ai-sdk.dev/docs/reference/ai-sdk-core/decide"
    }
  }
};
