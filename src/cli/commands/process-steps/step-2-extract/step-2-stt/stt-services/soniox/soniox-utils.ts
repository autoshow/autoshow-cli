import type { RetryClass, SonioxHttpError } from '~/types'

export type SonioxStage = NonNullable<SonioxHttpError['stage']>
export type SonioxRequestMetrics = {
  onRequest?: (() => void) | undefined
  onRetry?: ((status: number | undefined) => void) | undefined
}

export const getSonioxErrorStatus = (error: unknown): number | undefined =>
  error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined

export const toSonioxHttpError = (
  stage: SonioxStage,
  retryClass: RetryClass,
  response: Response,
  errText: string
): SonioxHttpError => Object.assign(
  new Error(`Soniox ${stage} failed (${response.status}): ${errText}`),
  {
    status: response.status,
    headers: response.headers,
    stage,
    retryClass
  }
)

export const attachSonioxErrorContext = (
  error: unknown,
  stage: SonioxStage,
  retryClass: RetryClass
): never => {
  if (error instanceof Error && error.cause instanceof Error) {
    ;(error.cause as SonioxHttpError).stage = stage
    ;(error.cause as SonioxHttpError).retryClass = retryClass
    throw error.cause
  }

  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as SonioxHttpError).stage = stage
  ;(source as SonioxHttpError).retryClass = retryClass
  throw source
}

export const attachSonioxValidationContext = (
  error: unknown,
  stage: SonioxStage,
  retryClass: RetryClass,
  rawResponse: unknown
): never => {
  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as SonioxHttpError).stage = stage
  ;(source as SonioxHttpError).retryClass = retryClass
  ;(source as SonioxHttpError).rawResponse = rawResponse
  throw source
}

export const buildSonioxPollingDeadlineError = (
  transcriptionId: string,
  pollDeadlineMs: number
): never => {
  const error = Object.assign(
    new Error(`Soniox timed out waiting for transcription completion for ${transcriptionId} (deadline exceeded after ${pollDeadlineMs}ms)`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

export const buildSonioxResumeProbeError = (
  transcriptionId: string,
  probeCount: number,
  totalWaitMs: number
): never => {
  const error = Object.assign(
    new Error(`Soniox transcription ${transcriptionId} is still pending after ${probeCount} resume status checks (${totalWaitMs}ms total backoff). Retry the command later.`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}
