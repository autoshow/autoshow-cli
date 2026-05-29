import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import {
  createOpenAIChatCompletion,
  createOpenAIResponse,
  extractOpenAIChatCompletionText,
  extractOpenAIResponseText,
  type OpenAIChatCompletionResponse,
} from '~/utils/openai/client'
import {
  geminiGenerateContent,
  type GeminiGenerateContentUsageMetadata,
} from '~/utils/gemini/gemini-rest'
import * as v from 'valibot'
import { l, err, comicLog, formatCompactCost, formatDuration } from '../../utils/logger'
import { ScenePromptDataSchema, SCENE_JSON_SCHEMA, StructuredScriptDataSchema } from '../../schemas/schemas'
import {
  getDraftPromptPath,
  getInvalidSceneJsonPath,
  getSceneJsonPath,
  getStructuredScriptPath,
} from '../../utils/project-paths'
import { getGeminiApiKey } from '../../utils/gemini-client'
import { calculateGeminiLlmCost } from '../../models/gemini-models'
import { calculateGrokLlmCost } from '../../models/grok-models'
import { isGeminiLlmModel, isGrokLlmModel, isOpenAiLlmModel } from '../../models/model-registry'
import { getGrokClientConfig } from '../../utils/grok-client'
import { getOpenAIClientConfig } from '../../utils/openai-client'
import { LLM_MODEL_PRICING, openAiLlmSupportsStructuredOutputs } from '../../models/openai-models'
import { parseJsonFile } from '../../utils/json-prompt-utils'
import { validateSceneRecapMontageExpansion } from '../../utils/recap-montage-utils'
import { validateSceneSourceSegmentCoverage } from '../../utils/source-coverage-utils'
import type {
  GeminiLlmModel,
  GrokLlmModel,
  LlmModel,
  OpenAiLlmModel,
} from '../../types/comic-types'
import type {
  DraftSceneResponseUsage,
  DraftSceneRunStats,
  GenerateSceneJsonOptions,
  SceneResponseResult,
} from '../../types/comic-command-types'


const SCENE_JSON_RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  name: SCENE_JSON_SCHEMA.name,
  schema: SCENE_JSON_SCHEMA.schema,
  strict: SCENE_JSON_SCHEMA.strict,
}





const calculateOpenAiCost = (model: OpenAiLlmModel, usage: DraftSceneResponseUsage): number => {
  const pricing = LLM_MODEL_PRICING[model]
  const cachedInputPrice = pricing.cachedInput
  const cachedTokens = usage.input_tokens_details?.cached_tokens ?? 0
  const uncachedInputTokens = usage.input_tokens - cachedTokens

  return (
    (uncachedInputTokens / 1_000_000) * pricing.input +
    (cachedTokens / 1_000_000) * cachedInputPrice +
    (usage.output_tokens / 1_000_000) * pricing.output
  )
}

const calculateCost = (model: LlmModel, usage: DraftSceneResponseUsage): number => {
  if (isOpenAiLlmModel(model)) {
    return calculateOpenAiCost(model, usage)
  }

  if (isGeminiLlmModel(model)) {
    return calculateGeminiLlmCost(model, usage)
  }

  if (isGrokLlmModel(model)) {
    return calculateGrokLlmCost(model, usage)
  }

  throw new Error(`Unsupported LLM model "${model}"`)
}

const extractJsonPayload = (content: string): string => {
  const trimmed = content.trim()
  if (!trimmed) {
    throw new Error('Model response was empty')
  }

  const fencedJsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fencedJsonMatch?.[1]) {
    return fencedJsonMatch[1].trim()
  }

  const firstBraceIndex = trimmed.indexOf('{')
  const lastBraceIndex = trimmed.lastIndexOf('}')
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return trimmed.slice(firstBraceIndex, lastBraceIndex + 1)
  }

  return trimmed
}

