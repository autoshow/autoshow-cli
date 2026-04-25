import * as v from 'valibot'
import type { OutputFormat } from './cli-types'
import type { ImageProvider, MusicProvider, TtsProvider, VideoProvider } from './provider-types'
import type { Step2TimingMetadata } from '../cli/commands/process-steps/step-2-extract/step-2-stt/stt-types'

export const ProcessingOptionsSchema = v.pipe(
  v.object({
    url: v.optional(v.pipe(v.string(), v.url()), undefined),
    filePath: v.optional(v.string(), undefined),
    whisperModels: v.optional(v.array(v.string()), undefined),
    whisperModel: v.string(),
    youtubeCaptions: v.optional(v.boolean(), undefined),
    gcloudSttModels: v.optional(v.array(v.string()), undefined),
    gcloudSttModel: v.optional(v.string(), undefined),
    awsSttModels: v.optional(v.array(v.string()), undefined),
    awsSttModel: v.optional(v.string(), undefined),
    deepinfraSttModels: v.optional(v.array(v.string()), undefined),
    deepinfraSttModel: v.optional(v.string(), undefined),
    deapiSttModels: v.optional(v.array(v.string()), undefined),
    deapiSttModel: v.optional(v.string(), undefined),
    awsRegion: v.optional(v.string(), undefined),
    awsBucket: v.optional(v.string(), undefined),
    groqSttModels: v.optional(v.array(v.string()), undefined),
    groqSttModel: v.optional(v.string(), undefined),
    elevenlabsSttModels: v.optional(v.array(v.string()), undefined),
    elevenlabsSttModel: v.optional(v.string(), undefined),
    sonioxSttModels: v.optional(v.array(v.string()), undefined),
    sonioxSttModel: v.optional(v.string(), undefined),
    revSttModels: v.optional(v.array(v.string()), undefined),
    revSttModel: v.optional(v.string(), undefined),
    mistralSttModels: v.optional(v.array(v.string()), undefined),
    mistralSttModel: v.optional(v.string(), undefined),
    assemblyaiSttModels: v.optional(v.array(v.string()), undefined),
    assemblyaiSttModel: v.optional(v.string(), undefined),
    gladiaSttModels: v.optional(v.array(v.string()), undefined),
    gladiaSttModel: v.optional(v.string(), undefined),
    happyscribeSttModels: v.optional(v.array(v.string()), undefined),
    happyscribeSttModel: v.optional(v.string(), undefined),
    happyscribeOrganizationId: v.optional(v.string(), undefined),
    supadataSttModels: v.optional(v.array(v.string()), undefined),
    supadataSttModel: v.optional(v.string(), undefined),
    openaiSttModels: v.optional(v.array(v.string()), undefined),
    openaiSttModel: v.optional(v.string(), undefined),
    geminiSttModels: v.optional(v.array(v.string()), undefined),
    geminiSttModel: v.optional(v.string(), undefined),
    glmSttModels: v.optional(v.array(v.string()), undefined),
    glmSttModel: v.optional(v.string(), undefined),
    togetherSttModels: v.optional(v.array(v.string()), undefined),
    togetherSttModel: v.optional(v.string(), undefined),
    fireworksSttModels: v.optional(v.array(v.string()), undefined),
    fireworksSttModel: v.optional(v.string(), undefined),
    cloudflareSttModels: v.optional(v.array(v.string()), undefined),
    cloudflareSttModel: v.optional(v.string(), undefined),
    supadataLang: v.optional(v.string(), undefined),
    speechmaticsSttModels: v.optional(v.array(v.string()), undefined),
    speechmaticsSttModel: v.optional(v.string(), undefined),
    deepgramSttModels: v.optional(v.array(v.string()), undefined),
    deepgramSttModel: v.optional(v.string(), undefined),
    diarizationSpeakerCount: v.optional(v.number(), undefined),
    refreshCache: v.optional(v.boolean(), undefined),
    noCache: v.optional(v.boolean(), undefined),
    llamaModels: v.optional(v.array(v.string()), undefined),
    llamaModel: v.optional(v.string(), undefined),
    openaiModels: v.optional(v.array(v.string()), undefined),
    openaiModel: v.optional(v.string(), undefined),
    groqModels: v.optional(v.array(v.string()), undefined),
    groqModel: v.optional(v.string(), undefined),
    geminiModels: v.optional(v.array(v.string()), undefined),
    geminiModel: v.optional(v.string(), undefined),
    anthropicModels: v.optional(v.array(v.string()), undefined),
    anthropicModel: v.optional(v.string(), undefined),
    minimaxModels: v.optional(v.array(v.string()), undefined),
    minimaxModel: v.optional(v.string(), undefined),
    grokModels: v.optional(v.array(v.string()), undefined),
    grokModel: v.optional(v.string(), undefined),
    llmProviderConcurrency: v.optional(v.number(), 2),
    llmLocalConcurrency: v.optional(v.number(), 1),
    outputDir: v.string(),
    useReverb: v.optional(v.boolean(), undefined),
    reverbVerbatimicity: v.optional(v.number(), undefined),
    split: v.optional(v.boolean(), undefined),
    skipLLM: v.optional(v.boolean(), undefined),
    directDownload: v.optional(v.boolean(), undefined),

    prompts: v.optional(v.array(v.string()), undefined),
    promptFile: v.optional(v.string(), undefined),
    renderedText: v.optional(v.boolean(), undefined),
    renderedOutDir: v.optional(v.string(), undefined),
    trackList: v.optional(v.string(), undefined),

    ttsSpeaker: v.optional(v.string(), undefined),
    groqTtsModels: v.optional(v.array(v.string()), undefined),
    groqTtsModel: v.optional(v.string(), undefined),
    groqVoiceId: v.optional(v.string(), undefined),
    openaiTtsModels: v.optional(v.array(v.string()), undefined),
    openaiTtsModel: v.optional(v.string(), undefined),
    openaiVoiceId: v.optional(v.string(), undefined),
    geminiTtsModels: v.optional(v.array(v.string()), undefined),
    geminiTtsModel: v.optional(v.string(), undefined),
    geminiVoiceId: v.optional(v.string(), undefined),
    geminiSpeaker1Name: v.optional(v.string(), undefined),
    geminiSpeaker1Voice: v.optional(v.string(), undefined),
    geminiSpeaker2Name: v.optional(v.string(), undefined),
    geminiSpeaker2Voice: v.optional(v.string(), undefined),
    elevenlabsTtsModels: v.optional(v.array(v.string()), undefined),
    elevenlabsTtsModel: v.optional(v.string(), undefined),
    elevenlabsVoiceId: v.optional(v.string(), undefined),
    deepgramTtsModels: v.optional(v.array(v.string()), undefined),
    deepgramTtsModel: v.optional(v.string(), undefined),
    deepgramVoiceId: v.optional(v.string(), undefined),
    minimaxTtsModels: v.optional(v.array(v.string()), undefined),
    minimaxTtsModel: v.optional(v.string(), undefined),
    minimaxTtsVoice: v.optional(v.string(), undefined),

    kittenTtsModels: v.optional(v.array(v.string()), undefined),
    kittenTtsModel: v.optional(v.string(), undefined),

    geminiImageModels: v.optional(v.array(v.string()), undefined),
    geminiImageModel: v.optional(v.string(), undefined),
    openaiImageModels: v.optional(v.array(v.string()), undefined),
    openaiImageModel: v.optional(v.string(), undefined),
    minimaxImageModels: v.optional(v.array(v.string()), undefined),
    minimaxImageModel: v.optional(v.string(), undefined),
    glmImageModels: v.optional(v.array(v.string()), undefined),
    glmImageModel: v.optional(v.string(), undefined),
    grokImageModels: v.optional(v.array(v.string()), undefined),
    grokImageModel: v.optional(v.string(), undefined),
    runwayImageModels: v.optional(v.array(v.string()), undefined),
    runwayImageModel: v.optional(v.string(), undefined),
    imageAspectRatio: v.optional(v.string(), undefined),
    imageSize: v.optional(v.string(), undefined),
    imageQuality: v.optional(v.string(), undefined),
    imageFormat: v.optional(v.string(), undefined),
    imageBackground: v.optional(v.string(), undefined),
    imagenCount: v.optional(v.number(), undefined),

    elevenlabsMusicModels: v.optional(v.array(v.string()), undefined),
    elevenlabsMusicModel: v.optional(v.string(), undefined),
    minimaxMusicModels: v.optional(v.array(v.string()), undefined),
    minimaxMusicModel: v.optional(v.string(), undefined),
    musicDuration: v.optional(v.number(), undefined),
    musicLyricsFile: v.optional(v.string(), undefined),
    musicInstrumental: v.optional(v.boolean(), undefined),

    geminiVideoModels: v.optional(v.array(v.string()), undefined),
    geminiVideoModel: v.optional(v.string(), undefined),
    minimaxVideoModels: v.optional(v.array(v.string()), undefined),
    minimaxVideoModel: v.optional(v.string(), undefined),
    glmVideoModels: v.optional(v.array(v.string()), undefined),
    glmVideoModel: v.optional(v.string(), undefined),
    grokVideoModels: v.optional(v.array(v.string()), undefined),
    grokVideoModel: v.optional(v.string(), undefined),
    runwayVideoModels: v.optional(v.array(v.string()), undefined),
    runwayVideoModel: v.optional(v.string(), undefined),
    videoDuration: v.optional(v.number(), undefined),
    videoSize: v.optional(v.string(), undefined),
    videoAspectRatio: v.optional(v.string(), undefined),
    videoResolution: v.optional(v.string(), undefined)
  }),
  v.check((obj): boolean => {
    const hasUrl = typeof obj.url === 'string' && obj.url.length > 0
    const hasFile = typeof obj.filePath === 'string' && obj.filePath.length > 0
    return (hasUrl && !hasFile) || (!hasUrl && hasFile)
  }, 'Provide either url or filePath')
)

