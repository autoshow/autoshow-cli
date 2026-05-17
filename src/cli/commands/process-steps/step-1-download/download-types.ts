import type {
  AggregatedPriceEstimate,
  BatchItem,
  BatchSource,
  DocumentMetadata,
  ExtractionMetadata,
  ExtractRoute,
  InputFamily,
  ProcessCommand,
  PlannedBatchInput,
  PreparedDocument,
  ResolvedBatch,
  ResolvedStep2Execution,
  RuntimeOptions,
  Step3Metadata,
  WebArticleMetadata
} from '~/types'

export type DownloadAudioOptions = {
  url?: string | undefined
  filePath?: string | undefined
  outputDir: string
  directDownload?: boolean | undefined
  keepOriginalMedia?: boolean | undefined
  bestQuality?: boolean | undefined
  ytDlpPassthroughArgs?: string[] | undefined
}

export type Step1SourceRef = {
  url?: string
  filePath?: string
}

export type AudioDownloadSource = 'yt-dlp' | 'direct-audio-url' | 'direct-media-url'
export type AudioDownloadStatus = 'started' | 'downloaded'

export type AudioDownloadSummary = {
  source: AudioDownloadSource
  status: AudioDownloadStatus
  target: string
  detail?: string
}

export type AudioNormalizeSummary = {
  status: 'planned'
  inputPath: string
  outputPath: string
  plan: NormalizedAudioPlan
}

export type YtDlpAuthMode = 'cookies-file' | 'cookies-from-browser' | 'none'

export type YtDlpListOptions = {
  limit?: number
  all?: boolean
  order?: 'newest' | 'oldest'
}

export type BatchOrder = 'newest' | 'oldest'
export type TopLevelTargetKind = 'directory' | 'input_list' | 'single'
export type Step2Route = 'stt' | 'ocr' | 'article' | 'native-document' | 'unsupported'

export type BatchOptions = {
  limit: number
  all: boolean
  order: BatchOrder
}

export type FfprobeStream = {
  index?: unknown
  codec_type?: unknown
  codec_name?: unknown
  sample_rate?: unknown
  channels?: unknown
  bit_rate?: unknown
  disposition?: unknown
}

export type FfprobeFormat = {
  format_name?: unknown
  duration?: unknown
  bit_rate?: unknown
}

export type FfprobePayload = {
  streams?: unknown
  format?: unknown
}

export type NormalizedAudioExtension = '.mp3' | '.m4a' | '.ogg' | '.flac'
export type NormalizedAudioFormat = 'mp3' | 'ipod' | 'ogg' | 'flac'
export type AudioNormalizationMode = 'copy-file' | 'copy-stream' | 'transcode-aac' | 'transcode-mp3' | 'transcode-flac'
export type AudioNormalizationProfile = 'default' | 'hosted-stt' | 'hosted-stt-mp3'

export type AudioStreamProbe = {
  index: number
  codecName: string
  sampleRate?: number | undefined
  channels?: number | undefined
  bitRate?: number | undefined
}

export type MediaProbe = {
  formatNames: string[]
  durationSeconds?: number | undefined
  bitRate?: number | undefined
  hasVideo: boolean
  hasNonAudioStreams: boolean
  audioStreamCount: number
  audioStream: AudioStreamProbe
}

export type NormalizedAudioPlan = {
  profile: AudioNormalizationProfile
  mode: AudioNormalizationMode
  outputExtension: NormalizedAudioExtension
  outputFormat: NormalizedAudioFormat
  outputCodecName: string
  sourceCodecName: string
  reason: string
  stripMetadata: boolean
  stripChapters: boolean
  targetBitRate?: number | undefined
  targetSampleRate?: number | undefined
  targetChannels?: number | undefined
}

export type PreparedDocumentMetadata = Pick<PreparedDocument, 'step1Metadata' | 'effectiveFilePath' | 'tempCleanup'>

export type DocFormat =
  | 'pdf' | 'epub' | 'png' | 'jpg' | 'tif' | 'docx' | 'pptx' | 'xlsx' | 'odf'
  | 'mobi' | 'azw3' | 'fb2' | 'lit' | 'cbz' | 'rtf' | 'csv' | 'webp' | 'bmp' | 'gif'
  | 'html'

export type MutoolDocInfo = {
  pageCount: number
  title?: string
  author?: string
}

export type TopLevelTargetInfo = {
  kind: TopLevelTargetKind
  exists: boolean
  isDirectory: boolean
  isFile: boolean
}

export type BatchItemProcessResult = {
  outputDir?: string
  manifestEntry?: Record<string, unknown>
}

export type BatchItemProcessor = (
  command: ProcessCommand,
  item: string,
  batchDir: string,
  opts: RuntimeOptions,
  batchItem?: BatchItem
) => Promise<BatchItemProcessResult | void>

export type InputKind =
  | 'url_streaming'
  | 'url_direct_media'
  | 'url_direct_document'
  | 'url_html_article'
  | 'url_x_space'
  | 'local_media'
  | 'local_document'

export type ParsedEpisode = {
  id: string | undefined
  enclosureUrl: string
  title: string | undefined
  pubDate: string | undefined
  duration: string | undefined
}

export type ParsedFeed = {
  title: string | undefined
  link: string | undefined
  author: string | undefined
  image: string | undefined
  episodes: ParsedEpisode[]
}

