import { test, expect } from 'bun:test'
import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE,
  hasConfiguredEnvVar
} from '../../../../../test-utils/test-helpers'

defineSTTServiceTest({
  models: ['scribe_v2'],
  cliFlag: '--elevenlabs-stt',
  sttService: 'elevenlabs',
  envVarKey: 'ELEVENLABS_API_KEY',
  envVarDescription: 'ElevenLabs transcription',
  extraArgs: ['--speaker-count', '2'],
})

test('elevenlabs scribe_v2 transcribes with speaker-count 3', async () => {
  if (!await hasConfiguredEnvVar('ELEVENLABS_API_KEY')) {
    console.log('Skipping: ELEVENLABS_API_KEY is required for ElevenLabs transcription')
    return
  }

  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'transcribe',
    STABLE_LOCAL_AUDIO_PATH,
    '--elevenlabs-stt',
    'scribe_v2',
    '--speaker-count',
    '3'
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    const transcriptExists = await fileExists(`${outputDir}/transcription.txt`)
    expect(transcriptExists).toBe(true)

    const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
      step2?: { transcriptionService?: string, transcriptionModel?: string }
    }
    expect(metadata.step2?.transcriptionService).toBe('elevenlabs')
    expect(metadata.step2?.transcriptionModel).toBe('scribe_v2')
  }
})
