import { GoogleGenAI } from '@google/genai'
import type { GeminiInlineAudioInfo, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks, concatAndConvertToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { exec } from '~/utils/cli-utils'
import { withRetry } from '~/utils/retries'
import { GEMINI_DEFAULT_TTS_VOICE, type GeminiTtsModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { readEnv } from '~/utils/validate/env-utils'
import { classifyGeminiRetry } from '~/utils/gemini-utils'

const MAX_CHARS_PER_CHUNK = 4000

const parseGeminiInlineAudioInfo = (mimeType: string | undefined): GeminiInlineAudioInfo => {
  const raw = mimeType ?? ''
  const normalized = raw.toLowerCase()
  const rateMatch = /rate=(\d+)/i.exec(raw)
  const parsedRate = rateMatch ? Number.parseInt(rateMatch[1] as string, 10) : NaN
  const sampleRate = Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : 24000

  if (normalized.includes('audio/l16') || normalized.includes('codec=pcm') || normalized.includes('audio/pcm')) {
    return {
      ext: 'pcm',
      isRawPcm: true,
      sampleRate
    }
  }
  if (normalized.includes('wav')) return { ext: 'wav', isRawPcm: false, sampleRate }
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return { ext: 'mp3', isRawPcm: false, sampleRate }
  if (normalized.includes('ogg')) return { ext: 'ogg', isRawPcm: false, sampleRate }
  if (normalized.includes('aac')) return { ext: 'aac', isRawPcm: false, sampleRate }
  if (normalized.includes('flac')) return { ext: 'flac', isRawPcm: false, sampleRate }
  return { ext: 'wav', isRawPcm: false, sampleRate }
}

export const runGeminiTts = async (
  text: string,
  outputDir: string,
  options: { model: GeminiTtsModel, voiceId?: string | undefined }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = readEnv('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required for Gemini TTS')
  }

  const voiceId = options.voiceId?.trim() || readEnv('GEMINI_TTS_VOICE') || GEMINI_DEFAULT_TTS_VOICE
  const chunks = splitTextIntoChunks(text, MAX_CHARS_PER_CHUNK)
  if (chunks.length === 0) {
    throw new Error('Gemini TTS input text is empty')
  }

  logTtsConfig('Gemini', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voiceId },
    { label: 'chunk count', value: chunks.length }
  ])

  const ai = new GoogleGenAI({ apiKey })
  const startTime = Date.now()
  const chunkPaths: string[] = []
  let chunkFileIndex = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i] as string
    const response = await withRetry(
      {
        retryClass: 'runtime_http_create_conservative',
        operationName: 'gemini-tts-generate',
        policy: { maxAttempts: 3 }
      },
      async () => {
        return await ai.models.generateContent({
          model: options.model,
          contents: chunk,
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceId
                }
              }
            }
          }
        })
      },
      classifyGeminiRetry
    )

    const parts = response.candidates?.[0]?.content?.parts ?? []
    for (const part of parts) {
      const inlineData = part.inlineData
      if (!inlineData || part.thought === true) {
        continue
      }

      const data = inlineData.data
      if (!data) {
        continue
      }

      chunkFileIndex += 1
      const info = parseGeminiInlineAudioInfo(inlineData.mimeType)
      const rawPath = `${outputDir}/speech-gemini-raw-${String(chunkFileIndex).padStart(3, '0')}.${info.ext}`
      const wavChunkPath = `${outputDir}/speech-gemini-chunk-${String(chunkFileIndex).padStart(3, '0')}.wav`
      const rawBytes = Buffer.from(data, 'base64')
      if (rawBytes.byteLength === 0) {
        continue
      }
      await Bun.write(rawPath, rawBytes)

      const ffmpegArgs = info.isRawPcm
        ? [
            '-f', 's16le',
            '-ar', String(info.sampleRate),
            '-ac', '1',
            '-i', rawPath,
            '-ar', '16000',
            '-ac', '1',
            '-c:a', 'pcm_s16le',
            '-y',
            wavChunkPath
          ]
        : [
            '-i', rawPath,
            '-ar', '16000',
            '-ac', '1',
            '-c:a', 'pcm_s16le',
            '-y',
            wavChunkPath
          ]

      const ffmpeg = await exec('ffmpeg', ffmpegArgs)
      if (ffmpeg.exitCode !== 0) {
        throw new Error(`Failed to convert Gemini audio chunk to WAV: ${ffmpeg.stderr.trim()}`)
      }

      await Bun.$`rm -f ${rawPath}`.quiet().nothrow()
      chunkPaths.push(wavChunkPath)
    }
  }

  if (chunkPaths.length === 0) {
    throw new Error('Gemini TTS returned no audio data')
  }

  const audioPath = await concatAndConvertToWav(chunkPaths, outputDir, 'Gemini')
  for (const chunkPath of chunkPaths) {
    await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
  }

  return finalizeTtsRun({
    service: 'gemini',
    model: options.model,
    speaker: voiceId,
    audioPath,
    chunkCount: chunkPaths.length,
    startTime
  })
}
