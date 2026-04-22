import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { planNormalizedAudioArtifact } from '~/cli/commands/process-steps/step-1-download/audio/audio-normalize'
import { downloadAudio } from '~/cli/commands/process-steps/step-1-download/audio/dl-audio'
import { extractLocalFileMetadata } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { prepareSttMedia } from '~/cli/commands/process-steps/step-2-stt/media'
import { prepareLocalSttInput } from '~/cli/commands/process-steps/step-2-stt/stt-local/local-audio-normalize'
import { splitAudioFile } from '~/cli/commands/process-steps/step-2-stt/stt-utils/audio-splitter'
import type { SttTarget } from '~/types'
import { exec, fileExists } from '~/utils/cli-utils'

const SAMPLE_AUDIO_PATH = 'input/examples/audio/1-audio.mp3'
const COVER_ART_PATH = 'input/examples/lyrics/01-cover.jpeg'
const HOSTED_AAC_BIT_RATE_CEILING = 96_000
const HOSTED_AAC_BIT_RATE_TOLERANCE = 10_000
const HOSTED_AUDIO_SIMILARITY_FLOOR_DB = 18
const CLOUD_STT_TARGET: SttTarget = {
  service: 'groq',
  model: 'whisper-large-v3-turbo',
  local: false
}
const DEEPINFRA_STT_TARGET: SttTarget = {
  service: 'deepinfra',
  model: 'openai/whisper-large-v3-turbo',
  local: false
}

const tempDirs: string[] = []
const envSnapshots = new Map<string, string | undefined>()

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-audio-normalize-'))
  tempDirs.push(dir)
  return dir
}

const probePrimaryAudioStream = async (
  audioPath: string
): Promise<{
  codecName: string
  sampleRate: number
  channels: number
  bitRate: number | null
}> => {
  const result = await exec('ffprobe', [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=codec_name,sample_rate,channels,bit_rate',
    '-of', 'json',
    audioPath
  ])

  expect(result.exitCode).toBe(0)
  const payload = JSON.parse(result.stdout) as {
    streams?: Array<{
      codec_name?: string
      sample_rate?: string
      channels?: number
      bit_rate?: string
    }>
  }
  const stream = payload.streams?.[0]
  if (!stream?.codec_name || !stream.sample_rate || typeof stream.channels !== 'number') {
    throw new Error(`Missing audio stream details for ${audioPath}`)
  }

  const bitRate = typeof stream.bit_rate === 'string'
    ? Number.parseInt(stream.bit_rate, 10)
    : Number.NaN

  return {
    codecName: stream.codec_name,
    sampleRate: Number.parseInt(stream.sample_rate, 10),
    channels: stream.channels,
    bitRate: Number.isFinite(bitRate) ? bitRate : null
  }
}

const probeMediaLayout = async (
  mediaPath: string
): Promise<{
  audioStreamCount: number
  videoStreamCount: number
  attachedPictureCount: number
  chapterCount: number
}> => {
  const result = await exec('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=index,codec_type:stream_disposition=attached_pic:chapter=id',
    '-of', 'json',
    mediaPath
  ])

  expect(result.exitCode).toBe(0)
  const payload = JSON.parse(result.stdout) as {
    streams?: Array<{
      codec_type?: string
      disposition?: {
        attached_pic?: number
      }
    }>
    chapters?: Array<unknown>
  }
  const streams = Array.isArray(payload.streams) ? payload.streams : []

  return {
    audioStreamCount: streams.filter((stream) => stream.codec_type === 'audio').length,
    videoStreamCount: streams.filter((stream) => stream.codec_type === 'video').length,
    attachedPictureCount: streams.filter((stream) => stream.disposition?.attached_pic === 1).length,
    chapterCount: Array.isArray(payload.chapters) ? payload.chapters.length : 0
  }
}

