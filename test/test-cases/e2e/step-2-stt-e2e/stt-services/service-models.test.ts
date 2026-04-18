import { test, expect } from 'bun:test'
import { defineSTTServiceTest } from '../../../../test-utils/define-stt-service-test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE,
  hasConfiguredEnvVar,
} from '../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../test-utils/manifest-helpers'

defineSTTServiceTest({
  models: ['universal-3-pro'],
  cliFlag: '--assemblyai-stt',
  sttService: 'assemblyai',
  envVarKey: 'ASSEMBLYAI_API_KEY',
  envVarDescription: 'AssemblyAI transcription',
})

defineSTTServiceTest({
  models: ['nova-3'],
  cliFlag: '--deepgram-stt',
  sttService: 'deepgram',
  envVarKey: 'DEEPGRAM_API_KEY',
  envVarDescription: 'Deepgram transcription',
})

defineSTTServiceTest({
  models: ['scribe_v2'],
  cliFlag: '--elevenlabs-stt',
  sttService: 'elevenlabs',
  envVarKey: 'ELEVENLABS_API_KEY',
  envVarDescription: 'ElevenLabs transcription',
})

defineSTTServiceTest({
  models: ['default'],
  cliFlag: '--gladia-stt',
  sttService: 'gladia',
  envVarKey: 'GLADIA_API_KEY',
  envVarDescription: 'Gladia transcription',
})

defineSTTServiceTest({
  models: ['whisper-large-v3', 'whisper-large-v3-turbo'],
  cliFlag: '--groq-stt',
  sttService: 'groq',
  envVarKey: 'GROQ_API_KEY',
  envVarDescription: 'Groq whisper transcription',
})

defineSTTServiceTest({
  models: ['voxtral-mini-2602'],
  cliFlag: '--mistral-stt',
  sttService: 'mistral',
  envVarKey: 'MISTRAL_API_KEY',
  envVarDescription: 'Mistral transcription',
})

defineSTTServiceTest({
  models: ['machine', 'low_cost'],
  cliFlag: '--rev-stt',
  sttService: 'rev',
  envVarKey: 'REVAI_ACCESS_TOKEN',
  envVarDescription: 'Rev transcription',
  timeoutMs: 90_000,
})

defineSTTServiceTest({
  models: ['stt-async-v4'],
  cliFlag: '--soniox-stt',
  sttService: 'soniox',
  envVarKey: 'SONIOX_API_KEY',
  envVarDescription: 'Soniox transcription',
})

defineSTTServiceTest({
  models: ['standard', 'enhanced'],
  cliFlag: '--speechmatics-stt',
  sttService: 'speechmatics',
  envVarKey: 'SPEECHMATICS_API_KEY',
  envVarDescription: 'Speechmatics transcription',
  timeoutMs: 30_000,
})

test('elevenlabs scribe_v2 transcribes with speaker-count 3', async () => {
  if (!await hasConfiguredEnvVar('ELEVENLABS_API_KEY')) {
    console.log('Skipping: ELEVENLABS_API_KEY is required for ElevenLabs transcription')
    return
  }

  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'stt',
    STABLE_LOCAL_AUDIO_PATH,
    '--elevenlabs-stt',
    'scribe_v2',
    '--speaker-count',
    '3'
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/transcription.txt`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      step2?: { transcriptionService?: string, transcriptionModel?: string }
    }
    expect(metadata.step2?.transcriptionService).toBe('elevenlabs')
    expect(metadata.step2?.transcriptionModel).toBe('scribe_v2')
  }
}, 30_000)
