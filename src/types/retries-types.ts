import type { RetryDecision } from './retry-types'

export type ClassifyFetchRetryOptions = {
  retryAbortOnConservative?: boolean
}

export type RetryClassifier = (error: unknown) => RetryDecision
