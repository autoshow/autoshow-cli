import { GoogleGenAI } from '@google/genai'
import * as l from '~/logger'
import type { Step3Metadata } from '~/types'
import { readEnv } from '~/utils/validate/env-utils'
import { withRetry } from '~/utils/retries'
import type { StructuredRequestOptions } from '~/cli/commands/process-steps/step-3-write/structured-output/types'
import { runWithLLMInstrumentation, buildStep3Metadata } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-instrumentation'
import { classifyGeminiRetry } from '~/utils/gemini-utils'

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

    const apiCall = (): Promise<string> => withRetry(
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
      classifyGeminiRetry
    )

    const { responseText, inputTokenCount, outputTokenCount, processingTime } = await runWithLLMInstrumentation(prompt, apiCall)
    const metadata = buildStep3Metadata('gemini', model, { processingTime, inputTokenCount, outputTokenCount }, structuredOpts)

    return { result: responseText, metadata }
  } catch (error) {
    l.error(`Failed to run Gemini model`, error)
    throw error
  }
}
