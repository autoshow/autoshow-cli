import { test, expect } from 'bun:test'
import { defineMusicServiceTest } from '../../../test-utils/define-music-service-test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  hasConfiguredEnvVar
} from '../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../test-utils/manifest-helpers'

const MUSIC_GEN_TITLE = 'music-gen'
const ELEVENLABS_MUSIC_TIMEOUT_MS = 120_000

defineMusicServiceTest({
  models: [
    { model: 'music_v1', prompt: 'upbeat electronic instrumental with warm synth pads', extraArgs: ['--music-duration', '12', '--music-instrumental'] },
  ],
  cliFlag: '--elevenlabs-music',
  musicService: 'elevenlabs',
  envVarKey: 'ELEVENLABS_API_KEY',
})

test('requires a music provider flag', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'music', 'an ambient piano song'],
  )
  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Specify a music generation provider')
})

test('--price with both providers shows two cost rows and per-provider filenames', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'music', 'an ambient piano song', '--elevenlabs-music', 'music_v1', '--minimax-music', 'music-2.5', '--price'],
  )
  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('elevenlabs')
  expect(output).toContain('minimax')
  expect(output).toContain('generated-music-elevenlabs-music_v1.mp3')
  expect(output).toContain('generated-music-minimax-music-2.5.mp3')
})

test('music_v1 generates cinematic orchestral music', async () => {
  const hasApiKey = await hasConfiguredEnvVar('ELEVENLABS_API_KEY')
  if (!hasApiKey) {
    console.log('Skipping: ELEVENLABS_API_KEY not configured')
    return
  }

  await cleanupTestOutput(MUSIC_GEN_TITLE)

  const result = await runCommand(
    ['src/cli/create-cli.ts', 'music', 'cinematic orchestral trailer, dramatic strings and percussion', '--elevenlabs-music', 'music_v1'],
  )

  expect(result.exitCode).toBe(0)

  const outputDir = await findLatestDirectory(MUSIC_GEN_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    const musicExists = await fileExists(`${outputDir}/generated-music.mp3`)
    expect(musicExists).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      music?: Array<{ musicService?: string; musicModel?: string }>
    }
    expect(metadata.music?.[0]?.musicService).toBe('elevenlabs')
    expect(metadata.music?.[0]?.musicModel).toBe('music_v1')
  }
}, ELEVENLABS_MUSIC_TIMEOUT_MS)

test('music_v1 generates lo-fi with duration and instrumental flag', async () => {
  const hasApiKey = await hasConfiguredEnvVar('ELEVENLABS_API_KEY')
  if (!hasApiKey) {
    console.log('Skipping: ELEVENLABS_API_KEY not configured')
    return
  }

  await cleanupTestOutput(MUSIC_GEN_TITLE)

  const result = await runCommand(
    ['src/cli/create-cli.ts', 'music', 'lo-fi chillhop with soft piano and vinyl texture', '--elevenlabs-music', 'music_v1', '--music-duration', '20', '--music-instrumental'],
  )

  expect(result.exitCode).toBe(0)

  const outputDir = await findLatestDirectory(MUSIC_GEN_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    const musicExists = await fileExists(`${outputDir}/generated-music.mp3`)
    expect(musicExists).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      music?: Array<{ musicService?: string; lyricsSource?: string }>
    }
    expect(metadata.music?.[0]?.musicService).toBe('elevenlabs')
    expect(metadata.music?.[0]?.lyricsSource).toBe('none')
  }
}, ELEVENLABS_MUSIC_TIMEOUT_MS)

test('write with elevenlabs music pipeline writes music artifacts and metadata', async () => {
  const hasOpenai = await hasConfiguredEnvVar('OPENAI_API_KEY')
  const hasElevenlabs = await hasConfiguredEnvVar('ELEVENLABS_API_KEY')
  if (!hasOpenai || !hasElevenlabs) {
    console.log('Skipping: OPENAI_API_KEY and ELEVENLABS_API_KEY required')
    return
  }

  await cleanupTestOutput('1-audio')

  const result = await runCommand(
    ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--openai', 'gpt-5.4', '--elevenlabs-music', 'music_v1', '--music-duration', '20'],
  )

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-audio')
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/generated-music.mp3`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      step7?: { musicService?: string; musicModel?: string; lyricsSource?: string }
    }
    expect(metadata.step7?.musicService).toBe('elevenlabs')
    expect(metadata.step7?.musicModel).toBe('music_v1')
    expect(metadata.step7?.lyricsSource).toBe('generated')
  }
}, ELEVENLABS_MUSIC_TIMEOUT_MS)
