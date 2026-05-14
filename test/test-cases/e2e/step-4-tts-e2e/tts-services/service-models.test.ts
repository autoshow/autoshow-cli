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
  hasConfiguredEnvVar,
  readConfiguredEnvVar,
} from '../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../test-utils/manifest-helpers'
import {
  ELEVENLABS_DEFAULT_VOICE_ID,
  GEMINI_DEFAULT_TTS_VOICE,
  OPENAI_DEFAULT_TTS_VOICE,
  DEEPGRAM_DEFAULT_VOICE,
  GCLOUD_DEFAULT_TTS_VOICES,
  GROK_DEFAULT_TTS_VOICE,
  RUNWAY_DEFAULT_TTS_VOICE,
  SPEECHIFY_DEFAULT_TTS_VOICE,
} from '~/cli/commands/setup-and-utilities/models/model-options'

const MISTRAL_TTS_MODEL = 'voxtral-mini-tts-2603'
const MISTRAL_REF_AUDIO_PATH = 'input/examples/audio/anthony-voice.mp3'
const DEAPI_TTS_CLONE_MODEL = 'Qwen3_TTS_12Hz_1_7B_Base'
const DEAPI_REF_AUDIO_PATH = 'input/examples/audio/0-audio-short.mp3'

const isTransientMistralTtsFailure = (output: string): boolean =>
  /Unable to connect|Unexpected HTTP client error|fetch failed|network error|econnreset|econnrefused|etimedout|socket hang up|dns/i.test(output)

