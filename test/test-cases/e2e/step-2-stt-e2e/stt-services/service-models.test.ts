import { join } from 'node:path'
import { expect } from 'bun:test'
import { defineSTTServiceTest } from '../../../../test-utils/define-stt-service-test'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../test-utils/budget'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_EXAMPLE_AUDIO_URL,
  STABLE_EXAMPLE_AUDIO_TITLE,
  SHORT_LOCAL_AUDIO_PATH,
  SHORT_LOCAL_AUDIO_TITLE,
} from '../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../test-utils/manifest-helpers'
import { requireConfiguredEnvVar, runCommandAndExpectOutputDir } from '../../../../test-utils/service-test-kit'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toRecordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

const YOUTUBE_TRANSCRIPT_URL = 'https://www.youtube.com/watch?v=MORMZXEaONk'
const YOUTUBE_TRANSCRIPT_TITLE = 'MORMZXEaONk'

const findStep2Metadata = (
  metadata: Record<string, unknown>,
  service: string,
  model: string
): Record<string, unknown> | undefined => {
  const step2 = metadata['step2']
  if (isRecord(step2)) {
    return step2
  }
  return toRecordArray(step2).find((entry) =>
    entry['transcriptionService'] === service && entry['transcriptionModel'] === model
  )
}

const resolveTranscriptArtifactDir = async (
  outputDir: string,
  metadata: Record<string, unknown>,
  service: string,
  model: string
): Promise<string> => {
  const providerState = toRecordArray(metadata['providerStates']).find((entry) =>
    entry['service'] === service && entry['model'] === model
  )
  const artifactDir = providerState && typeof providerState['artifactDir'] === 'string'
    ? providerState['artifactDir']
    : undefined

  if (artifactDir) {
    return join(outputDir, artifactDir)
  }

  if (await fileExists(join(outputDir, 'transcription.txt'))) {
    return outputDir
  }

  return join(outputDir, 'providers', `${service}-${model}`)
}

const defineUrlTranscriptServiceTest = ({
  service,
  model,
  cliFlag,
  envVarKey,
  envVarDescription,
}: {
  service: string
  model: string
  cliFlag: string
  envVarKey: string
  envVarDescription: string
}): void => {
  const budgetKey = `transcribe-${service}-${model}`

  budgetedTest(budgetKey, `${service} ${model} retrieves YouTube URL transcript`, async () => {
    await requireConfiguredEnvVar(envVarKey, `${envVarKey} is required for ${envVarDescription}`)

    await cleanupTestOutput(YOUTUBE_TRANSCRIPT_TITLE)

    const outputDir = await runCommandAndExpectOutputDir(YOUTUBE_TRANSCRIPT_TITLE, [
      'src/cli/create-cli.ts',
      'extract',
      YOUTUBE_TRANSCRIPT_URL,
      cliFlag,
      model
    ])

    expect(await fileExists(join(outputDir, 'run.json'))).toBe(true)

    const metadata = await readRunMetadata(outputDir)
    const step2 = findStep2Metadata(metadata, service, model)
    expect(step2?.['transcriptionService']).toBe(service)
    expect(step2?.['transcriptionModel']).toBe(model)

    const artifactDir = await resolveTranscriptArtifactDir(outputDir, metadata, service, model)
    const transcriptPath = join(artifactDir, 'transcription.txt')
    expect(await fileExists(transcriptPath)).toBe(true)
    expect((await Bun.file(transcriptPath).text()).length).toBeGreaterThan(0)
    expect(await fileExists(join(artifactDir, 'result.json'))).toBe(true)
  }, E2E_TEST_TIMEOUT_MS)
}

defineSTTServiceTest({
  models: ['universal-3-pro'],
  cliFlag: '--assemblyai',
  sttService: 'assemblyai',
  envVarKey: 'ASSEMBLYAI_API_KEY',
  envVarDescription: 'AssemblyAI transcription',
})

defineSTTServiceTest({
  models: ['nova-3'],
  cliFlag: '--deepgram',
  sttService: 'deepgram',
  envVarKey: 'DEEPGRAM_API_KEY',
  envVarDescription: 'Deepgram transcription',
})

defineSTTServiceTest({
  models: ['openai/whisper-large-v3-turbo', 'openai/whisper-large-v3'],
  cliFlag: '--deepinfra',
  sttService: 'deepinfra',
  envVarKey: 'DEEPINFRA_API_KEY',
  envVarDescription: 'DeepInfra transcription',
})

defineSTTServiceTest({
  models: ['openai/whisper-large-v3'],
  cliFlag: '--together',
  sttService: 'together',
  envVarKey: 'TOGETHER_API_KEY',
  envVarDescription: 'Together transcription',
})