const computePacketHashSequence = async (audioPath: string): Promise<string[]> => {
  const result = await exec('ffprobe', [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'packet=data_hash',
    '-show_data_hash', 'sha256',
    '-of', 'json',
    audioPath
  ])

  expect(result.exitCode).toBe(0)
  const payload = JSON.parse(result.stdout) as {
    packets?: Array<{
      data_hash?: string
    }>
  }

  return (Array.isArray(payload.packets) ? payload.packets : [])
    .map((packet) => packet.data_hash)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
}

const measureMonoAudioSiSdr = async (
  referencePath: string,
  candidatePath: string,
  sampleRate: number
): Promise<number> => {
  const filter = `[0:a]aformat=sample_rates=${sampleRate}:channel_layouts=mono[ref];[1:a]aformat=sample_rates=${sampleRate}:channel_layouts=mono[cand];[ref][cand]asisdr`
  const result = await exec('ffmpeg', [
    '-v', 'info',
    '-i', referencePath,
    '-i', candidatePath,
    '-filter_complex', filter,
    '-f', 'null',
    '-'
  ])

  expect(result.exitCode).toBe(0)
  const match = result.stderr.match(/SI-SDR ch0:\s+([+-]?(?:inf|\d+(?:\.\d+)?))/i)
  if (!match?.[1]) {
    throw new Error(`Failed to parse SI-SDR output for ${candidatePath}`)
  }

  if (match[1].toLowerCase() === 'inf') {
    return Number.POSITIVE_INFINITY
  }

  return Number.parseFloat(match[1])
}

const expectHostedAacArtifact = async (
  referencePath: string,
  artifactPath: string,
  sampleRate: number
): Promise<void> => {
  const audio = await probePrimaryAudioStream(artifactPath)
  expect(audio.codecName).toBe('aac')
  expect(audio.channels).toBe(1)
  expect(audio.sampleRate).toBe(sampleRate)
  if (audio.bitRate !== null) {
    expect(audio.bitRate).toBeLessThanOrEqual(HOSTED_AAC_BIT_RATE_CEILING + HOSTED_AAC_BIT_RATE_TOLERANCE)
  }

  const similarity = await measureMonoAudioSiSdr(referencePath, artifactPath, sampleRate)
  expect(similarity).toBeGreaterThan(HOSTED_AUDIO_SIMILARITY_FLOOR_DB)
}

const expectHostedMp3Artifact = async (
  referencePath: string,
  artifactPath: string,
  sampleRate: number
): Promise<void> => {
  const audio = await probePrimaryAudioStream(artifactPath)
  expect(audio.codecName).toBe('mp3')
  expect(audio.channels).toBe(1)
  expect(audio.sampleRate).toBe(sampleRate)
  if (audio.bitRate !== null) {
    expect(audio.bitRate).toBeLessThanOrEqual(HOSTED_AAC_BIT_RATE_CEILING + HOSTED_AAC_BIT_RATE_TOLERANCE)
  }

  const similarity = await measureMonoAudioSiSdr(referencePath, artifactPath, sampleRate)
  expect(similarity).toBeGreaterThan(HOSTED_AUDIO_SIMILARITY_FLOOR_DB)
}

const createAudioOnlyMp3Input = async (outputPath: string): Promise<void> => {
  const result = await exec('ffmpeg', [
    '-i', SAMPLE_AUDIO_PATH,
    '-map', '0:a:0',
    '-map_metadata', '-1',
    '-map_chapters', '-1',
    '-c:a', 'copy',
    '-id3v2_version', '3',
    '-y',
    outputPath
  ])

  expect(result.exitCode).toBe(0)
}

const createMp4Input = async (outputPath: string): Promise<void> => {
  const result = await exec('ffmpeg', [
    '-f', 'lavfi',
    '-i', 'color=c=black:s=16x16:r=1',
    '-i', SAMPLE_AUDIO_PATH,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-shortest',
    '-c:v', 'mpeg4',
    '-c:a', 'aac',
    '-ar', '44100',
    '-ac', '2',
    '-b:a', '128k',
    '-y',
    outputPath
  ])

  expect(result.exitCode).toBe(0)
}

