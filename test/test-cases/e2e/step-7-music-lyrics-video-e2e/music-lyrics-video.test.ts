import { afterAll, beforeAll, expect } from 'bun:test'
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { budgetedTest } from '../../../test-utils/budget'
import {
  cleanupTestOutput,
  ensurePageImageFixture,
  fileExists,
  findLatestDirectory,
  runCommand
} from '../../../test-utils/test-helpers'
import { readBatchManifest, readRunManifest } from '../../../test-utils/manifest-helpers'
import { exec } from '~/utils/cli-utils'

const SHORT_AUDIO_PATH = 'input/examples/audio/0-audio-short.mp3'
const SHORT_AUDIO_SUFFIX = 'music-lyrics-0-audio-short'
const RERENDER_SUFFIX = 'music-lyrics-0-audio-short-fixed'
const EXAMPLE_SONG_AUDIO_PATH = 'input/examples/lyrics/01-example-song.mp3'
const EXAMPLE_SONG_SUFFIX = 'music-lyrics-01-example-song'
const BATCH_SUFFIX = 'music-lyrics-batch'
const CAPTION_FIXTURE_DIR = 'output/music-lyrics-fixtures'
const CAPTION_FIXTURE_PATH = `${CAPTION_FIXTURE_DIR}/0-audio-short-fixed.vtt`
const MATCHING_IMAGE_PATH = 'input/examples/audio/0-audio-short.png'
const BATCH_INPUT_DIR = 'input/test-fixtures/music-lyrics-batch'

const probeVideoStream = async (videoPath: string): Promise<{ codecName: string, width: number, height: number }> => {
  const result = await exec('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,width,height',
    '-of', 'json',
    videoPath
  ])

  expect(result.exitCode).toBe(0)
  const parsed = JSON.parse(result.stdout) as {
    streams?: Array<{ codec_name?: string, width?: number, height?: number }>
  }
  const stream = parsed.streams?.[0]
  return {
    codecName: stream?.codec_name ?? '',
    width: stream?.width ?? 0,
    height: stream?.height ?? 0
  }
}

beforeAll(async () => {
  await cleanupTestOutput(SHORT_AUDIO_SUFFIX)
  await cleanupTestOutput(RERENDER_SUFFIX)
  await cleanupTestOutput(EXAMPLE_SONG_SUFFIX)
  await cleanupTestOutput(BATCH_SUFFIX)
  await mkdir(CAPTION_FIXTURE_DIR, { recursive: true })
  await mkdir(BATCH_INPUT_DIR, { recursive: true })
  await writeFile(CAPTION_FIXTURE_PATH, [
    'WEBVTT',
    '',
    '00:00:00.000 --> 00:00:00.800',
    'short line one',
    '',
    '00:00:00.900 --> 00:00:01.800',
    'short line two',
    ''
  ].join('\n'))
  await ensurePageImageFixture(MATCHING_IMAGE_PATH)
  await copyFile(SHORT_AUDIO_PATH, `${BATCH_INPUT_DIR}/01-batch-one.mp3`)
  await copyFile(SHORT_AUDIO_PATH, `${BATCH_INPUT_DIR}/02-batch-two.mp3`)
})

afterAll(async () => {
  await cleanupTestOutput(SHORT_AUDIO_SUFFIX)
  await cleanupTestOutput(RERENDER_SUFFIX)
  await cleanupTestOutput(EXAMPLE_SONG_SUFFIX)
  await cleanupTestOutput(BATCH_SUFFIX)
  await rm(CAPTION_FIXTURE_DIR, { recursive: true, force: true })
  await rm(BATCH_INPUT_DIR, { recursive: true, force: true })
  await rm(MATCHING_IMAGE_PATH, { force: true })
})

