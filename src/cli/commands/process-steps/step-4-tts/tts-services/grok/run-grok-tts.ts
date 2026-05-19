import * as v from 'valibot'
import type { GrokTtsModel, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks, concatAndConvertToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { GROK_DEFAULT_TTS_VOICE, validateGrokTtsLanguage, validateGrokTtsVoice } from '~/cli/commands/setup-and-utilities/models/model-options'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { validateDataSafe } from '~/utils/validate/validation'

const GROK_DEFAULT_BASE_URL = 'https://api.x.ai/v1'
const MAX_CHARS_PER_CHUNK = 15000

const GrokErrorSchema = v.object({
  error: v.optional(v.object({
    message: v.optional(v.string(), undefined)
  }), undefined),
  message: v.optional(v.string(), undefined)
})

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const readGrokError = async (response: Response): Promise<string> => {
  const raw = await response.text()
  if (!raw.trim()) {
    return `HTTP ${response.status}`
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    const validated = validateDataSafe(GrokErrorSchema, parsed)
    if (!validated) {
      return raw
    }

    if (typeof validated.error?.message === 'string' && validated.error.message.trim().length > 0) {
      return validated.error.message
    }
    if (typeof validated.message === 'string' && validated.message.trim().length > 0) {
      return validated.message
    }
    return raw
  } catch {
    return raw
  }
}

export const runGrokTts = async (
  text: string,
  outputDir: string,
  options: {
    model: GrokTtsModel
    voiceId?: string | undefined
    language?: string | undefined
    textNormalization?: boolean | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required for Grok TTS')
  }

  const baseURL = trimTrailingSlash(readEnv('XAI_BASE_URL') ?? GROK_DEFAULT_BASE_URL)
  const rawVoice = options.voiceId?.trim() || readEnv('XAI_TTS_VOICE') || GROK_DEFAULT_TTS_VOICE
  const voice = validateGrokTtsVoice(rawVoice)
  const language = validateGrokTtsLanguage(options.language?.trim() || 'auto')
  const chunks = splitTextIntoChunks(text, MAX_CHARS_PER_CHUNK)

  if (chunks.length === 0) {
    throw new Error('Grok TTS input text is empty')
  }

  logTtsConfig('Grok', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'language', value: language },
    ...(options.textNormalization === true ? [{ label: 'text normalization', value: 'enabled' }] : []),
    { label: 'chunk count', value: chunks.length }
  ])

  const startTime = Date.now()
  const chunkPaths: string[] = []

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunkIndex = i + 1
      const chunkPath = `${outputDir}/speech-grok-chunk-${String(chunkIndex).padStart(3, '0')}.wav`
      const audioBytes = await withRetry(
        { retryClass: 'runtime_http_create_conservative', operationName: `grok-tts-chunk-${chunkIndex}` },
        async (signal) => {
          const response = await fetch(`${baseURL}/tts`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              Accept: 'audio/wav'
            },
            body: JSON.stringify({
              text: chunks[i] as string,
              voice_id: voice,
              language,
              text_normalization: options.textNormalization === true,
              output_format: {
                codec: 'wav',
                sample_rate: 24000
              }
            }),
            ...(signal ? { signal } : {})
          })

          if (!response.ok) {
            const errText = await readGrokError(response)
            const err = new Error(`Grok TTS failed (${response.status}): ${errText}`) as Error & { status: number, headers: Headers }
            err.status = response.status
            err.headers = response.headers
            throw err
          }

          return new Uint8Array(await response.arrayBuffer())
        },
        (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
      )

      if (audioBytes.byteLength === 0) {
        throw new Error('Grok TTS returned empty audio')
      }

      await Bun.write(chunkPath, audioBytes)
      chunkPaths.push(chunkPath)
    }

    const audioPath = await concatAndConvertToWav(chunkPaths, outputDir, 'Grok')
    return finalizeTtsRun({
      service: 'grok',
      model: options.model,
      speaker: voice,
      audioPath,
      chunkCount: chunks.length,
      startTime
    })
  } finally {
    for (const chunkPath of chunkPaths) {
      await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
    }
  }
}
