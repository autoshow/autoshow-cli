import * as v from 'valibot'
import type { OutputFormat } from './cli-types'
import type { ImageProvider, MusicProvider, TtsProvider, VideoProvider } from './provider-types'

export const ProcessingOptionsSchema = v.pipe(
  v.object({
    url: v.optional(v.pipe(v.string(), v.url()), undefined),
    filePath: v.optional(v.string(), undefined),
    whisperModel: v.string(),
    groqSttModel: v.optional(v.string(), undefined),
    elevenlabsSttModel: v.optional(v.string(), undefined),
    openaiSttModel: v.optional(v.string(), undefined),
    mistralSttModel: v.optional(v.string(), undefined),
    assemblyaiSttModel: v.optional(v.string(), undefined),
    diarizationSpeakerCount: v.optional(v.number(), undefined),
    diarizationSpeakerNames: v.optional(v.array(v.string()), undefined),
    diarizationSpeakerReferences: v.optional(v.array(v.string()), undefined),
    llamaModel: v.optional(v.string(), undefined),
    openaiModel: v.optional(v.string(), undefined),
    groqModel: v.optional(v.string(), undefined),
    geminiModel: v.optional(v.string(), undefined),
    anthropicModel: v.optional(v.string(), undefined),
    minimaxModel: v.optional(v.string(), undefined),
    grokModel: v.optional(v.string(), undefined),
    outputDir: v.string(),
    useReverb: v.optional(v.boolean(), undefined),
    reverbVerbatimicity: v.optional(v.number(), undefined),
    split: v.optional(v.boolean(), undefined),
    useOpenAI: v.optional(v.boolean(), undefined),
    useGemini: v.optional(v.boolean(), undefined),
    useAnthropic: v.optional(v.boolean(), undefined),
    skipLLM: v.optional(v.boolean(), undefined),
    structured: v.optional(v.boolean(), undefined),
    structuredStrict: v.optional(v.boolean(), undefined),
    structuredCompatRetries: v.optional(v.number(), undefined),
    

    directDownload: v.optional(v.boolean(), undefined),

    prompts: v.optional(v.array(v.string()), undefined),

    ttsSpeaker: v.optional(v.string(), undefined),
    groqTtsModel: v.optional(v.string(), undefined),
    groqVoiceId: v.optional(v.string(), undefined),
    openaiTtsModel: v.optional(v.string(), undefined),
    openaiVoiceId: v.optional(v.string(), undefined),
    geminiTtsModel: v.optional(v.string(), undefined),
    geminiVoiceId: v.optional(v.string(), undefined),
    elevenlabsTtsModel: v.optional(v.string(), undefined),
    elevenlabsVoiceId: v.optional(v.string(), undefined),
    minimaxTtsModel: v.optional(v.string(), undefined),
    minimaxTtsVoice: v.optional(v.string(), undefined),

    kittenTtsModel: v.optional(v.string(), undefined),

    geminiImageModel: v.optional(v.string(), undefined),
    openaiImageModel: v.optional(v.string(), undefined),
    minimaxImageModel: v.optional(v.string(), undefined),
    imageAspectRatio: v.optional(v.string(), undefined),
    imageSize: v.optional(v.string(), undefined),
    imageQuality: v.optional(v.string(), undefined),
    imageFormat: v.optional(v.string(), undefined),
    imageBackground: v.optional(v.string(), undefined),
    imagenCount: v.optional(v.number(), undefined),

    elevenlabsMusicModel: v.optional(v.string(), undefined),
    minimaxMusicModel: v.optional(v.string(), undefined),
    musicDuration: v.optional(v.number(), undefined),
    musicLyricsFile: v.optional(v.string(), undefined),
    musicInstrumental: v.optional(v.boolean(), undefined),

    geminiVideoModel: v.optional(v.string(), undefined),
    minimaxVideoModel: v.optional(v.string(), undefined),
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

export const YtDlpVideoInfoSchema = v.object({
  title: v.optional(v.string(), undefined),
  duration: v.optional(v.number(), undefined),
  uploader: v.optional(v.string(), undefined),
  channel: v.optional(v.string(), undefined),
  channel_url: v.optional(v.string(), undefined),
  description: v.optional(v.string(), undefined),
  upload_date: v.optional(v.string(), undefined),
  thumbnail: v.optional(v.string(), undefined),
  chapters: v.optional(v.array(YtDlpChapterSchema), undefined)
})

export type ProcessingOptions = v.InferOutput<typeof ProcessingOptionsSchema>
export type VideoMetadata = v.InferOutput<typeof VideoMetadataSchema>
export type YtDlpVideoInfo = v.InferOutput<typeof YtDlpVideoInfoSchema>

export type DetectResult =
  | 'pdf' | 'epub' | 'docx' | 'pptx' | 'xlsx' | 'odf'
  | 'mobi' | 'azw3' | 'fb2' | 'lit' | 'cbz' | 'rtf' | 'csv'
  | 'png' | 'jpg' | 'tif' | 'webp' | 'bmp' | 'gif'
  | null

export type MutoolDocInfo = {
  pageCount: number
  title?: string
  author?: string
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
  preserveInterwordSpaces: v.optional(v.boolean(), false),
  rotate: v.optional(v.number(), 0),
  useOcrmypdf: v.optional(v.boolean(), undefined),
  usePaddleOcr: v.optional(v.boolean(), undefined),
  mistralOcrModel: v.optional(v.string(), undefined),
  useEpubBun: v.optional(v.boolean(), undefined),
  useEpubCalibre: v.optional(v.boolean(), undefined)
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

export type ExtractOcrEngine = 'tesseract' | 'ocrmypdf' | 'paddle-ocr' | 'mistral-ocr'

export type EpubInspectEngine = 'bun' | 'calibre'
export type EpubInspection = Record<string, unknown>
const EpubInspectionSchema = v.record(v.string(), v.unknown())

export const ExtractionMetadataSchema = v.object({
  extractionMethod: v.picklist([
    'docx', 'pptx', 'xlsx', 'odf', 'tesseract', 'mutool+tesseract', 'paddle-ocr', 'mutool+paddle-ocr', 'ocrmypdf', 'mistral-ocr', 'epub-bun', 'epub-calibre',
    'epub-text',
    'pdf-text', 'pdf+tesseract', 'pdf+ocrmypdf', 'pdf+paddle-ocr', 'pdf+mistral-ocr',
    'office-native', 'office+tesseract', 'office+ocrmypdf', 'office+paddle-ocr', 'office+mistral-ocr',
    'rtf+tesseract', 'rtf+ocrmypdf', 'rtf+paddle-ocr', 'rtf+mistral-ocr',
    'cbz+tesseract', 'cbz+paddle-ocr', 'cbz+ocrmypdf', 'cbz+mistral-ocr',
    'csv-raw',
    'image+tesseract', 'image+ocrmypdf', 'image+paddle-ocr', 'image+mistral-ocr'
  ]),
  totalPages: v.number(),
  ocrPages: v.number(),
  textPages: v.number(),
  processingTime: v.number(),
  dpi: v.number(),
  languages: v.string(),
  tokenEstimate: v.number(),
  ocrModel: v.optional(v.string(), undefined),
  epub: v.optional(EpubInspectionSchema, undefined),
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
  author: v.optional(v.string(), undefined),
  pageCount: v.number(),
  format: v.picklist([
    'pdf', 'epub', 'png', 'jpg', 'tif', 'docx', 'pptx', 'xlsx', 'odf',
    'mobi', 'azw3', 'fb2', 'lit', 'cbz', 'rtf', 'csv', 'webp', 'bmp', 'gif'
  ]),
  fileSize: v.number(),
  sourceFormat: v.optional(v.string(), undefined),
  normalizedFormat: v.optional(v.string(), undefined),
  conversionChain: v.optional(v.array(v.string()), undefined),
  metadataSchemaVersion: v.optional(v.number(), undefined)
})

export type InternalPage = {
  pageNumber: number
  text: string
  needsOcr: boolean
}

export type PreparedDocument = {
  outputDir: string
  step1Metadata: DocumentMetadata
  effectiveFilePath?: string
  tempCleanup?: () => Promise<void>
}

export type ProcessDocumentOutput = {
  result: ExtractionResult
  step1Metadata: DocumentMetadata
  step2Metadata: ExtractionMetadata
  outputDir: string
}

export type ExtractionOptions = v.InferOutput<typeof ExtractionOptionsSchema>
export type PageResult = v.InferOutput<typeof PageResultSchema>
export type ExtractionResult = v.InferOutput<typeof ExtractionResultSchema>
export type ExtractionMetadata = v.InferOutput<typeof ExtractionMetadataSchema>
export type DocumentMetadata = v.InferOutput<typeof DocumentMetadataSchema>

export type { OutputFormat as OcrOutputFormat }

export type OcrResult = {
  text: string
  confidence?: number
}

export type TranscriptionSegment = {
  start: string
  end: string
  text: string
  speaker?: string | undefined
}

export type TranscriptionResult = {
  text: string
  segments: TranscriptionSegment[]
}

export type DiarizationOptions = {
  speakerCount?: number | undefined
  knownSpeakerNames?: string[] | undefined
  knownSpeakerReferencePaths?: string[] | undefined
}

export type Step2Metadata = {
  transcriptionService: 'whisper' | 'reverb' | 'elevenlabs' | 'groq' | 'openai' | 'mistral' | 'assemblyai'
  transcriptionModel: string
  transcriptionModelName?: string | undefined
  processingTime: number
  tokenCount: number
}

export const MistralTranscriptionSegmentSchema = v.object({
  start: v.number(),
  end: v.number(),
  text: v.string(),
  speaker_id: v.optional(v.union([v.string(), v.number()]), undefined),
  type: v.optional(v.string(), undefined),
  additionalProperties: v.optional(v.record(v.string(), v.unknown()), undefined)
})

export const MistralTranscriptionResponseSchema = v.object({
  model: v.optional(v.string(), undefined),
  text: v.optional(v.string(), undefined),
  language: v.optional(v.nullable(v.string()), undefined),
  segments: v.optional(v.array(MistralTranscriptionSegmentSchema), undefined),
  usage: v.optional(v.object({
    promptAudioSeconds: v.optional(v.number(), undefined),
    additionalProperties: v.optional(v.record(v.string(), v.unknown()), undefined)
  }), undefined),
  additionalProperties: v.optional(v.record(v.string(), v.unknown()), undefined)
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

export type WhisperJsonOutput = v.InferOutput<typeof WhisperJsonOutputSchema>
export type ElevenLabsSttResponse = v.InferOutput<typeof ElevenLabsSttResponseSchema>
export type AssemblyAiTranscriptResponse = v.InferOutput<typeof AssemblyAiTranscriptResponseSchema>

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
  outputFormat: 'json' | 'markdown'
  structuredMode: 'native' | 'compat' | 'off'
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
  imageCount: number
  imageFileName: string
  imageFileNames: string[]
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

export type StepCostEntry = {
  step: 'stt' | 'extract' | 'llm' | 'tts' | 'image' | 'video' | 'music'
  provider: string
  model: string
  cost: number
  inputMetric?: string
  inputValue?: number
}

export type ActualCostBreakdown = {
  totalCost: number
  steps: StepCostEntry[]
}

export type EstimatedStepEntry = {
  step: 'stt' | 'extract' | 'llm' | 'tts' | 'image' | 'video' | 'music'
  provider: string
  model: string
  cost: number
  costMultiplier?: number
  durationSeconds?: number
  inputCostPer1MCents?: number
  outputCostPer1MCents?: number
  estimatedInputTokens?: number
  estimatedOutputTokens?: number
  costPer1kCharactersCents?: number
  inputCostPer1MCharactersCents?: number
  outputCostPer1MCharactersCents?: number
}

export type EstimatedCostBreakdown = {
  totalCost: number
  steps: EstimatedStepEntry[]
}

export type TimingStepEntry = {
  step: 'stt' | 'extract' | 'llm' | 'tts' | 'image' | 'video' | 'music'
  provider: string
  model: string
  processingTimeMs: number
  inputMetric?: string
  inputValue?: number
}

export type EstimatedTimingBreakdown = {
  totalProcessingTimeMs: number
  steps: TimingStepEntry[]
}

export type ActualTimingBreakdown = {
  totalProcessingTimeMs: number
  steps: TimingStepEntry[]
}

export type TimingBreakdown = {
  estimated: EstimatedTimingBreakdown
  actual: ActualTimingBreakdown
}

export type CostBreakdown = {
  estimated: EstimatedCostBreakdown
  actual: ActualCostBreakdown
}
