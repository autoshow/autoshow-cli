import { describe, test, expect } from 'bun:test'
import type { Tier } from '~/types/tests-dir-types'
import { TIER_RULES } from '../../test-runner/constants'

const getTierForFile = (file: string): Tier => {
  for (const [prefix, tier] of TIER_RULES) {
    if (file.startsWith(prefix)) {
      return tier
    }
  }
  return 'smoke'
}

describe('test runner tier routing', () => {
  test('routes API-backed transcribe and tts suites to api tier', () => {
    const apiFiles = [
      'test/test-cases/e2e/step-2-transcribe-e2e/assemblyai/assemblyai-models.test.ts',
      'test/test-cases/e2e/step-4-tts-e2e/openai-tts.test.ts',
      'test/test-cases/e2e/step-4-tts-e2e/gemini-tts.test.ts',
      'test/test-cases/e2e/step-4-tts-e2e/groq-tts.test.ts',
      'test/test-cases/e2e/step-4-tts-e2e/minimax-tts.test.ts',
      'test/test-cases/e2e/step-4-tts-e2e/kitten-tts-pipeline.test.ts',
      'test/test-cases/e2e/step-2-extract-e2e/extract-mistral-ocr.test.ts',
    ]

    for (const file of apiFiles) {
      expect(getTierForFile(file)).toBe('api')
    }
  })

  test('routes heavy local-only tests to slow-local tier', () => {
    const slowLocalFiles = [
      'test/test-cases/e2e/step-2-extract-e2e/extract-paddle-ocr-image.test.ts',
      'test/test-cases/e2e/step-3-write-e2e/llama/llama-qwen.test.ts',
      'test/test-cases/e2e/step-2-transcribe-e2e/reverb/reverb.test.ts',
      'test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-large-v3-turbo.test.ts',
    ]

    for (const file of slowLocalFiles) {
      expect(getTierForFile(file)).toBe('slow-local')
    }
  })

  test('routes network-dependent slow tests to slow-api tier', () => {
    const slowApiFiles = [
      'test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming.test.ts',
      'test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel.test.ts',
      'test/test-cases/e2e/step-1-download-e2e/twitch.test.ts',
      'test/test-cases/e2e/step-1-download-e2e/input-2-urls.test.ts',
      'test/test-cases/e2e/step-0-setup-e2e/llama-models.test.ts',
    ]

    for (const file of slowApiFiles) {
      expect(getTierForFile(file)).toBe('slow-api')
    }
  })

  test('routes local-only tests to local tier', () => {
    const localFiles = [
      'test/test-cases/e2e/step-4-tts-e2e/kitten-tts.test.ts',
      'test/test-cases/e2e/step-3-write-e2e/llama/llama-models.test.ts',
      'test/test-cases/e2e/step-3-write-e2e/llama/llama-smoke.test.ts',
    ]

    for (const file of localFiles) {
      expect(getTierForFile(file)).toBe('local')
    }
  })
})
