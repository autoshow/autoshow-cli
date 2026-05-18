import type {
  CostEstimateBase,
  DocumentMetadata,
  ExtractionMetadata,
  ImageProvider,
  MusicProvider,
  ProviderModelBase,
  Step1Metadata,
  Step2Metadata,
  Step3Metadata,
  Step4Metadata,
  Step5Metadata,
  Step6VideoMetadata,
  Step7MusicMetadata,
  TimingStepEntry,
  VideoProvider
} from '~/types'

export type SttStepEstimate = CostEstimateBase & {
  step: 'stt'
  durationSeconds: number
  estimateType?: 'heuristic' | 'exact'
}

export type LlmStepEstimate = ProviderModelBase & {
  step: 'llm'
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  estimatedInputTokens?: number
  estimatedOutputTokens?: number
  totalCost: number
  costMultiplier?: number
}

export type TtsStepEstimate = ProviderModelBase & {
  step: 'tts'
  costPer1kCharactersCents?: number
  inputCostPer1MCharactersCents?: number
  outputCostPer1MCharactersCents?: number
  characterCount?: number
  totalCost: number
  costMultiplier?: number
  estimateType?: 'heuristic' | 'exact'
  note?: string
  setupCostCents?: number
  setupTimeMs?: number
}

export type ImageStepEstimate = CostEstimateBase<ImageProvider> & {
  step: 'image'
}

export type VideoStepEstimate = CostEstimateBase<VideoProvider> & {
  step: 'video'
}

export type MusicStepEstimate = ProviderModelBase<MusicProvider> & {
  step: 'music'
  totalCost: number
  costMultiplier?: number
  lyricsSource: 'provided' | 'generated' | 'none'
  note?: string
}

export type UrlExtractProvider = 'defuddle' | 'firecrawl' | 'glm-reader' | 'spider' | 'zyte'

export type ExtractStepEstimate = ProviderModelBase<'tesseract' | 'ocrmypdf' | 'paddle-ocr' | 'mistral' | 'glm' | 'kimi' | 'openai' | 'anthropic' | 'gemini' | 'deepinfra' | UrlExtractProvider | 'gcloud-docai' | 'aws-textract'> & {
  step: 'extract'
  costPer1kPagesCents?: number
  costPer1kOutputCharsCents?: number
  inputCostPer1MCents?: number
  outputCostPer1MCents?: number
  pageCount?: number
  estimatedOutputChars?: number
  promptTokens?: number
  completionTokens?: number
  totalCost: number
  costMultiplier?: number
  estimateType?: 'heuristic' | 'exact'
  note?: string
}

export type StepEstimate =
  | SttStepEstimate
  | ExtractStepEstimate
  | LlmStepEstimate
  | TtsStepEstimate
  | ImageStepEstimate
  | VideoStepEstimate
  | MusicStepEstimate

export type AggregatedPriceEstimate = {
  steps: StepEstimate[]
  totalEstimatedCost: number
  timing?: StepTimingBreakdown | undefined
  notes?: string[]
}

export type ActualPipelineInputsBase<TStep1> = {
  step1?: TStep1 | undefined
  step2?: Step2Metadata | Step2Metadata[] | ExtractionMetadata | ExtractionMetadata[] | undefined
  step3?: Step3Metadata | Step3Metadata[] | undefined
  step4?: Step4Metadata | Step4Metadata[] | undefined
  step5?: Step5Metadata | Step5Metadata[] | undefined
  step6?: Step6VideoMetadata | Step6VideoMetadata[] | undefined
  step7?: Step7MusicMetadata | Step7MusicMetadata[] | undefined
  ttsCharacterCount?: number | undefined
}

export type ComputeActualCostsInput = ActualPipelineInputsBase<Step1Metadata> & {
  audioDurationSeconds?: number | undefined
}