const parseSceneJsonResponse = (
  content: string,
  options: { lenient: boolean }
): unknown => {
  return JSON.parse(options.lenient ? extractJsonPayload(content) : content)
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const formatOpenAIResponseError = (error: unknown): string => {
  if (isRecord(error)) {
    const code = typeof error['code'] === 'string' ? error['code'] : 'error'
    const message = typeof error['message'] === 'string' ? error['message'] : JSON.stringify(error)
    return `${code}: ${message}`
  }

  return String(error)
}

const createSceneResponseOpenAI = async (
  content: string,
  model: OpenAiLlmModel
): Promise<SceneResponseResult> => {
  const config = getOpenAIClientConfig()
  const usesStructuredOutputs = openAiLlmSupportsStructuredOutputs(model)
  const request: Record<string, unknown> = {
    model,
    input: content,
    stream: false,
    instructions: usesStructuredOutputs
      ? 'Return only the requested scene JSON.'
      : 'Return only valid JSON that matches the requested scene schema. Do not include markdown fences or commentary.',
    ...(usesStructuredOutputs ? { text: { format: SCENE_JSON_RESPONSE_FORMAT } } : {}),
  }

  const response = await createOpenAIResponse(config, request)
  if (response.error) {
    throw new Error(formatOpenAIResponseError(response.error))
  }

  const text = (extractOpenAIResponseText(response) ?? '').trim()
  if (!text) {
    const incompleteReason = response.incomplete_details
      ? ` (${JSON.stringify(response.incomplete_details)})`
      : ''
    throw new Error(`Empty response from ${model}${incompleteReason}`)
  }

  return {
    response: {
      model: response.model ?? model,
      text,
      ...(response.id ? { requestId: response.id } : {}),
      ...(response.usage ? { usage: response.usage as DraftSceneResponseUsage } : {}),
      ...(response.status ? { status: response.status } : {}),
    },
    usesStructuredOutputs,
  }
}

const normalizeGeminiSceneUsage = (
  usageMetadata: GeminiGenerateContentUsageMetadata | undefined
): DraftSceneResponseUsage | undefined => {
  if (!usageMetadata) {
    return undefined
  }

  const inputTokens = usageMetadata.promptTokenCount ?? 0
  const reasoningTokens = usageMetadata.thoughtsTokenCount ?? 0
  const outputTokens = (usageMetadata.candidatesTokenCount ?? 0) + reasoningTokens
  const totalTokens = usageMetadata.totalTokenCount
    ?? inputTokens + outputTokens + (usageMetadata.toolUsePromptTokenCount ?? 0)

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    input_tokens_details: {
      cached_tokens: usageMetadata.cachedContentTokenCount ?? 0,
    },
    ...(reasoningTokens > 0
      ? {
          output_tokens_details: {
            reasoning_tokens: reasoningTokens,
          },
        }
      : {}),
  }
}

const readNumberField = (value: unknown, field: string): number | undefined => {
  if (value !== null && typeof value === 'object' && field in value) {
    const fieldValue = (value as Record<string, unknown>)[field]
    return typeof fieldValue === 'number' ? fieldValue : undefined
  }
  return undefined
}

const normalizeChatCompletionSceneUsage = (
  response: OpenAIChatCompletionResponse
): DraftSceneResponseUsage | undefined => {
  const usage = response.usage
  if (!usage) {
    return undefined
  }

  const inputTokens = usage.prompt_tokens ?? 0
  const outputTokens = usage.completion_tokens ?? 0
  const cachedTokens = readNumberField(usage['prompt_tokens_details'], 'cached_tokens') ?? 0
  const reasoningTokens = readNumberField(usage['completion_tokens_details'], 'reasoning_tokens') ?? 0

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: usage.total_tokens ?? inputTokens + outputTokens,
    input_tokens_details: {
      cached_tokens: cachedTokens,
    },
    ...(reasoningTokens > 0
      ? {
          output_tokens_details: {
            reasoning_tokens: reasoningTokens,
          },
        }
      : {}),
  }
}

const createSceneResponseGemini = async (
  content: string,
  model: GeminiLlmModel
): Promise<SceneResponseResult> => {
  const apiKey = getGeminiApiKey()
  const response = await geminiGenerateContent(apiKey, {
    model,
    contents: content,
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: SCENE_JSON_SCHEMA.schema,
    },
    systemInstruction: 'Return only the requested scene JSON.',
  })

  const text = response.text?.trim()
  if (!text) {
    const blockedReason = response.promptFeedback?.blockReason
      ? ` (${response.promptFeedback.blockReason})`
      : ''
    throw new Error(`Empty response from ${model}${blockedReason}`)
  }
  const normalizedUsage = normalizeGeminiSceneUsage(response.usageMetadata)

  return {
    response: {
      model: response.modelVersion ?? model,
      text,
      ...(normalizedUsage ? { usage: normalizedUsage } : {}),
      ...(response.responseId ? { requestId: response.responseId } : {}),
    },
    usesStructuredOutputs: true,
  }
}

