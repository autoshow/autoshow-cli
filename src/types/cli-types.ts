import type { BatchOrder } from '../cli/commands/process-steps/step-1-download/download-types'
import type { HtmlArticleBackend } from './process-extraction-types'

const PROCESS_COMMANDS = ['metadata', 'download', 'extract', 'write', 'tts', 'image', 'video', 'music'] as const

type CanonicalProcessCommand = typeof PROCESS_COMMANDS[number]
export type ProcessCommand = CanonicalProcessCommand

export type OutputFormat = 'text' | 'json' | 'tsv' | 'hocr'

export type Step2ProviderSelectionOrigin = 'default' | 'explicit' | 'all-shortcut'

export type RuntimeOptions = {
  outputRootDir: string
  configPath: string | undefined
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
  glmModels: string[] | undefined
  glmModel: string | undefined
  kimiModels: string[] | undefined
  kimiModel: string | undefined
  whisperModels: string[] | undefined
  whisperModel: string
  deepinfraSttModels: string[] | undefined
  deepinfraSttModel: string | undefined
  groqSttModels: string[] | undefined
  groqSttModel: string | undefined
  grokSttModels: string[] | undefined
  grokSttModel: string | undefined
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
  scrapecreatorsSttModels: string[] | undefined
  scrapecreatorsSttModel: string | undefined
  openaiSttModels: string[] | undefined
  openaiSttModel: string | undefined
  geminiSttModels: string[] | undefined
  geminiSttModel: string | undefined
  glmSttModels: string[] | undefined
  glmSttModel: string | undefined
  togetherSttModels: string[] | undefined
  togetherSttModel: string | undefined
  supadataLang: string | undefined
  scrapecreatorsLang: string | undefined
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
  ttsProviderConcurrency: number
  ttsLocalConcurrency: number
  imageProviderConcurrency: number
  imageLocalConcurrency: number
  videoProviderConcurrency: number
  videoLocalConcurrency: number
  musicProviderConcurrency: number
  musicLocalConcurrency: number
  refreshCache: boolean
  noCache: boolean
  price: boolean
  allowOverBudget: boolean
  reverbVerbatimicity: number
  split: boolean
  skipLLM: boolean
  dpi: number
  lang: string
  out: OutputFormat
  password: string | undefined
  useTesseract: boolean
  useOcrmypdf: boolean
  usePaddleOcr: boolean
  mistralOcrModels: string[] | undefined
  mistralOcrModel: string | undefined
  glmOcrModels: string[] | undefined
  glmOcrModel: string | undefined
  kimiOcrModels: string[] | undefined
  kimiOcrModel: string | undefined
  openaiOcrModels: string[] | undefined
  openaiOcrModel: string | undefined
  grokOcrModels: string[] | undefined
  grokOcrModel: string | undefined
  anthropicOcrModels: string[] | undefined
  anthropicOcrModel: string | undefined
  geminiOcrModels: string[] | undefined
  geminiOcrModel: string | undefined
  deepinfraOcrModels: string[] | undefined
  deepinfraOcrModel: string | undefined
  unstructuredOcrModels: string[] | undefined
  unstructuredOcrModel: string | undefined
  primaryOcr: string | undefined
  epubChapterFiles: boolean
  epubChunkLimitChars: number | undefined
  pdfChapterMode: 'local' | 'auto' | 'llm'
  useEpubBun: boolean
  useEpubCalibre: boolean
  urlBackend: HtmlArticleBackend
  urlBackendExplicit: boolean
  urlBackends: HtmlArticleBackend[] | undefined
  urlProviderConcurrency: number
  urlRequestTimeoutMs: number
  urlRequestAttempts: number

  batchLimit: number
  batchAll: boolean
  batchOrder: BatchOrder
  batchConcurrency: number
  keepOriginalMedia: boolean
  bestQuality: boolean
  flatBatch: boolean
  ytDlpPassthroughArgs: string[] | undefined

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
  grokTtsModels: string[] | undefined
  grokTtsModel: string | undefined
  grokTtsVoice: string | undefined
  grokTtsLanguage: string | undefined
  grokTtsTextNormalization: boolean
  mistralTtsModels: string[] | undefined
  mistralTtsModel: string | undefined
  mistralTtsVoice: string | undefined
  mistralTtsRefAudio: string | undefined
  mistralTtsVoiceName: string | undefined
  ttsDialogueFormat: 'screenplay' | 'labeled' | undefined
  ttsSpeakerRefAudios: string[] | undefined
  ttsSpeakers: string[] | undefined
  openaiTtsModels: string[] | undefined
  openaiTtsModel: string | undefined
  openaiVoiceId: string | undefined
  openaiTtsInstructions: string | undefined
  openaiTtsSpeed: number | undefined
  openaiTtsRefAudio: string | undefined
  openaiTtsConsentId: string | undefined
  openaiTtsConsentAudio: string | undefined
  openaiTtsConsentLanguage: string | undefined
  openaiTtsConsentName: string | undefined
  openaiTtsVoiceName: string | undefined
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
  elevenlabsTtsRefAudio: string | undefined
  elevenlabsTtsVoiceName: string | undefined
  elevenlabsTtsCloneRemoveBackgroundNoise: boolean
  elevenlabsTtsOutputFormat: string | undefined
  elevenlabsTtsLanguageCode: string | undefined
  elevenlabsTtsStability: number | undefined
  elevenlabsTtsSimilarityBoost: number | undefined
  elevenlabsTtsStyle: number | undefined
  elevenlabsTtsUseSpeakerBoost: boolean
  elevenlabsTtsSpeed: number | undefined
  elevenlabsTtsSeed: number | undefined
  elevenlabsTtsTextNormalization: string | undefined
  elevenlabsTtsPronunciationDictionaryLocators: string[] | undefined
  elevenlabsTtsOptimizeStreamingLatency: number | undefined
  deepgramTtsModels: string[] | undefined
  deepgramTtsModel: string | undefined
  deepgramVoiceId: string | undefined
  deepgramTtsEncoding: string | undefined
  deepgramTtsContainer: string | undefined
  deepgramTtsBitRate: number | undefined
  deepgramTtsSampleRate: number | undefined
  deepgramTtsSpeed: number | undefined
  speechifyTtsModels: string[] | undefined
  speechifyTtsModel: string | undefined
  speechifyVoice: string | undefined
  speechifyTtsAudioFormat: string | undefined
  speechifyTtsLanguage: string | undefined
  speechifyTtsRefAudio: string | undefined
  speechifyTtsVoiceName: string | undefined
  speechifyTtsConsentName: string | undefined
  speechifyTtsConsentEmail: string | undefined
  speechifyTtsVoiceLocale: string | undefined
  speechifyTtsVoiceGender: string | undefined
  humeTtsModels: string[] | undefined
  humeTtsModel: string | undefined
  humeTtsVoice: string | undefined
  humeTtsVoiceProvider: string | undefined
  cartesiaTtsModels: string[] | undefined
  cartesiaTtsModel: string | undefined
  cartesiaTtsVoice: string | undefined
  cartesiaTtsLanguage: string | undefined
  minimaxTtsModels: string[] | undefined
  minimaxTtsModel: string | undefined
  minimaxTtsVoice: string | undefined
  minimaxTtsLanguageBoost: string | undefined
  minimaxTtsSpeed: number | undefined
  minimaxTtsVolume: number | undefined
  minimaxTtsPitch: number | undefined
  minimaxTtsEmotion: string | undefined
  minimaxTtsEnglishNormalization: boolean
  minimaxTtsPronunciations: string[] | undefined
  geminiImageModels: string[] | undefined
  geminiImageModel: string | undefined
  openaiImageModels: string[] | undefined
  openaiImageModel: string | undefined
  grokImageModels: string[] | undefined
  grokImageModel: string | undefined
  bflImageModels: string[] | undefined
  bflImageModel: string | undefined
  reveImageModels: string[] | undefined
  reveImageModel: string | undefined
  imageAspectRatio: string | undefined
  imageSize: string | undefined
  imageQuality: string | undefined
  imageFormat: string | undefined
  imageBackground: string | undefined
  imageCount: number | undefined
  imageInputs: string[] | undefined
  imageMask: string | undefined
  imageResponseMode: string | undefined
  geminiSearchGrounding: boolean | undefined
  imageCompression: number | undefined

  elevenlabsMusicModels: string[] | undefined
  elevenlabsMusicModel: string | undefined
  minimaxMusicModels: string[] | undefined
  minimaxMusicModel: string | undefined
  geminiMusicModels: string[] | undefined
  geminiMusicModel: string | undefined
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
  allVideo: boolean | undefined
  videoDuration: number | undefined
  videoSize: string | undefined
  videoAspectRatio: string | undefined
  videoResolution: string | undefined
  videoMode: string | undefined
  videoInputImage: string | undefined
  videoLastFrame: string | undefined
  videoReferenceImages: string[] | undefined
  videoInputVideo: string | undefined
  grokVideoStorageFilename: string | undefined
  grokVideoStorageExpiresAfter: number | undefined

  markdown: boolean
  save: boolean
}
