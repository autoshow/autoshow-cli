import { test, expect } from 'bun:test'
import { runCommand, STABLE_LOCAL_AUDIO_PATH } from '../../test-utils/test-helpers'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-stt/stt-targets'

const invalidCliCases: Array<{ label: string; args: string[] }> = [
  { label: 'CLI invalid whisper model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--whisper', 'whisper-large-v4'] },
  { label: 'CLI invalid ElevenLabs STT model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--elevenlabs-stt', 'scribe_v3'] },
  { label: 'CLI invalid Deepgram STT model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--deepgram-stt', 'nova-4'] },
  { label: 'CLI invalid Groq STT model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--groq-stt', 'whisper-large-v4'] },
  { label: 'CLI invalid OpenAI STT model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--openai-stt', 'gpt-4o-transcribe'] },
  { label: 'CLI invalid Mistral STT model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--mistral-stt', 'voxtral-mini-2507'] },
  { label: 'CLI invalid Mistral OCR model exits with usage error code 2', args: ['ocr', 'input/examples/document/1-document.pdf', '--mistral-ocr', 'mistral-ocr-2505'] },
  { label: 'stt rejects invalid speaker-count with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--speaker-count', '0'] },
  { label: 'stt rejects LLM provider flags with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--openai', 'gpt-5.4'] },
  { label: 'stt rejects MiniMax LLM flag with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--minimax', 'MiniMax-M2.5'] },
  { label: 'stt rejects Grok LLM flag with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--grok', 'grok-4.20-reasoning'] },
  { label: 'CLI invalid OpenAI model exits with usage error code 2', args: ['write', STABLE_LOCAL_AUDIO_PATH, '--openai', 'not-a-real-openai-model'] },
  { label: 'CLI invalid llama model exits with usage error code 2', args: ['write', STABLE_LOCAL_AUDIO_PATH, '--llama', 'not-a-real-llama-model'] },
  { label: 'CLI invalid anthropic model exits with usage error code 2', args: ['write', STABLE_LOCAL_AUDIO_PATH, '--anthropic', 'not-a-real-anthropic-model'] },
  { label: 'CLI invalid MiniMax model exits with usage error code 2', args: ['write', STABLE_LOCAL_AUDIO_PATH, '--minimax', 'not-a-real-minimax-model'] },
  { label: 'CLI invalid Grok model exits with usage error code 2', args: ['write', STABLE_LOCAL_AUDIO_PATH, '--grok', 'not-a-real-grok-model'] },
  { label: 'CLI invalid ElevenLabs TTS model exits with usage error code 2', args: ['tts', 'input/examples/document/1-tts.md', '--elevenlabs-tts', 'eleven_v4', '--elevenlabs-voice', 'voice_123'] },
  { label: 'CLI invalid MiniMax TTS model exits with usage error code 2', args: ['tts', 'input/examples/document/1-tts.md', '--minimax-tts', 'speech-3.0-hd'] },
  { label: 'CLI invalid Groq TTS model exits with usage error code 2', args: ['tts', 'input/examples/document/1-tts.md', '--groq-tts', 'canopylabs/orpheus-v2-english'] },
  { label: 'CLI invalid OpenAI TTS model exits with usage error code 2', args: ['tts', 'input/examples/document/1-tts.md', '--openai-tts', 'tts-1'] },
  { label: 'CLI invalid Gemini TTS model exits with usage error code 2', args: ['tts', 'input/examples/document/1-tts.md', '--gemini-tts', 'gemini-2.5-flash-tts'] },
  { label: 'CLI invalid MiniMax image model exits with usage error code 2', args: ['image', 'a sunset', '--minimax-image', 'image-02'] },
  { label: 'CLI invalid MiniMax video model exits with usage error code 2', args: ['video', 'a sunset', '--minimax-video', 'MiniMax-Hailuo-2.4'] },
  { label: 'CLI invalid ElevenLabs music model exits with usage error code 2', args: ['music', 'an ambient piano song', '--elevenlabs-music', 'music_v2'] },
  { label: 'CLI invalid MiniMax music model exits with usage error code 2', args: ['music', 'an ambient piano song', '--minimax-music', 'music-2.0'] },
]

