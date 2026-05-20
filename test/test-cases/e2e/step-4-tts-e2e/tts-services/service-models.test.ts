import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { test, expect } from 'bun:test'
import { defineTTSServiceTest } from '../../../../test-utils/define-tts-service-test'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../test-utils/budget'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_TTS_MD_PATH,
  STABLE_TTS_MD_TITLE,
  readConfiguredEnvVar,
} from '../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../test-utils/manifest-helpers'
import {
  formatCommandFailureDiagnostics,
  requireConfiguredEnvVar,
  requireConfiguredValue
} from '../../../../test-utils/service-test-kit'
import {
  ELEVENLABS_DEFAULT_VOICE_ID,
  GEMINI_DEFAULT_TTS_VOICE,
  OPENAI_DEFAULT_TTS_VOICE,
  DEEPGRAM_DEFAULT_VOICE,
  GCLOUD_DEFAULT_TTS_VOICES,
  GROK_DEFAULT_TTS_VOICE,
  SPEECHIFY_DEFAULT_TTS_VOICE,
  SUPPORTED_DEAPI_RUNNABLE_TTS_MODELS,
  DEAPI_DEFAULT_TTS_VOICE,
} from '~/cli/commands/setup-and-utilities/models/model-options'

const MISTRAL_TTS_MODEL = 'voxtral-mini-tts-2603'
const MISTRAL_REF_AUDIO_PATH = 'input/examples/audio/anthony-voice.mp3'
const DEAPI_TTS_CLONE_MODEL = 'Qwen3_TTS_12Hz_1_7B_Base'
const DEAPI_REF_AUDIO_PATH = 'https://ajc.pics/autoshow/examples/0-audio-short.mp3'
const SHORT_TTS_INPUT_PATH = 'input/examples/tts/0-tts-short.txt'
const SHORT_TTS_INPUT_TITLE = '0-tts-short'
const resolveDeapiDefaultSpeaker = (model: string): string => {
  if (model === 'Kokoro') return DEAPI_DEFAULT_TTS_VOICE
  if (model === 'Chatterbox') return 'default'
  return 'Vivian'
}

const isTransientMistralTtsFailure = (output: string): boolean =>
  /Unable to connect|Unexpected HTTP client error|fetch failed|network error|econnreset|econnrefused|etimedout|socket hang up|dns/i.test(output)

defineTTSServiceTest({
  models: ['gpt-4o-mini-tts'],
  cliFlag: '--openai',
  ttsService: 'openai',
  envVarKey: 'OPENAI_API_KEY',
  envVarDescription: 'OpenAI TTS',
  resolveExpectedSpeaker: async () => {
    const voice = await readConfiguredEnvVar('OPENAI_TTS_VOICE')
    return voice ?? OPENAI_DEFAULT_TTS_VOICE
  },
})

