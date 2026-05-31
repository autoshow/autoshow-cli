import { expect } from 'bun:test'
import { budgetedTest } from '../../../../test-utils/budget'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
} from '../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../test-utils/manifest-helpers'
import { requireConfiguredEnvVars } from '../../../../test-utils/service-test-kit'

const MUSIC_GEN_TITLE = 'music-gen'

budgetedTest('music-multi-minimax-music-2.6-gemini-lyria-3-clip-preview', 'multi-provider run produces per-provider filenames and array metadata', async () => {
  await requireConfiguredEnvVars(['MINIMAX_API_KEY', 'GEMINI_API_KEY'], 'MINIMAX_API_KEY and GEMINI_API_KEY both required')

  const result = await runCommand(
    [
      'src/cli/create-cli.ts',
      'music',
      'bright acoustic pop with handclaps and a catchy chorus',
      '--provider', 'minimax=music-2.6',
      '--provider', 'gemini=lyria-3-clip-preview',
      '--lyrics-file', 'input/examples/tts/1-tts.md',
    ],
  )

  expect(result.exitCode).toBe(0)

  const outputDir = await findLatestDirectory(MUSIC_GEN_TITLE, result.outputRoot)
  if (!outputDir) {
    throw new Error(`Expected output directory for ${MUSIC_GEN_TITLE}`)
  }

  expect(await fileExists(`${outputDir}/generated-music-minimax-music-2.6.mp3`)).toBe(true)
  expect(await fileExists(`${outputDir}/generated-music-gemini-lyria-3-clip-preview.mp3`)).toBe(true)

  const metadata = await readRunMetadata(outputDir) as {
    music?: Array<{ musicService?: string; musicModel?: string; lyricsSource?: string }>
  }
  const musicArr = metadata.music ?? []
  expect(musicArr.some(m =>
    m.musicService === 'minimax'
    && m.musicModel === 'music-2.6'
    && m.lyricsSource === 'provided'
  )).toBe(true)
  expect(musicArr.some(m =>
    m.musicService === 'gemini'
    && m.musicModel === 'lyria-3-clip-preview'
    && m.lyricsSource === 'provided'
  )).toBe(true)
})

