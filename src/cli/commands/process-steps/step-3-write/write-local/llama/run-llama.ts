import { countTokens } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import * as l from '~/utils/logger'
import { withProcessLock } from '~/utils/process-lock'
import { requestLlamaCompletion } from './llama-client'
import { LLAMA_PROCESS_LOCK_NAME } from './llama-constants'
import { resolveLlamaRequestModel } from './llama-server-identity'
import { ensureLlamaServerRunning } from './llama-server-runtime'

export { LLAMA_PROCESS_LOCK_NAME } from './llama-constants'
export { resolveLlamaServerTarget } from './llama-config'
export { ensureLlamaModelDownloaded } from './llama-model-download'
export {
  evaluateLlamaServerIdentityMatch,
  parseLlamaServerIdentityFromModels,
  parseLlamaServerIdentityFromProps
} from './llama-server-identity'
export {
  findLlamaServerPidsFromPsOutput,
  stopDefaultLlamaServer
} from './llama-server-process'

const withLlamaServerLock = async <T,>(fn: () => Promise<T>): Promise<T> =>
  await withProcessLock(LLAMA_PROCESS_LOCK_NAME, fn)

export const runLlamaModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  try {
    return await withLlamaServerLock(async () => {
      const identity = await ensureLlamaServerRunning(model)
      const requestModel = resolveLlamaRequestModel(identity)

      const inputTokenCount = countTokens(prompt)
      const startTime = Date.now()

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1800000)
      try {
        const completion = await requestLlamaCompletion(prompt, requestModel, controller.signal)
        const processingTime = Date.now() - startTime
        const responseText = completion.responseText
        const outputTokenCount = completion.outputTokenCount

        const metadata: Step3Metadata = {
          llmService: 'llama.cpp',
          llmModel: model,
          processingTime,
          inputTokenCount,
          outputTokenCount,
          outputFileName: '',
          outputFormat: 'json',
          structuredMode: structuredOpts?.strategy ?? 'schema-guided',
          structuredPresetNames: []
        }

        return { result: responseText, metadata }
      } finally {
        clearTimeout(timeoutId)
      }
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      l.error(`llama.cpp request timed out after 30 minutes`)
      throw new Error('llama.cpp processing timed out after 30 minutes')
    }
    l.error(`Failed to run llama.cpp model`, error)
    throw error
  }
}
