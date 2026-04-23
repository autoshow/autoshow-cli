import type { Step3Metadata } from '~/types/process-types'
import type { StructuredRequestOptions } from '../cli/commands/process-steps/step-3-write/write-types'

export type DownloadAudioOptions = {
  url?: string | undefined
  filePath?: string | undefined
  outputDir: string
  directDownload?: boolean | undefined
  keepOriginalMedia?: boolean | undefined
}

export type EmbeddedJson = {
  text?: string
  segments?: Array<{
    start?: number
    end?: number
    text?: string
    speaker?: string
  }>
}

export type OpenAICompatibleTranscriptionSegment = {
  start?: unknown
  end?: unknown
  text?: unknown
}

export type OpenAICompatibleTranscriptionResponse = {
  text?: unknown
  segments?: unknown
}

export type GroqTranscriptionSegment = OpenAICompatibleTranscriptionSegment
export type GroqTranscriptionResponse = OpenAICompatibleTranscriptionResponse

export type TranscribeEngine = 'reverb' | 'gcloud' | 'aws' | 'deepgram' | 'deepinfra' | 'deapi' | 'elevenlabs' | 'soniox' | 'speechmatics' | 'rev' | 'groq' | 'mistral' | 'assemblyai' | 'gladia' | 'happyscribe' | 'supadata' | 'whisper' | 'youtube-captions'

export type TranscribeEngineCapabilities = {
  diarizationByDefault: boolean
  supportsSpeakerCountHint: boolean
}

export type DownloadInfo = {
  sourceUrl: string
  destinationPath: string
}

export type LLMTarget = {
  service: Step3Metadata['llmService']
  label: string
  model: string
  run: (prompt: string, model: string, structuredOpts?: StructuredRequestOptions) => Promise<{ result: string; metadata: Step3Metadata }>
}

export type DocFormat =
  | 'pdf' | 'epub' | 'png' | 'jpg' | 'tif' | 'docx' | 'pptx' | 'xlsx' | 'odf'
  | 'mobi' | 'azw3' | 'fb2' | 'lit' | 'cbz' | 'rtf' | 'csv' | 'webp' | 'bmp' | 'gif'
  | 'html'

export type EbookFormat = 'mobi' | 'azw3' | 'fb2' | 'lit'
export type ImageFormat = 'png' | 'jpg' | 'tif' | 'webp' | 'bmp' | 'gif'
export type OfficeFormat = 'docx' | 'pptx' | 'xlsx' | 'odf'

export type ZipXmlPage = {
  page: number
  text: string
}

export type ZipXmlResult = {
  pages: ZipXmlPage[]
  text: string
  totalPages: number
}

export type { ZipEntry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-types'

export type ZipXmlFormat = 'docx' | 'pptx' | 'xlsx' | 'odf'
