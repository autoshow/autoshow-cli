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
import {
  formatCommandFailureDiagnostics,
  requireConfiguredEnvVar
} from '../../../../../test-utils/service-test-kit'
import {
  isTransientMistralTtsFailure,
  mistralRefAudioPath,
  mistralTtsModel,
} from './cases'

budgetedTest('tts-mistral-dialogue-ref-audio', 'mistral dialogue mode generates normalized dialogue, segments, and speech.wav', async () => {
  await requireConfiguredEnvVar('MISTRAL_API_KEY', 'MISTRAL_API_KEY is required for Mistral dialogue TTS test')

  const tempRoot = await mkdtemp(join(tmpdir(), 'autoshow-cli-mistral-dialogue-'))
  const inputPath = join(tempRoot, 'mistral-dialogue.txt')

  try {
    await writeFile(inputPath, [
      'Host: Hello from the dialogue test.',
      'Guest: Hi. This keeps the live test short.'
    ].join('\n'))

    const args = [
      'src/cli/create-cli.ts',
      'tts',
      inputPath,
      '--provider',
      `mistral=${mistralTtsModel}`,
      '--tts-dialogue-format',
      'labeled',
      '--tts-speaker-ref-audio',
      `Host=${mistralRefAudioPath}`,
      '--tts-speaker-ref-audio',
      'Guest=https://ajc.pics/autoshow/examples/1-audio.mp3'
    ]
    const result = await runCommand(args)

    if (result.exitCode !== 0 && isTransientMistralTtsFailure(`${result.stdout}\n${result.stderr}`)) {
      throw new Error(`Mistral TTS endpoint was not reachable for dialogue TTS test\n${formatCommandFailureDiagnostics(args, result)}`)
    }

    expect(result.exitCode).toBe(0)

    const outputDir = result.outputDir ?? await findLatestDirectory('mistral-dialogue', result.outputRoot)
    expect(outputDir).not.toBeNull()

    if (outputDir) {
      expect(await fileExists(`${outputDir}/speech.wav`)).toBe(true)
      expect(await fileExists(`${outputDir}/dialogue-normalized.txt`)).toBe(true)
      expect(await fileExists(`${outputDir}/segments/segment-001-Host.wav`)).toBe(true)
      expect(await fileExists(`${outputDir}/segments/segment-002-Guest.wav`)).toBe(true)

      const metadata = await readRunMetadata(outputDir) as {
        tts?: Array<{ ttsService?: string, ttsModel?: string, speaker?: string, chunkCount?: number }>
      }
      expect(metadata.tts?.[0]?.ttsService).toBe('mistral')
      expect(metadata.tts?.[0]?.ttsModel).toBe(mistralTtsModel)
      expect(metadata.tts?.[0]?.speaker).toBe('Host=ref_audio:anthony-voice.mp3, Guest=ref_audio:1-audio.mp3')
      expect(metadata.tts?.[0]?.chunkCount).toBe(2)
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}, E2E_TEST_TIMEOUT_MS)

