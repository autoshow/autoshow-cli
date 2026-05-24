import type { CartesiaTtsModel, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks, concatAndConvertToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import {
  CARTESIA_DEFAULT_TTS_VOICE,
  validateCartesiaTtsVoice
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { CARTESIA_DEFAULT_BASE_URL } from '~/utils/base-urls'
const CARTESIA_DEFAULT_VERSION = '2026-03-01'
const MAX_CHARS_PER_CHUNK = 5000

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const readCartesiaError = async (response: Response): Promise<string> => {
  const text = await response.text()
  return text.trim() || `HTTP ${response.status}`
}

export const runCartesiaTts = async (
  text: string,
  outputDir: string,
  options: {
    model: CartesiaTtsModel
    voiceId?: string | undefined
    language?: string | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = readEnv('CARTESIA_API_KEY')
  if (!apiKey) {
    throw new Error('CARTESIA_API_KEY environment variable is required for Cartesia TTS')
  }

  const baseURL = trimTrailingSlash(CARTESIA_DEFAULT_BASE_URL)
  const version = CARTESIA_DEFAULT_VERSION
  const voice = validateCartesiaTtsVoice(options.voiceId?.trim() || CARTESIA_DEFAULT_TTS_VOICE)
  const language = options.language?.trim() || undefined
  const chunks = splitTextIntoChunks(text, MAX_CHARS_PER_CHUNK)

  if (chunks.length === 0) {
    throw new Error('Cartesia TTS input text is empty')
  }

  logTtsConfig('Cartesia', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'language', value: language },
    { label: 'version', value: version },
    { label: 'chunk count', value: chunks.length }
  ])

  const startTime = Date.now()
  const chunkPaths: string[] = []

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunkIndex = i + 1
      const chunkPath = `${outputDir}/speech-cartesia-chunk-${String(chunkIndex).padStart(3, '0')}.wav`
      const audioBytes = await withRetry(
        { retryClass: 'runtime_http_create_conservative', operationName: `cartesia-tts-chunk-${chunkIndex}` },
        async (signal) => {
          const response = await fetch(`${baseURL}/tts/bytes`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Cartesia-Version': version,
              'Content-Type': 'application/json',
              Accept: 'application/octet-stream'
            },
            body: JSON.stringify({
              model_id: options.model,
              transcript: chunks[i] as string,
              voice: {
                mode: 'id',
                id: voice
              },
              ...(language ? { language } : {}),
              output_format: {
                container: 'wav',
                encoding: 'pcm_s16le',
                sample_rate: 24000
              }
            }),
            ...(signal ? { signal } : {})
          })

          if (!response.ok) {
            const errText = await readCartesiaError(response)
            const err = new Error(`Cartesia TTS failed (${response.status}): ${errText}`) as Error & { status: number, headers: Headers }
            err.status = response.status
            err.headers = response.headers
            throw err
          }

          return new Uint8Array(await response.arrayBuffer())
        },
        (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
      )

      if (audioBytes.byteLength === 0) {
        throw new Error('Cartesia TTS returned empty audio')
      }

      await Bun.write(chunkPath, audioBytes)
      chunkPaths.push(chunkPath)
    }

    const audioPath = await concatAndConvertToWav(chunkPaths, outputDir, 'Cartesia')
    return finalizeTtsRun({
      service: 'cartesia',
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
