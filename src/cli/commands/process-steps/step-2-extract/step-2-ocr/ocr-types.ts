import type {
  BatchManifestEntry,
  ExtractionMetadata,
  ExtractionResult,
  PageResult,
  ProcessDocumentOutput,
  ResolvedStep2Execution,
  Step1SourceRef
} from '~/types'
import type { ProviderRunStateBase } from '../step-2-shared/step-2-shared-types'

export type EpubInspectEngine = 'bun' | 'calibre'

export type EpubContentEntry = {
  path: string
  size: number
  compressedSize?: number
}

export type EpubContentReader = {
  adapterLabel: string
  entries: EpubContentEntry[]
  hasEntry: (entryPath: string) => boolean
  readText: (entryPath: string) => Promise<string>
}

export type EpubMetadata = {
  title?: string
  creators: string[]
  language?: string
  identifier?: string
  description?: string
  publisher?: string
  publishedAt?: string
  subjects: string[]
}

export type EpubManifestItem = {
  id: string
  href: string
  path: string
  mediaType: string
  properties?: string
}

export type EpubSpineItem = {
  index: number
  idref: string
  linear: string
  manifestId?: string
  href?: string
  path?: string
}

export type EpubTocItem = {
  id?: string
  playOrder?: number
  title: string
  href?: string
  path?: string
  children: EpubTocItem[]
}

export type EpubChapter = {
  index: number
  idref: string
  href: string
  path: string
  title?: string
  tocTitle?: string
  isTocStart?: boolean
  text: string
  wordCount: number
  characterCount: number
}

export type EpubAssets = {
  images: string[]
  stylesheets: string[]
  fonts: string[]
  scripts: string[]
  other: string[]
}

export type EpubInspectionPayload = {
  schemaVersion: 1
  engine: EpubInspectEngine
  container: {
    rootfilePath: string
    mediaType?: string
  }
  packagePath: string
  metadata: EpubMetadata
  manifest: EpubManifestItem[]
  spine: EpubSpineItem[]
  toc: {
    source: 'ncx' | 'nav' | 'none'
    items: EpubTocItem[]
  }
  chapters: EpubChapter[]
  assets: EpubAssets
  inventory: {
    totalFiles: number
    files: EpubContentEntry[]
  }
  stats: {
    chapterCount: number
    totalWords: number
    totalCharacters: number
    totalFiles: number
  }
  diagnostics: {
    adapter: string
    warnings: string[]
  }
}

export type EpubInspectOutput = {
  payload: EpubInspectionPayload
  text: string
}

export type ZipEntry = {
  name: string
  method: number
  compSize: number
  uncompSize: number
  localOffset: number
}

export type ZipXmlPage = {
  page: number
  text: string
}

export type ZipXmlResult = {
  pages: ZipXmlPage[]
  text: string
  totalPages: number
}

export type ZipXmlFormat = 'docx' | 'pptx' | 'xlsx' | 'odf'

export type OcrFn = (imagePath: string) => Promise<{ text: string, confidence?: number }>

export type HostedExtractOcrEngine = 'mistral-ocr' | 'glm-ocr' | 'openai-ocr' | 'anthropic-ocr' | 'gemini-ocr' | 'aws-textract' | 'gcloud-docai' | 'deapi-ocr'
export type LocalExtractOcrEngine = 'tesseract' | 'ocrmypdf' | 'paddle-ocr'

export type HostedOcrRun = {
  pages: PageResult[]
  extractionMethod: HostedExtractOcrEngine
  ocrService: 'mistral' | 'glm' | 'openai' | 'anthropic' | 'gemini' | 'aws-textract' | 'gcloud-docai' | 'deapi'
  ocrModel: string
  canonicalText?: string
  totalPages?: number
  promptTokens?: number
  completionTokens?: number
  providerCostCents?: number
  providerCostSource?: 'provider_quote' | 'registry_fallback'
}

export type OcrTarget = {
  service: 'tesseract' | 'ocrmypdf' | 'paddle-ocr' | 'mistral' | 'glm' | 'openai' | 'anthropic' | 'gemini' | 'aws-textract' | 'gcloud-docai' | 'deapi'
  model: string
}

export type OcrResumeRun = {
  outputDir: string
  requestedTargets: OcrTarget[]
  targetsToRun: OcrTarget[]
}

export type OcrLikeContext = {
  flags: Record<string, unknown> & { out?: unknown }
}

export type InternalPage = {
  pageNumber: number
  text: string
  needsOcr: boolean
}

export type DomNode = {
  nodeType: number
  textContent?: string | null
  childNodes?: Iterable<DomNode>
}

export type DomElement = DomNode & {
  localName: string
  getAttribute: (name: string) => string | null
  remove: () => void
}

export type DomDocument = DomNode & {
  body?: DomElement | null
  documentElement?: DomElement | null
  querySelectorAll: (selector: string) => Iterable<DomElement>
}

export type TextArtifactFile = {
  relativePath: string
  text: string
}

