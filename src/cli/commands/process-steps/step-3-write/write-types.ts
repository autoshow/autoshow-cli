import type * as v from 'valibot'
import type {
  RateEstimateBase,
  ProcessingOptions,
  Step3Metadata
} from '~/types'
import type { AnthropicRestConfig } from '~/utils/anthropic/client'
import type { OpenAIRestConfig } from '~/utils/openai/client'

export type LLMOptions = Pick<ProcessingOptions,
  | 'outputDir'
  | 'prompts'
  | 'promptFile'
  | 'promptMd'
  | 'openaiModels'
  | 'openaiModel'
  | 'groqModels'
  | 'groqModel'
  | 'geminiModels'
  | 'geminiModel'
  | 'anthropicModels'
  | 'anthropicModel'
  | 'minimaxModels'
  | 'minimaxModel'
  | 'grokModels'
  | 'grokModel'
  | 'glmModels'
  | 'glmModel'
  | 'kimiModels'
  | 'kimiModel'
  | 'llamaModels'
  | 'llamaModel'
  | 'llmProviderConcurrency'
  | 'llmLocalConcurrency'
> & {
  promptBuilder?: ((instruction: string) => string) | undefined
  structuredContext?: StructuredOutputContext | undefined
}

export type BuildPromptOptions = {
  promptSourceProvider?: string | undefined
  requestedSpeakerCount?: number | undefined
  suppressDiarizationLog?: boolean | undefined
}

export type LlamaServerTarget =
  | {
    mode: 'repo'
    requestedModel: string
    expectedRepo: string
    startupArgs: string[]
  }
  | {
    mode: 'path'
    requestedModel: string
    expectedPath: string
    startupArgs: string[]
  }

export type LlamaServerIdentity = {
  source: 'props' | 'models'
  modelId: string | null
  aliases: string[]
  modelPath: string | null
}

export type LlamaIdentityMatchResult = {
  matches: boolean
  reason: string
}

export type DownloadInfo = {
  sourceUrl: string
  destinationPath: string
}

export type JsonSchemaObject = Record<string, unknown>

export type StructuredStrategy = 'native' | 'schema-guided'

export type StructuredRequestOptions = {
  schemaName: string
  schema: JsonSchemaObject
  strict: boolean
  strategy: StructuredStrategy
}

export type StructuredOutputContext = {
  songLyricsTitle?: string | undefined
}

export type StructuredValidationContext = {
  leafPromptNames: string[]
  presetNames: string[]
  songLyricsTitle?: string | undefined
}

export type StructuredRunResult = {
  metadata: Step3Metadata
  renderedText: string
  parsedJson: unknown
}

export type ValibotSchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>

export type ResolvedStructuredSchema = {
  schemaName: string
  leafPromptNames: string[]
  presetNames: string[]
  schema: ValibotSchema
  jsonSchema: JsonSchemaObject
}

export type ProviderStructuredCapability = {
  nativeStructuredOutput: boolean
  strictMode: boolean
}

export type StructuredValidationResult = {
  success: boolean
  value?: unknown
  issue?: string
}

export type LLMService = Step3Metadata['llmService']

export type StructuredPresetName =
  | 'shortSummary'
  | 'longSummary'
  | 'bulletPoints'
  | 'takeaways'
  | 'quotes'
  | 'titles'
  | 'metadata'
  | 'faq'
  | 'questions'
  | 'chapterTitles'
  | 'chapterTitlesAndQuotes'
  | 'shortChapters'
  | 'mediumChapters'
  | 'longChapters'
  | 'keyMoments'
  | 'blog'
  | 'youtubeDescription'
  | 'seoArticle'
  | 'contentStrategy'
  | 'emailNewsletter'
  | 'pdfChapterBoundaries'
  | 'x'
  | 'tiktok'
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'standardSongLyrics'
  | 'rapSongLyrics'
  | 'rapSongLongLyrics'
  | 'poetryCollection'
  | 'screenplay'
  | 'shortStory'

export type CompatStructuredResponse = {
  parsedJson: unknown
  rawResponse: string
  metadata: Step3Metadata
}

export type AnthropicCompatibleService = Extract<Step3Metadata['llmService'], 'anthropic' | 'minimax'>

export type RunAnthropicCompatibleModelOptions = {
  prompt: string
  model: string
  structuredOpts?: StructuredRequestOptions | undefined
  config: AnthropicRestConfig
  service: AnthropicCompatibleService
  providerLabel: string
  operationName: string
  supportsStructuredOutput?: boolean
}

export type OpenAICompatibleChatService = Extract<Step3Metadata['llmService'], 'groq' | 'grok' | 'glm' | 'kimi'>

export type RunOpenAICompatibleChatModelOptions = {
  prompt: string
  model: string
  structuredOpts?: StructuredRequestOptions | undefined
  config: OpenAIRestConfig
  service: OpenAICompatibleChatService
  providerLabel: string
  operationName: string
  customizeRequestBody?: ((requestBody: Record<string, unknown>, model: string) => void) | undefined
  buildStructuredResponseFormat?: ((structuredOpts: StructuredRequestOptions) => Record<string, unknown>) | undefined
}

export type RenderedTextArtifactResult = {
  internalArtifacts: Record<string, string>
  externalFiles: string[]
}

export type LlmRateEstimate = RateEstimateBase & {
  inputCostPer1MCents: number
  outputCostPer1MCents: number
}
