import { test, expect } from 'bun:test'
import { runCommand, STABLE_LOCAL_AUDIO_PATH } from '../../test-utils/test-helpers'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'

test('CLI invalid whisper model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'transcribe',
    STABLE_LOCAL_AUDIO_PATH,
    '--whisper',
    'whisper-large-v4'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI invalid ElevenLabs STT model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'transcribe',
    STABLE_LOCAL_AUDIO_PATH,
    '--elevenlabs-stt',
    'scribe_v3'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI invalid Groq STT model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'transcribe',
    STABLE_LOCAL_AUDIO_PATH,
    '--groq-stt',
    'whisper-large-v4'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI invalid OpenAI STT model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'transcribe',
    STABLE_LOCAL_AUDIO_PATH,
    '--openai-stt',
    'gpt-4o-transcribe'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI invalid Mistral STT model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'transcribe',
    STABLE_LOCAL_AUDIO_PATH,
    '--mistral-stt',
    'voxtral-mini-2507'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI invalid Mistral OCR model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    'input/1-document.pdf',
    '--mistral-ocr',
    'mistral-ocr-2505'
  ])

  expect(result.exitCode).toBe(2)
})

test('transcribe help excludes LLM provider flags and includes prompt flag', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'transcribe',
    '--help'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--prompt')
  expect(result.stdout).toContain('--speaker-count')
  expect(result.stdout).toContain('--price')
  expect(result.stdout).toContain('--elevenlabs-stt')
  expect(result.stdout).toContain('--groq-stt')
  expect(result.stdout).toContain('--openai-stt')
  expect(result.stdout).toContain('--mistral-stt')
  expect(result.stdout).not.toMatch(/--openai(\s|$)/)
  expect(result.stdout).not.toMatch(/--gemini(\s|$)/)
  expect(result.stdout).not.toMatch(/--anthropic(\s|$)/)
  expect(result.stdout).not.toMatch(/--minimax(\s|$)/)
  expect(result.stdout).not.toMatch(/--llama(\s|$)/)
})

test('extract help includes mistral-ocr flag', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    '--help'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--mistral-ocr')
  expect(result.stdout).toContain('--epub-bun')
  expect(result.stdout).toContain('--epub-calibre')
})

test('setup help includes calibre step', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'setup',
    '--help'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('calibre')
})

test('transcribe rejects invalid speaker-count with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'transcribe',
    STABLE_LOCAL_AUDIO_PATH,
    '--speaker-count',
    '0'
  ])

  expect(result.exitCode).toBe(2)
})

test('transcribe rejects multiple STT engines with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'transcribe',
    STABLE_LOCAL_AUDIO_PATH,
    '--reverb',
    '--elevenlabs-stt',
    'scribe_v2'
  ])

  expect(result.exitCode).toBe(2)
})

test('transcribe rejects groq-stt with another STT engine', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'transcribe',
    STABLE_LOCAL_AUDIO_PATH,
    '--groq-stt',
    'whisper-large-v3',
    '--elevenlabs-stt',
    'scribe_v2'
  ])

  expect(result.exitCode).toBe(2)
})

test('transcribe rejects LLM provider flags with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'transcribe',
    STABLE_LOCAL_AUDIO_PATH,
    '--openai',
    'gpt-5.2'
  ])

  expect(result.exitCode).toBe(2)
})

test('transcribe rejects MiniMax LLM flag with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'transcribe',
    STABLE_LOCAL_AUDIO_PATH,
    '--minimax',
    'MiniMax-M2.5'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI short GPT OSS model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    STABLE_LOCAL_AUDIO_PATH,
    '--openai',
    '20b'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI invalid llama model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    STABLE_LOCAL_AUDIO_PATH,
    '--llama',
    'ggml-org/unknown-llama-model'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI invalid anthropic model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    STABLE_LOCAL_AUDIO_PATH,
    '--anthropic',
    'claude-3-opus'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI invalid MiniMax model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    STABLE_LOCAL_AUDIO_PATH,
    '--minimax',
    'MiniMax-M3'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI invalid ElevenLabs TTS model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    'input/1-tts.md',
    '--elevenlabs-tts',
    'eleven_v4',
    '--elevenlabs-voice',
    'voice_123'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI invalid MiniMax TTS model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    'input/1-tts.md',
    '--minimax-tts',
    'speech-3.0-hd'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI invalid Groq TTS model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    'input/1-tts.md',
    '--groq-tts',
    'canopylabs/orpheus-v2-english'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI invalid OpenAI TTS model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    'input/1-tts.md',
    '--openai-tts',
    'tts-1'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI invalid Gemini TTS model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    'input/1-tts.md',
    '--gemini-tts',
    'gemini-2.5-flash-tts'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI ElevenLabs TTS without voice id is accepted in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    'input/1-tts.md',
    '--elevenlabs-tts',
    'eleven_v3',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('CLI invalid MiniMax image model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'image',
    'a sunset',
    '--minimax-image',
    'image-02'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI invalid MiniMax video model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'video',
    'a sunset',
    '--minimax-video',
    'MiniMax-Hailuo-2.4'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI invalid ElevenLabs music model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'music',
    'an ambient piano song',
    '--elevenlabs-music',
    'music_v2'
  ])

  expect(result.exitCode).toBe(2)
})

test('CLI invalid MiniMax music model exits with usage error code 2', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'music',
    'an ambient piano song',
    '--minimax-music',
    'music-2.0'
  ])

  expect(result.exitCode).toBe(2)
})

test('buildOptsFromFlags maps --openai-voice to openaiVoiceId', () => {
  const opts = buildOptsFromFlags(false, {
    'openai-tts': 'gpt-4o-mini-tts',
    'openai-voice': 'alloy'
  })

  expect(opts.openaiTtsModel).toBe('gpt-4o-mini-tts')
  expect(opts.openaiVoiceId).toBe('alloy')
})

test('buildOptsFromFlags maps --gemini-voice to geminiVoiceId', () => {
  const opts = buildOptsFromFlags(false, {
    'gemini-tts': 'gemini-2.5-flash-preview-tts',
    'gemini-voice': 'Kore'
  })

  expect(opts.geminiTtsModel).toBe('gemini-2.5-flash-preview-tts')
  expect(opts.geminiVoiceId).toBe('Kore')
})