budgetedTest('tts-openai-gpt-4o-mini-tts-clone', 'OpenAI custom voice clone generates speech.wav when explicitly enabled', async () => {
  const enabled = await readConfiguredEnvVar('OPENAI_TTS_CUSTOM_VOICE_TEST')
  requireConfiguredValue(
    enabled === '1' ? enabled : null,
    'OPENAI_TTS_CUSTOM_VOICE_TEST=1 is required for OpenAI custom voice TTS test'
  )
  await requireConfiguredEnvVar('OPENAI_API_KEY', 'OPENAI_API_KEY is required for OpenAI custom voice TTS test')
  const consentId = await requireConfiguredEnvVar('OPENAI_TTS_CONSENT_ID', 'OPENAI_TTS_CONSENT_ID and OPENAI_TTS_REF_AUDIO are required for OpenAI custom voice TTS test')
  const refAudio = await requireConfiguredEnvVar('OPENAI_TTS_REF_AUDIO', 'OPENAI_TTS_CONSENT_ID and OPENAI_TTS_REF_AUDIO are required for OpenAI custom voice TTS test')

  await cleanupTestOutput(STABLE_TTS_MD_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--openai',
    'gpt-4o-mini-tts',
    '--openai-tts-ref-audio',
    refAudio,
    '--openai-tts-consent-id',
    consentId,
    '--openai-tts-voice-name',
    `AutoShowLive${Date.now().toString(36)}`
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_TTS_MD_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/speech.wav`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      tts?: Array<{ ttsService?: string, ttsModel?: string, speaker?: string, clonedVoiceId?: string, cloneCostCents?: number }>
    }
    expect(metadata.tts?.[0]?.ttsService).toBe('openai')
    expect(metadata.tts?.[0]?.ttsModel).toBe('gpt-4o-mini-tts')
    expect(metadata.tts?.[0]?.speaker).toBe(`ref_audio:${basename(refAudio)}`)
    expect(metadata.tts?.[0]?.clonedVoiceId?.startsWith('voice_')).toBe(true)
    expect(metadata.tts?.[0]?.cloneCostCents).toBe(0)
  }
}, E2E_TEST_TIMEOUT_MS)

defineTTSServiceTest({
  models: ['gemini-3.1-flash-tts-preview'],
  cliFlag: '--gemini',
  ttsService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
  envVarDescription: 'Gemini TTS',
  resolveExpectedSpeaker: async () => {
    const voice = await readConfiguredEnvVar('GEMINI_TTS_VOICE')
    return voice ?? GEMINI_DEFAULT_TTS_VOICE
  },
})

budgetedTest('tts-gemini-gemini-3.1-flash-tts-preview', 'gemini multispeaker with explicit speaker mappings generates speech.wav', async () => {
  await requireConfiguredEnvVar('GEMINI_API_KEY', 'GEMINI_API_KEY is required for Gemini TTS test')

  await cleanupTestOutput('gemini-multispeaker-dialogue')

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
      '--gemini',
      'gemini-3.1-flash-tts-preview',
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

    const outputDir = result.outputDir ?? await findLatestDirectory('gemini-multispeaker-dialogue')
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
    await cleanupTestOutput('gemini-multispeaker-dialogue')
    await rm(tempRoot, { recursive: true, force: true })
  }
}, E2E_TEST_TIMEOUT_MS)

defineTTSServiceTest({
  models: ['speech-2.8-turbo', 'speech-2.8-hd'],
  cliFlag: '--minimax',
  ttsService: 'minimax',
  envVarKey: 'MINIMAX_API_KEY',
  envVarDescription: 'MiniMax TTS',
  extraArgs: ['--minimax-tts-voice', 'English_expressive_narrator'],
  resolveExpectedSpeaker: async () => 'English_expressive_narrator',
})

defineTTSServiceTest({
  models: ['eleven_v3'],
  cliFlag: '--elevenlabs',
  ttsService: 'elevenlabs',
  envVarKey: 'ELEVENLABS_API_KEY',
  envVarDescription: 'ElevenLabs TTS',
  resolveExpectedSpeaker: async () => {
    const voiceId = await readConfiguredEnvVar('ELEVENLABS_VOICE_ID')
    return voiceId ?? ELEVENLABS_DEFAULT_VOICE_ID
  },
})

defineTTSServiceTest({
  models: ['canopylabs/orpheus-v1-english'],
  cliFlag: '--groq',
  ttsService: 'groq',
  envVarKey: 'GROQ_API_KEY',
  envVarDescription: 'Groq TTS',
  extraArgs: ['--groq-voice', 'troy'],
  resolveExpectedSpeaker: async () => 'troy',
})

defineTTSServiceTest({
  models: ['grok-tts'],
  cliFlag: '--grok',
  ttsService: 'grok',
  envVarKey: 'XAI_API_KEY',
  envVarDescription: 'xAI Grok TTS',
  extraArgs: ['--grok-tts-voice', GROK_DEFAULT_TTS_VOICE],
  resolveExpectedSpeaker: async () => GROK_DEFAULT_TTS_VOICE,
})

defineTTSServiceTest({
  models: [DEEPGRAM_DEFAULT_VOICE],
  cliFlag: '--deepgram',
  ttsService: 'deepgram',
  envVarKey: 'DEEPGRAM_API_KEY',
  envVarDescription: 'Deepgram TTS',
  inputPath: SHORT_TTS_INPUT_PATH,
  inputTitle: SHORT_TTS_INPUT_TITLE,
  resolveExpectedSpeaker: async () => {
    const voice = await readConfiguredEnvVar('DEEPGRAM_TTS_VOICE')
    return voice ?? DEEPGRAM_DEFAULT_VOICE
  },
})

defineTTSServiceTest({
  models: ['simba-english', 'simba-multilingual'],
  cliFlag: '--speechify',
  ttsService: 'speechify',
  envVarKey: 'SPEECHIFY_API_KEY',
  envVarDescription: 'Speechify TTS',
  resolveExpectedSpeaker: async () => {
    const voice = await readConfiguredEnvVar('SPEECHIFY_TTS_VOICE')
    return voice ?? SPEECHIFY_DEFAULT_TTS_VOICE
  },
})

defineTTSServiceTest({
  models: ['chirp3-hd', 'studio'],
  cliFlag: '--gcloud',
  ttsService: 'gcloud',
  envVarKey: 'AUTOSHOW_GCLOUD_TTS_E2E',
  envVarDescription: 'Google Cloud TTS readiness with AUTOSHOW_GCLOUD_TTS_E2E=1',
  inputPath: SHORT_TTS_INPUT_PATH,
  inputTitle: SHORT_TTS_INPUT_TITLE,
  resolveExpectedSpeaker: async (model) => GCLOUD_DEFAULT_TTS_VOICES[model as 'chirp3-hd' | 'studio'],
})

defineTTSServiceTest({
  models: SUPPORTED_DEAPI_RUNNABLE_TTS_MODELS,
  cliFlag: '--deapi',
  ttsService: 'deapi',
  envVarKey: 'DEAPI_API_KEY',
  envVarDescription: 'deAPI TTS',
  inputPath: SHORT_TTS_INPUT_PATH,
  inputTitle: SHORT_TTS_INPUT_TITLE,
  resolveExpectedSpeaker: async (model) => resolveDeapiDefaultSpeaker(model),
})

test('rejects invalid mistral model', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--mistral',
    'invalid-model'
  ])

  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Invalid --mistral-tts model')
})

test('mistral execution requires a voice source before API key validation', async () => {
  await cleanupTestOutput(STABLE_TTS_MD_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--mistral',
    MISTRAL_TTS_MODEL
  ], {
    env: {
      MISTRAL_API_KEY: '',
      MISTRAL_TTS_VOICE: '',
      MISTRAL_TTS_REF_AUDIO: ''
    }
  })

  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Mistral TTS requires a saved voice ID or reference audio')

  await cleanupTestOutput(STABLE_TTS_MD_TITLE)
})

budgetedTest('tts-mistral-voxtral-mini-tts-2603-voice', 'mistral saved voice generates speech.wav when MISTRAL_TTS_VOICE is configured', async () => {
  await requireConfiguredEnvVar('MISTRAL_API_KEY', 'MISTRAL_API_KEY is required for Mistral TTS test')
  const voice = await requireConfiguredEnvVar('MISTRAL_TTS_VOICE', 'MISTRAL_TTS_VOICE is required for Mistral saved-voice TTS test')

  await cleanupTestOutput(STABLE_TTS_MD_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--mistral',
    MISTRAL_TTS_MODEL,
    '--mistral-tts-voice',
    voice
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_TTS_MD_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/speech.wav`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      tts?: Array<{ ttsService?: string, ttsModel?: string, speaker?: string }>
    }
    expect(metadata.tts?.[0]?.ttsService).toBe('mistral')
    expect(metadata.tts?.[0]?.ttsModel).toBe(MISTRAL_TTS_MODEL)
    expect(metadata.tts?.[0]?.speaker).toBe(voice)
  }
}, E2E_TEST_TIMEOUT_MS)

