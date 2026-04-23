import type { Step3Metadata } from './process-types'
import type { StructuredRequestOptions } from '../cli/commands/process-steps/step-3-write/write-types'
import type {
  OpenAICompatibleTranscriptionResponse,
  OpenAICompatibleTranscriptionSegment
} from '../cli/commands/process-steps/step-2-extract/step-2-stt/stt-types'

export type GroqTranscriptionSegment = OpenAICompatibleTranscriptionSegment
export type GroqTranscriptionResponse = OpenAICompatibleTranscriptionResponse

export type TranscribeEngine = 'reverb' | 'gcloud' | 'aws' | 'deepgram' | 'deepinfra' | 'deapi' | 'elevenlabs' | 'soniox' | 'speechmatics' | 'rev' | 'groq' | 'mistral' | 'assemblyai' | 'gladia' | 'happyscribe' | 'supadata' | 'whisper' | 'youtube-captions'

export type LLMTarget = {
  service: Step3Metadata['llmService']
  label: string
  model: string
  run: (prompt: string, model: string, structuredOpts?: StructuredRequestOptions) => Promise<{ result: string; metadata: Step3Metadata }>
}

export type EbookFormat = 'mobi' | 'azw3' | 'fb2' | 'lit'
export type ImageFormat = 'png' | 'jpg' | 'tif' | 'webp' | 'bmp' | 'gif'
export type OfficeFormat = 'docx' | 'pptx' | 'xlsx' | 'odf'

export type { ZipEntry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-types'
