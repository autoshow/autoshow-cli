import * as v from 'valibot'

export type DetectResult =
  | 'pdf' | 'epub' | 'docx' | 'pptx' | 'xlsx' | 'odf'
  | 'mobi' | 'azw3' | 'fb2' | 'lit' | 'cbz' | 'rtf' | 'csv'
  | 'png' | 'jpg' | 'tif' | 'webp' | 'bmp' | 'gif'
  | 'html'
  | null

export type HtmlArticleBackend = 'defuddle' | 'firecrawl' | 'glm-reader'

export type WebArticleMetadata = {
  sourceUrl?: string
  finalUrl?: string
  title?: string
  author?: string
  site?: string
  published?: string
  language?: string
  wordCount?: number
  description?: string
}

export const ExtractionOptionsSchema = v.object({
  filePath: v.string(),
  outputDir: v.string(),
  dpi: v.optional(v.number(), 300),
  languages: v.optional(v.string(), 'eng'),
  oem: v.optional(v.number(), 1),
  psm: v.optional(v.number(), 3),
  outputFormat: v.optional(v.picklist(['text', 'json', 'tsv', 'hocr']), 'text'),
  password: v.optional(v.string(), undefined),
  pageSeparator: v.optional(v.string(), '\n\n'),
  renderConcurrency: v.optional(v.number(), undefined),
  ocrConcurrency: v.optional(v.number(), undefined),
  ocrProviderConcurrency: v.optional(v.number(), 2),
  ocrLocalConcurrency: v.optional(v.number(), 1),
  preserveInterwordSpaces: v.optional(v.boolean(), false),
    rotate: v.optional(v.number(), 0),
    useTesseract: v.optional(v.boolean(), undefined),
    useOcrmypdf: v.optional(v.boolean(), undefined),
    usePaddleOcr: v.optional(v.boolean(), undefined),
  mistralOcrModel: v.optional(v.string(), undefined),
  mistralOcrModels: v.optional(v.array(v.string()), undefined),
  glmOcrModel: v.optional(v.string(), undefined),
  glmOcrModels: v.optional(v.array(v.string()), undefined),
  kimiOcrModel: v.optional(v.string(), undefined),
  kimiOcrModels: v.optional(v.array(v.string()), undefined),
  openaiOcrModel: v.optional(v.string(), undefined),
  openaiOcrModels: v.optional(v.array(v.string()), undefined),
  anthropicOcrModel: v.optional(v.string(), undefined),
  anthropicOcrModels: v.optional(v.array(v.string()), undefined),
  geminiOcrModel: v.optional(v.string(), undefined),
  geminiOcrModels: v.optional(v.array(v.string()), undefined),
  deepinfraOcrModel: v.optional(v.string(), undefined),
  deepinfraOcrModels: v.optional(v.array(v.string()), undefined),
  awsTextractModel: v.optional(v.string(), undefined),
  awsTextractModels: v.optional(v.array(v.string()), undefined),
  awsRegion: v.optional(v.string(), undefined),
  awsBucket: v.optional(v.string(), undefined),
  configPath: v.optional(v.string(), undefined),
  gcloudDocaiModel: v.optional(v.string(), undefined),
  gcloudDocaiModels: v.optional(v.array(v.string()), undefined),
  primaryOcr: v.optional(v.string(), undefined),
  epubChapterFiles: v.optional(v.boolean(), undefined),
  epubChunkLimitChars: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  pdfChapterMode: v.optional(v.picklist(['local', 'auto', 'llm']), 'local'),
  pdfChapterLlmService: v.optional(v.string(), undefined),
  pdfChapterLlmModel: v.optional(v.string(), undefined),
  useEpubBun: v.optional(v.boolean(), undefined),
  useEpubCalibre: v.optional(v.boolean(), undefined),
  step2SelectionOrigins: v.optional(v.record(
    v.string(),
    v.picklist(['default', 'explicit', 'all-shortcut'])
  ), undefined),
  preparedMarkdown: v.optional(v.string(), undefined),
  htmlArticleBackend: v.optional(v.picklist(['defuddle', 'firecrawl', 'glm-reader']), undefined)
})

export const PageResultSchema = v.object({
  pageNumber: v.number(),
  method: v.picklist(['text', 'ocr', 'skipped']),
  text: v.string(),
  confidence: v.optional(v.number(), undefined)
})

export const ExtractionResultSchema = v.object({
  text: v.string(),
  pages: v.array(PageResultSchema),
  totalPages: v.number(),
  ocrPages: v.number(),
  textPages: v.number()
})

export type { EpubInspectEngine } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-types'
const EpubInspectionSchema = v.record(v.string(), v.unknown())
const ChapterExportSummarySchema = v.object({
  sourceFormat: v.picklist(['epub', 'pdf']),
  mode: v.picklist(['chapters', 'chunks']),
  chunkLimitChars: v.optional(v.number(), undefined),
  sectionsKept: v.number(),
  sectionsDropped: v.number(),
  dividerSectionsMerged: v.number(),
  logicalChapterCount: v.optional(v.number(), undefined),
  logicalChapterSource: v.optional(v.picklist(['toc', 'spine']), undefined),
  tocStartSections: v.optional(v.number(), undefined),
  prefaceSectionsDropped: v.optional(v.number(), undefined),
  filesWritten: v.number(),
  chapterFilesWritten: v.optional(v.number(), undefined),
  chunkFilesWritten: v.optional(v.number(), undefined),
  directories: v.array(v.string())
})

