import type { ClercFlagsDefinition } from 'clerc'
import {
  SUPPORTED_LLAMA_MODELS,
  SUPPORTED_ELEVENLABS_STT_MODELS,
  SUPPORTED_GROQ_STT_MODELS,
  SUPPORTED_MISTRAL_OCR_MODELS,
  SUPPORTED_ASSEMBLYAI_STT_MODELS,
  SUPPORTED_MISTRAL_STT_MODELS,
  SUPPORTED_OPENAI_STT_MODELS,
  SUPPORTED_MINIMAX_MODELS,
  SUPPORTED_GROQ_MODELS,
  SUPPORTED_GEMINI_MODELS
} from '~/cli/commands/models/model-options'

const LLAMA_MODELS_DESCRIPTION = `llama.cpp model ID (${SUPPORTED_LLAMA_MODELS.length} supported; see docs/commands/03-write.md)`
const ELEVENLABS_STT_MODELS_DESCRIPTION = `ElevenLabs STT model: ${SUPPORTED_ELEVENLABS_STT_MODELS.join('|')}`
const OPENAI_STT_MODELS_DESCRIPTION = `OpenAI STT model: ${SUPPORTED_OPENAI_STT_MODELS.join('|')}`
const MISTRAL_STT_MODELS_DESCRIPTION = `Mistral STT model: ${SUPPORTED_MISTRAL_STT_MODELS.join('|')}`
const ASSEMBLYAI_STT_MODELS_DESCRIPTION = `AssemblyAI STT model: ${SUPPORTED_ASSEMBLYAI_STT_MODELS.join('|')}`
const MISTRAL_OCR_MODELS_DESCRIPTION = `Mistral OCR model: ${SUPPORTED_MISTRAL_OCR_MODELS.join('|')}`
const GEMINI_MODELS_DESCRIPTION = `Gemini model: ${SUPPORTED_GEMINI_MODELS.join('|')}`

export const priceFlag = {
  price: {
    description: 'Show aggregated cost estimate for all active pipeline steps and exit',
    type: Boolean,
    default: false,
    negatable: false
  },
  'dry-run': {
    description: 'Preview what would happen without executing (same as --price)',
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
    description: ELEVENLABS_STT_MODELS_DESCRIPTION,
    type: String
  },
  'groq-stt': {
    description: `Groq Whisper STT model (API, billed): ${SUPPORTED_GROQ_STT_MODELS.join('|')}`,
    type: String
  },
  'openai-stt': {
    description: OPENAI_STT_MODELS_DESCRIPTION,
    type: String
  },
  'mistral-stt': {
    description: MISTRAL_STT_MODELS_DESCRIPTION,
    type: String
  },
  'assemblyai-stt': {
    description: ASSEMBLYAI_STT_MODELS_DESCRIPTION,
    type: String
  },
  'speaker-count': {
    description: 'Diarization speaker-count hint for supported STT services (example: ElevenLabs/OpenAI)',
    type: String
  },
  split: {
    description: 'Split audio into 10-minute segments for transcription',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies ClercFlagsDefinition

export const llmProviderFlags = {
  llama: {
    description: LLAMA_MODELS_DESCRIPTION,
    type: String
  },
  openai: {
    description: 'OpenAI model: gpt-5.2|gpt-5.1|gpt-5.2-pro',
    type: String
  },
  groq: {
    description: `Groq model: ${SUPPORTED_GROQ_MODELS.join('|')}`,
    type: String
  },
  anthropic: {
    description: 'Anthropic model: claude-sonnet-4-6|claude-opus-4-6',
    type: String
  },
  gemini: {
    description: GEMINI_MODELS_DESCRIPTION,
    type: String
  },
  minimax: {
    description: `MiniMax model: ${SUPPORTED_MINIMAX_MODELS.join('|')}`,
    type: String
  }
} as const satisfies ClercFlagsDefinition

export const mediaFlags = {
  ...transcriptionFlags,
  ...llmProviderFlags
} as const satisfies ClercFlagsDefinition

export const promptFlag = {
  prompt: {
    description: 'Named prompt(s) from src/prompts/prompts.json (default: "default")',
    type: [String] as [StringConstructor],
    default: [] as string[]
  }
} as const satisfies ClercFlagsDefinition

export const promptOutputFlags = {
  'json-output': {
    description: 'Use JSON prompt examples and prefer structured JSON write output when supported',
    type: Boolean,
    default: false,
    negatable: false
  },
  'md-output': {
    description: 'Use markdown prompt examples and disable structured JSON write output',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies ClercFlagsDefinition

export const structuredWriteFlags = {
  structured: {
    description: 'Enable structured JSON output for write step (default: on)',
    type: Boolean,
    default: true,
    negatable: true
  },
  'structured-strict': {
    description: 'Enable strict schema mode for providers that support it (default: on)',
    type: Boolean,
    default: true,
    negatable: true
  },
  'structured-compat-retries': {
    description: 'Structured compat-mode retries for providers without native schema support (default: 2)',
    type: String,
    default: '2'
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
    description: MISTRAL_OCR_MODELS_DESCRIPTION,
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
