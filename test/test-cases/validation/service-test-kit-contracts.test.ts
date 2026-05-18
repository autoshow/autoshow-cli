import { describe, expect, test } from 'bun:test'
import { classifySkippableLiveProviderFailure } from '../../test-utils/service-test-kit'

describe('classifySkippableLiveProviderFailure', () => {
  test('classifies known live-provider availability failures', () => {
    const cases: Array<{ output: string; expected: string }> = [
      {
        output: '\x1b[31mYou do not have enough credits to run this task.\x1b[0m',
        expected: 'Runway account does not have enough credits to run this task'
      },
      {
        output: 'Failed to run GLM model: {"code":"1113","message":"insufficient balance"}',
        expected: 'GLM account does not have enough balance or an active resource package'
      },
      {
        output: 'GLM Reader request failed (429 Too Many Requests): rate limit exceeded',
        expected: 'GLM Reader is rate limited'
      },
      {
        output: 'GLM image generation failed (429): Too Many Requests',
        expected: 'GLM image generation is rate limited'
      },
      {
        output: 'Retry Attempt\noperation glm-ocr reason retryable status 429\nCommand failed: glm-ocr failed after 4/4 attempts',
        expected: 'GLM provider remained rate limited after retries'
      },
      {
        output: 'Retry Attempt\noperation glm-llm reason retryable status 429\nFailed to run GLM model: glm-llm failed after 2/2 attempts',
        expected: 'GLM provider remained rate limited after retries'
      },
      {
        output: 'DeepInfra target openai/whisper-large-v3 command timed out after 300000ms',
        expected: 'DeepInfra openai/whisper-large-v3 transcription timed out'
      }
    ]

    for (const { output, expected } of cases) {
      expect(classifySkippableLiveProviderFailure(output)).toBe(expected)
    }
  })

  test('does not classify unrelated failures or the DeepInfra turbo model', () => {
    expect(classifySkippableLiveProviderFailure('GLM validation failed because output was malformed')).toBeNull()
    expect(classifySkippableLiveProviderFailure('command timed out for openai/whisper-large-v3')).toBeNull()
    expect(classifySkippableLiveProviderFailure('DeepInfra openai/whisper-large-v3 completed')).toBeNull()
    expect(classifySkippableLiveProviderFailure('DeepInfra openai/whisper-large-v3-turbo command timed out')).toBeNull()
  })
})