const createSceneResponseGrok = async (
  content: string,
  model: GrokLlmModel
): Promise<SceneResponseResult> => {
  const config = getGrokClientConfig()
  const response = await createOpenAIChatCompletion(config, {
    model,
    messages: [
      {
        role: 'system',
        content: 'Return only the requested scene JSON.',
      },
      {
        role: 'user',
        content,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: SCENE_JSON_SCHEMA.name,
        schema: SCENE_JSON_SCHEMA.schema,
        strict: SCENE_JSON_SCHEMA.strict,
      },
    },
  }, { errorMessagePrefix: 'Grok scene JSON request failed' })

  const text = (extractOpenAIChatCompletionText(response) ?? '').trim()
  if (!text) {
    throw new Error(`Empty response from ${model}`)
  }
  const requestId = typeof response['id'] === 'string' ? response['id'] : undefined
  const usage = normalizeChatCompletionSceneUsage(response)

  return {
    response: {
      model: response.model ?? model,
      text,
      ...(requestId ? { requestId } : {}),
      ...(usage ? { usage } : {}),
    },
    usesStructuredOutputs: true,
  }
}

const createSceneResponse = async (
  content: string,
  model: LlmModel
): Promise<SceneResponseResult> => {
  if (isOpenAiLlmModel(model)) {
    return createSceneResponseOpenAI(content, model)
  }

  if (isGeminiLlmModel(model)) {
    return createSceneResponseGemini(content, model)
  }

  if (isGrokLlmModel(model)) {
    return createSceneResponseGrok(content, model)
  }

  throw new Error(`Unsupported LLM model "${model}"`)
}


export const generateSceneJson = async (
  sceneSlug: string,
  options: GenerateSceneJsonOptions
): Promise<DraftSceneRunStats> => {
  const stats: DraftSceneRunStats = {
    filesProcessed: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCachedTokens: 0,
    totalCost: 0,
    totalDurationMs: 0
  }

  try {
    const filePath = getDraftPromptPath(sceneSlug)
    const content = await Bun.file(filePath).text()

    if (!content.trim()) {
      l.dim(`Skipping empty draft prompt bundle: ${sceneSlug}`)
      return stats
    }

    const requestStart = Date.now()
    const responseResult = await createSceneResponse(content, options.model)
    const requestDurationMs = Date.now() - requestStart
    const { response, usesStructuredOutputs } = responseResult

    const usage = response.usage
    if (usage) {
      const cachedTokens = usage.input_tokens_details?.cached_tokens ?? 0
      const cost = calculateCost(options.model, usage)

      stats.totalInputTokens += usage.input_tokens
      stats.totalOutputTokens += usage.output_tokens
      stats.totalCachedTokens += cachedTokens
      stats.totalCost += cost
    }

    stats.totalDurationMs += requestDurationMs

    const parsed = parseSceneJsonResponse(response.text, {
      lenient: !usesStructuredOutputs,
    })

    // Strip null tone values before validation
    if (parsed && typeof parsed === 'object' && 'panels' in parsed && Array.isArray(parsed.panels)) {
      for (const panel of parsed.panels) {
        if (
          panel
          && typeof panel === 'object'
          && 'speech' in panel
          && Array.isArray(panel.speech)
        ) {
          for (const item of panel.speech) {
            if (item && typeof item === 'object' && 'tone' in item && item.tone === null) {
              delete item.tone
            }
          }
        }
      }
    }

    const validated = v.parse(ScenePromptDataSchema, parsed)
    const structuredScript = await parseJsonFile(
      getStructuredScriptPath(sceneSlug),
      StructuredScriptDataSchema,
    )
    try {
      validateSceneSourceSegmentCoverage(validated, structuredScript.sourceSegments)
      await validateSceneRecapMontageExpansion(validated, structuredScript)
    } catch (coverageError) {
      const invalidOutputPath = getInvalidSceneJsonPath(sceneSlug)
      try {
        await mkdir(dirname(invalidOutputPath), { recursive: true })
        await Bun.write(invalidOutputPath, JSON.stringify(validated, null, 2))
        l.dim(`Saved invalid scene draft candidate: ${invalidOutputPath}`)
      } catch (writeError) {
        l.dim(
          `Could not save invalid scene draft candidate: ${
            writeError instanceof Error ? writeError.message : String(writeError)
          }`
        )
      }
      throw coverageError
    }

    const outputPath = getSceneJsonPath(sceneSlug)
    await mkdir(dirname(outputPath), { recursive: true })
    await Bun.write(outputPath, JSON.stringify(validated, null, 2))

    stats.filesProcessed++
    comicLog.line('scene-json generated', [
      `file=${basename(outputPath)}`,
      `model=${response.model}`,
      usage ? `tokens=${usage.total_tokens.toLocaleString()}` : 'tokens=unavailable',
      usage ? `cost=${formatCompactCost(stats.totalCost)}` : 'cost=unavailable',
      `api=${formatDuration(requestDurationMs)}`,
    ])
  } catch (error) {
    err(`Failed to generate scene JSON for ${sceneSlug}:`, error instanceof Error ? error.message : String(error))
    throw error
  }

  return stats
}
