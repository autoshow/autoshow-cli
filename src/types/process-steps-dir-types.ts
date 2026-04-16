import type { Step3Metadata } from '~/types/process-types'
import type { StructuredRequestOptions } from '~/cli/commands/process-steps/step-3-write/structured-output/types'

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

export type GroqTranscriptionSegment = {
  start?: unknown
  end?: unknown
  text?: unknown
}

export type GroqTranscriptionResponse = {
  text?: unknown
  segments?: unknown
}

export type OpenAITranscriptionDiarizedSegment = {
  id?: unknown
  start?: unknown
  end?: unknown
  speaker?: unknown
  text?: unknown
}

export type OpenAITranscriptionDiarizedResponse = {
  text?: unknown
  duration?: unknown
  task?: unknown
  segments?: unknown
}

export type TranscribeEngine = 'reverb' | 'deepgram' | 'elevenlabs' | 'soniox' | 'speechmatics' | 'rev' | 'groq' | 'openai' | 'mistral' | 'assemblyai' | 'gladia' | 'whisper'

export type TranscribeEngineCapabilities = {
  diarizationByDefault: boolean
  supportsSpeakerCountHint: boolean
  supportsKnownSpeakerReferences: boolean
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

export type ZipEntry = {
  name: string
  method: number
  compSize: number
  uncompSize: number
  localOffset: number
}

export type ZipXmlFormat = 'docx' | 'pptx' | 'xlsx' | 'odf'
