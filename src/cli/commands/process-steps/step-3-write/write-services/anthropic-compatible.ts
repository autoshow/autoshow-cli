import * as l from '~/logger'
import type {
  RunAnthropicCompatibleModelOptions,
  Step3Metadata
} from '~/types'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { runWithLLMInstrumentation, buildStep3Metadata } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-instrumentation'

const createCombinedSignal = (signal?: AbortSignal): AbortSignal => {
  const timeoutSignal = AbortSignal.timeout(1800000)
  return AbortSignal.any([...(signal ? [signal] : []), timeoutSignal])
}

const extractAnthropicText = (content: Array<{ type: string, text?: string }>): string =>
  content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('')

export const runAnthropicCompatibleModel = async ({
  prompt,
  model,
  structuredOpts,
  client,
  service,
  providerLabel,
  operationName,
  supportsStructuredOutput = false
}: RunAnthropicCompatibleModelOptions): Promise<{ result: string, metadata: Step3Metadata }> => {
  try {
    const apiCall = (): Promise<string> => withRetry(
      { retryClass: 'runtime_http_create_conservative', operationName },
      async (signal) => {
        const requestBody: Record<string, unknown> = {
          model,
          max_tokens: 16000,
          messages: [{ role: 'user', content: prompt }]
        }

        if (supportsStructuredOutput && structuredOpts) {
          requestBody['output_config'] = {
            format: {
              type: 'json_schema',
              schema: structuredOpts.schema
            }
          }
        }

        const message = await client.messages.create(requestBody as any, {
          signal: createCombinedSignal(signal)
        })

        const text = extractAnthropicText(message.content as Array<{ type: string, text?: string }>)
        if (!text) {
          throw new Error('No response text from model')
        }
        return text
      },
      (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
    )

    const { responseText, inputTokenCount, outputTokenCount, processingTime } = await runWithLLMInstrumentation(prompt, apiCall)
    const metadata = buildStep3Metadata(service, model, { processingTime, inputTokenCount, outputTokenCount }, structuredOpts)

    return { result: responseText, metadata }
  } catch (error) {
    l.error(`Failed to run ${providerLabel} model`, error)
    throw error
  }
}
