import { test, expect, beforeAll } from 'bun:test'
import { E2E_TEST_TIMEOUT_MS } from './budget'
import {
  runCommand,
  findLatestDirectory,
  readConfiguredEnvVar,
  type RunCommandOptions
} from './test-helpers'
import { stripAnsi } from '~/utils/terminal-colors'

const RUNWAY_INSUFFICIENT_CREDITS_MESSAGE = 'You do not have enough credits to run this task.'

const hasGlmSignal = (output: string): boolean =>
  /\bGLM\b/i.test(output)
  || /\bglm[-_](?:reader|ocr|llm|stt)\b/i.test(output)
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

const isGlmCertificateExpiryFailure = (output: string): boolean =>
  hasGlmSignal(output)
  && (
    /\bcertificate\s+(?:has\s+)?expired\b/i.test(output) ||
    /\bCERT_HAS_EXPIRED\b/i.test(output)
  )

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

const GEMINI_IMAGE_TEMP_STATUS_PATTERN = '\\b(?:429|500|502|503|504)\\b'

const hasGeminiImageSignal = (output: string): boolean =>
  /\bgemini\b/i.test(output)
  && (
    /\bgemini-image(?:-generate)?\b/i.test(output)
    || /\bGemini image\b/i.test(output)
    || /\bgemini-[\w.\-]+-image-preview\b/i.test(output)
  )

const isGeminiImageAvailabilityFailure = (output: string): boolean => {
  if (!hasGeminiImageSignal(output)) return false

  const statusPattern = new RegExp(`(?:Gemini API request failed with status|retryable status|status)\\s+${GEMINI_IMAGE_TEMP_STATUS_PATTERN}`, 'i')
  if (statusPattern.test(output)) return true

  return new RegExp(`${GEMINI_IMAGE_TEMP_STATUS_PATTERN}[\\s\\S]{0,160}(?:service unavailable|temporar(?:y|ily) unavailable|rate limit|rate limited|gateway|backend)`, 'i').test(output)
}

const hasBflImageSignal = (output: string): boolean =>
  /\bBFL\b/i.test(output)
  || /\bbfl-image\b/i.test(output)
  || /\bflux-2-/i.test(output)

const isBflResultDownloadAvailabilityFailure = (output: string): boolean => {
  if (!hasBflImageSignal(output)) return false
  if (/BFL image result download failed \(504\)/i.test(output)) return true
  if (
    /\bbfl-image-result-download\b[\s\S]{0,240}\bfailed after \d+\/\d+ attempts\b/i.test(output)
    && /(?:max attempts reached|retryable status 504|gateway timeout|network error|abort\/timeout)/i.test(output)
  ) {
    return true
  }
  return /\bbfl-image-result-download\b[\s\S]{0,240}(?:retryable status 504|status 504|gateway timeout|network error|abort\/timeout)/i.test(output)
}

export const classifyLiveProviderAvailabilityFailure = (output: string): string | null => {
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
  if (isGlmCertificateExpiryFailure(cleanOutput)) {
    return 'GLM provider TLS certificate has expired'
  }
  if (isGlmRetryable429Exhaustion(cleanOutput)) {
    return 'GLM provider remained rate limited after retries'
  }
  if (isDeepInfraWhisperLargeV3CommandTimeout(cleanOutput)) {
    return 'DeepInfra openai/whisper-large-v3 transcription timed out'
  }
  if (isGeminiImageAvailabilityFailure(cleanOutput)) {
    return 'Gemini image provider is temporarily unavailable or rate limited'
  }
  if (isBflResultDownloadAvailabilityFailure(cleanOutput)) {
    return 'BFL image result download hit a transient provider availability failure'
  }
  return null
}

export const withOutputLifecycle = (
  _title: string,
  setup?: (() => Promise<void>) | undefined
): void => {
  beforeAll(async () => {
    if (setup) {
      await setup()
    }
  })
}

export const defineInvalidModelTest = (name: string, args: string[]): void => {
  test(name, async () => {
    const result = await runCommand(args)
    expect(result.exitCode).not.toBe(0)
  }, E2E_TEST_TIMEOUT_MS)
}

export const requireConfiguredValue = <T>(
  value: T | null | undefined,
  message: string
): NonNullable<T> => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length > 0) {
      return trimmed as NonNullable<T>
    }
  } else if (value !== null && value !== undefined) {
    return value as NonNullable<T>
  }

  throw new Error(message)
}

export const requireConfiguredEnvVar = async (
  envVarKey: string,
  message = `${envVarKey} is required`
): Promise<string> => {
  const value = await readConfiguredEnvVar(envVarKey)
  return requireConfiguredValue(value, message)
}

export const requireConfiguredEnvVars = async (
  envVarKeys: readonly string[],
  message?: string
): Promise<Record<string, string>> => {
  const values: Record<string, string> = {}
  const missing: string[] = []

  for (const envVarKey of envVarKeys) {
    const value = await readConfiguredEnvVar(envVarKey)
    if (value) {
      values[envVarKey] = value
    } else {
      missing.push(envVarKey)
    }
  }

  if (missing.length > 0) {
    throw new Error(message ?? `${missing.join(', ')} required`)
  }

  return values
}

const COMMAND_FAILURE_TAIL_LINES = 80

const formatCommandArg = (arg: string): string =>
  /^[A-Za-z0-9_./:=@+-]+$/.test(arg) ? arg : JSON.stringify(arg)

const tailLines = (text: string, lineCount: number): string => {
  const trimmed = text.trimEnd()
  if (trimmed.length === 0) return '(empty)'
  return trimmed.split(/\r?\n/).slice(-lineCount).join('\n')
}

export const formatCommandFailureDiagnostics = (
  args: string[],
  result: { exitCode: number, stdout: string, stderr: string },
  lineCount = COMMAND_FAILURE_TAIL_LINES
): string => [
  `Command failed with exit code ${result.exitCode}: bun ${args.map(formatCommandArg).join(' ')}`,
  `--- stdout tail (${lineCount} lines) ---`,
  tailLines(result.stdout, lineCount),
  `--- stderr tail (${lineCount} lines) ---`,
  tailLines(result.stderr, lineCount)
].join('\n')

export const runCommandAndExpectOutputDir = async (
  title: string,
  args: string[],
  opts?: RunCommandOptions
): Promise<string> => {
  const result = await runCommand(args, opts)
  const combinedOutput = `${result.stdout}\n${result.stderr}`
  if (result.exitCode !== 0) {
    const availabilityReason = classifyLiveProviderAvailabilityFailure(combinedOutput)
    const diagnostics = formatCommandFailureDiagnostics(args, result)
    if (availabilityReason) {
      throw new Error(`Live provider availability failure: ${availabilityReason}\n${diagnostics}`)
    }
    throw new Error(diagnostics)
  }

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(title, result.outputRoot)
  if (!outputDir) {
    throw new Error(`Expected output directory for ${title}`)
  }
  return outputDir
}
