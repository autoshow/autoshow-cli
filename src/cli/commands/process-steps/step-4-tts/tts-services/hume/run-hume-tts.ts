import type { HumeTtsModel, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks, concatAndConvertToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import {
  HUME_DEFAULT_TTS_VOICE,
  validateHumeTtsVoice,
  validateHumeTtsVoiceProvider
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'

const HUME_DEFAULT_BASE_URL = 'https://api.hume.ai'
const MAX_CHARS_PER_CHUNK = 5000
const UUID_LIKE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type HumeVoicePayload =
  | { id: string }
  | { name: string, provider: string }

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const readHumeError = async (response: Response): Promise<string> => {
  const text = await response.text()
  return text.trim() || `HTTP ${response.status}`
}

const resolveHumeVoice = (
  options: {
    voice?: string | undefined
    voiceProvider?: string | undefined
  }
): { label: string, payload: HumeVoicePayload, provider?: string | undefined } => {
  const rawVoice = options.voice?.trim() || readEnv('HUME_TTS_VOICE') || HUME_DEFAULT_TTS_VOICE
  const label = validateHumeTtsVoice(rawVoice)
  const explicitProvider = options.voiceProvider?.trim() || readEnv('HUME_TTS_VOICE_PROVIDER')

  if (UUID_LIKE_RE.test(label) && !explicitProvider) {
    return { label, payload: { id: label } }
  }

  const provider = validateHumeTtsVoiceProvider(explicitProvider || 'HUME_AI')
  return { label, provider, payload: { name: label, provider } }
}

export const runHumeTts = async (
  text: string,
  outputDir: string,
  options: {
    model: HumeTtsModel
    voice?: string | undefined
    voiceProvider?: string | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = readEnv('HUME_API_KEY')
  if (!apiKey) {
    throw new Error('HUME_API_KEY environment variable is required for Hume TTS')
  }

  const baseURL = trimTrailingSlash(readEnv('HUME_BASE_URL') ?? HUME_DEFAULT_BASE_URL)
  const chunks = splitTextIntoChunks(text, MAX_CHARS_PER_CHUNK)

  if (chunks.length === 0) {
    throw new Error('Hume TTS input text is empty')
  }

  const voice = resolveHumeVoice(options)

  logTtsConfig('Hume', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice.label },
    { label: 'voice provider', value: voice.provider },
    { label: 'chunk count', value: chunks.length }
  ])

  const startTime = Date.now()
  const chunkPaths: string[] = []

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunkIndex = i + 1
      const chunkPath = `${outputDir}/speech-hume-chunk-${String(chunkIndex).padStart(3, '0')}.mp3`
      const audioBytes = await withRetry(
        { retryClass: 'runtime_http_create_conservative', operationName: `hume-tts-chunk-${chunkIndex}` },
        async (signal) => {
          const response = await fetch(`${baseURL}/v0/tts/file`, {
            method: 'POST',
            headers: {
              'X-Hume-Api-Key': apiKey,
              'Content-Type': 'application/json',
              Accept: 'application/octet-stream'
            },
            body: JSON.stringify({
              version: '2',
              format: { type: 'mp3' },
              num_generations: 1,
              utterances: [{
                text: chunks[i] as string,
                voice: voice.payload
              }]
            }),
            ...(signal ? { signal } : {})
          })

          if (!response.ok) {
            const errText = await readHumeError(response)
            const err = new Error(`Hume TTS failed (${response.status}): ${errText}`) as Error & { status: number, headers: Headers }
            err.status = response.status
            err.headers = response.headers
            throw err
          }

          return new Uint8Array(await response.arrayBuffer())
        },
        (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
      )

      if (audioBytes.byteLength === 0) {
        throw new Error('Hume TTS returned empty audio')
      }

      await Bun.write(chunkPath, audioBytes)
      chunkPaths.push(chunkPath)
    }

    const audioPath = await concatAndConvertToWav(chunkPaths, outputDir, 'Hume')
    return finalizeTtsRun({
      service: 'hume',
      model: options.model,
      speaker: voice.label,
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
