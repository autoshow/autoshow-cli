import { test, expect, beforeAll, afterAll } from 'bun:test'
import { E2E_TEST_TIMEOUT_MS } from './budget'
import { runCommand, findLatestDirectory, cleanupTestOutput, hasConfiguredEnvVar } from './test-helpers'
import { stripAnsi } from '~/utils/terminal-colors'

const RUNWAY_INSUFFICIENT_CREDITS_MESSAGE = 'You do not have enough credits to run this task.'

const hasGlmSignal = (output: string): boolean =>
  /\bGLM\b/i.test(output)
  || /\bglm[-_](?:reader|ocr|llm|image|stt)\b/i.test(output)
  || /\bZ\.?AI\b/i.test(output)
  || /\bapi\.z\.ai\b/i.test(output)
  || /\bpaas\/v4\b/i.test(output)

const isGlmAccountAvailabilityFailure = (output: string): boolean => {
  if (!hasGlmSignal(output)) return false
  return (
    /\b1113\b/.test(output) ||
    /insufficient\s+(?:account\s+)?balance/i.test(output) ||
    /balance\s+(?:is\s+)?(?:not\s+enough|insufficient)/i.test(output) ||
    /not\s+enough\s+balance/i.test(output) ||
    /no\s+(?:available\s+)?resource\s+package/i.test(output) ||
    /resource\s+package.{0,80}(?:not\s+found|unavailable|expired|exhausted|insufficient)/i.test(output)
  )
}

const isGlmReaderRateLimitFailure = (output: string): boolean =>
  /GLM Reader request failed \(429\b/i.test(output)
  || /\bglm-reader\b[\s\S]{0,240}(?:\b429\b|too many requests|rate limit)/i.test(output)

const isGlmImageRateLimitFailure = (output: string): boolean =>
  /GLM image generation failed \(429\b/i.test(output)
  || /\bglm[-_ ]image\b[\s\S]{0,240}(?:\b429\b|too many requests|rate limit)/i.test(output)

const isGlmRetryable429Exhaustion = (output: string): boolean =>
  /retryable status 429/i.test(output)
  && (/\bglm-(?:ocr|llm)\b/i.test(output) || /GLM (?:OCR|model)/i.test(output))
  && (/\bfailed after \d+(?:\/\d+)? attempts\b/i.test(output) || /\bCommand failed\b/i.test(output))

const isDeepInfraWhisperLargeV3CommandTimeout = (output: string): boolean =>
  /\bdeepinfra\b/i.test(output)
  && /openai\/whisper-large-v3(?!-turbo)\b/i.test(output)
  && (
    /\bcommand\b[\s\S]{0,120}\btimed?\s*out\b/i.test(output) ||
    /\bsubprocess\b[\s\S]{0,120}\btimed?\s*out\b/i.test(output) ||
    /\btimed?\s*out\b/i.test(output) ||
    /\btimeout\b/i.test(output) ||
    /\bSIGTERM\b/i.test(output) ||
    /\bexit(?:ed)?(?:\s+with)?(?:\s+code)?\s*(?:143|-15)\b/i.test(output)
  )

export const classifySkippableLiveProviderFailure = (output: string): string | null => {
  const cleanOutput = stripAnsi(output)
  if (cleanOutput.includes(RUNWAY_INSUFFICIENT_CREDITS_MESSAGE)) {
    return 'Runway account does not have enough credits to run this task'
  }
  if (isGlmAccountAvailabilityFailure(cleanOutput)) {
    return 'GLM account does not have enough balance or an active resource package'
  }
  if (isGlmReaderRateLimitFailure(cleanOutput)) {
    return 'GLM Reader is rate limited'
  }
  if (isGlmImageRateLimitFailure(cleanOutput)) {
    return 'GLM image generation is rate limited'
  }
  if (isGlmRetryable429Exhaustion(cleanOutput)) {
    return 'GLM provider remained rate limited after retries'
  }
  if (isDeepInfraWhisperLargeV3CommandTimeout(cleanOutput)) {
    return 'DeepInfra openai/whisper-large-v3 transcription timed out'
  }
  return null
}

export const withOutputLifecycle = (
  title: string,
  setup?: (() => Promise<void>) | undefined
): void => {
  beforeAll(async () => {
    if (setup) {
      await setup()
    }
    await cleanupTestOutput(title)
  })

  afterAll(async () => {
    await cleanupTestOutput(title)
  })
}

export const defineInvalidModelTest = (name: string, args: string[]): void => {
  test(name, async () => {
    const result = await runCommand(args)
    expect(result.exitCode).not.toBe(0)
  }, E2E_TEST_TIMEOUT_MS)
}

export const definePriceEstimateTest = (
  _budgetKey: string,
  name: string,
  args: string[]
): void => {
  test(name, async () => {
    const result = await runCommand(args)
    expect(result.exitCode).toBe(0)
  }, E2E_TEST_TIMEOUT_MS)
}

export const shouldSkipMissingEnv = async (
  envVarKey: string,
  skipMessage: string
): Promise<boolean> => {
  if (!await hasConfiguredEnvVar(envVarKey)) {
    console.log(`Skipping: ${skipMessage}`)
    return true
  }
  return false
}

export const runCommandAndExpectOutputDir = async (
  title: string,
  args: string[]
): Promise<string | null> => {
  const result = await runCommand(args)
  const combinedOutput = `${result.stdout}\n${result.stderr}`
  if (result.exitCode !== 0) {
    const skipReason = classifySkippableLiveProviderFailure(combinedOutput)
    if (skipReason) {
      console.log(`Skipping: ${skipReason}`)
      return null
    }
  }

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(title)
  expect(outputDir).not.toBeNull()
  return outputDir
}
