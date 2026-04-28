import * as v from 'valibot'
import type { GroqTtsModel, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks, concatAndConvertToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { GROQ_DEFAULT_TTS_VOICE, validateGroqTtsVoice } from '~/cli/commands/setup-and-utilities/models/model-options'
import { readEnv } from '~/utils/validate/env-utils'
import { validateDataSafe } from '~/utils/validate/validation'

const GROQ_DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1'
const MAX_CHARS_PER_CHUNK = 200

const GroqErrorSchema = v.object({
  error: v.optional(v.object({
    message: v.optional(v.string(), undefined)
  }), undefined),
  message: v.optional(v.string(), undefined)
})

const readGroqError = async (response: Response): Promise<string> => {
  const raw = await response.text()
  if (!raw.trim()) {
    return `HTTP ${response.status}`
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    const validated = validateDataSafe(GroqErrorSchema, parsed)
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

export const runGroqTts = async (
  text: string,
  outputDir: string,
  options: { model: GroqTtsModel, voiceId?: string | undefined }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = readEnv('GROQ_API_KEY')
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is required for Groq TTS')
  }

  const baseURL = readEnv('GROQ_BASE_URL') ?? GROQ_DEFAULT_BASE_URL
  const rawVoice = options.voiceId?.trim() || readEnv('GROQ_TTS_VOICE') || GROQ_DEFAULT_TTS_VOICE
  const voice = validateGroqTtsVoice(rawVoice)
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
    const response = await fetch(`${baseURL}/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'audio/wav'
      },
      body: JSON.stringify({
        model: options.model,
        voice,
        input: chunks[i] as string,
        response_format: 'wav'
      })
    })

    if (!response.ok) {
      const errText = await readGroqError(response)
      throw new Error(`Groq TTS failed (${response.status}): ${errText}`)
    }

    const audioBytes = new Uint8Array(await response.arrayBuffer())
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