budgetedTest('tts-mistral-voxtral-mini-tts-2603-ref-audio', 'mistral reference audio generates speech.wav', async () => {
  await requireConfiguredEnvVar('MISTRAL_API_KEY', 'MISTRAL_API_KEY is required for Mistral TTS test')

  await cleanupTestOutput(STABLE_TTS_MD_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--mistral',
    MISTRAL_TTS_MODEL,
    '--mistral-tts-ref-audio',
    MISTRAL_REF_AUDIO_PATH
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_TTS_MD_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/speech.wav`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      tts?: Array<{ ttsService?: string, ttsModel?: string, speaker?: string }>
    }
    expect(metadata.tts?.[0]?.ttsService).toBe('mistral')
    expect(metadata.tts?.[0]?.ttsModel).toBe(MISTRAL_TTS_MODEL)
    expect(metadata.tts?.[0]?.speaker).toBe('ref_audio:anthony-voice.mp3')
  }
}, E2E_TEST_TIMEOUT_MS)

budgetedTest('tts-mistral-dialogue-ref-audio', 'mistral dialogue mode generates normalized dialogue, segments, and speech.wav', async () => {
  await requireConfiguredEnvVar('MISTRAL_API_KEY', 'MISTRAL_API_KEY is required for Mistral dialogue TTS test')

  await cleanupTestOutput('mistral-dialogue')

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
      '--mistral',
      MISTRAL_TTS_MODEL,
      '--tts-dialogue-format',
      'labeled',
      '--tts-speaker-ref-audio',
      `Host=${MISTRAL_REF_AUDIO_PATH}`,
      '--tts-speaker-ref-audio',
      'Guest=https://ajc.pics/autoshow/examples/1-audio.mp3'
    ]
    const result = await runCommand(args)

    if (result.exitCode !== 0 && isTransientMistralTtsFailure(`${result.stdout}\n${result.stderr}`)) {
      throw new Error(`Mistral TTS endpoint was not reachable for dialogue TTS test\n${formatCommandFailureDiagnostics(args, result)}`)
    }

    expect(result.exitCode).toBe(0)

    const outputDir = result.outputDir ?? await findLatestDirectory('mistral-dialogue')
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
      expect(metadata.tts?.[0]?.ttsModel).toBe(MISTRAL_TTS_MODEL)
      expect(metadata.tts?.[0]?.speaker).toBe('Host=ref_audio:anthony-voice.mp3, Guest=ref_audio:1-audio.mp3')
      expect(metadata.tts?.[0]?.chunkCount).toBe(2)
    }
  } finally {
    await cleanupTestOutput('mistral-dialogue')
    await rm(tempRoot, { recursive: true, force: true })
  }
}, E2E_TEST_TIMEOUT_MS)

budgetedTest('tts-deapi-qwen3-voice-clone', 'deAPI Qwen3 voice clone generates speech.wav', async () => {
  await requireConfiguredEnvVar('DEAPI_API_KEY', 'DEAPI_API_KEY is required for deAPI TTS test')

  await cleanupTestOutput(STABLE_TTS_MD_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--deapi',
    DEAPI_TTS_CLONE_MODEL,
    '--deapi-tts-ref-audio',
    DEAPI_REF_AUDIO_PATH
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_TTS_MD_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/speech.wav`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      tts?: Array<{ ttsService?: string, ttsModel?: string, speaker?: string }>
    }
    expect(metadata.tts?.[0]?.ttsService).toBe('deapi')
    expect(metadata.tts?.[0]?.ttsModel).toBe(DEAPI_TTS_CLONE_MODEL)
    expect(metadata.tts?.[0]?.speaker).toBe('ref_audio:0-audio-short.mp3')
  }
}, E2E_TEST_TIMEOUT_MS)

budgetedTest('tts-groq-canopylabs/orpheus-v1-english', 'orpheus english with --groq-voice hannah generates speech.wav', async () => {
  await requireConfiguredEnvVar('GROQ_API_KEY', 'GROQ_API_KEY is required for Groq TTS test')

  await cleanupTestOutput(STABLE_TTS_MD_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--groq',
    'canopylabs/orpheus-v1-english',
    '--groq-voice',
    'hannah'
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_TTS_MD_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/speech.wav`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      tts?: Array<{ ttsService?: string, ttsModel?: string, speaker?: string }>
    }
    expect(metadata.tts?.[0]?.ttsService).toBe('groq')
    expect(metadata.tts?.[0]?.ttsModel).toBe('canopylabs/orpheus-v1-english')
    expect(metadata.tts?.[0]?.speaker).toBe('hannah')
  }
})
