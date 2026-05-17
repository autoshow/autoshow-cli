import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  createOpenAIResponse,
  extractOpenAIResponseText,
} from '~/utils/openai/client'
import {
  geminiGenerateContent,
  type GeminiGenerateContentUsageMetadata,
} from '~/utils/gemini/gemini-rest'
import * as v from 'valibot'
import { l, err } from '../../utils/logger'
import { ScenePromptDataSchema, SCENE_JSON_SCHEMA, StructuredScriptDataSchema } from '../../schemas/schemas'
import {
  getDraftPromptPath,
  getInvalidSceneJsonPath,
  getSceneJsonPath,
  getStructuredScriptPath,
} from '../../utils/project-paths'
import { getGeminiApiKey } from '../../utils/gemini-client'
import { calculateGeminiLlmCost } from '../../models/gemini-models'
import { isGeminiLlmModel, isOpenAiLlmModel } from '../../models/model-registry'
import { getOpenAIClientConfig } from '../../utils/openai-client'
import { LLM_MODEL_PRICING, openAiLlmSupportsStructuredOutputs } from '../../models/openai-models'
import { parseJsonFile } from '../../utils/json-prompt-utils'
import { validateSceneSourceSegmentCoverage } from '../../utils/source-coverage-utils'
import type {
  DraftSceneResponseUsage,
  DraftSceneRunStats,
  GeminiLlmModel,
  GenerateSceneJsonOptions,
  LlmModel,
  OpenAiLlmModel,
  SceneResponseResult,
} from '../../types'


const formatCost = (dollars: number): string => {
  return dollars < 0.01
    ? `$${dollars.toFixed(4)}`
    : `$${dollars.toFixed(2)}`
}

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

  throw new Error(`Unsupported LLM model "${model}"`)
}


export const generateSceneJson = async (
  sceneSlug: string,
  options: GenerateSceneJsonOptions
): Promise<DraftSceneRunStats> => {
  l(`Generating scene JSON from draft prompt via ${options.model}`)

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

    l.dim(`Sending to ${options.model}: ${sceneSlug}`)

    const requestStart = Date.now()
    const responseResult = await createSceneResponse(content, options.model)
    const requestDurationMs = Date.now() - requestStart
    const { response, usesStructuredOutputs } = responseResult

    // Log usage details
    const usage = response.usage
    l.dim(`  Model:            ${response.model}`)
    if (response.requestId) {
      l.dim(`  Response ID:      ${response.requestId}`)
    }
    if (response.status) {
      l.dim(`  Status:           ${response.status}`)
    }
    if (usage) {
      const cachedTokens = usage.input_tokens_details?.cached_tokens ?? 0
      const cost = calculateCost(options.model, usage)

      l.dim(`  Input tokens:     ${usage.input_tokens.toLocaleString()}${cachedTokens > 0 ? ` (${cachedTokens.toLocaleString()} cached)` : ''}`)
      l.dim(`  Output tokens:    ${usage.output_tokens.toLocaleString()}`)
      l.dim(`  Total tokens:     ${usage.total_tokens.toLocaleString()}`)
      l.dim(`  Cost:             ${formatCost(cost)}`)
      l.dim(`  Duration:         ${(requestDurationMs / 1000).toFixed(2)}s`)

      const reasoningTokens = usage.output_tokens_details?.reasoning_tokens
      if (reasoningTokens && reasoningTokens > 0) {
        l.dim(`  Reasoning tokens: ${reasoningTokens.toLocaleString()}`)
      }

      stats.totalInputTokens += usage.input_tokens
      stats.totalOutputTokens += usage.output_tokens
      stats.totalCachedTokens += cachedTokens
      stats.totalCost += cost
    } else {
      l.dim(`  Duration: ${(requestDurationMs / 1000).toFixed(2)}s (no usage data returned)`)
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
    l.dim(`Generated: ${sceneSlug}.json`)

    l('')
    l.success(`Scene JSON file generated: ${stats.filesProcessed}`)
  } catch (error) {
    err(`Failed to generate scene JSON for ${sceneSlug}:`, error instanceof Error ? error.message : String(error))
    throw error
  }

  return stats
}
