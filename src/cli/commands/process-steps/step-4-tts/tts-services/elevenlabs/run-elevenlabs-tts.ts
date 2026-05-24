import type { ElevenlabsTtsModel, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { exec } from '~/utils/cli-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { ELEVENLABS_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { ELEVENLABS_DEFAULT_VOICE_ID } from '~/cli/commands/setup-and-utilities/models/model-options'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { readElevenLabsError } from '~/cli/commands/process-steps/step-4-tts/tts-services/elevenlabs/elevenlabs-utils'
import {
  ensureElevenLabsTtsIvcVoice,
  type ElevenLabsTtsIvcOptions
} from './elevenlabs-ivc'

type ElevenLabsTtsVoiceSettings = {
  stability?: number | undefined
  similarity_boost?: number | undefined
  style?: number | undefined
  use_speaker_boost?: boolean | undefined
  speed?: number | undefined
}

type ElevenLabsTtsRequestControls = {
  outputFormat?: string | undefined
  languageCode?: string | undefined
  voiceSettings?: ElevenLabsTtsVoiceSettings | undefined
  seed?: number | undefined
  textNormalization?: string | undefined
  pronunciationDictionaryLocators?: string[] | undefined
  optimizeStreamingLatency?: number | undefined
}

const parsePronunciationDictionaryLocator = (
  value: string
): { pronunciation_dictionary_id: string, version_id?: string | undefined } => {
  const [rawId, rawVersion] = value.split(':', 2)
  const id = rawId?.trim()
  const version = rawVersion?.trim()
  if (!id) {
    throw new Error('Invalid --elevenlabs-tts-pronunciation-dictionary-locator value. Expected dictionary_id or dictionary_id:version_id.')
  }
  return {
    pronunciation_dictionary_id: id,
    ...(version ? { version_id: version } : {})
  }
}

const hasVoiceSettings = (settings: ElevenLabsTtsVoiceSettings | undefined): settings is ElevenLabsTtsVoiceSettings =>
  Boolean(settings && Object.values(settings).some((value) => value !== undefined))

export const runElevenLabsTts = async (
  text: string,
  outputDir: string,
  options: {
    model: ElevenlabsTtsModel
    voiceId?: string | undefined
    clone?: ElevenLabsTtsIvcOptions | undefined
    controls?: ElevenLabsTtsRequestControls | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = readEnv('ELEVENLABS_API_KEY')
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required for ElevenLabs TTS')
  }

  const baseURL = ELEVENLABS_DEFAULT_BASE_URL
  const audioPath = `${outputDir}/speech.wav`
  const tempAudioPath = `${outputDir}/speech-elevenlabs.mp3`
  const startTime = Date.now()
  const cloneResult = options.clone
    ? await ensureElevenLabsTtsIvcVoice(baseURL, apiKey, options.clone)
    : undefined
  const voiceId = cloneResult?.voiceId ?? options.voiceId?.trim() ?? ELEVENLABS_DEFAULT_VOICE_ID
  const outputFormat = options.controls?.outputFormat?.trim() || 'mp3_44100_128'
  const languageCode = options.controls?.languageCode?.trim() || undefined
  const pronunciationDictionaryLocators = options.controls?.pronunciationDictionaryLocators
    ?.map((item) => item.trim())
    .filter(Boolean)
    .map(parsePronunciationDictionaryLocator)
  const speaker = cloneResult
    ? `ref_audio:${cloneResult.sourceAudio.basename}`
    : voiceId

  logTtsConfig('ElevenLabs', [
    { label: 'model', value: options.model },
    {
      label: cloneResult ? 'reference audio' : 'voice',
      value: cloneResult ? cloneResult.sourceAudio.basename : voiceId
    },
    { label: 'output format', value: outputFormat },
    { label: 'language', value: languageCode },
    ...(cloneResult ? [{ label: 'cloned voice_id', value: cloneResult.voiceId }] : [])
  ])

  const audioBytes = await withRetry(
    { retryClass: 'runtime_http_create_conservative', operationName: 'elevenlabs-tts' },
    async () => {
      const params = new URLSearchParams({ output_format: outputFormat })
      if (typeof options.controls?.optimizeStreamingLatency === 'number') {
        params.set('optimize_streaming_latency', String(options.controls.optimizeStreamingLatency))
      }
      const voiceSettings = options.controls?.voiceSettings
      const requestBody = {
        text,
        model_id: options.model,
        ...(languageCode ? { language_code: languageCode } : {}),
        ...(hasVoiceSettings(voiceSettings) ? { voice_settings: voiceSettings } : {}),
        ...(typeof options.controls?.seed === 'number' ? { seed: options.controls.seed } : {}),
        ...(options.controls?.textNormalization ? { apply_text_normalization: options.controls.textNormalization } : {}),
        ...(pronunciationDictionaryLocators && pronunciationDictionaryLocators.length > 0
          ? { pronunciation_dictionary_locators: pronunciationDictionaryLocators }
          : {}),
      }
      const response = await fetch(`${baseURL}/text-to-speech/${encodeURIComponent(voiceId)}?${params.toString()}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errText = await readElevenLabsError(response)
        const err = new Error(`ElevenLabs TTS failed (${response.status}): ${errText}`) as Error & { status: number }
        err.status = response.status
        throw err
      }

      return await response.arrayBuffer()
    },
    (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
  )
  if (audioBytes.byteLength === 0) {
    throw new Error('ElevenLabs TTS returned empty audio')
  }

  await Bun.write(tempAudioPath, new Uint8Array(audioBytes))

  const ffmpeg = await exec('ffmpeg', [
    '-i', tempAudioPath,
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    '-y',
    audioPath
  ])

  if (ffmpeg.exitCode !== 0) {
    throw new Error(`Failed to convert ElevenLabs audio to WAV: ${ffmpeg.stderr.trim()}`)
  }

  await Bun.$`rm -f ${tempAudioPath}`.quiet().nothrow()

  const result = finalizeTtsRun({
    service: 'elevenlabs',
    model: options.model,
    speaker,
    audioPath,
    chunkCount: 1,
    startTime
  })

  return {
    audioPath: result.audioPath,
    metadata: {
      ...result.metadata,
      ...(cloneResult ? { clonedVoiceId: cloneResult.voiceId, cloneCostCents: 0 } : {})
    }
  }
}
