import { test, expect } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCommand, STABLE_LOCAL_AUDIO_PATH } from '../../test-utils/test-helpers'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-stt/stt-targets'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-ocr/ocr-targets'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { buildConfigPatchFromFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { resolveCheapestModelForFlag, selectCheapestVideoSelection } from '~/cli/commands/setup-and-utilities/models/cheapest-models'

const expectPriceSelection = (
  result: Awaited<ReturnType<typeof runCommand>>,
  provider: string,
  model: string
): void => {
  expect(result.exitCode).toBe(0)
  const combined = `${result.stdout}\n${result.stderr}`
  expect(
    combined.includes(`"provider": "${provider}"`) || combined.includes(provider)
  ).toBe(true)
  expect(
    combined.includes(`"model": "${model}"`) || combined.includes(model)
  ).toBe(true)
}

const invalidCliCases: Array<{ label: string; args: string[] }> = [
  { label: 'CLI invalid whisper model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--whisper', 'whisper-large-v4'] },
  { label: 'CLI invalid ElevenLabs STT model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--elevenlabs-stt', 'scribe_v3'] },
  { label: 'CLI invalid Deepgram STT model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--deepgram-stt', 'nova-4'] },
  { label: 'CLI invalid Soniox STT model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--soniox-stt', 'stt-async-v2'] },
  { label: 'CLI removed Soniox STT compatibility model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--soniox-stt', 'stt-async-v3'] },
  { label: 'CLI invalid Speechmatics STT model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--speechmatics-stt', 'premium'] },
  { label: 'CLI invalid Rev STT model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--rev-stt', 'human'] },
  { label: 'CLI unsupported Rev STT fusion model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--rev-stt', 'fusion'] },
  { label: 'CLI invalid DeepInfra STT model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--deepinfra-stt', 'openai/whisper-large-v4'] },
  { label: 'CLI invalid deAPI STT model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--deapi-stt', 'whisper-large-v3'] },
  { label: 'CLI invalid Groq STT model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--groq-stt', 'whisper-large-v4'] },
  { label: 'CLI invalid Mistral STT model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--mistral-stt', 'voxtral-mini-2507'] },
  { label: 'CLI invalid Gladia STT model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--gladia-stt', 'premium'] },
  { label: 'CLI invalid Supadata STT mode exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--supadata-stt', 'premium'] },
  { label: 'CLI invalid AWS STT model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--aws-stt', 'premium'] },
  { label: 'CLI invalid Google Cloud STT model exits with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--gcloud-stt', 'chirp_2'] },
  { label: 'CLI invalid Mistral OCR model exits with usage error code 2', args: ['ocr', 'input/examples/document/1-document.pdf', '--mistral-ocr', 'mistral-ocr-2505'] },
  { label: 'CLI invalid GLM OCR model exits with usage error code 2', args: ['ocr', 'input/examples/document/1-document.pdf', '--glm-ocr', 'glm-ocr-v2'] },
  { label: 'CLI invalid OpenAI OCR model exits with usage error code 2', args: ['ocr', 'input/examples/document/1-document.pdf', '--openai-ocr', 'gpt-4o'] },
  { label: 'CLI invalid Anthropic OCR model exits with usage error code 2', args: ['ocr', 'input/examples/document/1-document.pdf', '--anthropic-ocr', 'claude-3-opus'] },
  { label: 'CLI invalid Gemini OCR model exits with usage error code 2', args: ['ocr', 'input/examples/document/1-document.pdf', '--gemini-ocr', 'gemini-2.5-flash'] },
  { label: 'stt rejects invalid speaker-count with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--speaker-count', '0'] },
  { label: 'stt rejects LLM provider flags with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--openai', 'gpt-5.4'] },
  { label: 'stt rejects MiniMax LLM flag with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--minimax', 'MiniMax-M2.5'] },
  { label: 'stt rejects Grok LLM flag with usage error code 2', args: ['stt', STABLE_LOCAL_AUDIO_PATH, '--grok', 'grok-4.20-reasoning'] },
  { label: 'CLI invalid OpenAI model exits with usage error code 2', args: ['write', STABLE_LOCAL_AUDIO_PATH, '--openai', 'not-a-real-openai-model'] },
  { label: 'CLI malformed llama repo ID exits with usage error code 2', args: ['write', STABLE_LOCAL_AUDIO_PATH, '--llama', 'not-a-real-llama-model'] },
  { label: 'CLI invalid anthropic model exits with usage error code 2', args: ['write', STABLE_LOCAL_AUDIO_PATH, '--anthropic', 'not-a-real-anthropic-model'] },
  { label: 'CLI invalid MiniMax model exits with usage error code 2', args: ['write', STABLE_LOCAL_AUDIO_PATH, '--minimax', 'not-a-real-minimax-model'] },
  { label: 'CLI invalid Grok model exits with usage error code 2', args: ['write', STABLE_LOCAL_AUDIO_PATH, '--grok', 'not-a-real-grok-model'] },
  { label: 'CLI removed Groq short model compatibility id exits with usage error code 2', args: ['write', STABLE_LOCAL_AUDIO_PATH, '--groq', 'gpt-oss-20b'] },
  { label: 'CLI invalid ElevenLabs TTS model exits with usage error code 2', args: ['tts', 'input/examples/tts/1-tts.md', '--elevenlabs-tts', 'eleven_v4', '--elevenlabs-voice', 'voice_123'] },
  { label: 'CLI invalid MiniMax TTS model exits with usage error code 2', args: ['tts', 'input/examples/tts/1-tts.md', '--minimax-tts', 'speech-3.0-hd'] },
  { label: 'CLI invalid Groq TTS model exits with usage error code 2', args: ['tts', 'input/examples/tts/1-tts.md', '--groq-tts', 'canopylabs/orpheus-v2-english'] },
  { label: 'CLI invalid OpenAI TTS model exits with usage error code 2', args: ['tts', 'input/examples/tts/1-tts.md', '--openai-tts', 'tts-1'] },
  { label: 'CLI invalid Gemini TTS model exits with usage error code 2', args: ['tts', 'input/examples/tts/1-tts.md', '--gemini-tts', 'gemini-2.5-flash-tts'] },
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
  expect(result.stdout).toContain('--youtube-captions')
  expect(result.stdout).toContain('--price')
  expect(result.stdout).not.toContain('--provider')
  expect(result.stdout).toContain('--gcloud-stt')
  expect(result.stdout).toContain('--aws-stt')
  expect(result.stdout).toContain('--deepinfra-stt')
  expect(result.stdout).toContain('--deapi-stt')
  expect(result.stdout).toContain('--aws-region')
  expect(result.stdout).toContain('--aws-bucket')
  expect(result.stdout).toContain('--elevenlabs-stt')
  expect(result.stdout).toContain('--deepgram-stt')
  expect(result.stdout).toContain('--soniox-stt')
  expect(result.stdout).toContain('--speechmatics-stt')
  expect(result.stdout).toContain('--rev-stt')
  expect(result.stdout).toContain('low_cost')
  expect(result.stdout).toContain('--groq-stt')
  expect(result.stdout).toContain('--mistral-stt')
  expect(result.stdout).toContain('--gladia-stt')
  expect(result.stdout).toContain('--supadata-stt')
  expect(result.stdout).toContain('--supadata-lang')
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

