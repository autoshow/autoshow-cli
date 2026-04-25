import type { DeepgramTtsModel, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks, concatAndConvertToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { DEEPGRAM_DEFAULT_VOICE, validateDeepgramTtsVoice } from '~/cli/commands/setup-and-utilities/models/model-options'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { readDeepgramError } from './deepgram-utils'

const DEEPGRAM_DEFAULT_BASE_URL = 'https://api.deepgram.com'
const MAX_CHARS_PER_CHUNK = 2000

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

export const runDeepgramTts = async (
  text: string,
  outputDir: string,
  options: { model: DeepgramTtsModel, voiceId?: string | undefined }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = readEnv('DEEPGRAM_API_KEY')
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY environment variable is required for Deepgram TTS')
  }

  const baseURL = trimTrailingSlash(readEnv('DEEPGRAM_BASE_URL') ?? DEEPGRAM_DEFAULT_BASE_URL)
  const rawVoice = options.voiceId?.trim() || readEnv('DEEPGRAM_TTS_VOICE') || options.model || DEEPGRAM_DEFAULT_VOICE
  const voice = validateDeepgramTtsVoice(rawVoice)
  const chunks = splitTextIntoChunks(text, MAX_CHARS_PER_CHUNK)

  if (chunks.length === 0) {
    throw new Error('Deepgram TTS input text is empty')
  }

  logTtsConfig('Deepgram', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'chunk count', value: chunks.length }
  ])

  const startTime = Date.now()
  const chunkPaths: string[] = []

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunkIndex = i + 1
      const chunkPath = `${outputDir}/speech-deepgram-chunk-${String(chunkIndex).padStart(3, '0')}.mp3`
      const audioBytes = await withRetry(
        { retryClass: 'runtime_http_create_conservative', operationName: `deepgram-tts-chunk-${chunkIndex}` },
        async (signal) => {
          const response = await fetch(`${baseURL}/v1/speak?model=${encodeURIComponent(voice)}`, {
            method: 'POST',
            headers: {
              Authorization: `Token ${apiKey}`,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg'
            },
            body: JSON.stringify({ text: chunks[i] as string }),
            ...(signal ? { signal } : {})
          })

          if (!response.ok) {
            const errText = await readDeepgramError(response)
            const err = new Error(`Deepgram TTS failed (${response.status}): ${errText}`) as Error & { status: number, headers: Headers }
            err.status = response.status
            err.headers = response.headers
            throw err
          }

          return new Uint8Array(await response.arrayBuffer())
        },
        (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
      )

      if (audioBytes.byteLength === 0) {
        throw new Error('Deepgram TTS returned empty audio')
      }

      await Bun.write(chunkPath, audioBytes)
      chunkPaths.push(chunkPath)
    }

    const audioPath = await concatAndConvertToWav(chunkPaths, outputDir, 'Deepgram')
    return finalizeTtsRun({
      service: 'deepgram',
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
