export type RetryClass =
  | 'setup_download'
  | 'runtime_subprocess_transient'
  | 'runtime_http_read'
  | 'runtime_http_create_conservative'
  | 'runtime_poll_loop'

export type RetryPolicy = {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  jitter: boolean
  exponential: boolean
}

export type RetryContext = {
  retryClass: RetryClass
  operationName: string
  policy?: Partial<RetryPolicy>
}

export type RetryDecision = {
  shouldRetry: boolean
  delayMs: number
  reason: string
}

export type PollOptions<T> = {
  operationName: string
  pollFn: () => Promise<T>
  isDone: (result: T) => boolean
  isFailed?: (result: T) => { failed: true, reason: string } | { failed: false }
  intervalMs: number
  deadlineMs: number
}