export type ResolvedInputRouting = {
  family: InputFamily
  step2Route: Step2Route
  resolvedStep2: ResolvedStep2Execution
  extractRoute?: ExtractRoute | undefined
  supported: boolean
  skipReason?: string | undefined
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

export type BuildOptsDefaults = {
  defaultTtsEngine?: 'kitten'
}

export type RepeatableModelFlag =
  | 'whisper-stt'
  | 'gcloud-stt'
  | 'aws-stt'
  | 'deepinfra-stt'
  | 'deapi-stt'
  | 'groq-stt'
  | 'grok-stt'
  | 'elevenlabs-stt'
  | 'deepgram-stt'
  | 'soniox-stt'
  | 'speechmatics-stt'
  | 'rev-stt'
  | 'mistral-stt'
  | 'assemblyai-stt'
  | 'gladia-stt'
  | 'happyscribe-stt'
  | 'supadata-stt'
  | 'scrapecreators-stt'
  | 'openai-stt'
  | 'gemini-stt'
  | 'glm-stt'
  | 'together-stt'
  | 'mistral-ocr'
  | 'glm-ocr'
  | 'kimi-ocr'
  | 'openai-ocr'
  | 'anthropic-ocr'
  | 'gemini-ocr'
  | 'deepinfra-ocr'
  | 'aws-textract'
  | 'gcloud-docai'
  | 'llama'
  | 'openai'
  | 'groq'
  | 'gemini'
  | 'anthropic'
  | 'minimax'
  | 'grok'
  | 'glm'
  | 'kimi'
  | 'kitten-tts'
  | 'elevenlabs-tts'
  | 'deepgram-tts'
  | 'minimax-tts'
  | 'groq-tts'
  | 'grok-tts'
  | 'mistral-tts'
  | 'openai-tts'
  | 'gemini-tts'
  | 'speechify-tts'
  | 'gcloud-tts'
  | 'deapi-tts'
  | 'gemini-image'
  | 'openai-image'
  | 'minimax-image'
  | 'glm-image'
  | 'grok-image'
  | 'runway-image'
  | 'bfl-image'
  | 'deapi-image'
  | 'elevenlabs-music'
  | 'minimax-music'
  | 'deapi-music'
  | 'gemini-music'
  | 'gemini-video'
  | 'minimax-video'
  | 'glm-video'
  | 'grok-video'
  | 'runway-video'
  | 'deapi-video'

export type FlagOccurrenceValue = string | boolean

export type AllShortcutFlag =
  | 'all-stt'
  | 'all-ocr'
  | 'all-url'
  | 'all-llm'
  | 'all-tts'
  | 'all-image'
  | 'all-video'
  | 'all-music'

export type ResolvedProcessTargetPlan =
  | { kind: 'directory', targets: string[] }
  | { kind: 'input_list', resolvedBatch: ResolvedBatch }
  | { kind: 'resolved_batch', resolvedBatch: ResolvedBatch }
  | { kind: 'youtube_collection', targets: string[] }
  | { kind: 'single', target: string }

export type BatchExecutionPlan = {
  label: string
  items: string[]
  selectedItems?: Array<BatchItem | undefined>
  initialEntries: Record<string, unknown>[]
  resultEntryIndexes: number[]
  plannedInputs: PlannedBatchInput[]
  source?: BatchSource
  totalCount?: number
}

export type ExtractChildBatchPlan = {
  route: ExtractRoute
  items: string[]
  selectedItems?: Array<BatchItem | undefined>
  initialEntries: Record<string, unknown>[]
  resultEntryIndexes: number[]
  parentIndexes: number[]
}

export type ExtractHtmlToMarkdownInput = {
  html: string
  documentUrl: string
  sourceUrl?: string
  finalUrl?: string
}

export type ExtractHtmlToMarkdownResult = {
  markdown: string
  web: WebArticleMetadata
  title?: string
  author?: string
}

export type WriteDocumentOutputMetadataOptions = {
  step1: DocumentMetadata
  step2: ExtractionMetadata | ExtractionMetadata[]
  step3: Step3Metadata | Step3Metadata[]
  preflightEstimate?: AggregatedPriceEstimate | undefined
  mistralOcrModel: string | undefined
  glmOcrModel: string | undefined
  kimiOcrModel: string | undefined
  openaiOcrModel: string | undefined
  anthropicOcrModel: string | undefined
  geminiOcrModel: string | undefined
  deepinfraOcrModel: string | undefined
  llmService: string
  llmModel: string
  llmInputTokenCount: number
  llmOutputTokenCount: number
  artifactFiles: Record<string, string>
  completionStatus?: 'full' | 'incomplete' | 'failed' | undefined
  requestedProviders?: Array<{ service: string, model: string }> | undefined
  providerStates?: Array<Record<string, unknown>> | undefined
  missingProviders?: Array<{ service: string, model: string }> | undefined
  web?: WebArticleMetadata | undefined
  errors?: Array<{ service: string, model: string, message: string }> | undefined
}

export type BatchManifestEntry = Record<string, unknown>

export type BatchManifestErrorEntry = {
  service?: string
  model?: string
  message?: string
  skipped?: boolean
}

export type SttManifestProviderStatus = 'succeeded' | 'missing' | 'failed' | 'skipped'

export type SttManifestProviderSummary = {
  label: string
  status: SttManifestProviderStatus
  message?: string
}

export type SttBatchItemSummary = {
  label: string
  completionStatus: 'full' | 'incomplete' | 'failed' | 'skipped'
  providers: SttManifestProviderSummary[]
}
