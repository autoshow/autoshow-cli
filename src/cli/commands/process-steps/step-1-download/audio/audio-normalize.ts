import { copyFile, rm } from 'node:fs/promises'
import { extname } from 'node:path'
import { exec } from '~/utils/cli-utils'

type FfprobeStream = {
  index?: unknown
  codec_type?: unknown
  codec_name?: unknown
  disposition?: unknown
}

type FfprobeFormat = {
  format_name?: unknown
  duration?: unknown
  bit_rate?: unknown
}

type FfprobePayload = {
  streams?: unknown
  format?: unknown
}

export type NormalizedAudioExtension = '.mp3' | '.m4a' | '.ogg' | '.flac'
export type NormalizedAudioFormat = 'mp3' | 'ipod' | 'ogg' | 'flac'
export type AudioNormalizationMode = 'copy-file' | 'copy-stream' | 'transcode-flac'

export type AudioStreamProbe = {
  index: number
  codecName: string
}

export type MediaProbe = {
  formatNames: string[]
  durationSeconds?: number | undefined
  bitRate?: number | undefined
  hasVideo: boolean
  audioStream: AudioStreamProbe
}

export type NormalizedAudioPlan = {
  mode: AudioNormalizationMode
  outputExtension: NormalizedAudioExtension
  outputFormat: NormalizedAudioFormat
  sourceCodecName: string
  reason: string
}

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

const parseFfprobePayload = (raw: string): FfprobePayload => {
  const parsed = JSON.parse(raw) as FfprobePayload
  return parsed
}

const parseFormatNames = (format: FfprobeFormat | undefined): string[] => {
  if (!format || typeof format.format_name !== 'string') {
    return []
  }

  return format.format_name
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)
}

const getLowercaseExtension = (filePath: string): string =>
  extname(filePath).toLowerCase()

const buildPlan = (
  mode: AudioNormalizationMode,
  outputExtension: NormalizedAudioExtension,
  outputFormat: NormalizedAudioFormat,
  sourceCodecName: string,
  reason: string
): NormalizedAudioPlan => ({
  mode,
  outputExtension,
  outputFormat,
  sourceCodecName,
  reason
})

export const probeMediaFile = async (inputPath: string): Promise<MediaProbe> => {
  const result = await exec('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=format_name,duration,bit_rate:stream=index,codec_type,codec_name:stream_disposition=attached_pic',
    '-of', 'json',
    inputPath
  ])

  if (result.exitCode !== 0) {
    throw new Error(`Failed to probe media file: ${result.stderr || result.stdout}`)
  }

  const payload = parseFfprobePayload(result.stdout)
  const streams = Array.isArray(payload.streams) ? payload.streams as FfprobeStream[] : []
  const format = typeof payload.format === 'object' && payload.format !== null
    ? payload.format as FfprobeFormat
    : undefined
  const audioStreamRaw = streams.find((stream) => stream.codec_type === 'audio')
  if (!audioStreamRaw || typeof audioStreamRaw.codec_name !== 'string') {
    throw new Error(`No audio stream found in ${inputPath}`)
  }

  const audioStream: AudioStreamProbe = {
    index: typeof audioStreamRaw.index === 'number' ? audioStreamRaw.index : 0,
    codecName: audioStreamRaw.codec_name.toLowerCase()
  }

  const isAttachedPicture = (stream: FfprobeStream): boolean => {
    if (typeof stream.disposition !== 'object' || stream.disposition === null) {
      return false
    }

    const attachedPic = (stream.disposition as Record<string, unknown>)['attached_pic']
    return attachedPic === 1
      || attachedPic === '1'
      || attachedPic === true
  }

  return {
    formatNames: parseFormatNames(format),
    durationSeconds: toFiniteNumber(format?.duration),
    bitRate: toFiniteNumber(format?.bit_rate),
    hasVideo: streams.some((stream) => stream.codec_type === 'video' && !isAttachedPicture(stream)),
    audioStream
  }
}

export const resolveNormalizedAudioPlan = (
  inputPath: string,
  probe: MediaProbe
): NormalizedAudioPlan => {
  const sourceExtension = getLowercaseExtension(inputPath)
  const codecName = probe.audioStream.codecName
  const isAudioOnly = probe.hasVideo === false

  if (codecName === 'mp3') {
    if (isAudioOnly && sourceExtension === '.mp3') {
      return buildPlan('copy-file', '.mp3', 'mp3', codecName, 'audio-only mp3 fast path')
    }

    return buildPlan('copy-stream', '.mp3', 'mp3', codecName, 'extract or remux mp3 audio without re-encoding')
  }

  if (codecName === 'aac' || codecName === 'alac') {
    if (isAudioOnly && sourceExtension === '.m4a') {
      return buildPlan('copy-file', '.m4a', 'ipod', codecName, 'audio-only m4a fast path')
    }

    return buildPlan('copy-stream', '.m4a', 'ipod', codecName, 'extract or remux AAC/ALAC audio without re-encoding')
  }

  if (codecName === 'opus' || codecName === 'vorbis') {
    if (isAudioOnly && sourceExtension === '.ogg') {
      return buildPlan('copy-file', '.ogg', 'ogg', codecName, 'audio-only ogg fast path')
    }

    return buildPlan('copy-stream', '.ogg', 'ogg', codecName, 'extract or remux Opus/Vorbis audio without re-encoding')
  }

  if (codecName === 'flac') {
    if (isAudioOnly && sourceExtension === '.flac') {
      return buildPlan('copy-file', '.flac', 'flac', codecName, 'audio-only flac fast path')
    }

    return buildPlan('copy-stream', '.flac', 'flac', codecName, 'extract or remux FLAC audio without re-encoding')
  }

  return buildPlan('transcode-flac', '.flac', 'flac', codecName, 'transcode unsupported or uncompressed audio once to FLAC')
}

export const planNormalizedAudioArtifact = async (
  inputPath: string
): Promise<{ probe: MediaProbe, plan: NormalizedAudioPlan }> => {
  const probe = await probeMediaFile(inputPath)
  return {
    probe,
    plan: resolveNormalizedAudioPlan(inputPath, probe)
  }
}

export const materializeNormalizedAudioArtifact = async (
  inputPath: string,
  outputPath: string,
  plan: NormalizedAudioPlan
): Promise<void> => {
  await rm(outputPath, { force: true })

  if (plan.mode === 'copy-file') {
    if (inputPath !== outputPath) {
      await copyFile(inputPath, outputPath)
    }
    return
  }

  const args = [
    '-i', inputPath,
    '-map', '0:a:0',
    '-vn'
  ]

  if (plan.mode === 'copy-stream') {
    args.push('-c:a', 'copy', '-f', plan.outputFormat, '-y', outputPath)
  } else {
    args.push('-c:a', 'flac', '-compression_level', '12', '-y', outputPath)
  }

  const result = await exec('ffmpeg', args)
  if (result.exitCode !== 0) {
    throw new Error(`Failed to normalize audio artifact: ${result.stderr || result.stdout}`)
  }
}

export const resolveSplitAudioPlan = (
  inputPath: string,
  probe: MediaProbe
): Pick<NormalizedAudioPlan, 'mode' | 'outputExtension' | 'outputFormat'> => {
  const normalizedPlan = resolveNormalizedAudioPlan(inputPath, probe)
  if (normalizedPlan.mode === 'transcode-flac') {
    return {
      mode: 'transcode-flac',
      outputExtension: '.flac',
      outputFormat: 'flac'
    }
  }

  return {
    mode: 'copy-stream',
    outputExtension: normalizedPlan.outputExtension,
    outputFormat: normalizedPlan.outputFormat
  }
}