test('ocr help includes hosted OCR flags', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'ocr',
    '--help'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--mistral-ocr')
  expect(result.stdout).toContain('--glm-ocr')
  expect(result.stdout).toContain('--openai-ocr')
  expect(result.stdout).toContain('--anthropic-ocr')
  expect(result.stdout).toContain('--gemini-ocr')
  expect(result.stdout).not.toContain('--provider')
  expect(result.stdout).toContain('--epub-bun')
  expect(result.stdout).toContain('--epub-calibre')
})

test('resume help exposes combined STT and OCR resume flags', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'resume',
    '--help'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('resume [outputDir]')
  expect(result.stdout).toContain('--speaker-count')
  expect(result.stdout).toContain('--youtube-captions')
  expect(result.stdout).toContain('--stt-provider-concurrency')
  expect(result.stdout).toContain('--deepinfra-stt')
  expect(result.stdout).toContain('--deapi-stt')
  expect(result.stdout).toContain('--supadata-stt')
  expect(result.stdout).toContain('--supadata-lang')
  expect(result.stdout).toContain('--mistral-ocr')
  expect(result.stdout).toContain('--glm-ocr')
  expect(result.stdout).toContain('--epub-bun')
  expect(result.stdout).toContain('--batch-concurrency')
})

test('write help excludes top-level resume surface', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    '--help'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).not.toContain('resume [output-dir]')
})

test('write help includes text-input lyric workflow flags', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    '--help'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--text-input')
  expect(result.stdout).toContain('--prompt-file')
  expect(result.stdout).toContain('--rendered-text')
  expect(result.stdout).toContain('--rendered-out-dir')
  expect(result.stdout).toContain('--track-list')
  expect(result.stdout).toContain('--epub-bun')
  expect(result.stdout).toContain('--epub-calibre')
})

test('tts help includes Gemini multispeaker flags', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    '--help'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--gemini-speaker-1-name')
  expect(result.stdout).toContain('--gemini-speaker-1-voice')
  expect(result.stdout).toContain('--gemini-speaker-2-name')
  expect(result.stdout).toContain('--gemini-speaker-2-voice')
})

test('music help advertises local markdown and text prompt files', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'music',
    '--help'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('local .md/.txt file')
  expect(result.stdout).toContain('input/examples/tts/1-tts.md')
})

test('setup help includes calibre step', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'setup',
    '--help'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('calibre')
  expect(result.stdout).toContain('--gcloud')
  expect(result.stdout).toContain('--gcloud-project')
  expect(result.stdout).toContain('--gcloud-billing-account')
  expect(result.stdout).toContain('--gcloud-project-name')
  expect(result.stdout).toContain('--gcloud-organization')
  expect(result.stdout).toContain('--gcloud-folder')
  expect(result.stdout).toContain('--aws')
  expect(result.stdout).toContain('--aws-create-bucket')
  expect(result.stdout).toContain('--aws-region')
  expect(result.stdout).toContain('--aws-bucket')
  expect(result.stdout).toContain('--sample')
  expect(result.stdout).toContain('--models')
  expect(result.stdout).toContain('--out')
  expect(result.stdout).toContain('--verify-only')
})

test('setup rejects sample-only flags without --sample', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'setup',
    '--verify-only'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('--verify-only require --sample')
})

test('setup rejects combining --sample with --step', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'setup',
    '--sample',
    '--step',
    'sample'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('--sample cannot be combined with --step')
})

test('setup rejects combining --models with --doctor', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'setup',
    '--models',
    'base',
    '--doctor'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('--models cannot be combined with --doctor')
})

test('removed sample and models commands return unknown-command usage errors', async () => {
  const sampleResult = await runCommand([
    'src/cli/create-cli.ts',
    'sample'
  ])
  const modelsResult = await runCommand([
    'src/cli/create-cli.ts',
    'models'
  ])

  expect(sampleResult.exitCode).toBe(2)
  expect(modelsResult.exitCode).toBe(2)
  expect(`${sampleResult.stdout}\n${sampleResult.stderr}`).toContain('Unknown command "sample"')
  expect(`${modelsResult.stdout}\n${modelsResult.stderr}`).toContain('Unknown command "models"')
})

test('setup rejects combining --gcloud with --step', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'setup',
    '--gcloud',
    '--step',
    'transcription'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('--gcloud cannot be combined with --step')
})

test('setup rejects gcloud project automation flag without --gcloud', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'setup',
    '--gcloud-project',
    'my-project'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('--gcloud-project require --gcloud')
})

test('setup rejects gcloud project bootstrap flags without --gcloud-project', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'setup',
    '--gcloud',
    '--gcloud-billing-account',
    '000000-000000-000000'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('--gcloud-billing-account require --gcloud-project')
})

test('setup rejects combining gcloud organization and folder selectors', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'setup',
    '--gcloud',
    '--gcloud-project',
    'my-project',
    '--gcloud-organization',
    '123',
    '--gcloud-folder',
    '456'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('--gcloud-organization cannot be combined with --gcloud-folder')
})

test('setup rejects combining --aws with --step', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'setup',
    '--aws',
    '--step',
    'transcription'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('--aws cannot be combined with --step')
})

test('setup rejects aws bucket automation flags without --aws', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'setup',
    '--aws-create-bucket'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('--aws-create-bucket require --aws')
})

test('config help excludes legacy --max-usd and keeps --max-cents', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'config',
    '--help'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--max-cents')
  expect(result.stdout).not.toContain('--max-usd')
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

test('canonical help forms still work for metadata', async () => {
  const helpCommandResult = await runCommand([
    'src/cli/create-cli.ts',
    'help',
    'metadata'
  ])
  const commandFlagResult = await runCommand([
    'src/cli/create-cli.ts',
    'metadata',
    '--help'
  ])

  expect(helpCommandResult.exitCode).toBe(0)
  expect(helpCommandResult.stdout).toContain('bun as metadata')
  expect(commandFlagResult.exitCode).toBe(0)
  expect(commandFlagResult.stdout).toContain('bun as metadata')
})

test('legacy help argument order fails', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    '--help',
    'metadata'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Unsupported argument order')
})

