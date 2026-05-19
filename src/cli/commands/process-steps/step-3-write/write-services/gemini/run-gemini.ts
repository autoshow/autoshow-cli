import * as l from '~/utils/logger'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { readEnv } from '~/utils/validate/env-utils'
import { withRetry } from '~/utils/retries'
import { runWithLLMInstrumentation, buildStep3Metadata } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-instrumentation'
import { classifyGeminiRetry } from '~/cli/commands/process-steps/step-3-write/write-services/gemini/gemini-utils'
import { geminiGenerateContent } from '~/utils/gemini/gemini-rest'

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

    const apiCall = (): Promise<string> => withRetry(
      {
        retryClass: 'runtime_http_create_conservative',
        operationName: 'gemini-llm',
        policy: { maxAttempts: 3 }
      },
      async () => {
        const generationConfig: Record<string, unknown> | undefined = structuredOpts
          ? {
              responseMimeType: 'application/json',
              responseJsonSchema: structuredOpts.schema
            }
          : undefined

        const response = await geminiGenerateContent(apiKey, {
          model,
          contents: prompt,
          ...(generationConfig ? { generationConfig } : {})
        })

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
