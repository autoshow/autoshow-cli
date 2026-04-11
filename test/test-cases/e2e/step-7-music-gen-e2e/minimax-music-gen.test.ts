import { test, expect } from 'bun:test'
import { defineMusicServiceTest } from '../../../test-utils/define-music-service-test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  hasConfiguredEnvVar
} from '../../../test-utils/test-helpers'
import { budgetedTest } from '../../../test-utils/budget'

const MUSIC_GEN_TITLE = 'music-gen'

defineMusicServiceTest({
  models: [
    { model: 'music-2.5', prompt: 'uplifting indie rock with bright guitars', extraArgs: ['--music-lyrics-file', 'input/examples/document/0-tts-short.txt'] },
  ],
  cliFlag: '--minimax-music',
  musicService: 'minimax',
  envVarKey: 'MINIMAX_API_KEY',
})

budgetedTest('music-minimax-music-2.5', 'music-2.5 generates indie pop music', async () => {
  const hasApiKey = await hasConfiguredEnvVar('MINIMAX_API_KEY')
  if (!hasApiKey) {
    console.log('Skipping: MINIMAX_API_KEY not configured')
    return
  }

  await cleanupTestOutput(MUSIC_GEN_TITLE)

  const result = await runCommand(
    [
      'src/cli/create-cli.ts',
      'music',
      'indie pop, nostalgic summer road trip vibe',
      '--minimax-music',
      'music-2.5',
      '--music-lyrics-file',
      'input/examples/document/1-tts.md'
    ],
  )

  expect(result.exitCode).toBe(0)

  const outputDir = await findLatestDirectory(MUSIC_GEN_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    const musicExists = await fileExists(`${outputDir}/generated-music.mp3`)
    expect(musicExists).toBe(true)

    const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
      music?: { musicService?: string; musicModel?: string; lyricsSource?: string }
    }
    expect(metadata.music?.musicService).toBe('minimax')
    expect(metadata.music?.musicModel).toBe('music-2.5')
    expect(metadata.music?.lyricsSource).toBe('provided')
  }
})

budgetedTest('music-minimax-music-2.5', 'music-2.5 generates indie pop with lyrics file', async () => {
  const hasApiKey = await hasConfiguredEnvVar('MINIMAX_API_KEY')
  if (!hasApiKey) {
    console.log('Skipping: MINIMAX_API_KEY not configured')
    return
  }

  await cleanupTestOutput(MUSIC_GEN_TITLE)

  const result = await runCommand(
    ['src/cli/create-cli.ts', 'music', 'indie pop, nostalgic summer road trip vibe', '--minimax-music', 'music-2.5', '--music-lyrics-file', 'input/examples/document/1-tts.md'],
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
    expect(metadata.music?.musicService).toBe('minimax')
    expect(metadata.music?.lyricsSource).toBe('provided')
  }
})

budgetedTest('music-pipeline-minimax-music-2.5', 'write --price includes MiniMax music estimate', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'write', 'any-input', '--minimax-music', 'music-2.5', '--price'],
  )
  expect(result.exitCode).toBe(0)
})

test('write with elevenlabs music pipeline', async () => {
  const hasOpenai = await hasConfiguredEnvVar('OPENAI_API_KEY')
  const hasElevenlabs = await hasConfiguredEnvVar('ELEVENLABS_API_KEY')
  if (!hasOpenai || !hasElevenlabs) {
    console.log('Skipping: OPENAI_API_KEY and ELEVENLABS_API_KEY required')
    return
  }

  const result = await runCommand(
    ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--openai', 'gpt-5.4', '--elevenlabs-music', 'music_v1', '--music-duration', '20'],
  )
  expect(result.exitCode).toBe(0)
})

budgetedTest('music-pipeline-minimax-music-2.5', 'write with minimax music and lyrics file', async () => {
  const hasMinimax = await hasConfiguredEnvVar('MINIMAX_API_KEY')
  if (!hasMinimax) {
    console.log('Skipping: MINIMAX_API_KEY required')
    return
  }

  const result = await runCommand(
    ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--minimax-music', 'music-2.5', '--music-lyrics-file', 'input/examples/document/1-tts.md'],
  )
  expect(result.exitCode).toBe(0)
})

budgetedTest('music-pipeline-minimax-music-2.5', 'write --price with minimax music estimate', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--minimax-music', 'music-2.5', '--price'],
  )
  expect(result.exitCode).toBe(0)
})

test('multi-provider run produces per-provider filenames and array metadata', async () => {
  const hasElevenlabs = await hasConfiguredEnvVar('ELEVENLABS_API_KEY')
  const hasMinimax = await hasConfiguredEnvVar('MINIMAX_API_KEY')
  if (!hasElevenlabs || !hasMinimax) {
    console.log('Skipping: ELEVENLABS_API_KEY and MINIMAX_API_KEY both required')
    return
  }

  await cleanupTestOutput(MUSIC_GEN_TITLE)

  const result = await runCommand(
    [
      'src/cli/create-cli.ts',
      'music',
      'chill lo-fi beat',
      '--elevenlabs-music', 'music_v1',
      '--minimax-music', 'music-2.5',
      '--music-duration', '15',
    ],
  )

  expect(result.exitCode).toBe(0)

  const outputDir = await findLatestDirectory(MUSIC_GEN_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/generated-music-elevenlabs-music_v1.mp3`)).toBe(true)
    expect(await fileExists(`${outputDir}/generated-music-minimax-music-2.5.mp3`)).toBe(true)

    const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
      music?: Array<{ musicService?: string; musicModel?: string }>
    }
    expect(Array.isArray(metadata.music)).toBe(true)
    const musicArr = metadata.music ?? []
    expect(musicArr.some(m => m.musicService === 'elevenlabs')).toBe(true)
    expect(musicArr.some(m => m.musicService === 'minimax')).toBe(true)
  }
})
