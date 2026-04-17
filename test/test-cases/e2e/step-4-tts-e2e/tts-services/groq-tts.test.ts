import { test, expect } from 'bun:test'
import { defineTTSServiceTest } from '../../../../test-utils/define-tts-service-test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_TTS_MD_PATH,
  STABLE_TTS_MD_TITLE,
  hasConfiguredEnvVar
} from '../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../test-utils/manifest-helpers'

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
  const hasApiKey = await hasConfiguredEnvVar('GROQ_API_KEY')
  if (!hasApiKey) {
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

  const outputDir = await findLatestDirectory(STABLE_TTS_MD_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    const audioExists = await fileExists(`${outputDir}/speech.wav`)
    expect(audioExists).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      tts?: Array<{ ttsService?: string, ttsModel?: string, speaker?: string }>
    }
    expect(metadata.tts?.[0]?.ttsService).toBe('groq')
    expect(metadata.tts?.[0]?.ttsModel).toBe('canopylabs/orpheus-v1-english')
    expect(metadata.tts?.[0]?.speaker).toBe('hannah')
  }
})