export const VideoChapterSchema = v.object({
  startTime: v.number(),
  endTime: v.number(),
  title: v.string()
})

export const VideoMetadataSchema = v.object({
  title: v.string(),
  duration: v.string(),
  author: v.string(),
  description: v.string(),
  url: v.pipe(v.string(), v.url()),
  publishDate: v.optional(v.string(), undefined),
  thumbnail: v.optional(v.string(), undefined),
  channelUrl: v.optional(v.string(), undefined),
  chapters: v.optional(v.array(VideoChapterSchema), undefined)
})

export type Step1Metadata = VideoMetadata & {
  slug: string
  audioFileName: string
  audioFileSize: number
}

const YtDlpChapterSchema = v.object({
  start_time: v.optional(v.number(), undefined),
  end_time: v.optional(v.number(), undefined),
  title: v.optional(v.string(), undefined)
})

const YtDlpSubtitleTrackSchema = v.object({
  ext: v.string(),
  url: v.string(),
  name: v.optional(v.string(), undefined)
})

export const YtDlpVideoInfoSchema = v.object({
  id: v.optional(v.string(), undefined),
  title: v.optional(v.string(), undefined),
  duration: v.optional(v.number(), undefined),
  uploader: v.optional(v.string(), undefined),
  channel: v.optional(v.string(), undefined),
  channel_url: v.optional(v.string(), undefined),
  description: v.optional(v.string(), undefined),
  upload_date: v.optional(v.string(), undefined),
  thumbnail: v.optional(v.string(), undefined),
  chapters: v.optional(v.array(YtDlpChapterSchema), undefined),
  subtitles: v.optional(v.record(v.string(), v.array(YtDlpSubtitleTrackSchema)), undefined),
  automatic_captions: v.optional(v.record(v.string(), v.array(YtDlpSubtitleTrackSchema)), undefined)
})

