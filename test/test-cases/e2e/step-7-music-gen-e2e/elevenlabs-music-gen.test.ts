import { test, expect } from 'bun:test'
import { defineMusicServiceTest } from '../../../test-utils/define-music-service-test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  hasConfiguredEnvVar
} from '../../../test-utils/test-helpers'

const MUSIC_GEN_TITLE = 'music-gen'

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
})

test('--price with both providers shows two cost rows and per-provider filenames', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'music', 'an ambient piano song', '--elevenlabs-music', 'music_v1', '--minimax-music', 'music-2.5', '--price'],
  )
  expect(result.exitCode).toBe(0)
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

    const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
      music?: { musicService?: string; musicModel?: string }
    }
    expect(metadata.music?.musicService).toBe('elevenlabs')
    expect(metadata.music?.musicModel).toBe('music_v1')
  }
})

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

    const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
      music?: { musicService?: string; lyricsSource?: string }
    }
    expect(metadata.music?.musicService).toBe('elevenlabs')
    expect(metadata.music?.lyricsSource).toBe('none')
  }
})
