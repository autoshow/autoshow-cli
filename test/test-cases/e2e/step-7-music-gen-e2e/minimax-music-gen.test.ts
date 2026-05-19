import { expect } from 'bun:test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  hasConfiguredEnvVar
} from '../../../test-utils/test-helpers'
import { budgetedTest } from '../../../test-utils/budget'
import { readRunMetadata } from '../../../test-utils/manifest-helpers'

const MUSIC_GEN_TITLE = 'music-gen'

budgetedTest('music-pipeline-minimax-music-2.5', 'write with minimax music and lyrics file', async () => {
  const hasMinimax = await hasConfiguredEnvVar('MINIMAX_API_KEY')
  if (!hasMinimax) {
    console.log('Skipping: MINIMAX_API_KEY required')
    return
  }

  await cleanupTestOutput('1-audio')

  const result = await runCommand(
    ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--minimax-music', 'music-2.5', '--music-lyrics-file', 'input/examples/tts/1-tts.md'],
  )
  expect(result.exitCode).toBe(0)

  const outputDir = await findLatestDirectory('1-audio')
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/generated-music.mp3`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      step7?: { musicService?: string; musicModel?: string; lyricsSource?: string; musicFileName?: string }
    }
    expect(metadata.step7?.musicService).toBe('minimax')
    expect(metadata.step7?.musicModel).toBe('music-2.5')
    expect(metadata.step7?.lyricsSource).toBe('provided')
    expect(metadata.step7?.musicFileName).toBe('generated-music.mp3')
  }
})

budgetedTest('music-multi-minimax-music-2.5-gemini-lyria-3-clip-preview', 'multi-provider run produces per-provider filenames and array metadata', async () => {
  const hasMinimax = await hasConfiguredEnvVar('MINIMAX_API_KEY')
  const hasGemini = await hasConfiguredEnvVar('GEMINI_API_KEY')
  if (!hasMinimax || !hasGemini) {
    console.log('Skipping: MINIMAX_API_KEY and GEMINI_API_KEY both required')
    return
  }

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
  expect(outputDir).not.toBeNull()

  if (outputDir) {
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
  }
})