export type ProcessingOptions = v.InferOutput<typeof ProcessingOptionsSchema>
export type VideoMetadata = v.InferOutput<typeof VideoMetadataSchema>
export type YtDlpVideoInfo = v.InferOutput<typeof YtDlpVideoInfoSchema>

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
  glmOcrModel: v.optional(v.string(), undefined),
  openaiOcrModel: v.optional(v.string(), undefined),
  anthropicOcrModel: v.optional(v.string(), undefined),
  geminiOcrModel: v.optional(v.string(), undefined),
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
  filesWritten: v.number(),
  chapterFilesWritten: v.optional(v.number(), undefined),
  chunkFilesWritten: v.optional(v.number(), undefined),
  directories: v.array(v.string())
})

export const ExtractionMetadataSchema = v.object({
  extractionMethod: v.picklist([
    'docx', 'pptx', 'xlsx', 'odf', 'tesseract', 'mutool+tesseract', 'paddle-ocr', 'mutool+paddle-ocr', 'ocrmypdf', 'mistral-ocr', 'openai-ocr', 'epub-bun', 'epub-calibre',
    'epub-text',
    'pdf-text', 'pdf+tesseract', 'pdf+ocrmypdf', 'pdf+paddle-ocr', 'pdf+mistral-ocr', 'pdf+glm-ocr', 'pdf+openai-ocr', 'pdf+anthropic-ocr', 'pdf+gemini-ocr',
    'office-native', 'office+tesseract', 'office+ocrmypdf', 'office+paddle-ocr', 'office+mistral-ocr', 'office+glm-ocr', 'office+openai-ocr', 'office+anthropic-ocr', 'office+gemini-ocr',
    'rtf+tesseract', 'rtf+ocrmypdf', 'rtf+paddle-ocr', 'rtf+mistral-ocr', 'rtf+glm-ocr', 'rtf+openai-ocr', 'rtf+anthropic-ocr', 'rtf+gemini-ocr',
    'cbz+tesseract', 'cbz+paddle-ocr', 'cbz+ocrmypdf', 'cbz+mistral-ocr', 'cbz+glm-ocr', 'cbz+openai-ocr', 'cbz+anthropic-ocr', 'cbz+gemini-ocr',
    'csv-raw',
    'image+tesseract', 'image+ocrmypdf', 'image+paddle-ocr', 'image+mistral-ocr', 'image+glm-ocr', 'image+openai-ocr', 'image+anthropic-ocr', 'image+gemini-ocr',
    'glm-ocr',
    'openai-ocr',
    'anthropic-ocr',
    'gemini-ocr',
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
  metadataSchemaVersion: v.optional(v.number(), undefined)
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

export type ExtractionOptions = v.InferOutput<typeof ExtractionOptionsSchema>
export type PageResult = v.InferOutput<typeof PageResultSchema>
export type ExtractionResult = v.InferOutput<typeof ExtractionResultSchema>
export type ExtractionMetadata = v.InferOutput<typeof ExtractionMetadataSchema>
export type DocumentMetadata = v.InferOutput<typeof DocumentMetadataSchema>

export type { OutputFormat as OcrOutputFormat }

export type TranscriptionSegment = {
  start: string
  end: string
  text: string
  speaker?: string | undefined
}

export type TranscriptionEvidenceTimingSource = 'native' | 'interpolated'

export type TranscriptionEvidenceSegment = {
  startSeconds: number
  endSeconds: number
  text: string
  speaker?: string | undefined
  confidence?: number | undefined
}

export type TranscriptionEvidenceWord = {
  startSeconds: number
  endSeconds: number
  text: string
  normalized: string
  speaker?: string | undefined
  confidence?: number | undefined
  timingSource: TranscriptionEvidenceTimingSource
}

export type TranscriptionEvidenceCapabilities = {
  hasNativeWordTiming: boolean
  hasConfidence: boolean
  hasSpeakerLabels: boolean
}

export type TranscriptionEvidenceTimingQuality = 'native_word' | 'segment_interpolated' | 'coarse'

export type TranscriptionEvidence = {
  segments?: TranscriptionEvidenceSegment[] | undefined
  words?: TranscriptionEvidenceWord[] | undefined
  capabilities?: Partial<TranscriptionEvidenceCapabilities> | undefined
  timingQuality?: TranscriptionEvidenceTimingQuality | undefined
  rawResponse?: unknown
}

export type PersistedTranscriptionEvidence = {
  service: string
  model: string
  label: string
  transcriptText: string
  segments: TranscriptionEvidenceSegment[]
  words: TranscriptionEvidenceWord[]
  capabilities: TranscriptionEvidenceCapabilities
  timingQuality: TranscriptionEvidenceTimingQuality
  speakerInventory: string[]
}

export type TranscriptionResult = {
  text: string
  segments: TranscriptionSegment[]
  evidence?: TranscriptionEvidence | undefined
}

export type DiarizationOptions = {
  enabled?: boolean | undefined
  speakerCount?: number | undefined
}

export type Step2RuntimeMetadata = {
  mode: 'fresh' | 'resumed'
  stage: 'created' | 'polling' | 'completed' | 'cleanup-pending' | 'cleanup-complete'
  remoteJobId: string
  remoteAssetId?: string | undefined
  remoteAssetUrl?: string | undefined
  createCompletedAt?: string | undefined
  lastPollAt?: string | undefined
  completedAt?: string | undefined
  cleanupCompletedAt?: string | undefined
  cleanup?: {
    remoteJobDeleted?: boolean | undefined
    remoteAssetDeleted?: boolean | undefined
  } | undefined
}

export type Step2BillingMetadata = {
  creditsUsed?: number | undefined
  creditRateCents?: number | undefined
  totalCost?: number | undefined
  source?: 'response-header' | 'fallback-estimate' | 'provider_quote' | 'registry_fallback' | undefined
  mode?: 'url' | 'duration' | 'order' | 'segment_sum' | undefined
}

export type Step2Metadata = {
  transcriptionService: 'whisper' | 'reverb' | 'gcloud' | 'aws' | 'deepgram' | 'deepinfra' | 'deapi' | 'elevenlabs' | 'soniox' | 'speechmatics' | 'rev' | 'groq' | 'mistral' | 'assemblyai' | 'gladia' | 'happyscribe' | 'supadata' | 'openai-stt' | 'gemini-stt' | 'glm-stt' | 'together' | 'fireworks' | 'cloudflare' | 'youtube-captions'
  transcriptionModel: string
  processingTime: number
  tokenCount: number
  captionKind?: 'manual' | 'auto' | undefined
  captionLanguage?: string | undefined
  captionFormat?: 'vtt' | undefined
  timings?: Step2TimingMetadata | undefined
  runtime?: Step2RuntimeMetadata | undefined
  billing?: Step2BillingMetadata | undefined
}

export const GladiaWordSchema = v.object({
  word: v.string(),
  start: v.number(),
  end: v.number(),
  confidence: v.optional(v.number(), undefined),
  speaker: v.optional(v.union([v.string(), v.number()]), undefined)
})

export const GladiaUtteranceSchema = v.object({
  start: v.number(),
  end: v.number(),
  confidence: v.number(),
  channel: v.optional(v.number(), undefined),
  words: v.optional(v.array(GladiaWordSchema), undefined),
  text: v.string(),
  language: v.optional(v.string(), undefined),
  speaker: v.optional(v.union([v.string(), v.number()]), undefined)
})

export const GladiaUploadAudioMetadataSchema = v.object({
  id: v.string(),
  filename: v.string(),
  source: v.optional(v.string(), undefined),
  extension: v.string(),
  size: v.number(),
  audio_duration: v.number(),
  number_of_channels: v.number()
})

export const GladiaUploadResponseSchema = v.object({
  audio_url: v.string(),
  audio_metadata: GladiaUploadAudioMetadataSchema
})

export const GladiaCreateResponseSchema = v.object({
  id: v.string(),
  result_url: v.string()
})

export const GladiaTranscriptionResultSchema = v.looseObject({
  full_transcript: v.optional(v.string(), undefined),
  languages: v.optional(v.array(v.string()), undefined),
  utterances: v.optional(v.array(GladiaUtteranceSchema), undefined)
})

export const GladiaDiarizationResultSchema = v.looseObject({
  results: v.optional(v.array(GladiaUtteranceSchema), undefined)
})

export const GladiaStatusResponseSchema = v.looseObject({
  id: v.string(),
  status: v.picklist(['queued', 'processing', 'done', 'error']),
  request_id: v.optional(v.string(), undefined),
  created_at: v.optional(v.string(), undefined),
  completed_at: v.optional(v.nullable(v.string()), undefined),
  error_code: v.optional(v.nullable(v.number()), undefined),
  message: v.optional(v.string(), undefined),
  result: v.optional(v.nullable(v.looseObject({
    metadata: v.optional(v.looseObject({
      audio_duration: v.optional(v.number(), undefined),
      number_of_distinct_channels: v.optional(v.number(), undefined),
      billing_time: v.optional(v.number(), undefined),
      transcription_time: v.optional(v.number(), undefined)
    }), undefined),
    transcription: v.optional(GladiaTranscriptionResultSchema, undefined),
    diarization: v.optional(GladiaDiarizationResultSchema, undefined)
  })), undefined)
})

export const GoogleCloudWordInfoSchema = v.looseObject({
  startOffset: v.optional(v.string(), undefined),
  endOffset: v.optional(v.string(), undefined),
  word: v.string(),
  confidence: v.optional(v.number(), undefined),
  speakerLabel: v.optional(v.string(), undefined)
})

export const GoogleCloudSpeechAlternativeSchema = v.looseObject({
  transcript: v.optional(v.string(), undefined),
  confidence: v.optional(v.number(), undefined),
  words: v.optional(v.array(GoogleCloudWordInfoSchema), undefined)
})

export const GoogleCloudSpeechResultSchema = v.looseObject({
  languageCode: v.optional(v.string(), undefined),
  alternatives: v.optional(v.array(GoogleCloudSpeechAlternativeSchema), undefined)
})

export const GoogleCloudRecognizeResponseSchema = v.looseObject({
  results: v.optional(v.array(GoogleCloudSpeechResultSchema), undefined),
  metadata: v.optional(v.looseObject({}), undefined)
})

export const MistralTranscriptionSegmentSchema = v.looseObject({
  start: v.number(),
  end: v.number(),
  text: v.string(),
  speakerId: v.optional(v.nullable(v.union([v.string(), v.number()])), undefined),
  speaker_id: v.optional(v.nullable(v.union([v.string(), v.number()])), undefined),
  type: v.optional(v.string(), undefined)
})

export const MistralTranscriptionResponseSchema = v.looseObject({
  model: v.optional(v.string(), undefined),
  text: v.optional(v.string(), undefined),
  language: v.optional(v.nullable(v.string()), undefined),
  segments: v.optional(v.array(MistralTranscriptionSegmentSchema), undefined),
  usage: v.optional(v.looseObject({
    promptAudioSeconds: v.optional(v.nullable(v.number()), undefined),
    prompt_audio_seconds: v.optional(v.nullable(v.number()), undefined)
  }), undefined),
})

export const MistralOcrPageSchema = v.object({
  index: v.number(),
  markdown: v.string()
})

export const MistralOcrResponseSchema = v.object({
  pages: v.array(MistralOcrPageSchema),
  model: v.optional(v.string(), undefined),
  usage_info: v.optional(v.object({
    pages_processed: v.optional(v.number(), undefined),
    doc_size_bytes: v.optional(v.number(), undefined)
  }), undefined)
})

export const GlmOcrLayoutDetailSchema = v.looseObject({
  index: v.number(),
  label: v.string(),
  bbox_2d: v.optional(v.array(v.number()), undefined),
  content: v.optional(v.string(), undefined),
  height: v.optional(v.number(), undefined),
  width: v.optional(v.number(), undefined)
})

export const GlmOcrResponseSchema = v.looseObject({
  id: v.optional(v.string(), undefined),
  created: v.optional(v.number(), undefined),
  model: v.optional(v.string(), undefined),
  md_results: v.string(),
  layout_details: v.optional(v.array(v.array(GlmOcrLayoutDetailSchema)), undefined),
  data_info: v.optional(v.looseObject({
    num_pages: v.optional(v.number(), undefined),
    pages: v.optional(v.array(v.looseObject({
      width: v.optional(v.number(), undefined),
      height: v.optional(v.number(), undefined)
    })), undefined)
  }), undefined),
  usage: v.optional(v.looseObject({
    prompt_tokens: v.optional(v.number(), undefined),
    completion_tokens: v.optional(v.number(), undefined),
    total_tokens: v.optional(v.number(), undefined)
  }), undefined),
  request_id: v.optional(v.string(), undefined)
})

export const WhisperJsonSegmentSchema = v.object({
  timestamps: v.object({
    from: v.string(),
    to: v.string()
  }),
  offsets: v.object({
    from: v.number(),
    to: v.number()
  }),
  text: v.string()
})

export const WhisperJsonOutputSchema = v.object({
  transcription: v.array(WhisperJsonSegmentSchema)
})

export const ReverbWordSchema = v.object({
  word: v.string(),
  start: v.number(),
  end: v.number(),
  speaker: v.optional(v.string(), undefined)
})

export const ReverbSegmentSchema = v.object({
  start: v.number(),
  end: v.number(),
  text: v.string(),
  speaker: v.optional(v.string(), undefined),
  words: v.optional(v.array(ReverbWordSchema), undefined)
})

export const ReverbOutputSchema = v.object({
  segments: v.array(ReverbSegmentSchema),
  text: v.string(),
  speakers: v.optional(v.array(v.string()), undefined)
})

export const ElevenLabsTimestampSchema = v.union([v.number(), v.string()])

export const ElevenLabsWordSchema = v.object({
  text: v.optional(v.string(), undefined),
  word: v.optional(v.string(), undefined),
  start: v.optional(ElevenLabsTimestampSchema, undefined),
  end: v.optional(ElevenLabsTimestampSchema, undefined),
  speaker_id: v.optional(v.union([v.string(), v.number()]), undefined),
  type: v.optional(v.string(), undefined)
})

export const ElevenLabsSegmentSchema = v.object({
  text: v.optional(v.string(), undefined),
  start: v.optional(ElevenLabsTimestampSchema, undefined),
  end: v.optional(ElevenLabsTimestampSchema, undefined),
  speaker_id: v.optional(v.union([v.string(), v.number()]), undefined)
})

export const ElevenLabsSttResponseSchema = v.object({
  text: v.optional(v.string(), undefined),
  words: v.optional(v.array(ElevenLabsWordSchema), undefined),
  segments: v.optional(v.array(ElevenLabsSegmentSchema), undefined)
})

export const AssemblyAiUtteranceSchema = v.object({
  confidence: v.number(),
  start: v.number(),
  end: v.number(),
  text: v.string(),
  speaker: v.string(),
  channel: v.optional(v.string(), undefined)
})

export const AssemblyAiWordSchema = v.object({
  confidence: v.number(),
  start: v.number(),
  end: v.number(),
  text: v.string(),
  speaker: v.optional(v.string(), undefined)
})

export const AssemblyAiTranscriptResponseSchema = v.object({
  id: v.string(),
  status: v.string(),
  text: v.optional(v.nullable(v.string()), undefined),
  utterances: v.optional(v.nullable(v.array(AssemblyAiUtteranceSchema)), undefined),
  words: v.optional(v.nullable(v.array(AssemblyAiWordSchema)), undefined),
  error: v.optional(v.nullable(v.string()), undefined)
})

export const DeepgramWordSchema = v.object({
  word: v.optional(v.string(), undefined),
  punctuated_word: v.optional(v.string(), undefined),
  start: v.optional(v.number(), undefined),
  end: v.optional(v.number(), undefined),
  speaker: v.optional(v.number(), undefined)
})

export const DeepgramAlternativeSchema = v.object({
  transcript: v.optional(v.string(), undefined),
  words: v.optional(v.array(DeepgramWordSchema), undefined)
})

export const DeepgramChannelSchema = v.object({
  alternatives: v.optional(v.array(DeepgramAlternativeSchema), undefined)
})

export const DeepgramUtteranceSchema = v.object({
  start: v.number(),
  end: v.number(),
  transcript: v.string(),
  speaker: v.number(),
  words: v.optional(v.array(DeepgramWordSchema), undefined)
})

export const DeepgramResponseSchema = v.object({
  results: v.object({
    channels: v.array(DeepgramChannelSchema),
    utterances: v.optional(v.array(DeepgramUtteranceSchema), undefined)
  })
})

export const SonioxFileResponseSchema = v.object({
  id: v.string()
})

export const SonioxTranscriptionStatusSchema = v.object({
  id: v.string(),
  status: v.picklist(['queued', 'processing', 'completed', 'error']),
  model: v.optional(v.string(), undefined),
  filename: v.optional(v.string(), undefined),
  enable_speaker_diarization: v.optional(v.boolean(), undefined),
  enable_language_identification: v.optional(v.boolean(), undefined),
  audio_duration_ms: v.optional(v.nullable(v.number()), undefined),
  error_type: v.optional(v.nullable(v.string()), undefined),
  error_message: v.optional(v.nullable(v.string()), undefined)
})

export const SonioxTranscriptTokenSchema = v.object({
  text: v.string(),
  start_ms: v.optional(v.number(), undefined),
  end_ms: v.optional(v.number(), undefined),
  confidence: v.optional(v.number(), undefined),
  speaker: v.optional(v.nullable(v.union([v.string(), v.number()])), undefined),
  language: v.optional(v.nullable(v.string()), undefined),
  is_audio_event: v.optional(v.nullable(v.boolean()), undefined),
  translation_status: v.optional(v.nullable(v.string()), undefined)
})

export const SonioxTranscriptResponseSchema = v.object({
  id: v.string(),
  text: v.string(),
  tokens: v.array(SonioxTranscriptTokenSchema)
})

export const RevJobSchema = v.object({
  id: v.string(),
  status: v.picklist(['in_progress', 'transcribed', 'failed']),
  failure: v.optional(v.string(), undefined),
  failure_detail: v.optional(v.string(), undefined)
})

export const RevTranscriptElementSchema = v.object({
  type: v.picklist(['text', 'punct']),
  value: v.string(),
  ts: v.optional(v.number(), undefined),
  end_ts: v.optional(v.number(), undefined),
  confidence: v.optional(v.number(), undefined)
})

export const RevTranscriptMonologueSchema = v.object({
  speaker: v.number(),
  elements: v.array(RevTranscriptElementSchema)
})

export const RevTranscriptResponseSchema = v.object({
  monologues: v.array(RevTranscriptMonologueSchema)
})

export const SpeechmaticsJobErrorSchema = v.object({
  type: v.optional(v.string(), undefined),
  message: v.optional(v.string(), undefined)
})

export const SpeechmaticsJobSchema = v.object({
  id: v.string(),
  status: v.picklist(['running', 'done', 'rejected']),
  created_at: v.optional(v.string(), undefined),
  duration: v.optional(v.number(), undefined),
  data_name: v.optional(v.string(), undefined),
  error: v.optional(v.string(), undefined),
  errors: v.optional(v.array(SpeechmaticsJobErrorSchema), undefined)
})

export const SpeechmaticsJobResponseSchema = v.object({
  job: SpeechmaticsJobSchema
})

export const SpeechmaticsCreateJobResponseSchema = v.union([
  v.object({
    id: v.string()
  }),
  SpeechmaticsJobResponseSchema
])

export const SpeechmaticsTranscriptJobSchema = v.object({
  id: v.string(),
  created_at: v.optional(v.string(), undefined),
  duration: v.optional(v.number(), undefined),
  data_name: v.optional(v.string(), undefined)
})

export const SpeechmaticsTranscriptAlternativeSchema = v.object({
  content: v.string(),
  confidence: v.optional(v.number(), undefined),
  language: v.optional(v.string(), undefined),
  speaker: v.optional(v.string(), undefined)
})

export const SpeechmaticsTranscriptResultSchema = v.object({
  type: v.string(),
  start_time: v.number(),
  end_time: v.number(),
  is_eos: v.optional(v.boolean(), undefined),
  channel: v.optional(v.string(), undefined),
  alternatives: v.array(SpeechmaticsTranscriptAlternativeSchema)
})

export const SpeechmaticsTranscriptResponseSchema = v.object({
  format: v.optional(v.string(), undefined),
  job: v.optional(SpeechmaticsTranscriptJobSchema, undefined),
  results: v.array(SpeechmaticsTranscriptResultSchema)
})

export type GladiaStatusResponse = v.InferOutput<typeof GladiaStatusResponseSchema>
export type DeepgramResponse = v.InferOutput<typeof DeepgramResponseSchema>

export const LlamaResponseSchema = v.object({
  choices: v.array(v.object({
    message: v.object({
      content: v.string()
    })
  })),
  usage: v.optional(v.object({
    prompt_tokens: v.number(),
    completion_tokens: v.number(),
    total_tokens: v.number()
  }), undefined)
})

export type Step3Metadata = {
  llmService: 'llama.cpp' | 'openai' | 'groq' | 'gemini' | 'anthropic' | 'minimax' | 'grok'
  llmModel: string
  processingTime: number
  inputTokenCount: number
  outputTokenCount: number
  outputFileName: string
  outputFormat: 'json'
  structuredMode: 'native' | 'schema-guided'
  structuredPresetNames: string[]
}

export type Step4Metadata = {
  ttsService: TtsProvider
  ttsModel: string
  speaker?: string
  language?: string
  processingTime: number
  audioFileName: string
  audioFileSize: number
  chunkCount: number
}

export const TtsScriptOutputSchema = v.object({
  sampleRate: v.number(),
  chunkCount: v.number(),
  durationSeconds: v.number()
})

export type Step5Metadata = {
  imageService: ImageProvider
  imageModel: string
  processingTime: number
  imageFileNames: string[]
  imageCount: number
  imageFileSize: number
  imageWidth: number | undefined
  imageHeight: number | undefined
}

export type Step6VideoMetadata = {
  videoGenService: VideoProvider
  videoGenModel: string
  processingTime: number
  videoFileName: string
  videoFileSize: number
  videoDuration: number | undefined
}

export type Step7MusicMetadata = {
  musicService: MusicProvider
  musicModel: string
  processingTime: number
  musicFileName: string
  musicFileSize: number
  musicDurationMs: number | undefined
  lyricsSource: 'provided' | 'generated' | 'none'
}

export type TimingStepEntry = {
  step: 'stt' | 'extract' | 'llm' | 'tts' | 'image' | 'video' | 'music'
  provider: string
  model: string
  processingTimeMs: number
  inputMetric?: string
  inputValue?: number
}
