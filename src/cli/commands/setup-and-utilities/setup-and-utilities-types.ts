import type { InferOutput } from 'valibot'
import type { AutoshowConfigSchema } from '~/types'
import { ExtractLimitsSchema, ModelRegistrySchema, SttLimitsSchema } from './models/model-loader'
import {
  SUPPORTED_ANTHROPIC_MODELS,
  SUPPORTED_GROQ_MODELS,
  SUPPORTED_MINIMAX_MODELS
} from './models/llm-models'
import {
  SUPPORTED_AWS_STT_MODELS,
  SUPPORTED_DEAPI_STT_MODELS,
  SUPPORTED_DEEPGRAM_STT_MODELS,
  SUPPORTED_DEEPINFRA_STT_MODELS,
  SUPPORTED_ELEVENLABS_STT_MODELS,
  SUPPORTED_GCLOUD_STT_MODELS,
  SUPPORTED_GLADIA_STT_MODELS,
  SUPPORTED_GROQ_STT_MODELS,
  SUPPORTED_HAPPYSCRIBE_STT_MODELS,
  SUPPORTED_MISTRAL_STT_MODELS,
  SUPPORTED_REV_STT_MODELS,
  SUPPORTED_SONIOX_STT_MODELS,
  SUPPORTED_SPEECHMATICS_STT_MODELS,
  SUPPORTED_ASSEMBLYAI_STT_MODELS,
  SUPPORTED_SUPADATA_STT_MODELS,
  SUPPORTED_OPENAI_STT_MODELS,
  SUPPORTED_GEMINI_STT_MODELS,
  SUPPORTED_GLM_STT_MODELS,
  SUPPORTED_TOGETHER_STT_MODELS,
  SUPPORTED_FIREWORKS_STT_MODELS,
  SUPPORTED_CLOUDFLARE_STT_MODELS
} from './models/stt-models'
import {
  SUPPORTED_ANTHROPIC_OCR_MODELS,
  SUPPORTED_AWS_TEXTRACT_MODELS,
  SUPPORTED_DEAPI_OCR_MODELS,
  SUPPORTED_GCLOUD_DOCAI_MODELS,
  SUPPORTED_GEMINI_OCR_MODELS,
  SUPPORTED_GLM_OCR_MODELS,
  SUPPORTED_MISTRAL_OCR_MODELS,
  SUPPORTED_OPENAI_OCR_MODELS
} from './models/ocr-models'
import {
  SUPPORTED_DEAPI_TTS_MODELS,
  SUPPORTED_DEEPGRAM_TTS_MODELS,
  SUPPORTED_ELEVENLABS_TTS_MODELS,
  SUPPORTED_GEMINI_TTS_MODELS,
  SUPPORTED_GROQ_TTS_MODELS,
  SUPPORTED_KITTEN_TTS_MODELS,
  SUPPORTED_MINIMAX_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS
} from './models/tts-models'
import {
  SUPPORTED_GEMINI_IMAGE_MODELS,
  SUPPORTED_DEAPI_IMAGE_MODELS,
  SUPPORTED_GLM_IMAGE_MODELS,
  SUPPORTED_GROK_IMAGE_MODELS,
  SUPPORTED_MINIMAX_IMAGE_MODELS,
  SUPPORTED_OPENAI_IMAGE_MODELS,
  SUPPORTED_RUNWAY_IMAGE_MODELS,
  SUPPORTED_BFL_IMAGE_MODELS
} from './models/image-models'
import {
  SUPPORTED_ELEVENLABS_MUSIC_MODELS,
  SUPPORTED_MINIMAX_MUSIC_MODELS,
  SUPPORTED_DEAPI_MUSIC_MODELS
} from './models/music-models'
import {
  SUPPORTED_GLM_VIDEO_MODELS,
  SUPPORTED_DEAPI_VIDEO_MODELS,
  SUPPORTED_GROK_VIDEO_MODELS,
  SUPPORTED_GEMINI_VIDEO_MODELS,
  SUPPORTED_MINIMAX_VIDEO_MODELS,
  SUPPORTED_RUNWAY_VIDEO_MODELS
} from './models/video-models'

export type AutoshowConfig = InferOutput<typeof AutoshowConfigSchema>

export type ModelRegistry = InferOutput<typeof ModelRegistrySchema>

export type SampleSupportLevel = 'current' | 'planned'
export type FixtureKind = 'valid' | 'invalid'

export type FixtureDescriptor = {
  path: string
  format: string
  supportLevel: SampleSupportLevel
  validity: FixtureKind
  requiredTools: ToolName[]
  invalidReason?: string | undefined
}

