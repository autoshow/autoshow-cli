import type { DeepgramTtsModel, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks, concatAndConvertToWav, runTtsChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { withHostedTtsRetry } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry'
import { DEEPGRAM_DEFAULT_VOICE, validateDeepgramTtsVoice } from '~/cli/commands/setup-and-utilities/models/model-options'
import { readEnv } from '~/utils/validate/env-utils'
import { DEEPGRAM_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readDeepgramError } from './deepgram-utils'

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

export const runDeepgramTts = async (
  text: string,
  outputDir: string,
  options: {
    model: DeepgramTtsModel
    voiceId?: string | undefined
    encoding?: string | undefined
    container?: string | undefined
    bitRate?: number | undefined
    sampleRate?: number | undefined
    speed?: number | undefined
    chunkConcurrency?: number | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = readEnv('DEEPGRAM_API_KEY')
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY environment variable is required for Deepgram TTS')
  }

  const baseURL = trimTrailingSlash(DEEPGRAM_DEFAULT_BASE_URL)
  const rawVoice = options.voiceId?.trim() || options.model || DEEPGRAM_DEFAULT_VOICE
  const voice = validateDeepgramTtsVoice(rawVoice)
  const encoding = options.encoding?.trim() || undefined
  const container = options.container?.trim() || undefined
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.deepgram)

  if (chunks.length === 0) {
    throw new Error('Deepgram TTS input text is empty')
  }

  logTtsConfig('Deepgram', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'encoding', value: encoding },
    { label: 'container', value: container },
    { label: 'bit rate', value: options.bitRate },
    { label: 'sample rate', value: options.sampleRate },
    { label: 'speed', value: options.speed },
    { label: 'chunk count', value: chunks.length }
  ])

  const startTime = Date.now()
  const chunkPaths: string[] = []

  try {
    const orderedChunkPaths = await runTtsChunks(chunks, options.chunkConcurrency, async (chunk, index) => {
      const chunkIndex = index + 1
      const chunkPath = `${outputDir}/speech-deepgram-chunk-${String(chunkIndex).padStart(3, '0')}.mp3`
      const params = new URLSearchParams({ model: voice })
      if (encoding) params.set('encoding', encoding)
      if (container) params.set('container', container)
      if (typeof options.bitRate === 'number') params.set('bit_rate', String(options.bitRate))
      if (typeof options.sampleRate === 'number') params.set('sample_rate', String(options.sampleRate))
      if (typeof options.speed === 'number') params.set('speed', String(options.speed))
      const audioBytes = await withHostedTtsRetry(
        { operationName: `deepgram-tts-chunk-${chunkIndex}` },
        async (signal) => {
          const response = await fetch(`${baseURL}/v1/speak?${params.toString()}`, {
            method: 'POST',
            headers: {
              Authorization: `Token ${apiKey}`,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg'
            },
            body: JSON.stringify({ text: chunk }),
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
        }
      )

      if (audioBytes.byteLength === 0) {
        throw new Error('Deepgram TTS returned empty audio')
      }

      await Bun.write(chunkPath, audioBytes)
      chunkPaths.push(chunkPath)
      return chunkPath
    })

    const audioPath = await concatAndConvertToWav(orderedChunkPaths, outputDir, 'Deepgram')
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
