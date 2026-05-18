import { writeFile } from '~/utils/cli-utils'
import type { OcrProviderFailureSummary } from '~/types'
import { extractErrorMetadata, serializeDiagnosticError } from '~/utils/error-handler'

export class OcrStructuredResponseError extends Error {
  rawResponse: string

  constructor(message: string, rawResponse: string) {
    super(message)
    this.name = 'OcrStructuredResponseError'
    this.rawResponse = rawResponse
  }
}

export const findOcrStructuredResponseError = (
  error: unknown
): OcrStructuredResponseError | undefined => {
  const seen = new Set<unknown>()
  let current: unknown = error
  while (current instanceof Error && !seen.has(current)) {
    if (current instanceof OcrStructuredResponseError) {
      return current
    }
    seen.add(current)
    current = current.cause
  }
  return undefined
}

export const writeInvalidOcrStructuredResponse = async (
  providerDir: string,
  error: unknown
): Promise<'invalid-structured-response.txt' | undefined> => {
  const structuredError = findOcrStructuredResponseError(error)
  if (!structuredError) {
    return undefined
  }

  await writeFile(`${providerDir}/invalid-structured-response.txt`, structuredError.rawResponse)
  await writeFile(`${providerDir}/invalid-structured-response.json`, JSON.stringify({
    error: structuredError.message,
    rawResponseFile: 'invalid-structured-response.txt'
  }, null, 2))
  return 'invalid-structured-response.txt'
}

export const writeOcrProviderError = async (
  providerDir: string,
  error: unknown,
  failure: OcrProviderFailureSummary
): Promise<Pick<OcrProviderFailureSummary, 'errorFile' | 'rawResponseFile'>> => {
  let rawResponseFile: OcrProviderFailureSummary['rawResponseFile'] = await writeInvalidOcrStructuredResponse(providerDir, error)
  const metadata = extractErrorMetadata(error)
  const rawResponse = metadata['rawResponse'] ?? metadata['body']
  if (rawResponseFile === undefined && rawResponse !== undefined) {
    rawResponseFile = 'raw-response.json'
    await writeFile(`${providerDir}/${rawResponseFile}`, JSON.stringify(serializeDiagnosticError(rawResponse), null, 2))
  }
  await writeFile(`${providerDir}/error.json`, JSON.stringify({
    message: failure.message,
    category: failure.category,
    ...(failure.stage ? { stage: failure.stage } : {}),
    ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
    ...(typeof failure.retryAfterMs === 'number' ? { retryAfterMs: failure.retryAfterMs } : {}),
    ...(rawResponseFile ? { rawResponseFile } : {}),
    error: serializeDiagnosticError(error)
  }, null, 2))
  return {
    errorFile: 'error.json',
    ...(rawResponseFile ? { rawResponseFile } : {})
  }
}
