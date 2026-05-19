import type { HtmlArticleBackend } from './process-types'
import type { ResolvedStep2Provider } from '../cli/commands/process-steps/step-2-extract/step-2-shared/step-2-shared-types'

export type BatchItem = {
  id: string
  url: string
  title?: string
  author?: string
  publishedAt?: string
  duration?: string
  description?: string
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
  extractRoute?: ExtractRoute | undefined
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
  glmModels: string[] | undefined
  glmModel: string | undefined
  kimiModels: string[] | undefined
  kimiModel: string | undefined
  llmService: string | undefined
  llmModel: string | undefined
}

export type InputFamily = 'media' | 'document' | 'html_article' | 'x_space' | 'unsupported'
export type ExtractRoute = 'media' | 'document' | 'x-space'

export type Step2Modality = 'media' | 'document'

export type ResolvedStep2Execution =
  | {
      route: 'stt'
      sourceKind: 'media'
      providers: ResolvedStep2Provider[]
    }
  | {
      route: 'ocr'
      sourceKind: 'pdf' | 'image' | 'epub-pdf' | 'cbz-images'
      providers: ResolvedStep2Provider[]
    }
  | {
      route: 'article'
      sourceKind: 'article'
      backend: HtmlArticleBackend
      backends?: HtmlArticleBackend[] | undefined
    }
  | {
      route: 'native-document'
      sourceKind: 'epub' | 'epub-inspect' | 'office' | 'rtf' | 'csv'
    }
  | {
      route: 'unsupported'
      sourceKind: 'unsupported'
    }

export type PlannedBatchInput = {
  input: string
  inputFamily: InputFamily
  resolvedStep2: ResolvedStep2Execution
  extractRoute?: ExtractRoute | undefined
  batchItem?: BatchItem | undefined
}

export type ResolvedBatch = {
  source: BatchSource
  selectedUrls: string[]
  selectedItems: BatchItem[]
  totalCount: number
}