test('CLI ElevenLabs TTS without voice id is accepted in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    'input/examples/tts/1-tts.md',
    '--elevenlabs-tts',
    'eleven_v3',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

const barePriceSelectionCases = [
  {
    name: 'CLI bare Google Cloud STT flag is accepted in price mode',
    args: ['src/cli/create-cli.ts', 'stt', STABLE_LOCAL_AUDIO_PATH, '--gcloud-stt', '--price'],
    provider: 'gcloud',
    model: 'chirp_3',
  },
  {
    name: 'CLI bare Deepgram STT flag is accepted in price mode',
    args: ['src/cli/create-cli.ts', 'stt', STABLE_LOCAL_AUDIO_PATH, '--deepgram-stt', '--price'],
    provider: 'deepgram',
    model: 'nova-3',
  },
  {
    name: 'CLI bare DeepInfra STT flag resolves to the cheapest model in price mode',
    args: ['src/cli/create-cli.ts', 'stt', STABLE_LOCAL_AUDIO_PATH, '--deepinfra-stt', '--price'],
    provider: 'deepinfra',
    model: 'openai/whisper-large-v3-turbo',
  },
  {
    name: 'CLI bare deAPI STT flag resolves to the curated model in price mode',
    args: ['src/cli/create-cli.ts', 'stt', STABLE_LOCAL_AUDIO_PATH, '--deapi-stt', '--price'],
    provider: 'deapi',
    model: 'WhisperLargeV3',
  },
  {
    name: 'CLI bare Soniox STT flag is accepted in price mode',
    args: ['src/cli/create-cli.ts', 'stt', STABLE_LOCAL_AUDIO_PATH, '--soniox-stt', '--price'],
    provider: 'soniox',
    model: 'stt-async-v4',
  },
  {
    name: 'CLI bare Speechmatics STT flag is accepted in price mode',
    args: ['src/cli/create-cli.ts', 'stt', STABLE_LOCAL_AUDIO_PATH, '--speechmatics-stt', '--price'],
    provider: 'speechmatics',
    model: 'standard',
  },
  {
    name: 'CLI bare Gladia STT flag is accepted in price mode',
    args: ['src/cli/create-cli.ts', 'stt', STABLE_LOCAL_AUDIO_PATH, '--gladia-stt', '--price'],
    provider: 'gladia',
    model: 'default',
  },
  {
    name: 'CLI bare Rev STT flag is accepted in price mode',
    args: ['src/cli/create-cli.ts', 'stt', STABLE_LOCAL_AUDIO_PATH, '--rev-stt', '--price'],
    provider: 'rev',
    model: 'low_cost',
  },
  {
    name: 'CLI bare Groq STT flag resolves to the cheapest model in price mode',
    args: ['src/cli/create-cli.ts', 'stt', STABLE_LOCAL_AUDIO_PATH, '--groq-stt', '--price'],
    provider: 'groq',
    model: 'whisper-large-v3-turbo',
  },
  {
    name: 'CLI bare Supadata STT flag resolves to auto mode in price mode',
    args: ['src/cli/create-cli.ts', 'stt', STABLE_LOCAL_AUDIO_PATH, '--supadata-stt', '--price'],
    provider: 'supadata',
    model: 'auto',
  },
  {
    name: 'CLI bare Groq LLM flag resolves to the cheapest model in price mode',
    args: ['src/cli/create-cli.ts', 'write', STABLE_LOCAL_AUDIO_PATH, '--groq', '--price'],
    provider: 'groq',
    model: 'openai/gpt-oss-20b',
  },
  {
    name: 'CLI bare Anthropic LLM flag resolves to the cheapest model in price mode',
    args: ['src/cli/create-cli.ts', 'write', STABLE_LOCAL_AUDIO_PATH, '--anthropic', '--price'],
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
  },
  {
    name: 'CLI bare OpenAI TTS flag resolves to the cheapest model in price mode',
    args: ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--openai-tts', '--price'],
    provider: 'openai',
    model: 'gpt-4o-mini-tts',
  },
  {
    name: 'CLI bare Gemini TTS flag resolves to the cheapest model in price mode',
    args: ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--gemini-tts', '--price'],
    provider: 'gemini',
    model: 'gemini-2.5-flash-preview-tts',
  },
  {
    name: 'CLI bare OpenAI image flag resolves to the cheapest model in price mode',
    args: ['src/cli/create-cli.ts', 'image', 'a sunset', '--openai-image', '--price'],
    provider: 'openai',
    model: 'gpt-image-1-mini',
  },
  {
    name: 'CLI bare Mistral OCR flag resolves to the cheapest model in price mode',
    args: ['src/cli/create-cli.ts', 'ocr', 'input/examples/document/1-document.pdf', '--mistral-ocr', '--price'],
    provider: 'mistral',
    model: 'mistral-ocr-2512',
  },
  {
    name: 'CLI bare Anthropic OCR flag resolves to the cheapest model in price mode',
    args: ['src/cli/create-cli.ts', 'ocr', 'input/examples/document/1-document.pdf', '--anthropic-ocr', '--price'],
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
  },
  {
    name: 'CLI bare Gemini OCR flag resolves to the cheapest model in price mode',
    args: ['src/cli/create-cli.ts', 'ocr', 'input/examples/document/1-document.pdf', '--gemini-ocr', '--price'],
    provider: 'gemini',
    model: 'gemini-3.1-flash-lite-preview',
  },
  {
    name: 'CLI bare Gemini video flag resolves to the cheapest model in price mode',
    args: ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--gemini-video', '--price'],
    provider: 'gemini',
    model: 'veo-3.1-fast-generate-preview',
  },
] as const

for (const barePriceSelectionCase of barePriceSelectionCases) {
  test(barePriceSelectionCase.name, async () => {
    const result = await runCommand([...barePriceSelectionCase.args])
    expectPriceSelection(result, barePriceSelectionCase.provider, barePriceSelectionCase.model)
  })
}

test('CLI Supadata price output includes converted credit cost estimates', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'stt',
    STABLE_LOCAL_AUDIO_PATH,
    '--supadata-stt',
    'generate',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
  const combined = `${result.stdout}\n${result.stderr}`
  expect(combined).toContain('supadata')
  expect(combined).toContain('generate')
  expect(combined).toContain('Basic/Pro auto-recharge rate')
  expect(combined).toContain('2 credits/min')
  expect(combined).not.toContain('informational credit guidance only')
  expect(combined).not.toContain('Total estimated cost: 0.00000¢')
})

