import type { ClercFlagsDefinition } from 'clerc'
import {
  SUPPORTED_LLAMA_MODELS,
  SUPPORTED_ELEVENLABS_STT_MODELS,
  SUPPORTED_DEEPGRAM_STT_MODELS,
  SUPPORTED_SONIOX_STT_MODELS,
  SUPPORTED_SPEECHMATICS_STT_MODELS,
  SUPPORTED_REV_STT_MODELS,
  SUPPORTED_GLADIA_STT_MODELS,
  SUPPORTED_GROQ_STT_MODELS,
  SUPPORTED_GLM_OCR_MODELS,
  SUPPORTED_MISTRAL_OCR_MODELS,
  SUPPORTED_ASSEMBLYAI_STT_MODELS,
  SUPPORTED_MISTRAL_STT_MODELS,
  SUPPORTED_OPENAI_STT_MODELS,
  SUPPORTED_MINIMAX_MODELS,
  SUPPORTED_GROQ_MODELS,
  SUPPORTED_GEMINI_MODELS,
  SUPPORTED_GROK_MODELS
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { buildModelDescription } from '~/cli/commands/setup-and-utilities/models/model-validation'

export const priceFlag = {
  price: {
    description: 'Show aggregated cost estimate for all active pipeline steps and exit',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies ClercFlagsDefinition

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
} as const satisfies ClercFlagsDefinition

export const transcriptionFlags = {
  whisper: {
    description: 'Local whisper.cpp model (free): tiny|base|small|medium|large-v3-turbo',
    type: String,
    default: 'tiny'
  },
  reverb: {
    description: 'Use Reverb ASR for transcription',
    type: Boolean,
    default: false,
    negatable: false
  },
  'reverb-verbatimicity': {
    description: 'Reverb output style 0-1',
    type: String,
    default: '0.5'
  },
  'elevenlabs-stt': {
    description: buildModelDescription('ElevenLabs STT model', SUPPORTED_ELEVENLABS_STT_MODELS),
    type: String
  },
  'deepgram-stt': {
    description: buildModelDescription('Deepgram STT model', SUPPORTED_DEEPGRAM_STT_MODELS),
    type: String
  },
  'soniox-stt': {
    description: buildModelDescription('Soniox STT model', SUPPORTED_SONIOX_STT_MODELS),
    type: String
  },
  'speechmatics-stt': {
    description: buildModelDescription('Speechmatics STT model', SUPPORTED_SPEECHMATICS_STT_MODELS),
    type: String
  },
  'rev-stt': {
    description: buildModelDescription('Rev STT model', SUPPORTED_REV_STT_MODELS),
    type: String
  },
  'groq-stt': {
    description: `Groq Whisper STT model (API, billed): ${SUPPORTED_GROQ_STT_MODELS.join('|')}`,
    type: String
  },
  'openai-stt': {
    description: buildModelDescription('OpenAI STT model', SUPPORTED_OPENAI_STT_MODELS),
    type: String
  },
  'mistral-stt': {
    description: buildModelDescription('Mistral STT model', SUPPORTED_MISTRAL_STT_MODELS),
    type: String
  },
  'assemblyai-stt': {
    description: buildModelDescription('AssemblyAI STT model', SUPPORTED_ASSEMBLYAI_STT_MODELS),
    type: String
  },
  'gladia-stt': {
    description: buildModelDescription('Gladia STT model', SUPPORTED_GLADIA_STT_MODELS),
    type: String
  },
  'speaker-count': {
    description: 'Optional diarization speaker-count hint for supported STT services; unsupported providers report one aggregated warning at runtime',
    type: String
  },
  'speaker-name': {
    description: 'OpenAI diarization known speaker name. Repeat with matching --speaker-reference entries (up to 4)',
    type: [String] as [StringConstructor]
  },
  'speaker-reference': {
    description: 'OpenAI diarization reference clip path or data URL. Repeat in the same order as --speaker-name',
    type: [String] as [StringConstructor]
  },
  split: {
    description: 'Split audio into 10-minute segments for transcription',
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
} as const satisfies ClercFlagsDefinition

export const resumeMissingFlag = {
  'resume-missing': {
    description: 'Reuse an existing batch directory and rerun only missing provider outputs; omit the path to auto-pick the newest resumable batch under ./output',
    type: String
  }
} as const satisfies ClercFlagsDefinition

export const llmProviderFlags = {
  llama: {
    description: `llama.cpp model ID or Hugging Face repo ID (namespace/repo_name; ${SUPPORTED_LLAMA_MODELS.length} setup-managed defaults)`,
    type: String
  },
  openai: {
    description: 'OpenAI model: gpt-5.4|gpt-5.4-pro|gpt-5.4-mini|gpt-5.4-nano',
    type: String
  },
  groq: {
    description: `Groq model: ${SUPPORTED_GROQ_MODELS.join('|')}`,
    type: String
  },
  anthropic: {
    description: 'Anthropic model: claude-sonnet-4-6|claude-opus-4-6|claude-haiku-4-5',
    type: String
  },
  gemini: {
    description: buildModelDescription('Gemini model', SUPPORTED_GEMINI_MODELS),
    type: String
  },
  minimax: {
    description: `MiniMax model: ${SUPPORTED_MINIMAX_MODELS.join('|')}`,
    type: String
  },
  grok: {
    description: `Grok model: ${SUPPORTED_GROK_MODELS.join('|')}`,
    type: String
  }
} as const satisfies ClercFlagsDefinition

export const mediaFlags = {
  ...transcriptionFlags,
  ...llmProviderFlags
} as const satisfies ClercFlagsDefinition

export const promptFlag = {
  prompt: {
    description: 'Named prompt(s) from src/prompts/entries/*.json (default: "default")',
    type: [String] as [StringConstructor],
    default: [] as string[]
  }
} as const satisfies ClercFlagsDefinition

export const extractFlags = {
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
  ocrmypdf: {
    description: 'Use OCRmyPDF engine for extraction (auto-converts EPUB/image inputs to PDF; installed lazily on first use)',
    type: Boolean,
    default: false,
    negatable: false
  },
  'paddle-ocr': {
    description: 'Use PaddleOCR engine for extraction (PDF, EPUB, image; installed lazily on first use)',
    type: Boolean,
    default: false,
    negatable: false
  },
  'mistral-ocr': {
    description: buildModelDescription('Mistral OCR model', SUPPORTED_MISTRAL_OCR_MODELS),
    type: String
  },
  'glm-ocr': {
    description: buildModelDescription('GLM OCR model', SUPPORTED_GLM_OCR_MODELS),
    type: String
  }
} as const satisfies ClercFlagsDefinition

export const articleFlags = {
  'url-backend': {
    description: 'Article/HTML extraction backend: defuddle|firecrawl|glm-reader (default: defuddle; local .html/.htm always use defuddle)',
    type: String
  }
} as const satisfies ClercFlagsDefinition

export const advancedExtractFlags = {
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
} as const satisfies ClercFlagsDefinition
