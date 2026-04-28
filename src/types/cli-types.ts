import type { BatchOrder } from '../cli/commands/process-steps/step-1-download/download-types'

export const PROCESS_COMMANDS = ['metadata', 'download', 'extract', 'write', 'tts', 'image', 'music', 'video'] as const

export type CanonicalProcessCommand = typeof PROCESS_COMMANDS[number]
export type ProcessCommand = CanonicalProcessCommand | 'stt' | 'ocr'

export type OutputFormat = 'text' | 'json' | 'tsv' | 'hocr'

export type Step2ProviderSelectionOrigin = 'default' | 'explicit' | 'all-shortcut'

export type RuntimeOptions = {
  useReverb: boolean
  youtubeCaptions: boolean
  whisperExplicit: boolean
  step2SelectionOrigins: Partial<Record<string, Step2ProviderSelectionOrigin>>
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
  whisperModels: string[] | undefined
  whisperModel: string
  gcloudSttModels: string[] | undefined
  gcloudSttModel: string | undefined
  awsSttModels: string[] | undefined
  awsSttModel: string | undefined
  awsRegion: string | undefined
  awsBucket: string | undefined
  deepinfraSttModels: string[] | undefined
  deepinfraSttModel: string | undefined
  deapiSttModels: string[] | undefined
  deapiSttModel: string | undefined
  groqSttModels: string[] | undefined
  groqSttModel: string | undefined
  elevenlabsSttModels: string[] | undefined
  elevenlabsSttModel: string | undefined
  sonioxSttModels: string[] | undefined
  sonioxSttModel: string | undefined
  revSttModels: string[] | undefined
  revSttModel: string | undefined
  mistralSttModels: string[] | undefined
  mistralSttModel: string | undefined
  assemblyaiSttModels: string[] | undefined
  assemblyaiSttModel: string | undefined
  gladiaSttModels: string[] | undefined
  gladiaSttModel: string | undefined
  happyscribeSttModels: string[] | undefined
  happyscribeSttModel: string | undefined
  happyscribeOrganizationId: string | undefined
  supadataSttModels: string[] | undefined
  supadataSttModel: string | undefined
  openaiSttModels: string[] | undefined
  openaiSttModel: string | undefined
  geminiSttModels: string[] | undefined
  geminiSttModel: string | undefined
  glmSttModels: string[] | undefined
  glmSttModel: string | undefined
  togetherSttModels: string[] | undefined
  togetherSttModel: string | undefined
  fireworksSttModels: string[] | undefined
  fireworksSttModel: string | undefined
  cloudflareSttModels: string[] | undefined
  cloudflareSttModel: string | undefined
  supadataLang: string | undefined
  speechmaticsSttModels: string[] | undefined
  speechmaticsSttModel: string | undefined
  deepgramSttModels: string[] | undefined
  deepgramSttModel: string | undefined
  diarizationSpeakerCount: number | undefined
  sttProviderConcurrency: number
  sttLocalConcurrency: number
  sttSegmentConcurrency: number
  sttPreflightConcurrency: number
  ocrProviderConcurrency: number
  ocrLocalConcurrency: number
  llmProviderConcurrency: number
  llmLocalConcurrency: number
  refreshCache: boolean
  noCache: boolean
  price: boolean
  allowOverBudget: boolean
  reverbVerbatimicity: number
  split: boolean
  skipLLM: boolean
  dpi: number
  lang: string
  psm: number
  oem: number
  out: OutputFormat
  password: string | undefined
  pageSeparator: string | undefined
  preserveSpaces: boolean
  rotate: number
  useTesseract: boolean
  useOcrmypdf: boolean
  usePaddleOcr: boolean
  mistralOcrModels: string[] | undefined
  mistralOcrModel: string | undefined
  glmOcrModels: string[] | undefined
  glmOcrModel: string | undefined
  openaiOcrModels: string[] | undefined
  openaiOcrModel: string | undefined
  anthropicOcrModels: string[] | undefined
  anthropicOcrModel: string | undefined
  geminiOcrModels: string[] | undefined
  geminiOcrModel: string | undefined
  awsTextractModels: string[] | undefined
  awsTextractModel: string | undefined
  gcloudDocaiModels: string[] | undefined
  gcloudDocaiModel: string | undefined
  primaryOcr: string | undefined
  epubChapterFiles: boolean
  epubChunkLimitChars: number | undefined
  pdfChapterMode: 'local' | 'auto' | 'llm'
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
  promptFile: string | undefined
  textInput: boolean
  renderedText: boolean
  renderedOutDir: string | undefined
  trackList: string | undefined
  promptMd: boolean

  kittenTtsModels: string[] | undefined
  kittenTtsModel: string | undefined
  groqTtsModels: string[] | undefined
  groqTtsModel: string | undefined
  groqVoiceId: string | undefined
  openaiTtsModels: string[] | undefined
  openaiTtsModel: string | undefined
  openaiVoiceId: string | undefined
  geminiTtsModels: string[] | undefined
  geminiTtsModel: string | undefined
  geminiVoiceId: string | undefined
  geminiSpeaker1Name: string | undefined
  geminiSpeaker1Voice: string | undefined
  geminiSpeaker2Name: string | undefined
  geminiSpeaker2Voice: string | undefined
  elevenlabsTtsModels: string[] | undefined
  elevenlabsTtsModel: string | undefined
  elevenlabsVoiceId: string | undefined
  deepgramTtsModels: string[] | undefined
  deepgramTtsModel: string | undefined
  deepgramVoiceId: string | undefined
  minimaxTtsModels: string[] | undefined
  minimaxTtsModel: string | undefined
  minimaxTtsVoice: string | undefined
  geminiImageModels: string[] | undefined
  geminiImageModel: string | undefined
  openaiImageModels: string[] | undefined
  openaiImageModel: string | undefined
  minimaxImageModels: string[] | undefined
  minimaxImageModel: string | undefined
  glmImageModels: string[] | undefined
  glmImageModel: string | undefined
  grokImageModels: string[] | undefined
  grokImageModel: string | undefined
  runwayImageModels: string[] | undefined
  runwayImageModel: string | undefined
  imageAspectRatio: string | undefined
  imageSize: string | undefined
  imageQuality: string | undefined
  imageFormat: string | undefined
  imageBackground: string | undefined
  imagenCount: number | undefined

  elevenlabsMusicModels: string[] | undefined
  elevenlabsMusicModel: string | undefined
  minimaxMusicModels: string[] | undefined
  minimaxMusicModel: string | undefined
  musicDuration: number | undefined
  musicLyricsFile: string | undefined
  musicInstrumental: boolean | undefined

  geminiVideoModels: string[] | undefined
  geminiVideoModel: string | undefined
  minimaxVideoModels: string[] | undefined
  minimaxVideoModel: string | undefined
  glmVideoModels: string[] | undefined
  glmVideoModel: string | undefined
  grokVideoModels: string[] | undefined
  grokVideoModel: string | undefined
  runwayVideoModels: string[] | undefined
  runwayVideoModel: string | undefined
  videoDuration: number | undefined
  videoSize: string | undefined
  videoAspectRatio: string | undefined
  videoResolution: string | undefined

  markdown: boolean
  save: boolean
}