test('CLI explicit Rev Turbo STT flag is accepted in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'stt',
    STABLE_LOCAL_AUDIO_PATH,
    '--rev-stt',
    'low_cost',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('CLI custom llama Hugging Face repo ID is accepted in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    STABLE_LOCAL_AUDIO_PATH,
    '--llama',
    'unsloth/Qwen3.5-0.8B-GGUF',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('CLI explicit Anthropic Opus 4.7 flag is accepted in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    STABLE_LOCAL_AUDIO_PATH,
    '--anthropic',
    'claude-opus-4-7',
    '--price'
  ])

  expectPriceSelection(result, 'anthropic', 'claude-opus-4-7')
})

test('stt rejects removed --resume-missing flag through normal unknown-flag handling', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'stt',
    '--resume-missing'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Unexpected flag: resumeMissing')
})

test('ocr rejects removed --resume-missing flag through normal unknown-flag handling', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'ocr',
    '--resume-missing'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Unexpected flag: resumeMissing')
})

test('write --resume-missing still fails through normal unknown-flag handling', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    '--resume-missing'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Unexpected flag: resumeMissing')
})

test('write EPUB inspect mode rejects explicit non-JSON output the same way as ocr', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    'input/examples/document/1-epub.epub',
    '--epub-bun',
    '--out',
    'text',
    '--price'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('EPUB inspect mode supports JSON output only. Use --out json with --epub-bun or --epub-calibre.')
})

