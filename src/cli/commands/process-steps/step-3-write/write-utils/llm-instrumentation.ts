import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { countTokens } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'

type NormalizedLlmUsage = {
  inputTokenCount?: number | undefined
  outputTokenCount?: number | undefined
  totalTokenCount?: number | undefined
}

type LlmProviderResponse = {
  text: string
  usage?: unknown
  rawProviderUsage?: unknown
  returnedModel?: string | undefined
}

export type LlmApiCallResult = string | LlmProviderResponse

type LlmInstrumentationResult = {
  responseText: string
  inputTokenCount: number
  outputTokenCount: number
  processingTime: number
  tokenCountSource: NonNullable<Step3Metadata['tokenCountSource']>
  providerUsage?: NormalizedLlmUsage | undefined
  rawProviderUsage?: unknown
  providerReturnedModel?: string | undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const firstNumber = (record: Record<string, unknown>, keys: readonly string[]): number | undefined => {
  for (const key of keys) {
    const value = finiteNumber(record[key])
    if (value !== undefined) return value
  }
  return undefined
}

const normalizeLlmProviderUsage = (usage: unknown): NormalizedLlmUsage | undefined => {
  if (!isRecord(usage)) {
    return undefined
  }

  const inputTokenCount = firstNumber(usage, [
    'inputTokenCount',
    'input_tokens',
    'prompt_tokens',
    'promptTokenCount',
    'input_tokens_count'
  ])
  const outputTokenCount = firstNumber(usage, [
    'outputTokenCount',
    'output_tokens',
    'completion_tokens',
    'candidatesTokenCount',
    'completionTokenCount',
    'output_tokens_count'
  ])
  const totalTokenCount = firstNumber(usage, [
    'totalTokenCount',
    'total_tokens',
    'totalTokens',
    'total_token_count'
  ])

  if (
    inputTokenCount === undefined
    && outputTokenCount === undefined
    && totalTokenCount === undefined
  ) {
    return undefined
  }

  return {
    ...(inputTokenCount !== undefined ? { inputTokenCount } : {}),
    ...(outputTokenCount !== undefined ? { outputTokenCount } : {}),
    ...(totalTokenCount !== undefined ? { totalTokenCount } : {})
  }
}

export const runWithLLMInstrumentation = async (
  prompt: string,
  fn: () => Promise<LlmApiCallResult>
): Promise<LlmInstrumentationResult> => {
  const startTime = Date.now()
  const result = await fn()
  const processingTime = Date.now() - startTime
  const responseText = typeof result === 'string' ? result : result.text
  const rawProviderUsage = typeof result === 'string'
    ? undefined
    : result.rawProviderUsage ?? result.usage
  const providerUsage = normalizeLlmProviderUsage(typeof result === 'string' ? undefined : result.usage ?? result.rawProviderUsage)
  const hasCompleteProviderUsage = providerUsage?.inputTokenCount !== undefined && providerUsage.outputTokenCount !== undefined
  const inputTokenCount = providerUsage?.inputTokenCount ?? countTokens(prompt)
  const outputTokenCount = providerUsage?.outputTokenCount ?? countTokens(responseText)
  return {
    responseText,
    inputTokenCount,
    outputTokenCount,
    processingTime,
    tokenCountSource: hasCompleteProviderUsage ? 'provider_usage' : 'local_count',
    ...(providerUsage ? { providerUsage } : {}),
    ...(rawProviderUsage !== undefined ? { rawProviderUsage } : {}),
    ...(typeof result !== 'string' && result.returnedModel ? { providerReturnedModel: result.returnedModel } : {})
  }
}

export const buildStep3Metadata = (
  service: Step3Metadata['llmService'],
  model: string,
  timing: LlmInstrumentationResult,
  structuredOpts?: StructuredRequestOptions
): Step3Metadata => ({
  llmService: service,
  llmModel: model,
  ...(timing.providerReturnedModel ? { providerReturnedModel: timing.providerReturnedModel } : {}),
  processingTime: timing.processingTime,
  inputTokenCount: timing.inputTokenCount,
  outputTokenCount: timing.outputTokenCount,
  tokenCountSource: timing.tokenCountSource,
  ...(timing.providerUsage ? { providerUsage: timing.providerUsage } : {}),
  ...(timing.rawProviderUsage !== undefined ? { rawProviderUsage: timing.rawProviderUsage } : {}),
  outputFileName: '',
  outputFormat: 'json',
  structuredMode: structuredOpts?.strategy ?? 'schema-guided',
  structuredPresetNames: []
})
