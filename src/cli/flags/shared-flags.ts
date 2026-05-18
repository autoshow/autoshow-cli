import type { CliFlagsDefinition } from '~/cli/native'
import {
  SUPPORTED_LLAMA_MODELS,
  SUPPORTED_ANTHROPIC_MODELS,
  SUPPORTED_MINIMAX_MODELS,
  SUPPORTED_GROQ_MODELS,
  SUPPORTED_GEMINI_MODELS,
  SUPPORTED_GROK_MODELS,
  SUPPORTED_GLM_MODELS,
  SUPPORTED_KIMI_MODELS
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { buildModelDescription } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { getStep2ProviderFlags } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'

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
  },
  out: {
    description: 'Alias for --output-dir on standalone generation commands',
    type: String
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
  ...getStep2ProviderFlags('stt'),
  'youtube-captions': {
    description: 'Prefer English YouTube captions before STT when available; falls back to the normal STT provider path',
    type: Boolean,
    default: false,
    negatable: false
  },
  'reverb-verbatimicity': {
    description: 'Reverb output style 0-1',
    type: String,
    default: '0.5'
  },
  'aws-region': {
    description: 'AWS region for Amazon Transcribe and Textract staging (for example us-east-1)',
    type: String
  },
  'aws-bucket': {
    description: 'S3 bucket used for Amazon Transcribe and Textract staging',
    type: String
  },
  'happyscribe-organization-id': {
    description: 'Happy Scribe organization/workspace ID; required when the API key can access multiple organizations',
    type: String
  },
  'supadata-lang': {
    description: 'Supadata preferred transcript language (ISO 639-1); used with auto mode when a native transcript is available',
    type: String
  },
  'scrapecreators-lang': {
    description: 'ScrapeCreators YouTube transcript language code (default en)',
    type: String,
    default: 'en'
  },
  'speaker-count': {
    description: 'Optional diarization speaker-count hint for supported STT services; unsupported providers report one aggregated warning at runtime',
    type: String
  },
  split: {
    description: 'Split audio into 30-minute segments for transcription',
    type: Boolean,
    default: false,
    negatable: false
  },
  'stt-provider-concurrency': {
    description: 'STT: max cloud providers running in parallel for one item (default 2; batch scheduler still honors this cap in multi-item multi-provider runs)',
    type: String,
    default: '2'
  },
  'stt-local-concurrency': {
    description: 'STT: max local providers running in parallel for one item (default 1)',
    type: String,
    default: '1'
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
  }
} as const satisfies CliFlagsDefinition

export const llmProviderFlags = {
  llama: {
    description: `llama.cpp model ID or Hugging Face repo ID (namespace/repo_name; omit value for the default local model, ${SUPPORTED_LLAMA_MODELS.length} setup-managed defaults)`,
    type: [String] as [StringConstructor]
  },
  openai: {
    description: 'OpenAI model (omit value for cheapest supported model): gpt-5.4|gpt-5.4-pro|gpt-5.4-mini|gpt-5.4-nano',
    type: [String] as [StringConstructor]
  },
  groq: {
    description: `Groq model (omit value for cheapest supported model): ${SUPPORTED_GROQ_MODELS.join('|')}`,
    type: [String] as [StringConstructor]
  },
  anthropic: {
    description: buildModelDescription('Anthropic model', SUPPORTED_ANTHROPIC_MODELS),
    type: [String] as [StringConstructor]
  },
  gemini: {
    description: buildModelDescription('Gemini model', SUPPORTED_GEMINI_MODELS),
    type: [String] as [StringConstructor]
  },
  minimax: {
    description: `MiniMax model (omit value for cheapest supported model): ${SUPPORTED_MINIMAX_MODELS.join('|')}`,
    type: [String] as [StringConstructor]
  },
  grok: {
    description: `Grok model (omit value for cheapest supported model): ${SUPPORTED_GROK_MODELS.join('|')}`,
    type: [String] as [StringConstructor]
  },
  glm: {
    description: `GLM model (omit value for cheapest supported model): ${SUPPORTED_GLM_MODELS.join('|')}`,
    type: [String] as [StringConstructor]
  },
  kimi: {
    description: buildModelDescription('Kimi model', SUPPORTED_KIMI_MODELS),
    type: [String] as [StringConstructor]
  },
  'llm-provider-concurrency': {
    description: 'LLM: max hosted providers/models running in parallel for one write item (default 2)',
    type: String,
    default: '2'
  },
  'llm-local-concurrency': {
    description: 'LLM: max local llama.cpp models running in parallel for one write item (default 1)',
    type: String,
    default: '1'
  }
} as const satisfies CliFlagsDefinition

export const mediaFlags = {
  ...transcriptionFlags,
  ...llmProviderFlags
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
  ...getStep2ProviderFlags('ocr'),
  lang: {
    description: 'Tesseract language(s) like eng+fra (default: eng)',
    type: String,
    default: 'eng'
  },
  out: {
    description: 'Output format: text, json, tsv, hocr (default: text)',
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
    description: 'Hard export limit in thousands of characters; for EPUB alone writes chunks/, and with --chapters splits oversized EPUB or PDF chapter files',
    type: String
  },
  'pdf-chapter-mode': {
    description: 'PDF chapter detection mode: local|auto|llm (default: local)',
    type: String
  },
  'ocr-provider-concurrency': {
    description: 'OCR: max hosted providers/models running in parallel for one item (default 2)',
    type: String,
    default: '2'
  },
  'ocr-local-concurrency': {
    description: 'OCR: max local providers running in parallel for one item (default 1)',
    type: String,
    default: '1'
  }
} as const satisfies CliFlagsDefinition

export const articleFlags = {
  'url-backend': {
    description: 'Article/HTML extraction backend: defuddle|firecrawl|glm-reader|spider|zyte (default: defuddle; local .html/.htm always use defuddle)',
    type: String
  }
} as const satisfies CliFlagsDefinition

export const allArticleFlags = {
  ...articleFlags,
  'all-url': {
    description: 'Article/HTML extraction: run every URL backend for extract',
    type: Boolean,
    default: false,
    negatable: false
  },
  'url-provider-concurrency': {
    description: 'URL article extraction: max hosted URL backends running in parallel (default 2; --all-url defaults to up to 4)',
    type: String,
    default: '2'
  }
} as const satisfies CliFlagsDefinition

export const ocrTuningFlags = {
  dpi: {
    description: 'Render DPI for OCR pages (default: 300)',
    type: String,
    default: '300'
  },
  psm: {
    description: 'Tesseract page segmentation mode (default: 3)',
    type: String,
    default: '3'
  },
  oem: {
    description: 'Tesseract OCR engine mode (default: 1)',
    type: String,
    default: '1'
  },
  'page-separator': {
    description: 'Custom page separator string (default: \\n\\n)',
    type: String
  },
  'preserve-spaces': {
    description: 'Enable Tesseract preserve_interword_spaces=1',
    type: Boolean,
    default: false,
    negatable: false
  },
  rotate: {
    description: 'Rotate pages before OCR (degrees, default: 0)',
    type: String,
    default: '0'
  }
} as const satisfies CliFlagsDefinition