for (const { label, args } of invalidCliCases) {
  test(label, async () => {
    const result = await runCommand(['src/cli/create-cli.ts', ...args])
    expect(result.exitCode).toBe(2)
  })
}

test('stt help excludes LLM provider flags and includes prompt flag', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'stt',
    '--help'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--prompt')
  expect(result.stdout).toContain('--speaker-count')
  expect(result.stdout).toContain('--speaker-name')
  expect(result.stdout).toContain('--speaker-reference')
  expect(result.stdout).toContain('--price')
  expect(result.stdout).toContain('--elevenlabs-stt')
  expect(result.stdout).toContain('--deepgram-stt')
  expect(result.stdout).toContain('--groq-stt')
  expect(result.stdout).toContain('--openai-stt')
  expect(result.stdout).toContain('--mistral-stt')
  expect(result.stdout).toContain('--stt-provider-concurrency')
  expect(result.stdout).toContain('--stt-local-concurrency')
  expect(result.stdout).toContain('--stt-segment-concurrency')
  expect(result.stdout).toContain('--stt-preflight-concurrency')
  expect(result.stdout).toContain('--refresh-cache')
  expect(result.stdout).toContain('--no-cache')
  expect(result.stdout).not.toMatch(/--openai(\s|$)/)
  expect(result.stdout).not.toMatch(/--gemini(\s|$)/)
  expect(result.stdout).not.toMatch(/--anthropic(\s|$)/)
  expect(result.stdout).not.toMatch(/--minimax(\s|$)/)
  expect(result.stdout).not.toMatch(/--grok(\s|$)/)
  expect(result.stdout).not.toMatch(/--llama(\s|$)/)
})

test('ocr help includes mistral-ocr flag', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'ocr',
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

test('metadata help includes markdown output flag', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'metadata',
    '--help'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--markdown')
  expect(result.stdout).toContain('Markdown frontmatter YAML')
})

