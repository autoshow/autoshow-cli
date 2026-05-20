import { expect } from 'bun:test'
import { defineMusicServiceTest } from '../../../test-utils/define-music-service-test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput
} from '../../../test-utils/test-helpers'
import { budgetedTest } from '../../../test-utils/budget'
import { readRunMetadata } from '../../../test-utils/manifest-helpers'
import { requireConfiguredEnvVar, requireConfiguredEnvVars } from '../../../test-utils/service-test-kit'
import { MINIMAX_INSTRUMENTAL_MUSIC_MODELS } from '~/cli/commands/setup-and-utilities/models/model-options'

const MUSIC_GEN_TITLE = 'music-gen'
const MINIMAX_FREE_MUSIC_COMMAND_TIMEOUT_MS = 10 * 60_000
const MINIMAX_FREE_MUSIC_TEST_TIMEOUT_MS = 11 * 60_000

defineMusicServiceTest({
  models: MINIMAX_INSTRUMENTAL_MUSIC_MODELS.map((model) => ({
    model,
    prompt: 'an ambient piano instrumental',
    extraArgs: ['--music-instrumental'],
    expectedLyricsSource: 'none',
    ...(model === 'music-2.6-free'
      ? {
          commandTimeoutMs: MINIMAX_FREE_MUSIC_COMMAND_TIMEOUT_MS,
          testTimeoutMs: MINIMAX_FREE_MUSIC_TEST_TIMEOUT_MS,
        }
      : {}),
  })),
  cliFlag: '--minimax',
  musicService: 'minimax',
  envVarKey: 'MINIMAX_API_KEY',
})

budgetedTest('music-pipeline-minimax-music-2.5', 'write with minimax music and lyrics file', async () => {
  await requireConfiguredEnvVar('MINIMAX_API_KEY', 'MINIMAX_API_KEY required')

  await cleanupTestOutput('1-audio')

  const result = await runCommand(
    ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--minimax-music', 'music-2.5', '--music-lyrics-file', 'input/examples/tts/1-tts.md'],
  )
  expect(result.exitCode).toBe(0)

  const outputDir = await findLatestDirectory('1-audio')
  if (!outputDir) {
    throw new Error('Expected output directory for 1-audio')
  }

  expect(await fileExists(`${outputDir}/generated-music.mp3`)).toBe(true)

  const metadata = await readRunMetadata(outputDir) as {
    step7?: { musicService?: string; musicModel?: string; lyricsSource?: string; musicFileName?: string }
  }
  expect(metadata.step7?.musicService).toBe('minimax')
  expect(metadata.step7?.musicModel).toBe('music-2.5')
  expect(metadata.step7?.lyricsSource).toBe('provided')
  expect(metadata.step7?.musicFileName).toBe('generated-music.mp3')
})

budgetedTest('music-multi-minimax-music-2.5-gemini-lyria-3-clip-preview', 'multi-provider run produces per-provider filenames and array metadata', async () => {
  await requireConfiguredEnvVars(['MINIMAX_API_KEY', 'GEMINI_API_KEY'], 'MINIMAX_API_KEY and GEMINI_API_KEY both required')

  await cleanupTestOutput(MUSIC_GEN_TITLE)

  const result = await runCommand(
    [
      'src/cli/create-cli.ts',
      'music',
      'bright acoustic pop with handclaps and a catchy chorus',
      '--minimax', 'music-2.5',
      '--gemini', 'lyria-3-clip-preview',
      '--music-lyrics-file', 'input/examples/tts/1-tts.md',
    ],
  )

  expect(result.exitCode).toBe(0)

  const outputDir = await findLatestDirectory(MUSIC_GEN_TITLE)
  if (!outputDir) {
    throw new Error(`Expected output directory for ${MUSIC_GEN_TITLE}`)
  }

  expect(await fileExists(`${outputDir}/generated-music-minimax-music-2.5.mp3`)).toBe(true)
  expect(await fileExists(`${outputDir}/generated-music-gemini-lyria-3-clip-preview.mp3`)).toBe(true)

  const metadata = await readRunMetadata(outputDir) as {
    music?: Array<{ musicService?: string; musicModel?: string; lyricsSource?: string }>
  }
  const musicArr = metadata.music ?? []
  expect(musicArr.some(m =>
    m.musicService === 'minimax'
    && m.musicModel === 'music-2.5'
    && m.lyricsSource === 'provided'
  )).toBe(true)
  expect(musicArr.some(m =>
    m.musicService === 'gemini'
    && m.musicModel === 'lyria-3-clip-preview'
    && m.lyricsSource === 'provided'
  )).toBe(true)
})