test('write EPUB inspect price output reports write artifacts instead of extraction.txt', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    'input/examples/document/1-epub.epub',
    '--epub-bun',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('run.json (includes EPUB inspection payload)')
  expect(`${result.stdout}\n${result.stderr}`).not.toContain('extraction.txt')
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

test('buildOptsFromFlags maps --deepinfra-stt to deepinfraSttModel', () => {
  const opts = buildOptsFromFlags(false, {
    'deepinfra-stt': 'openai/whisper-large-v3-turbo'
  })

  expect(opts.deepinfraSttModel).toBe('openai/whisper-large-v3-turbo')
})

test('buildOptsFromFlags maps --deapi-stt to deapiSttModel and deapiSttModels', () => {
  const opts = buildOptsFromFlags(false, {
    'deapi-stt': ['WhisperLargeV3', 'WhisperLargeV3']
  })

  expect(opts.deapiSttModel).toBe('WhisperLargeV3')
  expect(opts.deapiSttModels).toEqual(['WhisperLargeV3'])
})

test('buildOptsFromFlags maps --gcloud-stt to gcloudSttModel', () => {
  const opts = buildOptsFromFlags(false, {
    'gcloud-stt': 'chirp_3'
  })

  expect(opts.gcloudSttModel).toBe('chirp_3')
})

test('buildOptsFromFlags maps AWS STT flags', () => {
  const opts = buildOptsFromFlags(false, {
    'aws-stt': 'standard',
    'aws-region': 'us-east-1',
    'aws-bucket': 'transcribe-bucket'
  })

  expect(opts.awsSttModel).toBe('standard')
  expect(opts.awsRegion).toBe('us-east-1')
  expect(opts.awsBucket).toBe('transcribe-bucket')
})

test('buildOptsFromFlags maps --youtube-captions to youtubeCaptions', () => {
  const opts = buildOptsFromFlags(false, {
    'youtube-captions': true
  })

  expect(opts.youtubeCaptions).toBe(true)
})

test('buildOptsFromFlags maps --glm-ocr to glmOcrModel', () => {
  const opts = buildOptsFromFlags(false, {
    'glm-ocr': 'glm-ocr'
  })

  expect(opts.glmOcrModel).toBe('glm-ocr')
})

test('buildOptsFromFlags maps --openai-ocr to openaiOcrModel', () => {
  const opts = buildOptsFromFlags(false, {
    'openai-ocr': 'gpt-5.4-nano'
  })

  expect(opts.openaiOcrModel).toBe('gpt-5.4-nano')
})

test('buildOptsFromFlags maps --anthropic-ocr to anthropicOcrModel', () => {
  const opts = buildOptsFromFlags(false, {
    'anthropic-ocr': 'claude-haiku-4-5'
  })

  expect(opts.anthropicOcrModel).toBe('claude-haiku-4-5')
})

test('buildOptsFromFlags maps --gemini-ocr to geminiOcrModel', () => {
  const opts = buildOptsFromFlags(false, {
    'gemini-ocr': 'gemini-3.1-flash-lite-preview'
  })

  expect(opts.geminiOcrModel).toBe('gemini-3.1-flash-lite-preview')
})

test('buildConfigPatchFromFlags resolves bare provider flags before writing config', () => {
  expect(buildConfigPatchFromFlags({
    'gcloud-stt': true,
    'aws-stt': true,
    'deepinfra-stt': true,
    'deapi-stt': true,
    'supadata-stt': true,
    'groq-stt': true,
    'openai': true,
    'grok': true,
    'openai-tts': true,
    'openai-image': true,
    'mistral-ocr': true,
    'openai-ocr': true,
    'anthropic-ocr': true,
    'gemini-ocr': true,
    'gemini-video': true
  }, new Set(['gcloud-stt', 'aws-stt', 'deepinfra-stt', 'deapi-stt', 'supadata-stt', 'groq-stt', 'openai', 'grok', 'openai-tts', 'openai-image', 'mistral-ocr', 'openai-ocr', 'anthropic-ocr', 'gemini-ocr', 'gemini-video']))).toEqual({
    version: 2,
    defaults: {
      stt: {
        gcloudStt: ['chirp_3'],
        awsStt: ['standard'],
        deepinfraStt: ['openai/whisper-large-v3-turbo'],
        deapiStt: ['WhisperLargeV3'],
        supadataStt: ['auto'],
        groqStt: ['whisper-large-v3-turbo']
      },
      llm: {
        openai: ['gpt-5.4-nano'],
        grok: ['grok-4.20-non-reasoning']
      },
      post: {
        tts: {
          openaiTts: ['gpt-4o-mini-tts']
        },
        image: {
          openaiImage: ['gpt-image-1-mini']
        },
        video: {
          geminiVideo: ['veo-3.1-fast-generate-preview']
        }
      },
      extract: {
        mistralOcr: ['mistral-ocr-2512'],
        openaiOcr: ['gpt-5.4-nano'],
        anthropicOcr: ['claude-haiku-4-5'],
        geminiOcr: ['gemini-3.1-flash-lite-preview']
      }
    }
  })
})

test('buildConfigPatchFromFlags stores AWS region and bucket defaults', () => {
  expect(buildConfigPatchFromFlags({
    'aws-stt': 'standard',
    'aws-region': 'us-east-1',
    'aws-bucket': 'transcribe-bucket'
  }, new Set(['aws-stt', 'aws-region', 'aws-bucket']))).toEqual({
    version: 2,
    defaults: {
      stt: {
        awsStt: ['standard'],
        awsRegion: 'us-east-1',
        awsBucket: 'transcribe-bucket'
      }
    }
  })
})

test('buildConfigPatchFromFlags stores Supadata STT defaults and language preference', () => {
  expect(buildConfigPatchFromFlags({
    'supadata-stt': 'native',
    'supadata-lang': 'en'
  }, new Set(['supadata-stt', 'supadata-lang']))).toEqual({
    version: 2,
    defaults: {
      stt: {
        supadataStt: ['native'],
        supadataLang: 'en'
      }
    }
  })
})

test('buildConfigPatchFromFlags stores Gemini multispeaker defaults', () => {
  expect(buildConfigPatchFromFlags({
    'gemini-tts': 'gemini-3.1-flash-tts-preview',
    'gemini-speaker-1-name': 'Host',
    'gemini-speaker-1-voice': 'Kore',
    'gemini-speaker-2-name': 'Guest',
    'gemini-speaker-2-voice': 'Puck'
  }, new Set([
    'gemini-tts',
    'gemini-speaker-1-name',
    'gemini-speaker-1-voice',
    'gemini-speaker-2-name',
    'gemini-speaker-2-voice'
  ]))).toEqual({
    version: 2,
    defaults: {
      post: {
        tts: {
          geminiTts: ['gemini-3.1-flash-tts-preview'],
          geminiSpeaker1Name: 'Host',
          geminiSpeaker1Voice: 'Kore',
          geminiSpeaker2Name: 'Guest',
          geminiSpeaker2Voice: 'Puck'
        }
      }
    }
  })
})

test('buildConfigPatchFromFlags stores repeated same-provider flags as ordered arrays', () => {
  const rawArgs = [
    'config',
    '--speechmatics-stt',
    'standard',
    '--speechmatics-stt',
    'enhanced',
    '--openai',
    'gpt-5.4',
    '--openai',
    'gpt-5.4-mini',
    '--gemini-video',
    'veo-3.1-fast-generate-preview',
    '--gemini-video',
    'veo-3.1-generate-preview'
  ]

  expect(buildConfigPatchFromFlags({
    'speechmatics-stt': ['standard', 'enhanced'],
    'openai': ['gpt-5.4', 'gpt-5.4-mini'],
    'gemini-video': ['veo-3.1-fast-generate-preview', 'veo-3.1-generate-preview']
  }, new Set(['speechmatics-stt', 'openai', 'gemini-video']), rawArgs)).toEqual({
    version: 2,
    defaults: {
      stt: {
        speechmaticsStt: ['standard', 'enhanced']
      },
      llm: {
        openai: ['gpt-5.4', 'gpt-5.4-mini']
      },
      post: {
        video: {
          geminiVideo: ['veo-3.1-fast-generate-preview', 'veo-3.1-generate-preview']
        }
      }
    }
  })
})

test('buildOptsFromFlags preserves custom llama Hugging Face repo IDs', () => {
  const opts = buildOptsFromFlags(false, {
    'llama': 'unsloth/Qwen3.5-0.8B-GGUF'
  })

  expect(opts.llamaModel).toBe('unsloth/Qwen3.5-0.8B-GGUF')
})

test('resolveCheapestModelForFlag uses current registry-driven cheapest selections', () => {
  expect(resolveCheapestModelForFlag('gcloud-stt')).toBe('chirp_3')
  expect(resolveCheapestModelForFlag('aws-stt')).toBe('standard')
  expect(resolveCheapestModelForFlag('deepinfra-stt')).toBe('openai/whisper-large-v3-turbo')
  expect(resolveCheapestModelForFlag('deapi-stt')).toBe('WhisperLargeV3')
  expect(resolveCheapestModelForFlag('supadata-stt')).toBe('auto')
  expect(resolveCheapestModelForFlag('groq-stt')).toBe('whisper-large-v3-turbo')
  expect(resolveCheapestModelForFlag('openai')).toBe('gpt-5.4-nano')
  expect(resolveCheapestModelForFlag('anthropic')).toBe('claude-haiku-4-5')
  expect(resolveCheapestModelForFlag('grok')).toBe('grok-4.20-non-reasoning')
  expect(resolveCheapestModelForFlag('openai-tts')).toBe('gpt-4o-mini-tts')
  expect(resolveCheapestModelForFlag('gemini-tts')).toBe('gemini-2.5-flash-preview-tts')
  expect(resolveCheapestModelForFlag('openai-image')).toBe('gpt-image-1-mini')
  expect(resolveCheapestModelForFlag('mistral-ocr')).toBe('mistral-ocr-2512')
  expect(resolveCheapestModelForFlag('openai-ocr')).toBe('gpt-5.4-nano')
  expect(resolveCheapestModelForFlag('anthropic-ocr')).toBe('claude-haiku-4-5')
  expect(resolveCheapestModelForFlag('gemini-ocr')).toBe('gemini-3.1-flash-lite-preview')
  expect(resolveCheapestModelForFlag('gemini-video')).toBe('veo-3.1-fast-generate-preview')
  expect(resolveCheapestModelForFlag('minimax-video')).toBe('T2V-01')
})

test('selectCheapestVideoSelection preserves minimal-cost video defaults', () => {
  expect(selectCheapestVideoSelection('gemini')).toEqual({
    provider: 'gemini',
    model: 'veo-3.1-fast-generate-preview',
    duration: 4,
    resolution: '720p',
    totalCost: 55
  })

  expect(selectCheapestVideoSelection('minimax')).toEqual({
    provider: 'minimax',
    model: 'T2V-01',
    duration: 6,
    resolution: '720p',
    totalCost: 19
  })
})

test('buildOptsFromFlags resolves bare provider flags to cheapest models', () => {
  const opts = buildOptsFromFlags(false, {
    'gcloud-stt': true,
    'aws-stt': true,
    'deepinfra-stt': true,
    'deapi-stt': true,
    'supadata-stt': true,
    'groq-stt': true,
    'openai': true,
    'anthropic': true,
    'grok': true,
    'openai-tts': true,
    'openai-image': true,
    'mistral-ocr': true,
    'openai-ocr': true,
    'gemini-ocr': true,
    'gemini-video': true
  })

  expect(opts.gcloudSttModel).toBe('chirp_3')
  expect(opts.awsSttModel).toBe('standard')
  expect(opts.deepinfraSttModel).toBe('openai/whisper-large-v3-turbo')
  expect(opts.deapiSttModel).toBe('WhisperLargeV3')
  expect(opts.supadataSttModel).toBe('auto')
  expect(opts.groqSttModel).toBe('whisper-large-v3-turbo')
  expect(opts.openaiModel).toBe('gpt-5.4-nano')
  expect(opts.anthropicModel).toBe('claude-haiku-4-5')
  expect(opts.grokModel).toBe('grok-4.20-non-reasoning')
  expect(opts.openaiTtsModel).toBe('gpt-4o-mini-tts')
  expect(opts.openaiImageModel).toBe('gpt-image-1-mini')
  expect(opts.mistralOcrModel).toBe('mistral-ocr-2512')
  expect(opts.openaiOcrModel).toBe('gpt-5.4-nano')
  expect(opts.geminiOcrModel).toBe('gemini-3.1-flash-lite-preview')
  expect(opts.geminiVideoModel).toBe('veo-3.1-fast-generate-preview')
})

test('buildOptsFromFlags preserves repeated same-provider flags in first-seen order', () => {
  const opts = buildOptsFromFlags(false, {
    'speechmatics-stt': ['standard', 'enhanced'],
    'openai': ['gpt-5.4', 'gpt-5.4-mini'],
    'openai-image': ['gpt-image-1-mini', 'gpt-image-1']
  }, [], {}, new Set(['speechmatics-stt', 'openai', 'openai-image']), [
    'stt',
    STABLE_LOCAL_AUDIO_PATH,
    '--speechmatics-stt',
    'standard',
    '--speechmatics-stt',
    'enhanced',
    '--openai',
    'gpt-5.4',
    '--openai',
    'gpt-5.4-mini',
    '--openai-image',
    'gpt-image-1-mini',
    '--openai-image',
    'gpt-image-1'
  ])

  expect(opts.speechmaticsSttModels).toEqual(['standard', 'enhanced'])
  expect(opts.speechmaticsSttModel).toBe('standard')
  expect(opts.openaiModels).toEqual(['gpt-5.4', 'gpt-5.4-mini'])
  expect(opts.openaiModel).toBe('gpt-5.4')
  expect(opts.openaiImageModels).toEqual(['gpt-image-1-mini', 'gpt-image-1'])
  expect(opts.openaiImageModel).toBe('gpt-image-1-mini')
})

test('buildOptsFromFlags deduplicates identical repeated provider-model pairs', () => {
  const opts = buildOptsFromFlags(false, {
    'speechmatics-stt': ['standard', 'standard', 'enhanced'],
    'openai': ['gpt-5.4', 'gpt-5.4']
  }, [], {}, new Set(['speechmatics-stt', 'openai']), [
    'stt',
    STABLE_LOCAL_AUDIO_PATH,
    '--speechmatics-stt',
    'standard',
    '--speechmatics-stt',
    'standard',
    '--speechmatics-stt',
    'enhanced',
    '--openai',
    'gpt-5.4',
    '--openai',
    'gpt-5.4'
  ])

  expect(opts.speechmaticsSttModels).toEqual(['standard', 'enhanced'])
  expect(opts.openaiModels).toEqual(['gpt-5.4'])
})

test('buildOptsFromFlags resolves bare OpenAI TTS to avoid kitten fallback', () => {
  const opts = buildOptsFromFlags(true, {
    'openai-tts': true
  }, [], { defaultTtsEngine: 'kitten' })

  expect(opts.openaiTtsModel).toBe('gpt-4o-mini-tts')
  expect(opts.kittenTtsModel).toBeUndefined()
})

test('buildOptsFromFlags maps --soniox-stt to sonioxSttModel', () => {
  const opts = buildOptsFromFlags(false, {
    'soniox-stt': 'stt-async-v4'
  })

  expect(opts.sonioxSttModel).toBe('stt-async-v4')
})

test('buildOptsFromFlags maps --speechmatics-stt to speechmaticsSttModel', () => {
  const opts = buildOptsFromFlags(false, {
    'speechmatics-stt': 'enhanced'
  })

  expect(opts.speechmaticsSttModel).toBe('enhanced')
})

test('buildOptsFromFlags maps --rev-stt to revSttModel', () => {
  const opts = buildOptsFromFlags(false, {
    'rev-stt': 'machine'
  })

  expect(opts.revSttModel).toBe('machine')
})

test('buildOptsFromFlags maps --rev-stt low_cost to revSttModel', () => {
  const opts = buildOptsFromFlags(false, {
    'rev-stt': 'low_cost'
  })

  expect(opts.revSttModel).toBe('low_cost')
})

test('buildOptsFromFlags maps --gladia-stt to gladiaSttModel', () => {
  const opts = buildOptsFromFlags(false, {
    'gladia-stt': 'default'
  })

  expect(opts.gladiaSttModel).toBe('default')
})

test('buildOptsFromFlags maps Supadata STT flags', () => {
  const opts = buildOptsFromFlags(false, {
    'supadata-stt': ['native', 'generate'],
    'supadata-lang': 'en'
  })

  expect(opts.supadataSttModel).toBe('native')
  expect(opts.supadataSttModels).toEqual(['native', 'generate'])
  expect(opts.supadataLang).toBe('en')
})

test('buildOptsFromFlags maps --aws-stt to awsSttModel', () => {
  const opts = buildOptsFromFlags(false, {
    'aws-stt': 'standard'
  })

  expect(opts.awsSttModel).toBe('standard')
})

test('buildOptsFromFlags maps --gemini-voice to geminiVoiceId', () => {
  const opts = buildOptsFromFlags(false, {
    'gemini-tts': 'gemini-2.5-flash-preview-tts',
    'gemini-voice': 'Kore'
  })

  expect(opts.geminiTtsModel).toBe('gemini-2.5-flash-preview-tts')
  expect(opts.geminiVoiceId).toBe('Kore')
})

test('buildOptsFromFlags maps Gemini multispeaker flags', () => {
  const opts = buildOptsFromFlags(false, {
    'gemini-tts': 'gemini-3.1-flash-tts-preview',
    'gemini-speaker-1-name': 'Host',
    'gemini-speaker-1-voice': 'Kore',
    'gemini-speaker-2-name': 'Guest',
    'gemini-speaker-2-voice': 'Puck'
  })

  expect(opts.geminiTtsModel).toBe('gemini-3.1-flash-tts-preview')
  expect(opts.geminiSpeaker1Name).toBe('Host')
  expect(opts.geminiSpeaker1Voice).toBe('Kore')
  expect(opts.geminiSpeaker2Name).toBe('Guest')
  expect(opts.geminiSpeaker2Voice).toBe('Puck')
})

test('Gemini multispeaker TTS rejects incomplete speaker flag sets in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    'input/examples/tts/1-tts.md',
    '--gemini-tts',
    'gemini-3.1-flash-tts-preview',
    '--gemini-speaker-1-name',
    'Host',
    '--gemini-speaker-1-voice',
    'Kore',
    '--price'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Gemini multispeaker TTS requires --gemini-speaker-2-name.')
})

