import { test, expect } from 'bun:test'
import { defineMusicServiceTest } from '../../../../test-utils/define-music-service-test'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../test-utils/budget'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput
} from '../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../test-utils/manifest-helpers'
import { requireConfiguredEnvVar } from '../../../../test-utils/service-test-kit'

defineMusicServiceTest({
  models: [
    { model: 'music_v1', prompt: 'upbeat electronic instrumental with warm synth pads', extraArgs: ['--duration', '3', '--instrumental'] },
  ],
  provider: 'elevenlabs',
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

budgetedTest('music-pipeline-elevenlabs-music_v1', 'write with elevenlabs music pipeline writes music artifacts and metadata', async () => {
  await requireConfiguredEnvVar('ELEVENLABS_API_KEY', 'ELEVENLABS_API_KEY required')

  await cleanupTestOutput('1-audio')

  const result = await runCommand(
    ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'llama=ggml-org/gemma-3-270m-it-GGUF', '--music', 'elevenlabs=music_v1', '--music-duration', '3'],
  )

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-audio')
  if (!outputDir) {
    throw new Error('Expected output directory for 1-audio')
  }

  expect(await fileExists(`${outputDir}/generated-music.mp3`)).toBe(true)

  const metadata = await readRunMetadata(outputDir) as {
    step7?: { musicService?: string; musicModel?: string; lyricsSource?: string }
  }
  expect(metadata.step7?.musicService).toBe('elevenlabs')
  expect(metadata.step7?.musicModel).toBe('music_v1')
  expect(metadata.step7?.lyricsSource).toBe('generated')
}, E2E_TEST_TIMEOUT_MS)
