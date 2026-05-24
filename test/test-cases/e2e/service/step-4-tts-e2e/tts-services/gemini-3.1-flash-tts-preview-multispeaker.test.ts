import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect } from 'bun:test'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../../test-utils/budget'
import {
  fileExists,
  findLatestDirectory,
  runCommand,
} from '../../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../../test-utils/manifest-helpers'
import { requireConfiguredEnvVar } from '../../../../../test-utils/service-test-kit'

budgetedTest('tts-gemini-gemini-3.1-flash-tts-preview', 'gemini multispeaker with explicit speaker mappings generates speech.wav', async () => {
  await requireConfiguredEnvVar('GEMINI_API_KEY', 'GEMINI_API_KEY is required for Gemini TTS test')

  const tempRoot = await mkdtemp(join(tmpdir(), 'autoshow-cli-gemini-tts-'))
  const inputPath = join(tempRoot, 'gemini-multispeaker-dialogue.txt')

  try {
    await writeFile(inputPath, [
      'Host: [warmly] Welcome back to the show.',
      'Guest: Thanks for having me.',
      'Host: What stood out most this week?',
      'Guest: The pacing and voice control improvements.'
    ].join('\n'))

    const result = await runCommand([
      'src/cli/create-cli.ts',
      'tts',
      inputPath,
      '--provider',
      'gemini=gemini-3.1-flash-tts-preview',
      '--gemini-speaker-1-name',
      'Host',
      '--gemini-speaker-1-voice',
      'Kore',
      '--gemini-speaker-2-name',
      'Guest',
      '--gemini-speaker-2-voice',
      'Puck'
    ])

    expect(result.exitCode).toBe(0)

    const outputDir = result.outputDir ?? await findLatestDirectory('gemini-multispeaker-dialogue', result.outputRoot)
    expect(outputDir).not.toBeNull()

    if (outputDir) {
      expect(await fileExists(`${outputDir}/speech.wav`)).toBe(true)

      const metadata = await readRunMetadata(outputDir) as {
        tts?: Array<{ ttsService?: string, ttsModel?: string, speaker?: string }>
      }
      expect(metadata.tts?.[0]?.ttsService).toBe('gemini')
      expect(metadata.tts?.[0]?.ttsModel).toBe('gemini-3.1-flash-tts-preview')
      expect(metadata.tts?.[0]?.speaker).toBe('Host=Kore, Guest=Puck')
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}, E2E_TEST_TIMEOUT_MS)