test('Gemini multispeaker TTS rejects --gemini-voice conflicts in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    'input/examples/tts/1-tts.md',
    '--gemini-tts',
    'gemini-3.1-flash-tts-preview',
    '--gemini-voice',
    'Kore',
    '--gemini-speaker-1-name',
    'Host',
    '--gemini-speaker-1-voice',
    'Kore',
    '--gemini-speaker-2-name',
    'Guest',
    '--gemini-speaker-2-voice',
    'Puck',
    '--price'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Gemini multispeaker TTS cannot be combined with --gemini-voice.')
})

test('Gemini multispeaker TTS validates transcript speaker labels before API calls', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'autoshow-cli-gemini-speaker-validation-'))
  const inputPath = join(tempRoot, 'missing-speaker-labels.txt')

  try {
    await writeFile(inputPath, [
      'Narrator: Welcome back to the show.',
      'Narrator: Today we are covering release notes.'
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
    ], {
      env: {
        GEMINI_API_KEY: ''
      }
    })

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('Gemini multispeaker TTS requires the input text to include "Host:" labels.')
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('write rejects removed --json-output flag', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    STABLE_LOCAL_AUDIO_PATH,
    '--json-output'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Unexpected flag: jsonOutput')
  expect(`${result.stdout}\n${result.stderr}`).not.toContain('was removed')
})