const createWavInput = async (outputPath: string): Promise<void> => {
  const result = await exec('ffmpeg', [
    '-i', SAMPLE_AUDIO_PATH,
    '-map', '0:a:0',
    '-ar', '48000',
    '-ac', '2',
    '-c:a', 'pcm_s16le',
    '-y',
    outputPath
  ])

  expect(result.exitCode).toBe(0)
}

const createMp3WithCoverArt = async (outputPath: string): Promise<void> => {
  const result = await exec('ffmpeg', [
    '-i', SAMPLE_AUDIO_PATH,
    '-i', COVER_ART_PATH,
    '-map', '0:a:0',
    '-map', '1:v:0',
    '-c:a', 'copy',
    '-c:v', 'mjpeg',
    '-disposition:v:0', 'attached_pic',
    '-metadata', 'title=Hosted STT Cover Art Regression',
    '-metadata', 'album=autoshow-test',
    '-metadata:s:v:0', 'title=cover-art',
    '-id3v2_version', '3',
    '-y',
    outputPath
  ])

  expect(result.exitCode).toBe(0)
}

const createLowBitrateMonoM4aInput = async (outputPath: string): Promise<void> => {
  const result = await exec('ffmpeg', [
    '-i', SAMPLE_AUDIO_PATH,
    '-map', '0:a:0',
    '-map_metadata', '-1',
    '-map_chapters', '-1',
    '-ar', '44100',
    '-ac', '1',
    '-c:a', 'aac',
    '-profile:a', 'aac_low',
    '-b:a', '64000',
    '-f', 'ipod',
    '-y',
    outputPath
  ])

  expect(result.exitCode).toBe(0)
}

const createLowBitrateMonoMp3Input = async (outputPath: string): Promise<void> => {
  const result = await exec('ffmpeg', [
    '-i', SAMPLE_AUDIO_PATH,
    '-map', '0:a:0',
    '-map_metadata', '-1',
    '-map_chapters', '-1',
    '-ar', '44100',
    '-ac', '1',
    '-c:a', 'libmp3lame',
    '-b:a', '64000',
    '-y',
    outputPath
  ])

  expect(result.exitCode).toBe(0)
}

const createLowBitrateMonoOggInput = async (outputPath: string): Promise<void> => {
  const result = await exec('ffmpeg', [
    '-i', SAMPLE_AUDIO_PATH,
    '-map', '0:a:0',
    '-map_metadata', '-1',
    '-map_chapters', '-1',
    '-ar', '48000',
    '-ac', '1',
    '-c:a', 'libopus',
    '-b:a', '48000',
    '-y',
    outputPath
  ])

  expect(result.exitCode).toBe(0)
}

const setEnv = (key: string, value: string | undefined): void => {
  if (!envSnapshots.has(key)) {
    envSnapshots.set(key, process.env[key])
  }

  if (value === undefined) {
    delete process.env[key]
    return
  }

  process.env[key] = value
}