defineTTSServiceTest({
  models: ['gpt-4o-mini-tts'],
  cliFlag: '--openai-tts',
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
  if (enabled !== '1') {
    console.log('Skipping: OPENAI_TTS_CUSTOM_VOICE_TEST=1 is required for OpenAI custom voice TTS test')
    return
  }
  if (!await hasConfiguredEnvVar('OPENAI_API_KEY')) {
    console.log('Skipping: OPENAI_API_KEY is required for OpenAI custom voice TTS test')
    return
  }
  const consentId = await readConfiguredEnvVar('OPENAI_TTS_CONSENT_ID')
  const refAudio = await readConfiguredEnvVar('OPENAI_TTS_REF_AUDIO')
  if (!consentId || !refAudio) {
    console.log('Skipping: OPENAI_TTS_CONSENT_ID and OPENAI_TTS_REF_AUDIO are required for OpenAI custom voice TTS test')
    return
  }

  await cleanupTestOutput(STABLE_TTS_MD_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--openai-tts',
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
  models: ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'],
  cliFlag: '--gemini-tts',
  ttsService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
  envVarDescription: 'Gemini TTS',
  resolveExpectedSpeaker: async () => {
    const voice = await readConfiguredEnvVar('GEMINI_TTS_VOICE')
    return voice ?? GEMINI_DEFAULT_TTS_VOICE
  },
})

budgetedTest('tts-gemini-gemini-3.1-flash-tts-preview', 'gemini multispeaker with explicit speaker mappings generates speech.wav', async () => {
  if (!await hasConfiguredEnvVar('GEMINI_API_KEY')) {
    console.log('Skipping: GEMINI_API_KEY is required for Gemini TTS test')
    return
  }

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
      '--gemini-tts',
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
  cliFlag: '--minimax-tts',
  ttsService: 'minimax',
  envVarKey: 'MINIMAX_API_KEY',
  envVarDescription: 'MiniMax TTS',
  extraArgs: ['--minimax-tts-voice', 'English_expressive_narrator'],
  resolveExpectedSpeaker: async () => 'English_expressive_narrator',
})

defineTTSServiceTest({
  models: ['eleven_v3', 'eleven_flash_v2_5', 'eleven_turbo_v2_5'],
  cliFlag: '--elevenlabs-tts',
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
  cliFlag: '--groq-tts',
  ttsService: 'groq',
  envVarKey: 'GROQ_API_KEY',
  envVarDescription: 'Groq TTS',
  extraArgs: ['--groq-voice', 'troy'],
  resolveExpectedSpeaker: async () => 'troy',
})

defineTTSServiceTest({
  models: ['grok-tts'],
  cliFlag: '--grok-tts',
  ttsService: 'grok',
  envVarKey: 'XAI_API_KEY',
  envVarDescription: 'xAI Grok TTS',
  extraArgs: ['--grok-tts-voice', GROK_DEFAULT_TTS_VOICE],
  resolveExpectedSpeaker: async () => GROK_DEFAULT_TTS_VOICE,
})

defineTTSServiceTest({
  models: ['aura-2-thalia-en'],
  cliFlag: '--deepgram-tts',
  ttsService: 'deepgram',
  envVarKey: 'DEEPGRAM_API_KEY',
  envVarDescription: 'Deepgram TTS',
  resolveExpectedSpeaker: async () => {
    const voice = await readConfiguredEnvVar('DEEPGRAM_TTS_VOICE')
    return voice ?? DEEPGRAM_DEFAULT_VOICE
  },
})

defineTTSServiceTest({
  models: ['eleven_multilingual_v2'],
  cliFlag: '--runway-tts',
  ttsService: 'runway',
  envVarKey: 'RUNWAYML_API_SECRET',
  envVarDescription: 'Runway TTS',
  resolveExpectedSpeaker: async () => {
    const voice = await readConfiguredEnvVar('RUNWAY_TTS_VOICE')
    return voice ?? RUNWAY_DEFAULT_TTS_VOICE
  },
})

defineTTSServiceTest({
  models: ['simba-english', 'simba-multilingual'],
  cliFlag: '--speechify-tts',
  ttsService: 'speechify',
  envVarKey: 'SPEECHIFY_API_KEY',
  envVarDescription: 'Speechify TTS',
  resolveExpectedSpeaker: async () => {
    const voice = await readConfiguredEnvVar('SPEECHIFY_TTS_VOICE')
    return voice ?? SPEECHIFY_DEFAULT_TTS_VOICE
  },
})

defineTTSServiceTest({
  models: ['standard'],
  cliFlag: '--gcloud-tts',
  ttsService: 'gcloud',
  envVarKey: 'AUTOSHOW_GCLOUD_TTS_E2E',
  envVarDescription: 'Google Cloud TTS readiness with AUTOSHOW_GCLOUD_TTS_E2E=1',
  resolveExpectedSpeaker: async () => GCLOUD_DEFAULT_TTS_VOICES.standard,
})

test('rejects invalid mistral model', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--mistral-tts',
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
    '--mistral-tts',
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
  if (!await hasConfiguredEnvVar('MISTRAL_API_KEY')) {
    console.log('Skipping: MISTRAL_API_KEY is required for Mistral TTS test')
    return
  }
  const voice = await readConfiguredEnvVar('MISTRAL_TTS_VOICE')
  if (!voice) {
    console.log('Skipping: MISTRAL_TTS_VOICE is required for Mistral saved-voice TTS test')
    return
  }

  await cleanupTestOutput(STABLE_TTS_MD_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--mistral-tts',
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
  if (!await hasConfiguredEnvVar('MISTRAL_API_KEY')) {
    console.log('Skipping: MISTRAL_API_KEY is required for Mistral TTS test')
    return
  }

  await cleanupTestOutput(STABLE_TTS_MD_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--mistral-tts',
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
  if (!await hasConfiguredEnvVar('MISTRAL_API_KEY')) {
    console.log('Skipping: MISTRAL_API_KEY is required for Mistral dialogue TTS test')
    return
  }

  await cleanupTestOutput('mistral-dialogue')

  const tempRoot = await mkdtemp(join(tmpdir(), 'autoshow-cli-mistral-dialogue-'))
  const inputPath = join(tempRoot, 'mistral-dialogue.txt')

  try {
    await writeFile(inputPath, [
      'Host: Hello from the dialogue test.',
      'Guest: Hi. This keeps the live test short.'
    ].join('\n'))

    const result = await runCommand([
      'src/cli/create-cli.ts',
      'tts',
      inputPath,
      '--mistral-tts',
      MISTRAL_TTS_MODEL,
      '--tts-dialogue-format',
      'labeled',
      '--tts-speaker-ref-audio',
      `Host=${MISTRAL_REF_AUDIO_PATH}`,
      '--tts-speaker-ref-audio',
      'Guest=input/examples/audio/1-audio.mp3'
    ])

    if (result.exitCode !== 0 && isTransientMistralTtsFailure(`${result.stdout}\n${result.stderr}`)) {
      console.log('Skipping: Mistral TTS endpoint was not reachable for dialogue TTS test')
      return
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
  if (!await hasConfiguredEnvVar('DEAPI_API_KEY')) {
    console.log('Skipping: DEAPI_API_KEY is required for deAPI TTS test')
    return
  }

  await cleanupTestOutput(STABLE_TTS_MD_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--deapi-tts',
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

budgetedTest('tts-deepgram-aura-2-thalia-en', 'deepgram with --deepgram-voice aura-2-andromeda-en records speaker override', async () => {
  if (!await hasConfiguredEnvVar('DEEPGRAM_API_KEY')) {
    console.log('Skipping: DEEPGRAM_API_KEY is required for Deepgram TTS test')
    return
  }

  await cleanupTestOutput(STABLE_TTS_MD_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--deepgram-tts',
    'aura-2-thalia-en',
    '--deepgram-voice',
    'aura-2-andromeda-en'
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_TTS_MD_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/speech.wav`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      tts?: Array<{ ttsService?: string, ttsModel?: string, speaker?: string }>
    }
    expect(metadata.tts?.[0]?.ttsService).toBe('deepgram')
    expect(metadata.tts?.[0]?.ttsModel).toBe('aura-2-thalia-en')
    expect(metadata.tts?.[0]?.speaker).toBe('aura-2-andromeda-en')
  }
})

budgetedTest('tts-groq-canopylabs/orpheus-v1-english', 'orpheus english with --groq-voice hannah generates speech.wav', async () => {
  if (!await hasConfiguredEnvVar('GROQ_API_KEY')) {
    console.log('Skipping: GROQ_API_KEY is required for Groq TTS test')
    return
  }

  await cleanupTestOutput(STABLE_TTS_MD_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--groq-tts',
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