test('buildOptsFromFlags accepts --url-backend glm-reader', () => {
  const opts = buildOptsFromFlags(false, {
    'url-backend': 'glm-reader'
  })

  expect(opts.urlBackend).toBe('glm-reader')
})

test('write rejects removed --md-output flag', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    STABLE_LOCAL_AUDIO_PATH,
    '--md-output'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Unexpected flag: mdOutput')
  expect(`${result.stdout}\n${result.stderr}`).not.toContain('was removed')
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
    'assemblyai-stt': 'universal-3-pro'
  }, [], {}, new Set(['whisper', 'assemblyai-stt']))

  expect(collectSttTargets(opts).map((target) => `${target.service}:${target.model}`)).toEqual([
    'assemblyai:universal-3-pro',
    'whisper:base'
  ])
})

test('collectSttTargets deduplicates identical provider-specific specs', () => {
  const opts = buildOptsFromFlags(false, {
    whisper: 'base',
    'assemblyai-stt': 'universal-3-pro'
  })

  expect(collectSttTargets(opts).map((target) => `${target.service}:${target.model}`)).toEqual([
    'assemblyai:universal-3-pro'
  ])
})

test('collectExplicitOcrTargets collects canonical OCR provider flags', () => {
  const opts = buildOptsFromFlags(false, {
    'paddle-ocr': true,
    'mistral-ocr': 'mistral-ocr-2512',
    'openai-ocr': 'gpt-5.4-nano',
    'anthropic-ocr': 'claude-haiku-4-5',
    'gemini-ocr': 'gemini-3.1-flash-lite-preview'
  })

  expect(collectExplicitOcrTargets(opts)).toEqual([
    { service: 'paddle-ocr', model: 'paddle-ocr' },
    { service: 'mistral', model: 'mistral-ocr-2512' },
    { service: 'openai', model: 'gpt-5.4-nano' },
    { service: 'anthropic', model: 'claude-haiku-4-5' },
    { service: 'gemini', model: 'gemini-3.1-flash-lite-preview' }
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
      diarizationOptions: { enabled: true }
    }
  ])
})

test('collectSttTargets includes DeepInfra targets without diarization or speaker-count hints', () => {
  const opts = buildOptsFromFlags(false, {
    'deepinfra-stt': 'openai/whisper-large-v3-turbo',
    'speaker-count': '2'
  })

  expect(collectSttTargets(opts)).toEqual([
    {
      service: 'deepinfra',
      model: 'openai/whisper-large-v3-turbo',
      local: false
    }
  ])
})

test('collectSttTargets includes deAPI targets without diarization or speaker-count hints', () => {
  const opts = buildOptsFromFlags(false, {
    'deapi-stt': 'WhisperLargeV3',
    'speaker-count': '2'
  })

  expect(collectSttTargets(opts)).toEqual([
    {
      service: 'deapi',
      model: 'WhisperLargeV3',
      local: false
    }
  ])
})

test('collectSttTargets includes AWS targets with region, bucket, and speaker-count hints', () => {
  const opts = buildOptsFromFlags(false, {
    'aws-stt': 'standard',
    'aws-region': 'us-east-1',
    'aws-bucket': 'transcribe-bucket',
    'speaker-count': '2'
  })

  expect(collectSttTargets(opts)).toEqual([
    {
      service: 'aws',
      model: 'standard',
      local: false,
      awsRegion: 'us-east-1',
      awsBucket: 'transcribe-bucket',
      diarizationOptions: { enabled: true, speakerCount: 2 }
    }
  ])
})

test('collectSttTargets includes Google Cloud targets with exact speaker-count hints', () => {
  const opts = buildOptsFromFlags(false, {
    'gcloud-stt': 'chirp_3',
    'speaker-count': '2'
  })

  expect(collectSttTargets(opts)).toEqual([
    {
      service: 'gcloud',
      model: 'chirp_3',
      local: false,
      diarizationOptions: { enabled: true, speakerCount: 2 }
    }
  ])
})

test('collectSttTargets includes Soniox targets with ignored speaker-count hints', () => {
  const opts = buildOptsFromFlags(false, {
    'soniox-stt': 'stt-async-v4',
    'speaker-count': '2'
  })

  expect(collectSttTargets(opts)).toEqual([
    {
      service: 'soniox',
      model: 'stt-async-v4',
      local: false,
      diarizationOptions: { enabled: true }
    }
  ])
})

test('collectSttTargets includes Rev targets with ignored speaker-count hints', () => {
  const opts = buildOptsFromFlags(false, {
    'rev-stt': 'machine',
    'speaker-count': '2'
  })

  expect(collectSttTargets(opts)).toEqual([
    {
      service: 'rev',
      model: 'machine',
      local: false,
      diarizationOptions: { enabled: true }
    }
  ])
})

test('collectSttTargets includes Rev Turbo targets with ignored speaker-count hints', () => {
  const opts = buildOptsFromFlags(false, {
    'rev-stt': 'low_cost',
    'speaker-count': '2'
  })

  expect(collectSttTargets(opts)).toEqual([
    {
      service: 'rev',
      model: 'low_cost',
      local: false,
      diarizationOptions: { enabled: true }
    }
  ])
})

