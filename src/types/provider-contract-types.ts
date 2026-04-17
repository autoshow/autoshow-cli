import type { OutputFormat } from './cli-types'

export type ProviderSpec = {
  provider: string
  model?: string | undefined
}

export type BatchPolicy = {
  enabled?: boolean | undefined
  limit?: number | undefined
  all?: boolean | undefined
  order?: 'newest' | 'oldest' | undefined
  concurrency?: number | undefined
}

export type ResumePolicy = {
  path?: string | undefined
  retryableOnly?: boolean | undefined
}

export type ConcurrencyPolicy = {
  provider?: number | undefined
  local?: number | undefined
  segment?: number | undefined
}

export type DiarizationPolicy = {
  enabled?: boolean | undefined
  speakerCount?: number | undefined
  speakerNames?: string[] | undefined
  speakerReferences?: string[] | undefined
}

export type OcrRenderPolicy = {
  outputFormat?: OutputFormat | undefined
  languages?: string | undefined
  password?: string | undefined
}

export type SttPolicy = {
  providers: ProviderSpec[]
  batch?: BatchPolicy | undefined
  resume?: ResumePolicy | undefined
  concurrency?: ConcurrencyPolicy | undefined
  diarization?: DiarizationPolicy | undefined
  split?: boolean | undefined
}

export type OcrPolicy = {
  providers: ProviderSpec[]
  batch?: BatchPolicy | undefined
  resume?: ResumePolicy | undefined
  render?: OcrRenderPolicy | undefined
  epubBackend?: 'bun' | 'calibre' | undefined
  urlBackend?: 'defuddle' | 'firecrawl' | 'glm-reader' | undefined
}

export type ProviderCheckpoint = {
  schemaVersion: 1
  kind: 'provider-checkpoint'
  provider: string
  model?: string | undefined
  metadata: Record<string, unknown>
}

export type ProviderResult = {
  schemaVersion: 1
  kind: 'provider-result'
  provider: string
  model?: string | undefined
  metadata?: Record<string, unknown> | undefined
  result: Record<string, unknown>
}

export type RunManifest = {
  schemaVersion: 1
  kind: 'stt' | 'ocr'
  metadata: Record<string, unknown>
}

export type SttRunManifest = RunManifest & {
  kind: 'stt'
}

export type OcrRunManifest = RunManifest & {
  kind: 'ocr'
}

export type BatchManifest = {
  schemaVersion: 1
  kind: 'stt' | 'ocr'
  items: Record<string, unknown>[]
  source?: Record<string, unknown> | undefined
}
