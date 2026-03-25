import { describe, expect, test } from 'bun:test'
import { PRICE_SELECTION_REGISTRY, resolvePriceSelection } from '../../test-runner/price-commands'

const listAllTestFiles = async (): Promise<string[]> => {
  const glob = new Bun.Glob('test/test-cases/**/*.test.ts')
  return (await Array.fromAsync(glob.scan({ dot: false }))).sort()
}

const uniqueBudgetKeys = [...new Set(
  PRICE_SELECTION_REGISTRY
    .filter(entry => entry.budgetSkippable)
    .map(entry => entry.key)
)].sort()

const EXPECTED_BUDGET_KEYS = [
  'extract-mistral-mistral-ocr-2512',
  'extract-mistral-mistral-ocr-latest',
  'extract-paddle-ocr-image',
  'image-gemini-gemini-3-pro-image-preview',
  'image-gemini-imagen-4.0-fast-generate-001',
  'image-gemini-imagen-4.0-generate-001',
  'image-gemini-imagen-4.0-ultra-generate-001',
  'image-minimax-image-01',
  'image-openai-gpt-image-1',
  'image-openai-gpt-image-1-mini',
  'image-openai-gpt-image-1.5',
  'music-elevenlabs-music_v1',
  'music-minimax-music-2.5',
  'music-pipeline-minimax-music-2.5',
  'transcribe-assemblyai-universal-2',
  'transcribe-assemblyai-universal-3-pro',
  'transcribe-elevenlabs-scribe_v2',
  'transcribe-groq-whisper-large-v3',
  'transcribe-groq-whisper-large-v3-turbo',
  'transcribe-mistral-voxtral-mini-2602',
  'transcribe-mistral-voxtral-mini-latest',
  'transcribe-openai-gpt-4o-transcribe-diarize',
  'transcribe-reverb',
  'transcribe-whisper-base',
  'transcribe-whisper-large-v3-turbo',
  'transcribe-whisper-large-v3-turbo-split',
  'transcribe-whisper-medium',
  'transcribe-whisper-small',
  'transcribe-whisper-split',
  'transcribe-whisper-tiny',
  'tts-elevenlabs-eleven_flash_v2_5',
  'tts-elevenlabs-eleven_turbo_v2_5',
  'tts-elevenlabs-eleven_v3',
  'tts-gemini-gemini-2.5-flash-preview-tts',
  'tts-gemini-gemini-2.5-pro-preview-tts',
  'tts-groq-canopylabs/orpheus-v1-english',
  'tts-kitten-micro',
  'tts-kitten-mini',
  'tts-kitten-nano',
  'tts-kitten-nano-0.8-int8',
  'tts-minimax-speech-2.8-hd',
  'tts-minimax-speech-2.8-turbo',
  'tts-openai-gpt-4o-mini-tts',
  'video-gemini-veo-3.1-fast-generate-preview',
  'video-gemini-veo-3.1-generate-preview',
  'video-minimax-MiniMax-Hailuo-02',
  'video-minimax-MiniMax-Hailuo-2.3',
  'video-minimax-T2V-01',
  'video-minimax-T2V-01-Director',
  'video-sora-sora-2',
  'video-sora-sora-2-pro',
  'write-anthropic-claude-opus-4-6',
  'write-anthropic-claude-sonnet-4-6',
  'write-gemini-gemini-3-flash-preview',
  'write-gemini-gemini-3-pro-preview',
  'write-groq-openai/gpt-oss-120b',
  'write-groq-openai/gpt-oss-20b',
  'write-llama-gemma-3-270m',
  'write-llama-qwen3-0.6b',
  'write-llama-qwen3-0.6b-document',
  'write-minimax-MiniMax-M2.5',
  'write-minimax-MiniMax-M2.5-highspeed',
  'write-openai-gpt-5.1',
  'write-openai-gpt-5.2',
  'write-openai-gpt-5.2-pro',
].sort()

describe('test runner price selection', () => {
  test('resolves explicit file selection to file-mapped price commands', async () => {
    const resolved = resolvePriceSelection(
      await listAllTestFiles(),
      ['test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts']
    )

    expect(resolved.suiteName).toBe('Selected paths: step-4-tts-e2e/tts-local/kitten-tts.test.ts')
    expect(resolved.commands.map(command => command.key).sort()).toEqual([
      'tts-kitten-micro',
      'tts-kitten-mini',
      'tts-kitten-nano',
      'tts-kitten-nano-0.8-int8',
    ])
  })

  test('resolves directory selection to the union of matching commands', async () => {
    const resolved = resolvePriceSelection(
      await listAllTestFiles(),
      ['test/test-cases/e2e/step-3-write-e2e/write-services/openai/']
    )

    expect(resolved.suiteName).toBe('Selected paths: step-3-write-e2e/write-services/openai')
    expect(resolved.commands.map(command => command.key).sort()).toEqual([
      'write-openai-gpt-5.1',
      'write-openai-gpt-5.2',
      'write-openai-gpt-5.2-pro',
    ])
  })

  test('resolves mixed path selection without reintroducing tier semantics', async () => {
    const resolved = resolvePriceSelection(
      await listAllTestFiles(),
      [
        'test/test-cases/e2e/step-3-write-e2e/write-services/openai/',
        'test/test-cases/e2e/step-2-transcribe-e2e/transcribe-local/whisper/whisper-models-price.test.ts',
      ]
    )

    expect(resolved.suiteName).toBe('Selected paths: step-3-write-e2e/write-services/openai, step-2-transcribe-e2e/transcribe-local/whisper/whisper-models-price.test.ts')
    expect(resolved.commands.map(command => command.key).sort()).toEqual([
      'transcribe-whisper-base',
      'transcribe-whisper-large-v3-turbo',
      'transcribe-whisper-medium',
      'transcribe-whisper-small',
      'transcribe-whisper-tiny',
      'write-openai-gpt-5.1',
      'write-openai-gpt-5.2',
      'write-openai-gpt-5.2-pro',
    ])
  })

  test('returns an empty selection for mappedless paths that still match tests', async () => {
    const resolved = resolvePriceSelection(
      await listAllTestFiles(),
      ['test/test-cases/validation/']
    )

    expect(resolved.suiteName).toBe('Selected paths: validation')
    expect(resolved.commands).toEqual([])
  })

  test('filters report-only commands out of budget preflight selection', async () => {
    const resolved = resolvePriceSelection(
      await listAllTestFiles(),
      ['test/test-cases/e2e/api-cheap.test.ts'],
      true
    )

    expect(resolved.suiteName).toBe('Selected paths: api-cheap.test.ts')
    expect(resolved.commands).toEqual([])
  })

  test('registry budget keys stay aligned with the supported budget skip surface', () => {
    expect(uniqueBudgetKeys).toEqual(EXPECTED_BUDGET_KEYS)
  })
})
