import { copyFile, rm } from 'node:fs/promises'
import { extname } from 'node:path'
import { exec } from '~/utils/cli-utils'
import type {
  AudioNormalizationMode,
  AudioNormalizationProfile,
  AudioStreamProbe,
  FfprobeFormat,
  FfprobePayload,
  FfprobeStream,
  MediaProbe,
  NormalizedAudioExtension,
  NormalizedAudioFormat,
  NormalizedAudioPlan
} from '~/types'

const HOSTED_STT_MAX_BIT_RATE = 96_000

const isHostedSttProfile = (
  profile: AudioNormalizationProfile
): boolean => profile === 'hosted-stt' || profile === 'hosted-stt-mp3'

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
  profile: AudioNormalizationProfile,
  mode: AudioNormalizationMode,
  outputExtension: NormalizedAudioExtension,
  outputFormat: NormalizedAudioFormat,
  sourceCodecName: string,
  outputCodecName: string,
  reason: string,
  options: {
    targetBitRate?: number | undefined
    targetSampleRate?: number | undefined
    targetChannels?: number | undefined
  } = {}
): NormalizedAudioPlan => ({
  profile,
  mode,
  outputExtension,
  outputFormat,
  outputCodecName,
  sourceCodecName,
  reason,
  stripMetadata: isHostedSttProfile(profile),
  stripChapters: isHostedSttProfile(profile),
  ...(options.targetBitRate !== undefined ? { targetBitRate: options.targetBitRate } : {}),
  ...(options.targetSampleRate !== undefined ? { targetSampleRate: options.targetSampleRate } : {}),
  ...(options.targetChannels !== undefined ? { targetChannels: options.targetChannels } : {})
})

export const probeMediaFile = async (inputPath: string): Promise<MediaProbe> => {
  const result = await exec('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=format_name,duration,bit_rate:stream=index,codec_type,codec_name,sample_rate,channels,bit_rate:stream_disposition=attached_pic',
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
    codecName: audioStreamRaw.codec_name.toLowerCase(),
    sampleRate: toFiniteNumber(audioStreamRaw.sample_rate),
    channels: toFiniteNumber(audioStreamRaw.channels),
    bitRate: toFiniteNumber(audioStreamRaw.bit_rate) ?? toFiniteNumber(format?.bit_rate)
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
    bitRate: audioStream.bitRate,
    hasVideo: streams.some((stream) => stream.codec_type === 'video' && !isAttachedPicture(stream)),
    hasNonAudioStreams: streams.some((stream) => stream.codec_type !== 'audio'),
    audioStreamCount: streams.filter((stream) => stream.codec_type === 'audio').length,
    audioStream
  }
}

const isHostedPreserveCandidate = (
  inputPath: string,
  probe: MediaProbe
): boolean => {
  const sourceExtension = getLowercaseExtension(inputPath)
  const codecName = probe.audioStream.codecName
  const bitRate = probe.bitRate

  if (probe.audioStreamCount !== 1 || probe.hasNonAudioStreams || probe.audioStream.channels !== 1) {
    return false
  }

  if (bitRate === undefined || bitRate <= 0 || bitRate > HOSTED_STT_MAX_BIT_RATE) {
    return false
  }

  return (codecName === 'mp3' && sourceExtension === '.mp3')
    || (codecName === 'aac' && sourceExtension === '.m4a')
}

const isHostedMp3PreserveCandidate = (
  inputPath: string,
  probe: MediaProbe
): boolean => {
  const sourceExtension = getLowercaseExtension(inputPath)
  const codecName = probe.audioStream.codecName
  const bitRate = probe.bitRate

  if (probe.audioStreamCount !== 1 || probe.hasNonAudioStreams || probe.audioStream.channels !== 1) {
    return false
  }

  if (bitRate === undefined || bitRate <= 0 || bitRate > HOSTED_STT_MAX_BIT_RATE) {
    return false
  }

  return codecName === 'mp3' && sourceExtension === '.mp3'
}

const resolveHostedTargetBitRate = (probe: MediaProbe): number => {
  if (probe.bitRate !== undefined && probe.bitRate > 0) {
    return Math.min(Math.round(probe.bitRate), HOSTED_STT_MAX_BIT_RATE)
  }

  return HOSTED_STT_MAX_BIT_RATE
}