export type ChapterExportSummary = {
  sourceFormat: 'epub' | 'pdf'
  mode: 'chapters' | 'chunks'
  chunkLimitChars?: number
  sectionsKept: number
  sectionsDropped: number
  dividerSectionsMerged: number
  logicalChapterCount?: number
  logicalChapterSource?: 'toc' | 'spine'
  tocStartSections?: number
  prefaceSectionsDropped?: number
  filesWritten: number
  chapterFilesWritten?: number
  chunkFilesWritten?: number
  directories: string[]
}

export type EpubArtifactFile = TextArtifactFile

export type EpubExportPlan = {
  files: TextArtifactFile[]
  summary: {
    sourceFormat: 'epub'
    mode: 'chapters' | 'chunks'
    chunkLimitChars?: number
    sectionsKept: number
    sectionsDropped: number
    dividerSectionsMerged: number
    logicalChapterCount?: number
    logicalChapterSource?: 'toc' | 'spine'
    tocStartSections?: number
    prefaceSectionsDropped?: number
    filesWritten: number
    chapterFilesWritten?: number
    chunkFilesWritten?: number
    directories: string[]
  }
}

export type EpubTextSection = {
  index: number
  id: string
  title: string
  href: string
  text: string
  isTocStart?: boolean
  sourceIndexes?: number[]
}

export type EpubTextOutput = {
  pages: PageResult[]
  text: string
  exportPlan?: EpubExportPlan
}

export type OcrSourceKind =
  | 'article'
  | 'epub-inspect'
  | 'pdf'
  | 'image'
  | 'office-native'
  | 'epub-pdf'
  | 'rtf-native'
  | 'cbz-images'

export type OcrCompletionStatus = 'full' | 'incomplete' | 'failed'

export type OcrResult = {
  text: string
  confidence?: number
}

export type OcrRequestedProvider = {
  service: OcrTarget['service']
  model: string
}

export type OcrRecordedProviderError = {
  message: string
  retryable: boolean
}

export type OcrProviderState = ProviderRunStateBase<OcrTarget['service'], OcrRecordedProviderError>

export type OcrProviderSuccess = {
  target: OcrTarget
  metadata: ExtractionMetadata
  result: ExtractionResult
  relativeDir?: string | undefined
}

export type ExistingOcrRun = {
  successes: Array<OcrProviderSuccess | undefined>
  providerStates: Map<string, OcrProviderState>
}

export type OcrProviderFailureSummary = {
  message: string
  retryable?: boolean | undefined
}

export type OpenAIOcrInputContent =
  | {
      type: 'input_file'
      filename: string
      file_data: string
    }
  | {
      type: 'input_image'
      detail: 'high'
      image_url: string
    }

export type TocScanOptions = {
  allowUnnumbered?: boolean
}

export type TocPageAnalysis = {
  pageNumber: number
  hasTocHeading: boolean
  entries: PdfTocEntry[]
  tocLikeCount: number
  isToc: boolean
}

export type PdfChapterMode = 'local' | 'auto' | 'llm'

export type PdfOutlineEntry = {
  title: string
  pdfPage: number
  depth: number
}

export type PdfPageLabelEntry = {
  pageIndex: number
  style: 'arabic' | 'roman'
  prefix?: string
  startAt: number
}

export type PdfPageLabelCandidate = {
  pdfPage: number
  style: 'arabic' | 'roman'
  raw: string
  value: number
  location: 'top' | 'bottom'
}

export type PdfPageMapSpan = {
  style: 'arabic' | 'roman'
  pdfStartPage: number
  pdfEndPage: number
  printedStartPage: string
  printedEndPage: string
  offset: number
  source: 'page-labels' | 'page-text'
}

export type PdfTocEntry = {
  title: string
  printedPage?: string
  style?: 'arabic' | 'roman'
  numericValue?: number
  tocPdfPage: number
}

export type ResolvedPdfChapter = {
  title: string
  pdfStartPage: number
  printedStartPage?: string
  source: string
  confidence: number
}

export type PdfChapterDetectionSummary = {
  mode: PdfChapterMode
  strategyUsed: string
  overallConfidence: number
  warnings: string[]
  tocPages: number[]
  pageMapSpans: PdfPageMapSpan[]
  chapters: ResolvedPdfChapter[]
  llm?: {
    service: string
    model: string
  }
}

export type PdfChapterBuildResult = {
  files?: TextArtifactFile[]
  summary?: ChapterExportSummary
  detection: PdfChapterDetectionSummary
}

export type ResumeOcrEntry = {
  outputDir: string
  source: Step1SourceRef
  requestedTargets: OcrTarget[]
  missingTargets: OcrTarget[]
  completionStatus: 'full' | 'incomplete' | 'failed'
  rawEntry: BatchManifestEntry
}

export type OcrMetadataOptions = {
  failures?: Array<{ service: string, model: string, message: string }>
  web?: ProcessDocumentOutput['web']
  source?: Step1SourceRef
  completionStatus?: OcrCompletionStatus
  resolvedStep2?: ResolvedStep2Execution
  requestedProviders?: Array<{ service: string, model: string }>
  providerStates?: Array<Record<string, unknown>>
  missingProviders?: Array<{ service: string, model: string }>
  primaryProvider?: { service: string, model: string } | undefined
}
