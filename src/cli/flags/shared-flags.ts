import type { CliFlagsDefinition } from '~/cli/native'

export const priceFlag = {
  price: {
    description: 'Show aggregated cost estimate for all active pipeline steps and exit',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

export const generationOutputFlags = {
  'output-dir': {
    description: 'Exact output directory for this generation run',
    type: String
  }
} as const satisfies CliFlagsDefinition

export const booleanAllProvidersFlag = {
  'all-providers': {
    description: 'Run every provider supported by this command and input route',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

export const stepProviderSelectorFlags = {
  stt: {
    description: 'Write pipeline STT provider[=model]: whisper|reverb|deepinfra|elevenlabs|deepgram|soniox|speechmatics|rev|groq|grok|mistral|assemblyai|gladia|happyscribe|supadata|scrapecreators|openai|gemini|glm|together (default: whisper=tiny)',
    type: [String] as [StringConstructor]
  },
  ocr: {
    description: 'Write pipeline OCR provider[=model]: tesseract|ocrmypdf|paddle-ocr|mistral|glm|kimi|openai|grok|anthropic|gemini|deepinfra|unstructured (default: tesseract)',
    type: [String] as [StringConstructor]
  },
  llm: {
    description: 'Write pipeline LLM provider[=model]: openai|groq|gemini|anthropic|minimax|grok|glm|kimi|llama (default: llama)',
    type: [String] as [StringConstructor]
  },
  tts: {
    description: 'Write pipeline TTS provider[=model]: kitten|elevenlabs|minimax|groq|grok|mistral|openai|gemini|deepgram|speechify|hume|cartesia',
    type: [String] as [StringConstructor]
  },
  image: {
    description: 'Write pipeline image provider[=model]: gemini|openai|grok|bfl|reve',
    type: [String] as [StringConstructor]
  },
  video: {
    description: 'Write pipeline video provider[=model]: gemini|minimax|glm|grok|runway',
    type: [String] as [StringConstructor]
  },
  music: {
    description: 'Write pipeline music provider[=model]: elevenlabs|minimax|gemini',
    type: [String] as [StringConstructor]
  }
} as const satisfies CliFlagsDefinition

export const writeAllProvidersFlag = {
  'all-providers': {
    description: 'Write pipeline all-provider selector, repeatable for stt|ocr|url|llm|tts|image|video|music',
    type: [String] as [StringConstructor]
  }
} as const satisfies CliFlagsDefinition

export const sharedConcurrencyFlags = {
  'provider-concurrency': {
    description: 'Max hosted providers/models running in parallel for one item (default 2; all-provider runs default up to 8)',
    type: String,
    default: '2'
  },
  'local-concurrency': {
    description: 'Max local providers/models running in parallel for one item (default 1)',
    type: String,
    default: '1'
  }
} as const satisfies CliFlagsDefinition

export const batchFlags = {
  'batch-limit': {
    description: 'Batch: number of items to process (default 5)',
    type: String,
    default: '5'
  },
  'batch-all': {
    description: 'Batch: process all items',
    type: Boolean,
    default: false,
    negatable: false
  },
  'batch-order': {
    description: 'Batch: item order newest|oldest (default newest)',
    type: String,
    default: 'newest'
  },
  'batch-concurrency': {
    description: 'Batch: number of items to process concurrently (default 1)',
    type: String,
    default: '1'
  }
} as const satisfies CliFlagsDefinition

export const transcriptionFlags = {
  'youtube-captions': {
    description: 'Prefer English YouTube captions before STT when available; falls back to the normal STT provider path',
    type: Boolean,
    default: false,
    negatable: false
  },
  'stt-reverb-verbatimicity': {
    description: 'Reverb output style 0-1',
    type: String,
    default: '0.5'
  },
  'stt-happyscribe-organization-id': {
    description: 'Happy Scribe organization/workspace ID; required when the API key can access multiple organizations',
    type: String
  },
  'stt-supadata-lang': {
    description: 'Supadata preferred transcript language (ISO 639-1); used with auto mode when a native transcript is available',
    type: String
  },
  'stt-scrapecreators-lang': {
    description: 'ScrapeCreators YouTube transcript language code (default en)',
    type: String,
    default: 'en'
  },
  'speaker-count': {
    description: 'Optional diarization speaker-count hint (positive integer); unsupported providers report one aggregated warning at runtime',
    type: String
  },
  split: {
    description: 'Split audio into 30-minute segments for transcription',
    type: Boolean,
    default: false,
    negatable: false
  },
  'stt-segment-concurrency': {
    description: 'STT: max split segments in flight per provider (default 2; local clamps to 1)',
    type: String,
    default: '2'
  },
  'stt-preflight-concurrency': {
    description: 'STT: max duration probes running in parallel during preflight (default 4)',
    type: String,
    default: '4'
  },
  'refresh-cache': {
    description: 'STT: rebuild cache entries touched by this run',
    type: Boolean,
    default: false,
    negatable: false
  },
  'no-cache': {
    description: 'STT: bypass media cache for this run',
    type: Boolean,
    default: false,
    negatable: false
  },
  'reverb-verbatimicity': {
    description: 'Reverb output style 0-1',
    type: String,
    default: '0.5',
    help: { hidden: true }
  },
  'happyscribe-organization-id': {
    description: 'Happy Scribe organization/workspace ID',
    type: String,
    help: { hidden: true }
  },
  'supadata-lang': {
    description: 'Supadata preferred transcript language (ISO 639-1)',
    type: String,
    help: { hidden: true }
  },
  'scrapecreators-lang': {
    description: 'ScrapeCreators YouTube transcript language code',
    type: String,
    default: 'en',
    help: { hidden: true }
  }
} as const satisfies CliFlagsDefinition

export const llmProviderFlags = {
  llm: stepProviderSelectorFlags.llm
} as const satisfies CliFlagsDefinition

export const promptFlag = {
  prompt: {
    description: 'Named prompt(s) discovered under src/prompts/entries/ (default: "default")',
    type: [String] as [StringConstructor],
    default: [] as string[]
  },
  'prompt-md': {
    description: 'Save a second prompt file (prompt-md.md) with markdown examples alongside the JSON prompt',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

export const ocrInputFlags = {
  'ocr-language': {
    description: 'Tesseract language(s) like eng+fra (default: eng)',
    type: String,
    default: 'eng'
  },
  format: {
    description: 'Output format: text|json|tsv|hocr (default: text)',
    type: String,
    default: 'text'
  },
  password: {
    description: 'Password for encrypted PDFs',
    type: String
  },
  chapters: {
    description: 'EPUB native text runs and PDF autodetection: write chapter files under chapters/',
    type: Boolean,
    default: false,
    negatable: false
  },
  length: {
    description: 'Hard export limit in thousands of characters (e.g. 50 = 50,000 chars); for EPUB alone writes chunks/, and with --chapters splits oversized EPUB or PDF chapter files',
    type: String
  },
  'pdf-chapter-mode': {
    description: 'PDF chapter detection mode: local|auto|llm (default: local)',
    type: String,
    default: 'local'
  }
} as const satisfies CliFlagsDefinition

export const articleFlags = {
  'url-provider': {
    description: 'Article/HTML extraction backend: defuddle|firecrawl|glm-reader|spider|supadata|zyte (default: defuddle; local .html/.htm always use defuddle)',
    type: String,
    default: 'defuddle'
  }
} as const satisfies CliFlagsDefinition

export const allArticleFlags = {
  ...articleFlags,
  'url-request-timeout-ms': {
    description: 'URL article extraction: per-provider request timeout in milliseconds (default 60000; env AUTOSHOW_URL_REQUEST_TIMEOUT_MS)',
    type: String,
    default: '60000'
  },
  'url-request-attempts': {
    description: 'URL article extraction: total provider request attempts including retries (default 3; env AUTOSHOW_URL_REQUEST_ATTEMPTS)',
    type: String,
    default: '3'
  }
} as const satisfies CliFlagsDefinition

export const ocrTuningFlags = {
  'ocr-dpi': {
    description: 'Render DPI for OCR pages (default: 300)',
    type: String,
    default: '300'
  }
} as const satisfies CliFlagsDefinition