export type ComputeEstimatedCostsInput = {
  applyCostMultipliers?: boolean | undefined
  sourceUrl?: string | undefined
  sttTargets?: Array<{ service: Step2Metadata['transcriptionService'], model: string }> | undefined
  whisperModel?: string | undefined
  gcloudSttModel?: string | undefined
  awsSttModel?: string | undefined
  deepinfraSttModel?: string | undefined
  deapiSttModel?: string | undefined
  groqSttModel?: string | undefined
  grokSttModel?: string | undefined
  elevenlabsSttModel?: string | undefined
  deepgramSttModel?: string | undefined
  sonioxSttModel?: string | undefined
  speechmaticsSttModel?: string | undefined
  revSttModel?: string | undefined
  mistralSttModel?: string | undefined
  assemblyaiSttModel?: string | undefined
  gladiaSttModel?: string | undefined
  happyscribeSttModel?: string | undefined
  supadataSttModel?: string | undefined
  scrapecreatorsSttModel?: string | undefined
  openaiSttModel?: string | undefined
  geminiSttModel?: string | undefined
  glmSttModel?: string | undefined
  togetherSttModel?: string | undefined
  mistralOcrModel?: string | undefined
  glmOcrModel?: string | undefined
  kimiOcrModel?: string | undefined
  openaiOcrModel?: string | undefined
  anthropicOcrModel?: string | undefined
  geminiOcrModel?: string | undefined
  deepinfraOcrModel?: string | undefined
  extractTargets?: Array<{
    provider: 'mistral' | 'glm' | 'kimi' | 'openai' | 'anthropic' | 'gemini' | 'deepinfra' | UrlExtractProvider | 'gcloud-docai' | 'aws-textract'
    model: string
    pageCount?: number
    promptTokens?: number
    completionTokens?: number
    quotedCostCents?: number
    estimateType?: 'heuristic' | 'exact'
    note?: string
  }> | undefined
  extractPageCount?: number | undefined
  useReverb?: boolean | undefined
  audioDurationSeconds?: number | undefined
  llmTargets?: Array<{
    service: Step3Metadata['llmService']
    model: string
    inputTokens?: number
    outputTokens?: number
  }> | undefined
  llmService?: string | undefined
  llmModel?: string | undefined
  llmInputTokenCount?: number | undefined
  llmOutputTokenCount?: number | undefined
  skipLLM?: boolean | undefined
  ttsTargets?: Array<{ service: string, model: string, setupCostCents?: number, setupTimeMs?: number, setupNote?: string }> | undefined
  ttsService?: string | undefined
  ttsModel?: string | undefined
  ttsCharacterCount?: number | undefined
  imageTargets?: Array<{ service: Step5Metadata['imageService'], model: string, count: number, imageSize?: string, imageQuality?: string }> | undefined
  geminiImageModel?: string | undefined
  openaiImageModel?: string | undefined
  minimaxImageModel?: string | undefined
  glmImageModel?: string | undefined
  grokImageModel?: string | undefined
  runwayImageModel?: string | undefined
  bflImageModel?: string | undefined
  deapiImageModel?: string | undefined
  imageSize?: string | undefined
  imageQuality?: string | undefined
  imageCount?: number | undefined
  geminiVideoModel?: string | undefined
  minimaxVideoModel?: string | undefined
  glmVideoModel?: string | undefined
  grokVideoModel?: string | undefined
  runwayVideoModel?: string | undefined
  deapiVideoModel?: string | undefined
  videoTargets?: Array<{ service: Step6VideoMetadata['videoGenService'], model: string, durationSeconds?: number }> | undefined
  videoDuration?: number | undefined
  videoSize?: string | undefined
  videoAspectRatio?: string | undefined
  videoResolution?: string | undefined
  videoMode?: string | undefined
  elevenlabsMusicModel?: string | undefined
  minimaxMusicModel?: string | undefined
  deapiMusicModel?: string | undefined
  geminiMusicModel?: string | undefined
  musicTargets?: Array<{ service: Step7MusicMetadata['musicService'], model: string, durationSeconds?: number }> | undefined
  musicDuration?: number | undefined
  musicLyricsFile?: string | undefined
  musicInstrumental?: boolean | undefined
}