export const ExtractionMetadataSchema = v.object({
  extractionMethod: v.picklist([
    'docx', 'pptx', 'xlsx', 'odf', 'tesseract', 'mutool+tesseract', 'paddle-ocr', 'mutool+paddle-ocr', 'ocrmypdf', 'mistral-ocr', 'openai-ocr', 'epub-bun', 'epub-calibre',
    'epub-text',
    'pdf-text', 'pdf+tesseract', 'pdf+ocrmypdf', 'pdf+paddle-ocr', 'pdf+mistral-ocr', 'pdf+glm-ocr', 'pdf+kimi-ocr', 'pdf+openai-ocr', 'pdf+anthropic-ocr', 'pdf+gemini-ocr', 'pdf+deepinfra-ocr', 'pdf+aws-textract', 'pdf+gcloud-docai',
    'office-native', 'rtf-native',
    'cbz+tesseract', 'cbz+paddle-ocr', 'cbz+ocrmypdf', 'cbz+mistral-ocr', 'cbz+glm-ocr', 'cbz+kimi-ocr', 'cbz+openai-ocr', 'cbz+anthropic-ocr', 'cbz+gemini-ocr', 'cbz+deepinfra-ocr', 'cbz+aws-textract', 'cbz+gcloud-docai',
    'csv-raw',
    'image+tesseract', 'image+ocrmypdf', 'image+paddle-ocr', 'image+mistral-ocr', 'image+glm-ocr', 'image+kimi-ocr', 'image+openai-ocr', 'image+anthropic-ocr', 'image+gemini-ocr', 'image+deepinfra-ocr', 'image+aws-textract', 'image+gcloud-docai',
    'glm-ocr',
    'kimi-ocr',
    'openai-ocr',
    'anthropic-ocr',
    'gemini-ocr',
    'deepinfra-ocr',
    'aws-textract',
    'gcloud-docai',
    'html+defuddle', 'html+firecrawl', 'html+glm-reader'
  ]),
  totalPages: v.number(),
  ocrPages: v.number(),
  textPages: v.number(),
  processingTime: v.number(),
  dpi: v.number(),
  languages: v.string(),
  tokenEstimate: v.number(),
  ocrModel: v.optional(v.string(), undefined),
  ocrService: v.optional(v.string(), undefined),
  promptTokens: v.optional(v.number(), undefined),
  completionTokens: v.optional(v.number(), undefined),
  epub: v.optional(EpubInspectionSchema, undefined),
  chapterExport: v.optional(ChapterExportSummarySchema, undefined),
  epubExport: v.optional(ChapterExportSummarySchema, undefined),
  pdfChapterDetection: v.optional(v.record(v.string(), v.unknown()), undefined),
  inputFamily: v.optional(v.string(), undefined),
  normalizedFrom: v.optional(v.string(), undefined),
  conversionChain: v.optional(v.array(v.string()), undefined),
  outputFormat: v.optional(v.string(), undefined),
  outputFidelity: v.optional(v.string(), undefined),
  languageSupported: v.optional(v.boolean(), undefined),
  probeFailureReason: v.optional(v.string(), undefined),
  headerContentTypeOverridden: v.optional(v.boolean(), undefined),
  metadataSchemaVersion: v.optional(v.number(), undefined),
  providerCostCents: v.optional(v.number(), undefined),
  providerCostSource: v.optional(v.string(), undefined),
  ocrProviderUsage: v.optional(v.array(v.record(v.string(), v.unknown())), undefined)
})

export const DocumentMetadataSchema = v.object({
  title: v.optional(v.string(), undefined),
  slug: v.string(),
  author: v.optional(v.string(), undefined),
  pageCount: v.number(),
  format: v.picklist([
    'pdf', 'epub', 'png', 'jpg', 'tif', 'docx', 'pptx', 'xlsx', 'odf',
    'mobi', 'azw3', 'fb2', 'lit', 'cbz', 'rtf', 'csv', 'webp', 'bmp', 'gif',
    'html'
  ]),
  fileSize: v.number(),
  sourceFormat: v.optional(v.string(), undefined),
  normalizedFormat: v.optional(v.string(), undefined),
  conversionChain: v.optional(v.array(v.string()), undefined),
  metadataSchemaVersion: v.optional(v.number(), undefined)
})

export type PreparedDocument = {
  outputDir: string
  step1Metadata: DocumentMetadata
  effectiveFilePath?: string
  tempCleanup?: () => Promise<void>
  preparedMarkdown?: string
  htmlArticleBackend?: HtmlArticleBackend
  web?: WebArticleMetadata
}

export type ProcessDocumentOutput = {
  result: ExtractionResult
  step1Metadata: DocumentMetadata
  step2Metadata: ExtractionMetadata | ExtractionMetadata[]
  completionStatus?: 'full' | 'incomplete' | 'failed' | undefined
  requestedProviders?: Array<{ service: string, model: string }> | undefined
  providerStates?: Array<Record<string, unknown>> | undefined
  missingProviders?: Array<{ service: string, model: string }> | undefined
  web?: WebArticleMetadata | undefined
  step2Errors?: Array<{
    service: string
    model: string
    message: string
  }> | undefined
  outputDir: string
}

export type ExtractionOptions = v.InferOutput<typeof ExtractionOptionsSchema> & {
  ocrPreparationCache?: import('~/types').OcrPreparationCache | undefined
}
export type PageResult = v.InferOutput<typeof PageResultSchema>
export type ExtractionResult = v.InferOutput<typeof ExtractionResultSchema>
export type ExtractionMetadata = v.InferOutput<typeof ExtractionMetadataSchema>
export type DocumentMetadata = v.InferOutput<typeof DocumentMetadataSchema>

export type { OutputFormat as OcrOutputFormat } from './cli-types'