test('CLI ElevenLabs TTS without voice id is accepted in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    'input/examples/document/1-tts.md',
    '--elevenlabs-tts',
    'eleven_v3',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('CLI bare Deepgram STT flag is accepted in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'stt',
    STABLE_LOCAL_AUDIO_PATH,
    '--deepgram-stt',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('buildOptsFromFlags maps --openai-voice to openaiVoiceId', () => {
  const opts = buildOptsFromFlags(false, {
    'openai-tts': 'gpt-4o-mini-tts',
    'openai-voice': 'alloy'
  })

  expect(opts.openaiTtsModel).toBe('gpt-4o-mini-tts')
  expect(opts.openaiVoiceId).toBe('alloy')
})

test('buildOptsFromFlags maps --deepgram-stt to deepgramSttModel', () => {
  const opts = buildOptsFromFlags(false, {
    'deepgram-stt': 'nova-3'
  })

  expect(opts.deepgramSttModel).toBe('nova-3')
})

test('buildOptsFromFlags maps --gemini-voice to geminiVoiceId', () => {
  const opts = buildOptsFromFlags(false, {
    'gemini-tts': 'gemini-2.5-flash-preview-tts',
    'gemini-voice': 'Kore'
  })

  expect(opts.geminiTtsModel).toBe('gemini-2.5-flash-preview-tts')
  expect(opts.geminiVoiceId).toBe('Kore')
})

test('buildOptsFromFlags maps --json-output to structured output', () => {
  const opts = buildOptsFromFlags(false, {
    'json-output': true
  })

  expect(opts.structured).toBe(true)
})

test('buildOptsFromFlags maps --md-output to markdown output', () => {
  const opts = buildOptsFromFlags(false, {
    'md-output': true
  })

  expect(opts.structured).toBe(false)
})

test('buildOptsFromFlags maps repeated OpenAI speaker hint flags', () => {
  const opts = buildOptsFromFlags(false, {
    'speaker-name': ['Host', 'Guest'],
    'speaker-reference': ['clips/host.mp3', 'clips/guest.mp3']
  })

  expect(opts.diarizationSpeakerNames).toEqual(['Host', 'Guest'])
  expect(opts.diarizationSpeakerReferences).toEqual(['clips/host.mp3', 'clips/guest.mp3'])
})

test('buildOptsFromFlags maps STT concurrency and cache flags', () => {
  const opts = buildOptsFromFlags(false, {
    'stt-provider-concurrency': '3',
    'stt-local-concurrency': '2',
    'stt-segment-concurrency': '4',
    'stt-preflight-concurrency': '5',
    'refresh-cache': true,
    'no-cache': true
  })

  expect(opts.sttProviderConcurrency).toBe(3)
  expect(opts.sttLocalConcurrency).toBe(2)
  expect(opts.sttSegmentConcurrency).toBe(4)
  expect(opts.sttPreflightConcurrency).toBe(5)
  expect(opts.refreshCache).toBe(true)
  expect(opts.noCache).toBe(true)
})

test('collectSttTargets includes whisper only when explicitly requested alongside other providers', () => {
  const opts = buildOptsFromFlags(false, {
    whisper: 'base',
    'assemblyai-stt': 'universal-2'
  }, [], {}, new Set(['whisper', 'assemblyai-stt']))

  expect(collectSttTargets(opts).map((target) => `${target.service}:${target.model}`)).toEqual([
    'assemblyai:universal-2',
    'whisper:base'
  ])
})

test('collectSttTargets includes Deepgram targets with ignored speaker-count hints', () => {
  const opts = buildOptsFromFlags(false, {
    'deepgram-stt': 'nova-3',
    'speaker-count': '2'
  })

  expect(collectSttTargets(opts)).toEqual([
    {
      service: 'deepgram',
      model: 'nova-3',
      local: false,
      diarizationOptions: {}
    }
  ])
})

test('stt accepts multiple STT providers in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'stt',
    STABLE_LOCAL_AUDIO_PATH,
    '--elevenlabs-stt',
    'scribe_v2',
    '--assemblyai-stt',
    'universal-2',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('stt accepts Deepgram plus another STT provider in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'stt',
    STABLE_LOCAL_AUDIO_PATH,
    '--deepgram-stt',
    'nova-3',
    '--assemblyai-stt',
    'universal-2',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('write accepts multiple STT providers in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    STABLE_LOCAL_AUDIO_PATH,
    '--whisper',
    'tiny',
    '--assemblyai-stt',
    'universal-2',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('write accepts multiple music providers in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    STABLE_LOCAL_AUDIO_PATH,
    '--elevenlabs-music',
    'music_v1',
    '--minimax-music',
    'music-2.5',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('ocr accepts multiple OCR providers in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'ocr',
    'input/examples/document/1-document.pdf',
    '--paddle-ocr',
    '--mistral-ocr',
    'mistral-ocr-latest',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('write accepts multiple OCR providers in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    'input/examples/document/1-document.pdf',
    '--paddle-ocr',
    '--mistral-ocr',
    'mistral-ocr-latest',
    '--openai',
    'gpt-5.4',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('cache command accepts prune and clear actions', async () => {
  const pruneResult = await runCommand([
    'src/cli/create-cli.ts',
    'cache',
    'prune'
  ])
  const clearResult = await runCommand([
    'src/cli/create-cli.ts',
    'cache',
    'clear'
  ])

  expect(pruneResult.exitCode).toBe(0)
  expect(clearResult.exitCode).toBe(0)
})

test('buildOptsFromFlags maps --markdown for metadata output', () => {
  const opts = buildOptsFromFlags(true, {
    'markdown': true
  })

  expect(opts.markdown).toBe(true)
})

test('buildOptsFromFlags rejects conflicting output mode flags', () => {
  expect(() => buildOptsFromFlags(false, {
    'json-output': true,
    'md-output': true
  })).toThrow('Cannot use both --json-output and --md-output at the same time.')
})
