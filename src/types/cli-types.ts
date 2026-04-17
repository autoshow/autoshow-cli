export const PROCESS_COMMANDS = ['metadata', 'download', 'stt', 'write', 'ocr', 'tts', 'image', 'music', 'video'] as const
export const PROCESS_COMMAND_ALIASES = ['transcribe', 'extract'] as const

export type CanonicalProcessCommand = typeof PROCESS_COMMANDS[number]
export type ProcessCommand = CanonicalProcessCommand | typeof PROCESS_COMMAND_ALIASES[number]

export const isSttCommand = (command: ProcessCommand): command is 'stt' | 'transcribe' =>
  command === 'stt' || command === 'transcribe'

export const isOcrCommand = (command: ProcessCommand): command is 'ocr' | 'extract' =>
  command === 'ocr' || command === 'extract'

export const canonicalizeProcessCommand = (command: ProcessCommand): CanonicalProcessCommand => {
  if (isSttCommand(command)) return 'stt'
  if (isOcrCommand(command)) return 'ocr'
  return command
}

export type OutputFormat = 'text' | 'json' | 'tsv' | 'hocr'

export type BatchOrder = 'newest' | 'oldest'

export type RuntimeOptions = {
  provider: string[] | undefined
  useReverb: boolean
  whisperExplicit: boolean
  useOpenAI: boolean
  useGemini: boolean
  useAnthropic: boolean
  llamaModel: string | undefined
  openaiModel: string | undefined
  groqModel: string | undefined
  geminiModel: string | undefined
  anthropicModel: string | undefined
  minimaxModel: string | undefined
  grokModel: string | undefined
  whisperModel: string
  groqSttModel: string | undefined
  elevenlabsSttModel: string | undefined
  sonioxSttModel: string | undefined
  revSttModel: string | undefined
  openaiSttModel: string | undefined
  mistralSttModel: string | undefined
  assemblyaiSttModel: string | undefined
  gladiaSttModel: string | undefined
  speechmaticsSttModel: string | undefined
  deepgramSttModel: string | undefined
  diarizationSpeakerCount: number | undefined
  diarizationSpeakerNames: string[] | undefined
  diarizationSpeakerReferences: string[] | undefined
  sttProviderConcurrency: number
  sttLocalConcurrency: number
  sttSegmentConcurrency: number
  sttPreflightConcurrency: number
  resumeMissing: string | undefined
  refreshCache: boolean
  noCache: boolean
  price: boolean
  allowOverBudget: boolean
  reverbVerbatimicity: number
  split: boolean
  skipLLM: boolean
  structured: boolean
  structuredStrict: boolean
  structuredCompatRetries: number
  dpi: number
  lang: string
  psm: number
  oem: number
  out: OutputFormat
  password: string | undefined
  pageSeparator: string | undefined
  preserveSpaces: boolean
  rotate: number
  useOcrmypdf: boolean
  usePaddleOcr: boolean
  mistralOcrModel: string | undefined
  glmOcrModel: string | undefined
  useEpubBun: boolean
  useEpubCalibre: boolean
  urlBackend: 'defuddle' | 'firecrawl' | 'glm-reader'
  urlBackendExplicit: boolean

  batchLimit: number
  batchAll: boolean
  batchOrder: BatchOrder
  batchConcurrency: number
  keepOriginalMedia: boolean
  flatBatch: boolean

  ttsSpeaker: string

  prompts: string[]

  kittenTtsModel: string | undefined
  groqTtsModel: string | undefined
  groqVoiceId: string | undefined
  openaiTtsModel: string | undefined
  openaiVoiceId: string | undefined
  geminiTtsModel: string | undefined
  geminiVoiceId: string | undefined
  elevenlabsTtsModel: string | undefined
  elevenlabsVoiceId: string | undefined
  minimaxTtsModel: string | undefined
  minimaxTtsVoice: string | undefined
  geminiImageModel: string | undefined
  openaiImageModel: string | undefined
  minimaxImageModel: string | undefined
  imageAspectRatio: string | undefined
  imageSize: string | undefined
  imageQuality: string | undefined
  imageFormat: string | undefined
  imageBackground: string | undefined
  imagenCount: number | undefined

  elevenlabsMusicModel: string | undefined
  minimaxMusicModel: string | undefined
  musicDuration: number | undefined
  musicLyricsFile: string | undefined
  musicInstrumental: boolean | undefined

  geminiVideoModel: string | undefined
  minimaxVideoModel: string | undefined
  videoDuration: number | undefined
  videoSize: string | undefined
  videoAspectRatio: string | undefined
  videoResolution: string | undefined

  markdown: boolean
  save: boolean
}