afterEach(async () => {
  for (const [key, value] of envSnapshots) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  envSnapshots.clear()

  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

describe('audio normalization', () => {
  test('prepareSttMedia compresses typical stereo mp3 inputs to mono AAC .m4a for hosted STT', async () => {
    const tempDir = await createTempDir()
    const inputPath = join(tempDir, 'stereo.mp3')
    const outputDir = join(tempDir, 'output')
    await createAudioOnlyMp3Input(inputPath)
    const inputAudio = await probePrimaryAudioStream(inputPath)

    const prepared = await prepareSttMedia({
      source: { filePath: inputPath },
      targets: [CLOUD_STT_TARGET],
      outputDir,
      noCache: true
    })

    try {
      expect(basename(prepared.executionArtifacts.sourceMediaPath)).toBe('source_media.m4a')
      expect(prepared.executionArtifacts.sourceMediaPath.endsWith('.m4a')).toBe(true)
      expect(prepared.outputArtifacts.sourceMediaPath.endsWith('.m4a')).toBe(true)
      expect(prepared.step1Metadata.audioFileName.endsWith('.m4a')).toBe(true)
      expect(prepared.cache.sourceMedia).toBe('miss')
      expect(await fileExists(prepared.executionArtifacts.sourceMediaPath)).toBe(true)
      expect(await fileExists(prepared.outputArtifacts.sourceMediaPath)).toBe(true)
      await expectHostedAacArtifact(inputPath, prepared.executionArtifacts.sourceMediaPath, inputAudio.sampleRate)
      expect(Object.keys(prepared.executionArtifacts)).toEqual(['sourceMediaPath'])
      expect(Object.keys(prepared.outputArtifacts)).toEqual(['sourceMediaPath'])
    } finally {
      await prepared.cleanup?.()
    }
  })

  test('prepareSttMedia compresses DeepInfra shared hosted inputs to mono mp3 instead of .m4a', async () => {
    const tempDir = await createTempDir()
    const inputPath = join(tempDir, 'stereo.mp3')
    const outputDir = join(tempDir, 'output')
    await createAudioOnlyMp3Input(inputPath)
    const inputAudio = await probePrimaryAudioStream(inputPath)

    const prepared = await prepareSttMedia({
      source: { filePath: inputPath },
      targets: [DEEPINFRA_STT_TARGET],
      outputDir,
      noCache: true
    })

    try {
      expect(basename(prepared.executionArtifacts.sourceMediaPath)).toBe('source_media.mp3')
      expect(prepared.executionArtifacts.sourceMediaPath.endsWith('.mp3')).toBe(true)
      expect(prepared.outputArtifacts.sourceMediaPath.endsWith('.mp3')).toBe(true)
      expect(prepared.step1Metadata.audioFileName.endsWith('.mp3')).toBe(true)
      await expectHostedMp3Artifact(inputPath, prepared.executionArtifacts.sourceMediaPath, inputAudio.sampleRate)
    } finally {
      await prepared.cleanup?.()
    }
  })

  test('prepareSttMedia normalizes local mp4 inputs to source_media.m4a and drops video for hosted STT', async () => {
    const tempDir = await createTempDir()
    const inputPath = join(tempDir, 'input.mp4')
    const outputDir = join(tempDir, 'output')
    await createMp4Input(inputPath)
    const inputAudio = await probePrimaryAudioStream(inputPath)

    const prepared = await prepareSttMedia({
      source: { filePath: inputPath },
      targets: [CLOUD_STT_TARGET],
      outputDir,
      noCache: true
    })

    try {
      expect(basename(prepared.executionArtifacts.sourceMediaPath)).toBe('source_media.m4a')
      expect(prepared.executionArtifacts.sourceMediaPath.endsWith('.m4a')).toBe(true)
      expect(prepared.outputArtifacts.sourceMediaPath.endsWith('.m4a')).toBe(true)
      expect(prepared.step1Metadata.audioFileName.endsWith('.m4a')).toBe(true)
      const outputLayout = await probeMediaLayout(prepared.executionArtifacts.sourceMediaPath)
      expect(outputLayout.audioStreamCount).toBe(1)
      expect(outputLayout.videoStreamCount).toBe(0)
      expect(outputLayout.attachedPictureCount).toBe(0)
      expect(outputLayout.chapterCount).toBe(0)
      await expectHostedAacArtifact(inputPath, prepared.executionArtifacts.sourceMediaPath, inputAudio.sampleRate)
    } finally {
      await prepared.cleanup?.()
    }
  })

  test('prepareSttMedia converts uncompressed wav inputs to source_media.m4a for hosted STT', async () => {
    const tempDir = await createTempDir()
    const inputPath = join(tempDir, 'input.wav')
    const outputDir = join(tempDir, 'output')
    await createWavInput(inputPath)
    const inputAudio = await probePrimaryAudioStream(inputPath)

    const prepared = await prepareSttMedia({
      source: { filePath: inputPath },
      targets: [CLOUD_STT_TARGET],
      outputDir,
      noCache: true
    })

    try {
      expect(basename(prepared.executionArtifacts.sourceMediaPath)).toBe('source_media.m4a')
      expect(prepared.executionArtifacts.sourceMediaPath.endsWith('.m4a')).toBe(true)
      expect(prepared.outputArtifacts.sourceMediaPath.endsWith('.m4a')).toBe(true)
      expect(prepared.step1Metadata.audioFileName.endsWith('.m4a')).toBe(true)
      await expectHostedAacArtifact(inputPath, prepared.executionArtifacts.sourceMediaPath, inputAudio.sampleRate)
    } finally {
      await prepared.cleanup?.()
    }
  })

  test('prepareSttMedia preserves low-bitrate mono .m4a hosted artifacts with stream copy cleanup', async () => {
    const tempDir = await createTempDir()
    const inputPath = join(tempDir, 'low-bitrate.m4a')
    const outputDir = join(tempDir, 'output')
    await createLowBitrateMonoM4aInput(inputPath)

    const prepared = await prepareSttMedia({
      source: { filePath: inputPath },
      targets: [CLOUD_STT_TARGET],
      outputDir,
      noCache: true
    })

    try {
      expect(prepared.executionArtifacts.sourceMediaPath.endsWith('.m4a')).toBe(true)
      expect(await computePacketHashSequence(prepared.executionArtifacts.sourceMediaPath)).toEqual(
        await computePacketHashSequence(inputPath)
      )
      const outputLayout = await probeMediaLayout(prepared.executionArtifacts.sourceMediaPath)
      expect(outputLayout.audioStreamCount).toBe(1)
      expect(outputLayout.videoStreamCount).toBe(0)
      expect(outputLayout.attachedPictureCount).toBe(0)
      expect(outputLayout.chapterCount).toBe(0)
    } finally {
      await prepared.cleanup?.()
    }
  })

  test('prepareSttMedia preserves low-bitrate mono mp3 hosted artifacts with stream copy cleanup', async () => {
    const tempDir = await createTempDir()
    const inputPath = join(tempDir, 'low-bitrate.mp3')
    const outputDir = join(tempDir, 'output')
    await createLowBitrateMonoMp3Input(inputPath)

    const prepared = await prepareSttMedia({
      source: { filePath: inputPath },
      targets: [CLOUD_STT_TARGET],
      outputDir,
      noCache: true
    })

    try {
      expect(prepared.executionArtifacts.sourceMediaPath.endsWith('.mp3')).toBe(true)
      expect(await computePacketHashSequence(prepared.executionArtifacts.sourceMediaPath)).toEqual(
        await computePacketHashSequence(inputPath)
      )
      const outputLayout = await probeMediaLayout(prepared.executionArtifacts.sourceMediaPath)
      expect(outputLayout.audioStreamCount).toBe(1)
      expect(outputLayout.videoStreamCount).toBe(0)
      expect(outputLayout.attachedPictureCount).toBe(0)
      expect(outputLayout.chapterCount).toBe(0)
    } finally {
      await prepared.cleanup?.()
    }
  })

  test('prepareSttMedia transcodes low-bitrate .ogg inputs to .m4a for hosted STT', async () => {
    const tempDir = await createTempDir()
    const inputPath = join(tempDir, 'low-bitrate.ogg')
    const outputDir = join(tempDir, 'output')
    await createLowBitrateMonoOggInput(inputPath)
    const inputAudio = await probePrimaryAudioStream(inputPath)

    const prepared = await prepareSttMedia({
      source: { filePath: inputPath },
      targets: [CLOUD_STT_TARGET],
      outputDir,
      noCache: true
    })

    try {
      expect(prepared.executionArtifacts.sourceMediaPath.endsWith('.m4a')).toBe(true)
      expect(prepared.outputArtifacts.sourceMediaPath.endsWith('.m4a')).toBe(true)
      const outputAudio = await probePrimaryAudioStream(prepared.executionArtifacts.sourceMediaPath)
      expect(outputAudio.codecName).toBe('aac')
      expect(outputAudio.channels).toBe(1)
      expect(outputAudio.sampleRate).toBe(inputAudio.sampleRate)
    } finally {
      await prepared.cleanup?.()
    }
  })

  test('prepareSttMedia strips attached cover art from hosted-STT artifacts while preserving audio', async () => {
    const tempDir = await createTempDir()
    const inputPath = join(tempDir, 'input-with-cover.mp3')
    const outputDir = join(tempDir, 'output')
    await createMp3WithCoverArt(inputPath)
    const inputAudio = await probePrimaryAudioStream(inputPath)

    const inputLayout = await probeMediaLayout(inputPath)
    expect(inputLayout.audioStreamCount).toBe(1)
    expect(inputLayout.videoStreamCount).toBe(1)
    expect(inputLayout.attachedPictureCount).toBe(1)

    const prepared = await prepareSttMedia({
      source: { filePath: inputPath },
      targets: [CLOUD_STT_TARGET],
      outputDir,
      noCache: true
    })

    try {
      expect(prepared.executionArtifacts.sourceMediaPath.endsWith('.m4a')).toBe(true)
      const outputLayout = await probeMediaLayout(prepared.executionArtifacts.sourceMediaPath)
      expect(outputLayout.audioStreamCount).toBe(1)
      expect(outputLayout.videoStreamCount).toBe(0)
      expect(outputLayout.attachedPictureCount).toBe(0)
      expect(outputLayout.chapterCount).toBe(0)
      await expectHostedAacArtifact(inputPath, prepared.executionArtifacts.sourceMediaPath, inputAudio.sampleRate)
    } finally {
      await prepared.cleanup?.()
    }
  })

  test('downloadAudio keeps the default local mp3 fast path byte-identical', async () => {
    const tempDir = await createTempDir()
    const outputDir = join(tempDir, 'output')
    await mkdir(outputDir, { recursive: true })
    const metadata = await extractLocalFileMetadata(SAMPLE_AUDIO_PATH)
    const { audioPath } = await downloadAudio({
      filePath: SAMPLE_AUDIO_PATH,
      outputDir
    }, metadata)

    expect(audioPath.endsWith('.mp3')).toBe(true)
    expect(await Bun.file(audioPath).bytes()).toEqual(await Bun.file(SAMPLE_AUDIO_PATH).bytes())
  })

  test('prepareSttMedia rebuilds cached source_media artifacts from cache version 5', async () => {
    const tempDir = await createTempDir()
    const cacheDir = join(tempDir, 'cache')
    const inputPath = join(tempDir, 'cached-cover-art.mp3')
    await createMp3WithCoverArt(inputPath)
    setEnv('AUTOSHOW_CACHE_DIR', cacheDir)

    const first = await prepareSttMedia({
      source: { filePath: inputPath },
      targets: [CLOUD_STT_TARGET]
    })
    const entryJsonPath = join(dirname(first.executionArtifacts.sourceMediaPath), 'entry.json')
    const entry = JSON.parse(await Bun.file(entryJsonPath).text()) as {
      artifactVersions?: {
        source_media?: number
      }
    }
    entry.artifactVersions = {
      source_media: 5
    }
    await Bun.write(first.executionArtifacts.sourceMediaPath, await Bun.file(inputPath).bytes())
    await Bun.write(entryJsonPath, JSON.stringify(entry, null, 2))

    const rebuilt = await prepareSttMedia({
      source: { filePath: inputPath },
      targets: [CLOUD_STT_TARGET]
    })

    const inputAudio = await probePrimaryAudioStream(inputPath)
    expect(rebuilt.cache.sourceMedia).toBe('miss')
    expect(rebuilt.executionArtifacts.sourceMediaPath.endsWith('.m4a')).toBe(true)
    const rebuiltLayout = await probeMediaLayout(rebuilt.executionArtifacts.sourceMediaPath)
    expect(rebuiltLayout.audioStreamCount).toBe(1)
    expect(rebuiltLayout.videoStreamCount).toBe(0)
    expect(rebuiltLayout.attachedPictureCount).toBe(0)
    await expectHostedAacArtifact(inputPath, rebuilt.executionArtifacts.sourceMediaPath, inputAudio.sampleRate)
  })

  test('prepareSttMedia rebuilds cached source_media artifacts when hosted provider compatibility changes', async () => {
    const tempDir = await createTempDir()
    const cacheDir = join(tempDir, 'cache')
    const inputPath = join(tempDir, 'compatibility.mp3')
    await createAudioOnlyMp3Input(inputPath)
    setEnv('AUTOSHOW_CACHE_DIR', cacheDir)

    const hostedPrepared = await prepareSttMedia({
      source: { filePath: inputPath },
      targets: [CLOUD_STT_TARGET]
    })

    expect(hostedPrepared.cache.sourceMedia).toBe('miss')
    expect(hostedPrepared.executionArtifacts.sourceMediaPath.endsWith('.m4a')).toBe(true)

    const deepinfraPrepared = await prepareSttMedia({
      source: { filePath: inputPath },
      targets: [DEEPINFRA_STT_TARGET]
    })

    expect(deepinfraPrepared.cache.sourceMedia).toBe('miss')
    expect(deepinfraPrepared.executionArtifacts.sourceMediaPath.endsWith('.mp3')).toBe(true)
  })

  test('hosted STT planner no longer emits .ogg or .flac shared artifacts', async () => {
    const tempDir = await createTempDir()
    const wavPath = join(tempDir, 'planner.wav')
    const oggPath = join(tempDir, 'planner.ogg')
    await createWavInput(wavPath)
    await createLowBitrateMonoOggInput(oggPath)

    const wavPlan = await planNormalizedAudioArtifact(wavPath, 'hosted-stt')
    const oggPlan = await planNormalizedAudioArtifact(oggPath, 'hosted-stt')

    expect(wavPlan.plan.outputExtension).toBe('.m4a')
    expect(wavPlan.plan.outputFormat).toBe('ipod')
    expect(wavPlan.plan.mode).toBe('transcode-aac')
    expect(wavPlan.plan.outputCodecName).toBe('aac')
    expect(oggPlan.plan.outputExtension).toBe('.m4a')
    expect(oggPlan.plan.outputFormat).toBe('ipod')
    expect(oggPlan.plan.mode).toBe('transcode-aac')
    expect(oggPlan.plan.outputCodecName).toBe('aac')
  })

  test('splitAudioFile creates mp3 segments', async () => {
    const tempDir = await createTempDir()
    const segments = await splitAudioFile(SAMPLE_AUDIO_PATH, tempDir, 0.5)

    expect(segments).toHaveLength(2)
    expect(segments.every((segment) => segment.path.endsWith('.mp3'))).toBe(true)
    expect(await fileExists(join(tempDir, 'segments', 'segment_001.mp3'))).toBe(true)
    expect(await fileExists(join(tempDir, 'segments', 'segment_001.wav'))).toBe(false)
    expect((await probePrimaryAudioStream(segments[0]!.path)).codecName).toBe('mp3')
  })

  test('prepareLocalSttInput converts mp3 input to a temporary wav and cleans it up', async () => {
    const prepared = await prepareLocalSttInput(SAMPLE_AUDIO_PATH, 'autoshow-local-stt-input-')

    expect(prepared.audioPath.endsWith('.wav')).toBe(true)
    expect(await fileExists(prepared.audioPath)).toBe(true)
    expect((await probePrimaryAudioStream(prepared.audioPath)).codecName).toBe('pcm_s16le')

    await prepared.cleanup()

    expect(await fileExists(prepared.audioPath)).toBe(false)
  })
})
