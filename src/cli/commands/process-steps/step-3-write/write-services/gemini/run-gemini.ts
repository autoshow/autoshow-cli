import { GoogleGenAI } from '@google/genai'
import * as l from '~/logger'
import type { Step3Metadata } from '~/types'
import { countTokens } from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import type { StructuredRequestOptions } from '~/cli/commands/process-steps/step-3-write/structured-output/types'

const parseStatusFromGeminiError = (error: unknown): number | undefined => {
  if (error && typeof error === 'object') {
    if ('status' in error && typeof error.status === 'number') {
      return error.status
    }
    if ('code' in error && typeof error.code === 'number') {
      return error.code
    }
  }

  if (error instanceof Error) {
    const codeMatch = /"code"\s*:\s*(\d{3})/.exec(error.message)
    if (codeMatch) {
      const parsed = Number.parseInt(codeMatch[1] as string, 10)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return undefined
}

export const runGeminiModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  try {
    const apiKey = readEnv('GEMINI_API_KEY')
    if (!apiKey) {
      l.error(`GEMINI_API_KEY not found in environment`)
      throw new Error('GEMINI_API_KEY environment variable is required')
    }

    const ai = new GoogleGenAI({ apiKey })

    const inputTokenCount = countTokens(prompt)
    const startTime = Date.now()

    const responseText = await withRetry(
      {
        retryClass: 'runtime_http_create_conservative',
        operationName: 'gemini-llm',
        policy: { maxAttempts: 3 }
      },
      async () => {
        const requestBody: Record<string, unknown> = {
          model,
          contents: prompt,
        }

        if (structuredOpts) {
          requestBody['config'] = {
            responseMimeType: 'application/json',
            responseJsonSchema: structuredOpts.schema
          }
        }

        const response = await ai.models.generateContent(requestBody as any)

        const text = response.text ?? ''
        if (!text) {
          throw new Error('No response text from model')
        }
        return text
      },
      (error) => {
        const decision = classifyFetchRetry(error, 'runtime_http_create_conservative')
        if (decision.shouldRetry) {
          return decision
        }

        const status = parseStatusFromGeminiError(error)
        if (status !== undefined && (status === 408 || status === 425 || status === 429 || status >= 500)) {
          return {
            shouldRetry: true,
            delayMs: 0,
            reason: `retryable status ${status}`
          }
        }

        return decision
      }
    )

    const processingTime = Date.now() - startTime
    const outputTokenCount = countTokens(responseText)

    const metadata: Step3Metadata = {
      llmService: 'gemini',
      llmModel: model,
      processingTime,
      inputTokenCount,
      outputTokenCount,
      outputFileName: '',
      outputFormat: structuredOpts ? 'json' : 'markdown',
      structuredMode: structuredOpts?.modeHint ?? 'off',
      structuredPresetNames: []
    }

    return { result: responseText, metadata }
  } catch (error) {
    l.error(`Failed to run Gemini model`, error)
    throw error
  }
}
