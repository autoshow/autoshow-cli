import { afterAll, beforeAll, expect, test } from 'bun:test'
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { E2E_TEST_TIMEOUT_MS } from '../../test-utils/timeouts'
import {
  OUTPUT_DIR,
  fileExists,
  runCommand
} from '../../test-utils/test-helpers'
import { readRunManifest, writeProviderResultFixture, writeRunManifestFixture } from '../../test-utils/manifest-helpers'

const SHORT_AUDIO_PATH = 'input/examples/audio/0-audio-short.mp3'
const FIXTURE_RUN_DIR = `${OUTPUT_DIR}/transcript-video-fixture-run`
const FIXTURE_TEXT_PATH = `${FIXTURE_RUN_DIR}/transcription.txt`

const fixtureTranscriptionResult = {
  text: 'Hello there. Thanks for joining.',
  segments: [
    { start: '00:00:00.000', end: '00:00:00.850', speaker: 'speaker-1', text: 'Hello there.' },
    { start: '00:00:00.850', end: '00:00:01.700', speaker: 'speaker-2', text: 'Thanks for joining.' }
  ],
  evidence: {
    segments: [
      { startSeconds: 0, endSeconds: 0.85, speaker: 'speaker-1', text: 'Hello there.' },
      { startSeconds: 0.85, endSeconds: 1.7, speaker: 'speaker-2', text: 'Thanks for joining.' }
    ],
    capabilities: {
      hasSpeakerLabels: true,
      hasNativeWordTiming: false,
      hasConfidence: false
    },
    timingQuality: 'segment_interpolated'
  }
}

beforeAll(async () => {
  await mkdir(FIXTURE_RUN_DIR, { recursive: true })
  await copyFile(SHORT_AUDIO_PATH, `${FIXTURE_RUN_DIR}/0-audio-short.mp3`)
  await writeRunManifestFixture(FIXTURE_RUN_DIR, 'extract', {
    step1: {
      title: 'Transcript Video Fixture',
      audioFileName: '0-audio-short.mp3'
    },
    step2: {
      transcriptionService: 'fixture',
      transcriptionModel: 'fixture-model',
      processingTime: 1,
      tokenCount: 4
    },
    providerStates: [{
      service: 'fixture',
      model: 'fixture-model',
      artifactDir: '.',
      status: 'succeeded',
      attempts: 1
    }],
    extractRoute: 'media'
  })
  await writeProviderResultFixture(
    FIXTURE_RUN_DIR,
    'fixture',
    'fixture-model',
    {
      transcriptionService: 'fixture',
      transcriptionModel: 'fixture-model',
      processingTime: 1,
      tokenCount: 4
    },
    fixtureTranscriptionResult
  )
  await writeFile(FIXTURE_TEXT_PATH, [
    '[00:00:00] [speaker-1] Hello there.',
    '[00:00:01] [speaker-2] Thanks for joining.',
    ''
  ].join('\n'))
})

afterAll(async () => {
  await rm(FIXTURE_RUN_DIR, { recursive: true, force: true })
})

test('extract transcript-video renders from a media extract output directory', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    FIXTURE_RUN_DIR,
    '--transcript-video'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.outputDir).not.toBeNull()

  if (result.outputDir) {
    expect(await fileExists(`${result.outputDir}/0-audio-short.mp4`)).toBe(true)
    expect(await fileExists(`${result.outputDir}/0-audio-short.vtt`)).toBe(true)
    expect(await fileExists(`${result.outputDir}/0-audio-short.srt`)).toBe(true)
    expect(await fileExists(`${result.outputDir}/.transcript-video-tmp`)).toBe(false)

    const manifest = await readRunManifest(result.outputDir)
    expect(manifest.kind).toBe('video')
    expect(manifest.metadata['mode']).toBe('transcript-video')
    expect((manifest.metadata['source'] as Record<string, unknown>)['extractRunDir']).toContain('transcript-video-fixture-run')
    expect((manifest.metadata['transcript'] as Record<string, unknown>)['cueSource']).toBe('extract-evidence-segments')
    expect((manifest.metadata['transcript'] as Record<string, unknown>)['speakerCount']).toBe(2)

    const vtt = await Bun.file(`${result.outputDir}/0-audio-short.vtt`).text()
    expect(vtt).toContain('speaker-1: Hello there.')
    expect(vtt).toContain('speaker-2: Thanks for joining.')
  }
}, E2E_TEST_TIMEOUT_MS)

test('extract transcript-video renders from explicit audio and transcript text files', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    '--transcript-video',
    '--audio',
    SHORT_AUDIO_PATH,
    '--transcript-text',
    FIXTURE_TEXT_PATH,
    '--keep-tmp'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.outputDir).not.toBeNull()

  if (result.outputDir) {
    expect(await fileExists(`${result.outputDir}/transcription.mp4`)).toBe(true)
    expect(await fileExists(`${result.outputDir}/transcription.vtt`)).toBe(true)
    expect(await fileExists(`${result.outputDir}/.transcript-video-tmp`)).toBe(true)

    const manifest = await readRunManifest(result.outputDir)
    expect(manifest.kind).toBe('video')
    expect((manifest.metadata['source'] as Record<string, unknown>)['transcriptSource']).toBe('transcript-text')
    expect((manifest.metadata['transcript'] as Record<string, unknown>)['cueSource']).toBe('transcript-text')
  }
}, E2E_TEST_TIMEOUT_MS)