export type SampleFixtureEntry = FixtureDescriptor & {
  verified: boolean
}

export type SampleSkippedEntry = {
  path: string
  reason: string
  requiredTools: string[]
}

export type SampleManifestSummary = {
  total: number
  generated: number
  skipped: number
  verified: number
}

export type SampleManifest = {
  schemaVersion: number
  generatedAt: string
  mode: 'full' | 'partial'
  fixtures: SampleFixtureEntry[]
  skipped: SampleSkippedEntry[]
  summary: SampleManifestSummary
}

export type RunResult = {
  stdout: string
  stderr: string
  exitCode: number
}

export type RunOptions = {
  cwd?: string
  env?: Record<string, string | undefined>
  allowFailure?: boolean
}

export type SetupPlatform = 'darwin' | 'linux' | 'unknown'

export type ModelLinksData = Record<string, Record<string, string[]>>

export type LinksSelection = {
  serviceSelections: Map<string, string[]>
  globalSections: string[]
}

export type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export type RunLinksOptions = {
  outputPath?: string | URL
  fetchImpl?: FetchFn
}

export type GroqModel = typeof SUPPORTED_GROQ_MODELS[number]
export type AnthropicModel = typeof SUPPORTED_ANTHROPIC_MODELS[number]
export type MinimaxModel = typeof SUPPORTED_MINIMAX_MODELS[number]
export type AwsSttModel = typeof SUPPORTED_AWS_STT_MODELS[number]
export type DeapiSttModel = typeof SUPPORTED_DEAPI_STT_MODELS[number]
export type DeapiTtsModel = typeof SUPPORTED_DEAPI_TTS_MODELS[number]
export type DeapiOcrModel = typeof SUPPORTED_DEAPI_OCR_MODELS[number]
export type DeapiMusicModel = typeof SUPPORTED_DEAPI_MUSIC_MODELS[number]
export type GcloudSttModel = typeof SUPPORTED_GCLOUD_STT_MODELS[number]
export type DeepgramSttModel = typeof SUPPORTED_DEEPGRAM_STT_MODELS[number]
export type DeepinfraSttModel = typeof SUPPORTED_DEEPINFRA_STT_MODELS[number]
export type ElevenlabsSttModel = typeof SUPPORTED_ELEVENLABS_STT_MODELS[number]
export type SonioxSttModel = typeof SUPPORTED_SONIOX_STT_MODELS[number]
export type SpeechmaticsSttModel = typeof SUPPORTED_SPEECHMATICS_STT_MODELS[number]
export type RevSttModel = typeof SUPPORTED_REV_STT_MODELS[number]
export type GroqSttModel = typeof SUPPORTED_GROQ_STT_MODELS[number]
export type MistralSttModel = typeof SUPPORTED_MISTRAL_STT_MODELS[number]
export type AssemblyaiSttModel = typeof SUPPORTED_ASSEMBLYAI_STT_MODELS[number]
export type GladiaSttModel = typeof SUPPORTED_GLADIA_STT_MODELS[number]
export type HappyscribeSttModel = typeof SUPPORTED_HAPPYSCRIBE_STT_MODELS[number]
export type SupadataSttModel = typeof SUPPORTED_SUPADATA_STT_MODELS[number]
export type OpenaiSttModel = typeof SUPPORTED_OPENAI_STT_MODELS[number]
export type GeminiSttModel = typeof SUPPORTED_GEMINI_STT_MODELS[number]
export type GlmSttModel = typeof SUPPORTED_GLM_STT_MODELS[number]
export type TogetherSttModel = typeof SUPPORTED_TOGETHER_STT_MODELS[number]
export type FireworksSttModel = typeof SUPPORTED_FIREWORKS_STT_MODELS[number]
export type CloudflareSttModel = typeof SUPPORTED_CLOUDFLARE_STT_MODELS[number]
export type MistralOcrModel = typeof SUPPORTED_MISTRAL_OCR_MODELS[number]
export type GlmOcrModel = typeof SUPPORTED_GLM_OCR_MODELS[number]
export type OpenAIOcrModel = typeof SUPPORTED_OPENAI_OCR_MODELS[number]
export type AnthropicOcrModel = typeof SUPPORTED_ANTHROPIC_OCR_MODELS[number]
export type GeminiOcrModel = typeof SUPPORTED_GEMINI_OCR_MODELS[number]
export type AwsTextractModel = typeof SUPPORTED_AWS_TEXTRACT_MODELS[number]
export type GcloudDocaiModel = typeof SUPPORTED_GCLOUD_DOCAI_MODELS[number]
export type KittenTtsModel = typeof SUPPORTED_KITTEN_TTS_MODELS[number]
export type ElevenlabsTtsModel = typeof SUPPORTED_ELEVENLABS_TTS_MODELS[number]
export type MinimaxTtsModel = typeof SUPPORTED_MINIMAX_TTS_MODELS[number]
export type GroqTtsModel = typeof SUPPORTED_GROQ_TTS_MODELS[number]
export type OpenAITtsModel = typeof SUPPORTED_OPENAI_TTS_MODELS[number]
export type GeminiTtsModel = typeof SUPPORTED_GEMINI_TTS_MODELS[number]
export type DeepgramTtsModel = typeof SUPPORTED_DEEPGRAM_TTS_MODELS[number]
export type ElevenlabsMusicModel = typeof SUPPORTED_ELEVENLABS_MUSIC_MODELS[number]
export type MinimaxMusicModel = typeof SUPPORTED_MINIMAX_MUSIC_MODELS[number]
export type GeminiImageModel = typeof SUPPORTED_GEMINI_IMAGE_MODELS[number]
export type OpenAIImageModel = typeof SUPPORTED_OPENAI_IMAGE_MODELS[number]
export type MinimaxImageModel = typeof SUPPORTED_MINIMAX_IMAGE_MODELS[number]
export type GlmImageModel = typeof SUPPORTED_GLM_IMAGE_MODELS[number]
export type GrokImageModel = typeof SUPPORTED_GROK_IMAGE_MODELS[number]
export type RunwayImageModel = typeof SUPPORTED_RUNWAY_IMAGE_MODELS[number]
export type BflImageModel = typeof SUPPORTED_BFL_IMAGE_MODELS[number]
export type DeapiImageModel = typeof SUPPORTED_DEAPI_IMAGE_MODELS[number]
export type GeminiVideoModel = typeof SUPPORTED_GEMINI_VIDEO_MODELS[number]
export type MinimaxVideoModel = typeof SUPPORTED_MINIMAX_VIDEO_MODELS[number]
export type GlmVideoModel = typeof SUPPORTED_GLM_VIDEO_MODELS[number]
export type GrokVideoModel = typeof SUPPORTED_GROK_VIDEO_MODELS[number]
export type RunwayVideoModel = typeof SUPPORTED_RUNWAY_VIDEO_MODELS[number]
export type DeapiVideoModel = typeof SUPPORTED_DEAPI_VIDEO_MODELS[number]

