import { describe, expect, test } from 'bun:test'
import { classifyLiveProviderAvailabilityFailure, formatCommandFailureDiagnostics } from '../../test-utils/service-test-kit'

describe('classifyLiveProviderAvailabilityFailure', () => {
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
        output: 'glm/glm-ocr: certificate has expired',
        expected: 'GLM provider TLS certificate has expired'
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
      },
      {
        output: 'Retry Attempt\noperation gemini-image-generate\nreason retryable status 503\nFailed to run Gemini image model imagen-4.0-generate-001: gemini-image-generate failed after 3/3 attempts (max attempts reached, 2100ms elapsed)\nGemini API request failed with status 503: service unavailable',
        expected: 'Gemini image provider is temporarily unavailable or rate limited'
      },
      {
        output: 'gemini/imagen-4.0-ultra-generate-001 Gemini API request failed with status 429: Resource exhausted',
        expected: 'Gemini image provider is temporarily unavailable or rate limited'
      },
      {
        output: 'BFL image result download failed (504)',
        expected: 'BFL image result download hit a transient provider availability failure'
      },
      {
        output: 'Retry Attempt\noperation bfl-image-result-download\nreason retryable status 504\nflux-2-flex bfl-image-result-download failed after 4/4 attempts (max attempts reached, 4200ms elapsed)',
        expected: 'BFL image result download hit a transient provider availability failure'
      }
    ]

    for (const { output, expected } of cases) {
      expect(classifyLiveProviderAvailabilityFailure(output)).toBe(expected)
    }
  })

  test('does not classify unrelated failures or the DeepInfra turbo model', () => {
    expect(classifyLiveProviderAvailabilityFailure('GLM validation failed because output was malformed')).toBeNull()
    expect(classifyLiveProviderAvailabilityFailure('command timed out for openai/whisper-large-v3')).toBeNull()
    expect(classifyLiveProviderAvailabilityFailure('DeepInfra openai/whisper-large-v3 completed')).toBeNull()
    expect(classifyLiveProviderAvailabilityFailure('DeepInfra openai/whisper-large-v3-turbo command timed out')).toBeNull()
    expect(classifyLiveProviderAvailabilityFailure('Gemini image validation failed because output was malformed')).toBeNull()
    expect(classifyLiveProviderAvailabilityFailure('Failed to run Gemini model: Gemini API request failed with status 503')).toBeNull()
    expect(classifyLiveProviderAvailabilityFailure('Gemini API request failed with status 400 for imagen-4.0-generate-001: invalid prompt')).toBeNull()
    expect(classifyLiveProviderAvailabilityFailure('BFL image request failed (400): invalid prompt')).toBeNull()
    expect(classifyLiveProviderAvailabilityFailure('flux-2-flex bfl-image-result-download failed after 2/4 attempts (non-retryable status 400, 1200ms elapsed)')).toBeNull()
  })
})

describe('formatCommandFailureDiagnostics', () => {
  test('prints a compact command, stdout tail, and stderr tail', () => {
    const output = formatCommandFailureDiagnostics(
      ['src/cli/create-cli.ts', 'video', 'A serene mountain landscape', '--runway', 'gen4.5'],
      {
        exitCode: 1,
        stdout: ['stdout 1', 'stdout 2', 'stdout 3'].join('\n'),
        stderr: ['stderr 1', 'stderr 2', 'stderr 3'].join('\n')
      },
      2
    )

    expect(output).toContain('Command failed with exit code 1: bun src/cli/create-cli.ts video "A serene mountain landscape" --runway gen4.5')
    expect(output).toContain('--- stdout tail (2 lines) ---\nstdout 2\nstdout 3')
    expect(output).toContain('--- stderr tail (2 lines) ---\nstderr 2\nstderr 3')
    expect(output).not.toContain('stdout 1')
    expect(output).not.toContain('stderr 1')
  })
})
