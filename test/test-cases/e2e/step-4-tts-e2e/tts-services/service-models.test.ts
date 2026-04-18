import { test, expect } from 'bun:test'
import { defineTTSServiceTest } from '../../../../test-utils/define-tts-service-test'
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
} from '~/cli/commands/setup-and-utilities/models/model-options'

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

defineTTSServiceTest({
  models: ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'],
  cliFlag: '--gemini-tts',
  ttsService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
  envVarDescription: 'Gemini TTS',
  resolveExpectedSpeaker: async () => {
    const voice = await readConfiguredEnvVar('GEMINI_TTS_VOICE')
    return voice ?? GEMINI_DEFAULT_TTS_VOICE
  },
})

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

test('orpheus english with --groq-voice hannah generates speech.wav', async () => {
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
