import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { prepareSttMedia } from '~/cli/commands/process-steps/step-2-stt/stt-media-cache'
import { prepareLocalSttInput } from '~/cli/commands/process-steps/step-2-stt/stt-local/local-audio-normalize'
import { splitAudioFile } from '~/cli/commands/process-steps/step-2-stt/stt-utils/audio-splitter'
import type { SttTarget } from '~/types'
import { exec, fileExists } from '~/utils/cli-utils'

const SAMPLE_AUDIO_PATH = 'input/examples/audio/1-audio.mp3'
const CLOUD_STT_TARGET: SttTarget = {
  service: 'openai',
  model: 'gpt-4o-transcribe',
  local: false
}

const tempDirs: string[] = []

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-audio-normalize-'))
  tempDirs.push(dir)
  return dir
}

const probeAudioCodec = async (audioPath: string): Promise<string> => {
  const result = await exec('ffprobe', [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=codec_name',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath
  ])

  expect(result.exitCode).toBe(0)
  return result.stdout.trim().split('\n')[0] ?? ''
}

const createMp4Input = async (outputPath: string): Promise<void> => {
  const result = await exec('ffmpeg', [
    '-f', 'lavfi',
    '-i', 'color=c=black:s=16x16:r=1',
    '-i', SAMPLE_AUDIO_PATH,
    '-shortest',
    '-c:v', 'mpeg4',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-y',
    outputPath
  ])

  expect(result.exitCode).toBe(0)
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

describe('audio normalization', () => {
  test('prepareSttMedia keeps local mp3 inputs byte-identical on the source-media fast path', async () => {
    const tempDir = await createTempDir()
    const outputDir = join(tempDir, 'output')

    const prepared = await prepareSttMedia({
      source: { filePath: SAMPLE_AUDIO_PATH },
      targets: [CLOUD_STT_TARGET],
      outputDir,
      noCache: true
    })

    try {
      expect(await Bun.file(prepared.executionArtifacts.sourceMediaPath).bytes()).toEqual(await Bun.file(SAMPLE_AUDIO_PATH).bytes())
      expect(await Bun.file(prepared.outputArtifacts.sourceMediaPath).bytes()).toEqual(await Bun.file(SAMPLE_AUDIO_PATH).bytes())
    } finally {
      await prepared.cleanup?.()
    }
  })

  test('prepareSttMedia normalizes local mp4 inputs to source_media.mp3', async () => {
    const tempDir = await createTempDir()
    const inputPath = join(tempDir, 'input.mp4')
    const outputDir = join(tempDir, 'output')
    await createMp4Input(inputPath)

    const prepared = await prepareSttMedia({
      source: { filePath: inputPath },
      targets: [CLOUD_STT_TARGET],
      outputDir,
      noCache: true
    })

    try {
      expect(basename(prepared.executionArtifacts.sourceMediaPath)).toBe('source_media.mp3')
      expect(prepared.executionArtifacts.sourceMediaPath.endsWith('.mp3')).toBe(true)
      expect(prepared.outputArtifacts.sourceMediaPath.endsWith('.mp3')).toBe(true)
      expect(prepared.step1Metadata.audioFileName.endsWith('.mp3')).toBe(true)
      expect(prepared.cache.sourceMedia).toBe('miss')
      expect(await fileExists(prepared.executionArtifacts.sourceMediaPath)).toBe(true)
      expect(await fileExists(prepared.outputArtifacts.sourceMediaPath)).toBe(true)
      expect(await probeAudioCodec(prepared.executionArtifacts.sourceMediaPath)).toBe('mp3')
      expect(Object.keys(prepared.executionArtifacts)).toEqual(['sourceMediaPath'])
      expect(Object.keys(prepared.outputArtifacts)).toEqual(['sourceMediaPath'])
    } finally {
      await prepared.cleanup?.()
    }
  })

  test('splitAudioFile creates mp3 segments', async () => {
    const tempDir = await createTempDir()
    const segments = await splitAudioFile(SAMPLE_AUDIO_PATH, tempDir, 0.5)

    expect(segments).toHaveLength(2)
    expect(segments.every((segment) => segment.path.endsWith('.mp3'))).toBe(true)
    expect(await fileExists(join(tempDir, 'segments', 'segment_001.mp3'))).toBe(true)
    expect(await fileExists(join(tempDir, 'segments', 'segment_001.wav'))).toBe(false)
    expect(await probeAudioCodec(segments[0]!.path)).toBe('mp3')
  })

  test('prepareLocalSttInput converts mp3 input to a temporary wav and cleans it up', async () => {
    const prepared = await prepareLocalSttInput(SAMPLE_AUDIO_PATH, 'autoshow-local-stt-input-')

    expect(prepared.audioPath.endsWith('.wav')).toBe(true)
    expect(await fileExists(prepared.audioPath)).toBe(true)
    expect(await probeAudioCodec(prepared.audioPath)).toBe('pcm_s16le')

    await prepared.cleanup()

    expect(await fileExists(prepared.audioPath)).toBe(false)
  })
})