budgetedTest('music-lyrics-rerender', 'music lyric-video rerender uses edited captions, preserves tmp when requested, and writes fixed render outputs', async () => {
  await cleanupTestOutput(RERENDER_SUFFIX)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'music',
    '--audio',
    SHORT_AUDIO_PATH,
    '--captions',
    CAPTION_FIXTURE_PATH,
    '--keep-tmp'
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(RERENDER_SUFFIX)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/0-audio-short-fixed.mp4`)).toBe(true)
    expect(await fileExists(`${outputDir}/0-audio-short-fixed.vtt`)).toBe(true)
    expect(await fileExists(`${outputDir}/0-audio-short-fixed.srt`)).toBe(true)
    expect(await fileExists(`${outputDir}/.lyrics-tmp`)).toBe(true)

    const manifest = await readRunManifest(outputDir)
    expect(manifest.kind).toBe('music')
    expect(manifest.metadata['mode']).toBe('lyric-video')
    expect((manifest.metadata['transcription'] as Record<string, unknown>)['mode']).toBe('captions')
    expect((manifest.metadata['render'] as Record<string, unknown>)['backgroundMode']).toBe('image')
    expect((manifest.metadata['artifacts'] as Record<string, unknown>)['tempDirKept']).toBe(true)

    const videoStream = await probeVideoStream(`${outputDir}/0-audio-short-fixed.mp4`)
    expect(videoStream.codecName).toBe('h264')
    expect(videoStream.width).toBe(1920)
    expect(videoStream.height).toBe(1080)
  }
}, 30000)

budgetedTest('music-lyrics-whisper-tiny', 'music lyric-video transcribes local audio with whisper and cleans tmp by default', async () => {
  await cleanupTestOutput(SHORT_AUDIO_SUFFIX)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'music',
    '--audio',
    SHORT_AUDIO_PATH,
    '--model',
    'tiny'
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(SHORT_AUDIO_SUFFIX)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/0-audio-short.mp4`)).toBe(true)
    expect(await fileExists(`${outputDir}/0-audio-short.vtt`)).toBe(true)
    expect(await fileExists(`${outputDir}/0-audio-short.srt`)).toBe(true)
    expect(await fileExists(`${outputDir}/run.json`)).toBe(true)
    expect(await fileExists(`${outputDir}/.lyrics-tmp`)).toBe(false)

    const manifest = await readRunManifest(outputDir)
    expect(manifest.kind).toBe('music')
    expect(manifest.metadata['mode']).toBe('lyric-video')
    const transcription = manifest.metadata['transcription'] as Record<string, unknown>
    expect(transcription['mode']).toBe('whisper')
    expect(transcription['model']).toBe('tiny')
    expect(typeof transcription['descriptor']).toBe('string')
    expect(String(transcription['descriptor'])).toContain('ggml-tiny')
    expect(Number(transcription['cueCount'])).toBeGreaterThan(0)

    const vtt = await Bun.file(`${outputDir}/0-audio-short.vtt`).text()
    expect(vtt).toContain('WEBVTT')
  }
}, 30000)

budgetedTest('music-lyrics-default-example-song', 'bun as music --audio input/examples/lyrics/01-example-song.mp3 renders the bundled example with the default whisper model', async () => {
  await cleanupTestOutput(EXAMPLE_SONG_SUFFIX)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'music',
    '--audio',
    EXAMPLE_SONG_AUDIO_PATH
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(EXAMPLE_SONG_SUFFIX)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/01-example-song.mp4`)).toBe(true)
    expect(await fileExists(`${outputDir}/01-example-song.vtt`)).toBe(true)
    expect(await fileExists(`${outputDir}/01-example-song.srt`)).toBe(true)
    expect(await fileExists(`${outputDir}/run.json`)).toBe(true)
    expect(await fileExists(`${outputDir}/.lyrics-tmp`)).toBe(false)

    const manifest = await readRunManifest(outputDir)
    expect(manifest.kind).toBe('music')
    expect(manifest.metadata['mode']).toBe('lyric-video')

    const transcription = manifest.metadata['transcription'] as Record<string, unknown>
    expect(transcription['mode']).toBe('whisper')
    expect(transcription['model']).toBe('large-v3-turbo')
    expect(typeof transcription['descriptor']).toBe('string')
    expect(String(transcription['descriptor'])).toContain('ggml-large-v3-turbo')
    expect(Number(transcription['cueCount'])).toBeGreaterThan(0)

    const render = manifest.metadata['render'] as Record<string, unknown>
    expect(render['backgroundMode']).toBe('image')

    const videoStream = await probeVideoStream(`${outputDir}/01-example-song.mp4`)
    expect(videoStream.codecName).toBe('h264')
    expect(videoStream.width).toBe(1920)
    expect(videoStream.height).toBe(1080)
  }
}, 120000)

budgetedTest('music-lyrics-batch-tiny', 'music lyric-video batch writes a batch manifest and child lyric runs for the configured input tree', async () => {
  await cleanupTestOutput(BATCH_SUFFIX)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'music',
    '--batch',
    '--model',
    'tiny'
  ], {
    env: {
      AUTOSHOW_MUSIC_LYRIC_VIDEO_INPUT_DIR: BATCH_INPUT_DIR
    }
  })

  expect(result.exitCode).toBe(0)
  expect(result.outputDir).not.toBeNull()

  if (result.outputDir) {
    const batchDir = resolve(process.cwd(), result.outputDir)
    expect(await fileExists(`${batchDir}/batch.json`)).toBe(true)

    const manifest = await readBatchManifest(batchDir)
    expect(manifest.kind).toBe('music')
    expect(manifest.source?.['mode']).toBe('lyric-video')
    expect(manifest.items).toHaveLength(2)
    const childDirNames = (manifest.items as Array<Record<string, unknown>>)
      .map((item) => basename(String(item['outputDir'])))
      .sort()
    expect(childDirNames).toEqual(['01-batch-one', '02-batch-two'])

    for (const item of manifest.items as Array<Record<string, unknown>>) {
      expect(item['status']).toBe('completed')
      const childDir = resolve(process.cwd(), String(item['outputDir']))
      expect(await fileExists(`${childDir}/run.json`)).toBe(true)
      const childManifest = await readRunManifest(childDir)
      expect(childManifest.kind).toBe('music')
      expect(childManifest.metadata['mode']).toBe('lyric-video')
    }
  }
}, 30000)
