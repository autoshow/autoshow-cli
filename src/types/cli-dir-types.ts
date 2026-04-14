import type { ProcessCommand, RuntimeOptions } from '~/types/cli-types'

export type BatchItem = {
  id: string
  url: string
  title?: string
  author?: string
  publishedAt?: string
  duration?: string
  directDownload?: boolean
  meta?: Record<string, unknown>
}

export type BatchSourceKind = 'podcast_rss' | 'youtube_channel' | 'youtube_playlist' | 'url_list'

export type BatchSource = {
  sourceKind: BatchSourceKind
  sourceUrl: string
  title?: string
  author?: string
  image?: string
  link?: string
  items: BatchItem[]
}

export type BatchOptions = {
  limit: number
  all: boolean
  order: 'newest' | 'oldest'
}

export type TopLevelTargetKind = 'directory' | 'input_list' | 'single'

export type TopLevelTargetInfo = {
  kind: TopLevelTargetKind
  exists: boolean
  isDirectory: boolean
  isFile: boolean
}

export type BatchItemProcessor = (
  command: ProcessCommand,
  item: string,
  batchDir: string,
  opts: RuntimeOptions,
  batchItem?: BatchItem
) => Promise<BatchItemProcessResult | void>

export type BatchItemProcessResult = {
  outputDir?: string
  manifestEntry?: Record<string, unknown>
}

export type BatchProcessResult = {
  ok: number
  partial: number
  incomplete: number
  fail: number
  batchDir?: string
  failureExitCode?: number
}

export type BatchRunOptions = {
  source?: BatchSource
  selectedItems?: BatchItem[]
  concurrency?: number
  totalCount?: number
}

export type ResolvedLLMConfig = {
  useOpenAI: boolean
  useGroq: boolean
  useGemini: boolean
  useAnthropic: boolean
  useMinimax: boolean
  llamaModel: string | undefined
  openaiModel: string | undefined
  groqModel: string | undefined
  geminiModel: string | undefined
  anthropicModel: string | undefined
  minimaxModel: string | undefined
  grokModel: string | undefined
  llmService: string | undefined
  llmModel: string | undefined
}

export type InputKind =
  | 'url_streaming'
  | 'url_direct_media'
  | 'url_direct_document'
  | 'local_media'
  | 'local_document'

export type YtDlpFlatEntry = {
  id?: string
  url?: string
  webpage_url?: string
  title?: string
  uploader?: string
  channel?: string
  upload_date?: string
  duration?: number
}

export type ResolvedBatch = {
  source: BatchSource
  selectedUrls: string[]
  selectedItems: BatchItem[]
  totalCount: number
}
