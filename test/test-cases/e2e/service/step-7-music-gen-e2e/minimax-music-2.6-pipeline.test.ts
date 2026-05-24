import { expect } from 'bun:test'
import { budgetedTest } from '../../../../test-utils/budget'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
} from '../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../test-utils/manifest-helpers'
import { requireConfiguredEnvVar } from '../../../../test-utils/service-test-kit'

budgetedTest('music-pipeline-minimax-music-2.6', 'write with minimax music and lyrics file', async () => {
  await requireConfiguredEnvVar('MINIMAX_API_KEY', 'MINIMAX_API_KEY required')

  const result = await runCommand(
    ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--music', 'minimax=music-2.6', '--music-lyrics-file', 'input/examples/tts/1-tts.md'],
  )
  expect(result.exitCode).toBe(0)

  const outputDir = await findLatestDirectory('1-audio', result.outputRoot)
  if (!outputDir) {
    throw new Error('Expected output directory for 1-audio')
  }

  expect(await fileExists(`${outputDir}/generated-music.mp3`)).toBe(true)

  const metadata = await readRunMetadata(outputDir) as {
    step7?: { musicService?: string; musicModel?: string; lyricsSource?: string; musicFileName?: string }
  }
  expect(metadata.step7?.musicService).toBe('minimax')
  expect(metadata.step7?.musicModel).toBe('music-2.6')
  expect(metadata.step7?.lyricsSource).toBe('provided')
  expect(metadata.step7?.musicFileName).toBe('generated-music.mp3')
})