export type CostEstimation = {
  costMultiplier: number
}

export type SttEstimation = CostEstimation & {
  msPerSecond: number
}

export type SttBilling = {
  roundingIncrementSeconds?: number
  minimumSeconds?: number
}

export type SttLimits = InferOutput<typeof SttLimitsSchema>
export type ExtractLimits = InferOutput<typeof ExtractLimitsSchema>

export type ExtractEstimation = CostEstimation & {
  msPerPage: number
}

export type LlmEstimation = CostEstimation & {
  msPer1KTokens: number
}

export type TtsEstimation = CostEstimation & {
  msPer1KChars: number
}

export type ImageEstimation = CostEstimation & {
  msPerImage: number
}

export type MusicEstimation = CostEstimation & {
  msPerSecond: number
}

export type VideoEstimation = CostEstimation & {
  msPerSecond: number
}

export type CheapestVideoSelection = {
  provider: 'gemini' | 'minimax' | 'glm' | 'grok' | 'runway' | 'deapi'
  model: string
  duration: number
  size?: string | undefined
  resolution?: string | undefined
  totalCost: number
}

export type ToolName = 'ffmpeg' | 'ffprobe' | 'calibre' | 'imagemagick'

export type ToolStatus = {
  available: boolean
  command: string
  remediation: string
}

export type FixtureDef = FixtureDescriptor

export type GenerateResult = {
  generated: boolean
  reason?: string
}

export type ValidateResult = {
  valid: boolean
  reason?: string
}

export type SampleFixtureOptions = {
  out?: string
  refresh?: boolean
  verifyOnly?: boolean
  validOnly?: boolean
}

export type CheckResult = {
  label: string
  ok: boolean
  detail: string
}

export type SetupToolStatus = {
  tool: string
  status: string
  detail?: string
}

export type SetupStepId =
  | 'uv' | 'yt-dlp' | 'whisper-binary' | 'whisper-model' | 'llama-binary'
  | 'reverb' | 'calibre' | 'all'
  | 'transcription' | 'write' | 'tts' | 'image' | 'video' | 'music' | 'sample'
