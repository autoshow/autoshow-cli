import type { ProcessCommand, RuntimeOptions, Step2ProviderSelectionOrigin } from '~/types/cli-types'
import type { HtmlArticleBackend } from './process-types'

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

export type BatchChildRunContext = {
  batchDir: string
  batchItem?: BatchItem
  outputDir?: string
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
  selectedItems?: Array<BatchItem | undefined>
  concurrency?: number
  totalCount?: number
  initialEntries?: Record<string, unknown>[]
  resultEntryIndexes?: number[]
  parentBatchDir?: string | undefined
}

export type ResolvedLLMConfig = {
  llamaModels: string[] | undefined
  llamaModel: string | undefined
  openaiModels: string[] | undefined
  openaiModel: string | undefined
  groqModels: string[] | undefined
  groqModel: string | undefined
  geminiModels: string[] | undefined
  geminiModel: string | undefined
  anthropicModels: string[] | undefined
  anthropicModel: string | undefined
  minimaxModels: string[] | undefined
  minimaxModel: string | undefined
  grokModels: string[] | undefined
  grokModel: string | undefined
  llmService: string | undefined
  llmModel: string | undefined
}

export type InputKind =
  | 'url_streaming'
  | 'url_direct_media'
  | 'url_direct_document'
  | 'url_html_article'
  | 'local_media'
  | 'local_document'

export type InputFamily = 'media' | 'document' | 'html_article' | 'unsupported'
export type RoutedChildKind = 'stt' | 'ocr'

export type Step2Modality = 'media' | 'document'
export type Step2Route = 'stt' | 'ocr' | 'article' | 'native-document' | 'unsupported'

export type ResolvedStep2Provider = {
  service: string
  model: string
  origin?: Step2ProviderSelectionOrigin | undefined
}

export type ResolvedStep2Execution =
  | {
      route: 'stt'
      sourceKind: 'media'
      providers: ResolvedStep2Provider[]
    }
  | {
      route: 'ocr'
      sourceKind: 'pdf' | 'image' | 'epub-pdf' | 'office-pdf' | 'rtf-pdf' | 'cbz-images'
      providers: ResolvedStep2Provider[]
    }
  | {
      route: 'article'
      sourceKind: 'article'
      backend: HtmlArticleBackend
    }
  | {
      route: 'native-document'
      sourceKind: 'epub' | 'epub-inspect' | 'office' | 'csv'
    }
  | {
      route: 'unsupported'
      sourceKind: 'unsupported'
    }

export type ResolvedInputRouting = {
  family: InputFamily
  step2Route: Step2Route
  resolvedStep2: ResolvedStep2Execution
  routedChildKind?: RoutedChildKind | undefined
  supported: boolean
  skipReason?: string | undefined
}

export type PlannedBatchInput = {
  input: string
  inputFamily: InputFamily
  resolvedStep2: ResolvedStep2Execution
  routedChildKind?: RoutedChildKind | undefined
  batchItem?: BatchItem | undefined
}

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
