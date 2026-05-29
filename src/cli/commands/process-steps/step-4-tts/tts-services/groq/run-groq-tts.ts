import type { GroqTtsModel, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks, concatAndConvertToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { fetchTtsAudioBytes } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-http-utils'
import {
  getGroqDefaultTtsVoiceForModel,
  validateGroqTtsVoiceForModel
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { readEnv } from '~/utils/validate/env-utils'
import { GROQ_DEFAULT_BASE_URL } from '~/utils/base-urls'
const MAX_CHARS_PER_CHUNK = 200

export const runGroqTts = async (
  text: string,
  outputDir: string,
  options: { model: GroqTtsModel, voiceId?: string | undefined }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = readEnv('GROQ_API_KEY')
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is required for Groq TTS')
  }

  const baseURL = GROQ_DEFAULT_BASE_URL
  const rawVoice = options.voiceId?.trim() || getGroqDefaultTtsVoiceForModel(options.model)
  const voice = validateGroqTtsVoiceForModel(options.model, rawVoice)
  const chunks = splitTextIntoChunks(text, MAX_CHARS_PER_CHUNK)
  if (chunks.length === 0) {
    throw new Error('Groq TTS input text is empty')
  }

  logTtsConfig('Groq', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'chunk count', value: chunks.length }
  ])

  const startTime = Date.now()
  const chunkPaths: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunkIndex = i + 1
    const chunkPath = `${outputDir}/speech-groq-chunk-${String(chunkIndex).padStart(3, '0')}.wav`
    const audioBytes = await fetchTtsAudioBytes({
      url: `${baseURL}/audio/speech`,
      apiKey,
      providerLabel: 'Groq',
      body: {
        model: options.model,
        voice,
        input: chunks[i] as string,
        response_format: 'wav'
      }
    })

    if (audioBytes.byteLength === 0) {
      throw new Error('Groq TTS returned empty audio')
    }

    await Bun.write(chunkPath, audioBytes)
    chunkPaths.push(chunkPath)
  }

  const audioPath = await concatAndConvertToWav(chunkPaths, outputDir, 'Groq')
  for (const chunkPath of chunkPaths) {
    await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
  }

  return finalizeTtsRun({
    service: 'groq',
    model: options.model,
    speaker: voice,
    audioPath,
    chunkCount: chunks.length,
    startTime
  })
}
