import type { GrokTtsModel, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks, concatAndConvertToWav, runTtsChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { fetchTtsAudioBytes, trimTrailingSlash } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-http-utils'
import { withHostedTtsRetry } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry'
import { GROK_DEFAULT_TTS_VOICE, validateGrokTtsLanguage, validateGrokTtsVoice } from '~/cli/commands/setup-and-utilities/models/model-options'
import { readEnv } from '~/utils/validate/env-utils'
import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'

export const runGrokTts = async (
  text: string,
  outputDir: string,
  options: {
    model: GrokTtsModel
    voiceId?: string | undefined
    language?: string | undefined
    textNormalization?: boolean | undefined
    chunkConcurrency?: number | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required for Grok TTS')
  }

  const baseURL = trimTrailingSlash(XAI_DEFAULT_BASE_URL)
  const rawVoice = options.voiceId?.trim() || GROK_DEFAULT_TTS_VOICE
  const voice = validateGrokTtsVoice(rawVoice)
  const language = validateGrokTtsLanguage(options.language?.trim() || 'auto')
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.grok)

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
    const orderedChunkPaths = await runTtsChunks(chunks, options.chunkConcurrency, async (chunk, index) => {
      const chunkIndex = index + 1
      const chunkPath = `${outputDir}/speech-grok-chunk-${String(chunkIndex).padStart(3, '0')}.wav`
      const audioBytes = await withHostedTtsRetry(
        { operationName: `grok-tts-chunk-${chunkIndex}` },
        async (signal) => await fetchTtsAudioBytes({
          url: `${baseURL}/tts`,
          apiKey,
          providerLabel: 'Grok',
          signal,
          body: {
            text: chunk,
            voice_id: voice,
            language,
            text_normalization: options.textNormalization === true,
            output_format: {
              codec: 'wav',
              sample_rate: 24000
            }
          }
        })
      )

      if (audioBytes.byteLength === 0) {
        throw new Error('Grok TTS returned empty audio')
      }

      await Bun.write(chunkPath, audioBytes)
      chunkPaths.push(chunkPath)
      return chunkPath
    })

    const audioPath = await concatAndConvertToWav(orderedChunkPaths, outputDir, 'Grok')
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