defineSTTServiceTest({
  models: ['scribe_v2'],
  cliFlag: '--elevenlabs',
  sttService: 'elevenlabs',
  envVarKey: 'ELEVENLABS_API_KEY',
  envVarDescription: 'ElevenLabs transcription',
})

defineSTTServiceTest({
  models: ['default'],
  cliFlag: '--gladia',
  sttService: 'gladia',
  envVarKey: 'GLADIA_API_KEY',
  envVarDescription: 'Gladia transcription',
})

defineSTTServiceTest({
  models: ['whisper-large-v3', 'whisper-large-v3-turbo'],
  cliFlag: '--groq',
  sttService: 'groq',
  envVarKey: 'GROQ_API_KEY',
  envVarDescription: 'Groq whisper transcription',
})

defineSTTServiceTest({
  models: ['speech-to-text'],
  cliFlag: '--grok',
  sttService: 'grok',
  envVarKey: 'XAI_API_KEY',
  envVarDescription: 'xAI Grok transcription',
})

defineSTTServiceTest({
  models: ['voxtral-mini-2602'],
  cliFlag: '--mistral',
  sttService: 'mistral',
  envVarKey: 'MISTRAL_API_KEY',
  envVarDescription: 'Mistral transcription',
})

defineSTTServiceTest({
  models: ['machine', 'low_cost'],
  cliFlag: '--rev',
  sttService: 'rev',
  envVarKey: 'REVAI_ACCESS_TOKEN',
  envVarDescription: 'Rev transcription',
})

defineSTTServiceTest({
  models: ['stt-async-v4'],
  cliFlag: '--soniox',
  sttService: 'soniox',
  envVarKey: 'SONIOX_API_KEY',
  envVarDescription: 'Soniox transcription',
})

defineSTTServiceTest({
  models: ['standard', 'enhanced'],
  cliFlag: '--speechmatics',
  sttService: 'speechmatics',
  envVarKey: 'SPEECHMATICS_API_KEY',
  envVarDescription: 'Speechmatics transcription',
})

defineSTTServiceTest({
  models: ['gpt-4o-mini-transcribe', 'gpt-4o-transcribe'],
  cliFlag: '--openai',
  sttService: 'openai-stt',
  envVarKey: 'OPENAI_API_KEY',
  envVarDescription: 'OpenAI transcription',
  inputPath: SHORT_LOCAL_AUDIO_PATH,
  inputTitle: SHORT_LOCAL_AUDIO_TITLE,
})

defineSTTServiceTest({
  models: ['gemini-3-flash-preview'],
  cliFlag: '--gemini',
  sttService: 'gemini-stt',
  envVarKey: 'GEMINI_API_KEY',
  envVarDescription: 'Gemini transcription',
  inputPath: SHORT_LOCAL_AUDIO_PATH,
  inputTitle: SHORT_LOCAL_AUDIO_TITLE,
})

defineSTTServiceTest({
  models: ['glm-asr-2512'],
  cliFlag: '--glm',
  sttService: 'glm-stt',
  envVarKey: 'GLM_API_KEY',
  envVarDescription: 'GLM transcription',
  inputPath: SHORT_LOCAL_AUDIO_PATH,
  inputTitle: SHORT_LOCAL_AUDIO_TITLE,
})

defineUrlTranscriptServiceTest({
  service: 'supadata',
  model: 'auto',
  cliFlag: '--supadata',
  envVarKey: 'SUPADATA_API_KEY',
  envVarDescription: 'Supadata YouTube transcript retrieval',
})

defineUrlTranscriptServiceTest({
  service: 'scrapecreators',
  model: 'youtube-transcript',
  cliFlag: '--scrapecreators',
  envVarKey: 'SCRAPECREATORS_API_KEY',
  envVarDescription: 'ScrapeCreators YouTube transcript retrieval',
})

budgetedTest('transcribe-elevenlabs-scribe_v2', 'elevenlabs scribe_v2 transcribes with speaker-count 3', async () => {
  await requireConfiguredEnvVar('ELEVENLABS_API_KEY', 'ELEVENLABS_API_KEY is required for ElevenLabs transcription')

  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    STABLE_EXAMPLE_AUDIO_URL,
    '--elevenlabs',
    'scribe_v2',
    '--speaker-count',
    '3'
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_EXAMPLE_AUDIO_TITLE)
  if (!outputDir) {
    throw new Error(`Expected output directory for ${STABLE_EXAMPLE_AUDIO_TITLE}`)
  }

  expect(await fileExists(`${outputDir}/transcription.txt`)).toBe(true)

  const metadata = await readRunMetadata(outputDir) as {
    step2?: { transcriptionService?: string, transcriptionModel?: string }
  }
  expect(metadata.step2?.transcriptionService).toBe('elevenlabs')
  expect(metadata.step2?.transcriptionModel).toBe('scribe_v2')
}, E2E_TEST_TIMEOUT_MS)
