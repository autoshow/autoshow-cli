import { expect, test } from 'bun:test'
import { defineTTSServicePriceTests } from '../../test-utils/define-tts-service-test'
import { runCommand, STABLE_LOCAL_AUDIO_PATH, STABLE_TTS_MD_PATH } from '../../test-utils/test-helpers'

const MISTRAL_TTS_MODEL = 'voxtral-mini-tts-2603'
const MISTRAL_REF_AUDIO_PATH = 'input/examples/audio/anthony-voice.mp3'
const OPENAI_REF_AUDIO_PATH = 'input/examples/audio/anthony-voice.mp3'

defineTTSServicePriceTests({
  models: ['gpt-4o-mini-tts'],
  cliFlag: '--openai-tts',
  ttsService: 'openai',
})

defineTTSServicePriceTests({
  models: ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'],
  cliFlag: '--gemini-tts',
  ttsService: 'gemini',
})

defineTTSServicePriceTests({
  models: ['speech-2.8-turbo', 'speech-2.8-hd'],
  cliFlag: '--minimax-tts',
  ttsService: 'minimax',
})

defineTTSServicePriceTests({
  models: ['eleven_v3', 'eleven_flash_v2_5', 'eleven_turbo_v2_5'],
  cliFlag: '--elevenlabs-tts',
  ttsService: 'elevenlabs',
})

defineTTSServicePriceTests({
  models: ['canopylabs/orpheus-v1-english'],
  cliFlag: '--groq-tts',
  ttsService: 'groq',
})

defineTTSServicePriceTests({
  models: ['grok-tts'],
  cliFlag: '--grok-tts',
  ttsService: 'grok',
})

defineTTSServicePriceTests({
  models: ['aura-2-thalia-en'],
  cliFlag: '--deepgram-tts',
  ttsService: 'deepgram',
})

defineTTSServicePriceTests({
  models: ['eleven_multilingual_v2'],
  cliFlag: '--runway-tts',
  ttsService: 'runway',
})

defineTTSServicePriceTests({
  models: ['simba-english', 'simba-multilingual'],
  cliFlag: '--speechify-tts',
  ttsService: 'speechify',
})

defineTTSServicePriceTests({
  models: ['standard', 'wavenet', 'neural2', 'studio', 'chirp3-hd'],
  cliFlag: '--gcloud-tts',
  ttsService: 'gcloud',
})

test('gcloud instant custom voice --price works with an existing voice cloning key', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--gcloud-tts',
    'instant-custom-voice',
    '--gcloud-tts-voice-cloning-key',
    'test-key',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('mistral --price works without a voice source', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--mistral-tts',
    MISTRAL_TTS_MODEL,
    '--price'
  ], {
    env: {
      MISTRAL_TTS_VOICE: '',
      MISTRAL_TTS_REF_AUDIO: ''
    }
  })

  expect(result.exitCode).toBe(0)
  expect(result.outputDir).toBeNull()
  expect(`${result.stdout}\n${result.stderr}`).toContain('speech')
})

test('mistral rejects voice and reference audio together before API request in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--mistral-tts',
    MISTRAL_TTS_MODEL,
    '--mistral-tts-voice',
    'voice_abc123',
    '--mistral-tts-ref-audio',
    MISTRAL_REF_AUDIO_PATH,
    '--price'
  ])

  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Use either --mistral-tts-voice or --mistral-tts-ref-audio, not both')
})

test('openai custom voice --price includes setup estimate without an API key', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--openai-tts',
    'gpt-4o-mini-tts',
    '--openai-tts-ref-audio',
    OPENAI_REF_AUDIO_PATH,
    '--openai-tts-consent-id',
    'cons_123',
    '--price'
  ], {
    env: {
      OPENAI_API_KEY: '',
      OPENAI_BASE_URL: ''
    }
  })

  expect(result.exitCode).toBe(0)
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('gpt-4o-mini-tts')
  expect(output).toContain('setup')
  expect(output).toContain('speech')
})

test('openai custom voice rejects missing consent source before API request in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--openai-tts',
    'gpt-4o-mini-tts',
    '--openai-tts-ref-audio',
    OPENAI_REF_AUDIO_PATH,
    '--price'
  ])

  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('requires exactly one of --openai-tts-consent-id or --openai-tts-consent-audio')
})

test('rejects invalid deepgram voice override before API request in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--deepgram-tts',
    'aura-2-thalia-en',
    '--deepgram-voice',
    'invalid-model',
    '--price'
  ])

  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Invalid --deepgram-voice "invalid-model"')
})

test('rejects invalid grok voice override before API request in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--grok-tts',
    'grok-tts',
    '--grok-tts-voice',
    'invalid-voice',
    '--price'
  ])

  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Invalid --grok-tts-voice "invalid-voice"')
})

test('rejects invalid runway voice override before API request in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--runway-tts',
    'eleven_multilingual_v2',
    '--runway-tts-voice',
    'invalid-voice',
    '--price'
  ])

  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Invalid --runway-tts-voice "invalid-voice"')
})

test('multi-provider --price prints both TTS targets and renamed output files', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--kitten-tts',
    'kitten-tts-mini',
    '--openai-tts',
    'gpt-4o-mini-tts',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('kitten')
  expect(output).toContain('kitten-tts-mini')
  expect(output).toContain('openai')
  expect(output).toContain('gpt-4o-mini-tts')
  expect(output).toContain('speech-kitten-kitten-tts-mini.wav')
  expect(output).toContain('speech-openai-gpt-4o-mini-tts.wav')
})

test('write --price omits TTS estimates when multiple LLM providers are selected', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    STABLE_LOCAL_AUDIO_PATH,
    '--openai',
    'gpt-5.4',
    '--groq',
    'openai/gpt-oss-20b',
    '--kitten-tts',
    'kitten-tts-mini',
    '--openai-tts',
    'gpt-4o-mini-tts',
    '--price'
  ])
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).toBe(0)
  expect(output).toContain('TTS estimate omitted')
  expect(output).not.toContain('speech-kitten-kitten-tts-mini.wav')
  expect(output).not.toContain('speech-openai-gpt-4o-mini-tts.wav')
})