export type ComputeEstimatedProcessingTimesInput = {
  sttTargets?: Array<{ service: Step2Metadata['transcriptionService'], model: string }> | undefined
  transcriptionService?: Step2Metadata['transcriptionService'] | undefined
  transcriptionModel?: string | undefined
  audioDurationSeconds?: number | undefined
  mistralOcrModel?: string | undefined
  glmOcrModel?: string | undefined
  kimiOcrModel?: string | undefined
  openaiOcrModel?: string | undefined
  anthropicOcrModel?: string | undefined
  geminiOcrModel?: string | undefined
  deepinfraOcrModel?: string | undefined
  extractTargets?: Array<{ provider: 'mistral' | 'glm' | 'kimi' | 'openai' | 'anthropic' | 'gemini' | 'deepinfra' | UrlExtractProvider | 'gcloud-docai' | 'aws-textract', model: string, pageCount?: number }> | undefined
  extractPageCount?: number | undefined
  llmTargets?: Array<{
    service: Step3Metadata['llmService']
    model: string
    inputTokens?: number
    outputTokens?: number
  }> | undefined
  llmService?: Step3Metadata['llmService'] | undefined
  llmModel?: string | undefined
  llmInputTokenCount?: number | undefined
  llmOutputTokenCount?: number | undefined
  skipLLM?: boolean | undefined
  ttsTargets?: Array<{ service: Step4Metadata['ttsService'], model: string, setupTimeMs?: number, setupCostCents?: number, setupNote?: string }> | undefined
  ttsService?: Step4Metadata['ttsService'] | undefined
  ttsModel?: string | undefined
  ttsCharacterCount?: number | undefined
  imageTargets?: Array<{ service: Step5Metadata['imageService'], model: string, count: number, imageSize?: string, imageQuality?: string }> | undefined
  imageService?: Step5Metadata['imageService'] | undefined
  imageModel?: string | undefined
  imageCount?: number | undefined
  videoService?: Step6VideoMetadata['videoGenService'] | undefined
  videoModel?: string | undefined
  videoDurationSeconds?: number | undefined
  videoTargets?: Array<{ service: Step6VideoMetadata['videoGenService'], model: string, durationSeconds?: number }> | undefined
  musicTargets?: Array<{ service: Step7MusicMetadata['musicService'], model: string, durationSeconds?: number }> | undefined
  musicService?: Step7MusicMetadata['musicService'] | undefined
  musicModel?: string | undefined
  musicDurationSeconds?: number | undefined
}

export type ComputeActualProcessingTimesInput = ActualPipelineInputsBase<Step1Metadata | DocumentMetadata> & {
  audioDurationSeconds?: number | undefined
}

export type PreflightResult = {
  estimate: AggregatedPriceEstimate
  shouldExit: boolean
}

export type BilledSttCost = {
  requestedDurationSeconds: number
  billedDurationSeconds: number
  cost: number
}

export type StepCostEntry = {
  step: 'stt' | 'extract' | 'llm' | 'tts' | 'image' | 'video' | 'music'
  provider: string
  model: string
  cost: number
  inputMetric?: string
  inputValue?: number
  promptTokens?: number
  completionTokens?: number
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
  costPer1kPagesCents?: number
  costPer1kOutputCharsCents?: number
  pageCount?: number
  estimatedOutputChars?: number
  inputCostPer1MCents?: number
  outputCostPer1MCents?: number
  estimatedInputTokens?: number
  estimatedOutputTokens?: number
  promptTokens?: number
  completionTokens?: number
  estimateType?: 'heuristic' | 'exact'
  costPer1kCharactersCents?: number
  inputCostPer1MCharactersCents?: number
  outputCostPer1MCharactersCents?: number
  setupCostCents?: number
  setupTimeMs?: number
}

export type EstimatedCostBreakdown = {
  totalCost: number
  steps: EstimatedStepEntry[]
}

export type StepTimingBreakdown = {
  totalProcessingTimeMs: number
  steps: TimingStepEntry[]
}