const resolveNormalizedAudioPlan = (
  inputPath: string,
  probe: MediaProbe,
  profile: AudioNormalizationProfile = 'default'
): NormalizedAudioPlan => {
  const sourceExtension = getLowercaseExtension(inputPath)
  const codecName = probe.audioStream.codecName
  const isAudioOnly = probe.hasVideo === false

  if (profile === 'hosted-stt') {
    if (isHostedPreserveCandidate(inputPath, probe)) {
      if (codecName === 'mp3') {
        return buildPlan(
          profile,
          'copy-stream',
          '.mp3',
          'mp3',
          codecName,
          'mp3',
          'preserve low-bitrate mono hosted-STT mp3 while stripping non-audio baggage'
        )
      }

      return buildPlan(
        profile,
        'copy-stream',
        '.m4a',
        'ipod',
        codecName,
        'aac',
        'preserve low-bitrate mono hosted-STT AAC in .m4a while stripping non-audio baggage'
      )
    }

    return buildPlan(
      profile,
      'transcode-aac',
      '.m4a',
      'ipod',
      codecName,
      'aac',
      'compress hosted-STT source media to mono AAC-LC in .m4a with a 96 kbps ceiling',
      {
        targetBitRate: resolveHostedTargetBitRate(probe),
        ...(probe.audioStream.sampleRate !== undefined ? { targetSampleRate: probe.audioStream.sampleRate } : {}),
        targetChannels: 1
      }
    )
  }

  if (profile === 'hosted-stt-mp3') {
    if (isHostedMp3PreserveCandidate(inputPath, probe)) {
      return buildPlan(
        profile,
        'copy-stream',
        '.mp3',
        'mp3',
        codecName,
        'mp3',
        'preserve low-bitrate mono hosted-STT mp3 while stripping non-audio baggage'
      )
    }

    return buildPlan(
      profile,
      'transcode-mp3',
      '.mp3',
      'mp3',
      codecName,
      'mp3',
      'compress hosted-STT source media to mono mp3 with a 96 kbps ceiling',
      {
        targetBitRate: resolveHostedTargetBitRate(probe),
        ...(probe.audioStream.sampleRate !== undefined ? { targetSampleRate: probe.audioStream.sampleRate } : {}),
        targetChannels: 1
      }
    )
  }

  if (codecName === 'mp3') {
    if (profile === 'default' && isAudioOnly && sourceExtension === '.mp3') {
      return buildPlan(profile, 'copy-file', '.mp3', 'mp3', codecName, 'mp3', 'audio-only mp3 fast path')
    }

    return buildPlan(
      profile,
      'copy-stream',
      '.mp3',
      'mp3',
      codecName,
      'mp3',
      'extract or remux mp3 audio without re-encoding'
    )
  }

  if (codecName === 'aac' || codecName === 'alac') {
    if (profile === 'default' && isAudioOnly && sourceExtension === '.m4a') {
      return buildPlan(profile, 'copy-file', '.m4a', 'ipod', codecName, codecName, 'audio-only m4a fast path')
    }

    return buildPlan(
      profile,
      'copy-stream',
      '.m4a',
      'ipod',
      codecName,
      codecName,
      'extract or remux AAC/ALAC audio without re-encoding'
    )
  }

  if (codecName === 'opus' || codecName === 'vorbis') {
    if (profile === 'default' && isAudioOnly && sourceExtension === '.ogg') {
      return buildPlan(profile, 'copy-file', '.ogg', 'ogg', codecName, codecName, 'audio-only ogg fast path')
    }

    return buildPlan(
      profile,
      'copy-stream',
      '.ogg',
      'ogg',
      codecName,
      codecName,
      'extract or remux Opus/Vorbis audio without re-encoding'
    )
  }

  if (codecName === 'flac') {
    if (profile === 'default' && isAudioOnly && sourceExtension === '.flac') {
      return buildPlan(profile, 'copy-file', '.flac', 'flac', codecName, 'flac', 'audio-only flac fast path')
    }

    return buildPlan(
      profile,
      'copy-stream',
      '.flac',
      'flac',
      codecName,
      'flac',
      'extract or remux FLAC audio without re-encoding'
    )
  }

  return buildPlan(
    profile,
    'transcode-flac',
    '.flac',
    'flac',
    codecName,
    'flac',
    'transcode unsupported or uncompressed audio once to FLAC'
  )
}

export const planNormalizedAudioArtifact = async (
  inputPath: string,
  profile: AudioNormalizationProfile = 'default'
): Promise<{ probe: MediaProbe, plan: NormalizedAudioPlan }> => {
  const probe = await probeMediaFile(inputPath)
  return {
    probe,
    plan: resolveNormalizedAudioPlan(inputPath, probe, profile)
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

  if (plan.stripMetadata) {
    args.push('-map_metadata', '-1')
  }

  if (plan.stripChapters) {
    args.push('-map_chapters', '-1')
  }

  if (plan.mode === 'copy-stream') {
    args.push('-c:a', 'copy', '-f', plan.outputFormat, '-y', outputPath)
  } else if (plan.mode === 'transcode-aac') {
    args.push('-c:a', 'aac', '-profile:a', 'aac_low')
    if (plan.targetBitRate !== undefined) {
      args.push('-b:a', String(plan.targetBitRate))
    }
    if (plan.targetSampleRate !== undefined) {
      args.push('-ar', String(plan.targetSampleRate))
    }
    if (plan.targetChannels !== undefined) {
      args.push('-ac', String(plan.targetChannels))
    }
    args.push('-f', plan.outputFormat, '-y', outputPath)
  } else if (plan.mode === 'transcode-mp3') {
    args.push('-c:a', 'libmp3lame')
    if (plan.targetBitRate !== undefined) {
      args.push('-b:a', String(plan.targetBitRate))
    }
    if (plan.targetSampleRate !== undefined) {
      args.push('-ar', String(plan.targetSampleRate))
    }
    if (plan.targetChannels !== undefined) {
      args.push('-ac', String(plan.targetChannels))
    }
    args.push('-f', plan.outputFormat, '-y', outputPath)
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
  const normalizedPlan = resolveNormalizedAudioPlan(inputPath, probe, 'default')
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