test('collectSttTargets includes Gladia targets with speaker-count hints', () => {
  const opts = buildOptsFromFlags(false, {
    'gladia-stt': 'default',
    'speaker-count': '2'
  })

  expect(collectSttTargets(opts)).toEqual([
    {
      service: 'gladia',
      model: 'default',
      local: false,
      diarizationOptions: { enabled: true, speakerCount: 2 }
    }
  ])
})

test('collectSttTargets includes Supadata targets without diarization or speaker-count hints', () => {
  const opts = buildOptsFromFlags(false, {
    'supadata-stt': ['auto', 'native'],
    'speaker-count': '2'
  })

  expect(collectSttTargets(opts)).toEqual([
    { service: 'supadata', model: 'auto', local: false },
    { service: 'supadata', model: 'native', local: false }
  ])
})

test('collectSttTargets enables diarization for ElevenLabs without a speaker-count hint', () => {
  const opts = buildOptsFromFlags(false, {
    'elevenlabs-stt': 'scribe_v2'
  })

  expect(collectSttTargets(opts)).toEqual([
    {
      service: 'elevenlabs',
      model: 'scribe_v2',
      local: false,
      diarizationOptions: { enabled: true }
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
    'universal-3-pro',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('stt rejects removed generic --provider aliases', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'stt',
    STABLE_LOCAL_AUDIO_PATH,
    '--provider',
    'whisper:tiny',
    '--provider',
    'assemblyai:universal-3-pro',
    '--price'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Unexpected flag: provider')
  expect(`${result.stdout}\n${result.stderr}`).not.toContain('Use provider-named flags')
})

test('stt accepts Deepgram plus another STT provider in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'stt',
    STABLE_LOCAL_AUDIO_PATH,
    '--deepgram-stt',
    'nova-3',
    '--assemblyai-stt',
    'universal-3-pro',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('stt accepts DeepInfra plus another STT provider in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'stt',
    STABLE_LOCAL_AUDIO_PATH,
    '--deepinfra-stt',
    'openai/whisper-large-v3-turbo',
    '--assemblyai-stt',
    'universal-3-pro',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('write rejects multiple STT providers in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    STABLE_LOCAL_AUDIO_PATH,
    '--whisper',
    'tiny',
    '--assemblyai-stt',
    'universal-3-pro',
    '--price'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('write accepts at most one STT provider')
})

test('write accepts multiple LLM providers in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    STABLE_LOCAL_AUDIO_PATH,
    '--openai',
    'gpt-5.4',
    '--groq',
    'openai/gpt-oss-20b',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('write accepts multiple TTS providers in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    STABLE_LOCAL_AUDIO_PATH,
    '--openai-tts',
    'gpt-4o-mini-tts',
    '--elevenlabs-tts',
    'eleven_v3',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('write accepts multiple image providers in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    STABLE_LOCAL_AUDIO_PATH,
    '--openai-image',
    'gpt-image-1-mini',
    '--minimax-image',
    'image-01',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('write accepts multiple video providers in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    STABLE_LOCAL_AUDIO_PATH,
    '--gemini-video',
    'veo-3.1-generate-preview',
    '--minimax-video',
    'MiniMax-Hailuo-2.3',
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
    'mistral-ocr-2512',
    '--glm-ocr',
    'glm-ocr',
    '--openai-ocr',
    'gpt-5.4-nano',
    '--gemini-ocr',
    'gemini-3.1-flash-lite-preview',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('ocr rejects removed generic --provider aliases', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'ocr',
    'input/examples/document/1-document.pdf',
    '--provider',
    'tesseract',
    '--provider',
    'glm-ocr',
    '--price'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Unexpected flag: provider')
  expect(`${result.stdout}\n${result.stderr}`).not.toContain('Use provider-named flags')
})

test('write rejects multiple OCR providers in price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    'input/examples/document/1-document.pdf',
    '--paddle-ocr',
    '--mistral-ocr',
    'mistral-ocr-2512',
    '--openai-ocr',
    'gpt-5.4-nano',
    '--openai',
    'gpt-5.4',
    '--price'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('write accepts at most one OCR provider')
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

test('buildOptsFromFlags maps text-input lyric workflow flags', () => {
  const opts = buildOptsFromFlags(false, {
    'text-input': true,
    'prompt-file': './albums/demo/prompt.md',
    'rendered-text': true,
    'rendered-out-dir': './albums/demo/lyrics',
    'track-list': './albums/demo/tracks.md'
  })

  expect(opts.textInput).toBe(true)
  expect(opts.promptFile).toBe('./albums/demo/prompt.md')
  expect(opts.renderedText).toBe(true)
  expect(opts.renderedOutDir).toBe('./albums/demo/lyrics')
  expect(opts.trackList).toBe('./albums/demo/tracks.md')
})

test('write rejects removed structured output flags', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    STABLE_LOCAL_AUDIO_PATH,
    '--structured'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Unexpected flag: structured')
  expect(`${result.stdout}\n${result.stderr}`).not.toContain('Structured output is now internal')
})

test('loadConfig rejects legacy pricing.maxUsd', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-config-legacy-'))
  const configPath = join(tempDir, 'autoshow.json')

  try {
    await writeFile(configPath, JSON.stringify({
      version: 2,
      pricing: {
        maxUsd: 1
      }
    }, null, 2))

    await expect(loadConfig(configPath)).rejects.toThrow('autoshow config')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('loadConfig rejects scalar model selections that do not match the v2 schema', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-config-normalize-'))
  const configPath = join(tempDir, 'autoshow.json')

  try {
    await writeFile(configPath, JSON.stringify({
      version: 2,
      defaults: {
        stt: {
          speechmaticsStt: 'enhanced'
        },
        llm: {
          openai: 'gpt-5.4-mini',
          grok: 'grok-4.20-non-reasoning'
        },
        post: {
          video: {
            geminiVideo: 'veo-3.1-fast-generate-preview'
          }
        },
        extract: {
          mistralOcr: 'mistral-ocr-2512'
        }
      }
    }, null, 2))

    await expect(loadConfig(configPath)).rejects.toThrow('autoshow config')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('loadConfig rejects removed defaults.stt.openaiStt', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-config-removed-stt-'))
  const configPath = join(tempDir, 'autoshow.json')

  try {
    await writeFile(configPath, JSON.stringify({
      version: 2,
      defaults: {
        stt: {
          openaiStt: 'removed-model'
        }
      }
    }, null, 2))

    await expect(loadConfig(configPath)).rejects.toThrow('autoshow config')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
