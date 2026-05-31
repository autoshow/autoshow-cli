import type { OpenAITtsModel, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks, concatAndConvertToWav, runTtsChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { withHostedTtsRetry } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry'
import { OPENAI_DEFAULT_TTS_VOICE } from '~/cli/commands/setup-and-utilities/models/model-options'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/openai/openai-utils'
import {
  ensureOpenAITtsCustomVoice,
  resolveOpenAITtsBaseUrl,
  toOpenAISpeechVoice,
  type OpenAITtsCustomVoiceOptions
} from './openai-custom-voices'
import { createOpenAISpeech } from '~/utils/openai/client'

export const runOpenAITts = async (
  text: string,
  outputDir: string,
  options: {
    model: OpenAITtsModel
    voiceId?: string | undefined
    clone?: OpenAITtsCustomVoiceOptions | undefined
    instructions?: string | undefined
    speed?: number | undefined
    chunkConcurrency?: number | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const config = getOpenAIClientConfig()
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.openai)

  if (chunks.length === 0) {
    throw new Error('OpenAI TTS input text is empty')
  }

  const startTime = Date.now()
  const cloneResult = options.clone
    ? await ensureOpenAITtsCustomVoice(resolveOpenAITtsBaseUrl(config.baseURL), config.apiKey, options.clone)
    : undefined
  const voiceId = (cloneResult?.voiceId ?? options.voiceId?.trim()) || OPENAI_DEFAULT_TTS_VOICE
  const speaker = cloneResult ? `ref_audio:${cloneResult.sampleAudio.basename}` : voiceId
  const speechVoice = toOpenAISpeechVoice(voiceId)

  logTtsConfig('OpenAI', [
    { label: 'model', value: options.model },
    { label: cloneResult ? 'reference audio' : 'voice', value: cloneResult ? cloneResult.sampleAudio.basename : voiceId },
    ...(cloneResult ? [{ label: 'cloned voice_id', value: cloneResult.voiceId }] : []),
    ...(options.instructions ? [{ label: 'instructions', value: 'configured' }] : []),
    ...(typeof options.speed === 'number' ? [{ label: 'speed', value: options.speed }] : []),
    { label: 'chunk count', value: chunks.length }
  ])

  const chunkPaths: string[] = []

  try {
    const orderedChunkPaths = await runTtsChunks(chunks, options.chunkConcurrency, async (chunk, index) => {
      const chunkPath = `${outputDir}/speech-openai-chunk-${String(index + 1).padStart(3, '0')}.wav`
      const requestBody = {
        model: options.model,
        voice: speechVoice,
        input: chunk,
        response_format: 'wav' as const,
        ...(options.instructions ? { instructions: options.instructions } : {}),
        ...(typeof options.speed === 'number' ? { speed: options.speed } : {})
      }
      const bytes = await withHostedTtsRetry(
        { operationName: `openai-tts-chunk-${index + 1}` },
        async (signal) => await createOpenAISpeech(config, requestBody, { signal })
      )
      if (bytes.byteLength === 0) {
        throw new Error('OpenAI TTS returned empty audio')
      }
      await Bun.write(chunkPath, bytes)
      chunkPaths.push(chunkPath)
      return chunkPath
    })

    const audioPath = await concatAndConvertToWav(orderedChunkPaths, outputDir, 'OpenAI')
    const result = finalizeTtsRun({
      service: 'openai',
      model: options.model,
      speaker,
      audioPath,
      chunkCount: chunks.length,
      startTime
    })

    return {
      audioPath: result.audioPath,
      metadata: {
        ...result.metadata,
        ...(cloneResult ? { clonedVoiceId: cloneResult.voiceId, cloneCostCents: 0 } : {})
      }
    }
  } finally {
    for (const chunkPath of chunkPaths) {
      await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
    }
  }
}
