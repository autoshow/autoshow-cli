import type { RetryDecision } from '~/types'
import { classifyFetchRetry } from '~/utils/retries'

const parseStatusFromGeminiError = (error: unknown): number | undefined => {
  if (error && typeof error === 'object') {
    if ('status' in error && typeof error.status === 'number') {
      return error.status
    }
    if ('code' in error && typeof error.code === 'number') {
      return error.code
    }
  }

  if (error instanceof Error) {
    const codeMatch = /"code"\s*:\s*(\d{3})/.exec(error.message)
    if (codeMatch) {
      const parsed = Number.parseInt(codeMatch[1] as string, 10)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return undefined
}

export const classifyGeminiRetry = (error: unknown): RetryDecision => {
  const decision = classifyFetchRetry(error, 'runtime_http_create_conservative')
  if (decision.shouldRetry) {
    return decision
  }

  const status = parseStatusFromGeminiError(error)
  if (status !== undefined && (status === 408 || status === 425 || status === 429 || status >= 500)) {
    return {
      shouldRetry: true,
      delayMs: 0,
      reason: `retryable status ${status}`
    }
  }

  return decision
}
