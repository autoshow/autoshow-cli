import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { countTokens } from '~/cli/commands/process-steps/step-2-stt/stt-utils/stt-utils'

export const runWithLLMInstrumentation = async (
  prompt: string,
  fn: () => Promise<string>
): Promise<{ responseText: string; inputTokenCount: number; outputTokenCount: number; processingTime: number }> => {
  const inputTokenCount = countTokens(prompt)
  const startTime = Date.now()
  const responseText = await fn()
  const processingTime = Date.now() - startTime
  const outputTokenCount = countTokens(responseText)
  return { responseText, inputTokenCount, outputTokenCount, processingTime }
}

export const buildStep3Metadata = (
  service: Step3Metadata['llmService'],
  model: string,
  timing: { processingTime: number; inputTokenCount: number; outputTokenCount: number },
  structuredOpts?: StructuredRequestOptions
): Step3Metadata => ({
  llmService: service,
  llmModel: model,
  processingTime: timing.processingTime,
  inputTokenCount: timing.inputTokenCount,
  outputTokenCount: timing.outputTokenCount,
  outputFileName: '',
  outputFormat: 'json',
  structuredMode: structuredOpts?.strategy ?? 'schema-guided',
  structuredPresetNames: []
})
