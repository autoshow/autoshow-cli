import { writeFile } from '~/utils/cli-utils'

export class OcrStructuredResponseError extends Error {
  rawResponse: string
  retryable = true

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
): Promise<void> => {
  const structuredError = findOcrStructuredResponseError(error)
  if (!structuredError) {
    return
  }

  await writeFile(`${providerDir}/invalid-structured-response.txt`, structuredError.rawResponse)
  await writeFile(`${providerDir}/invalid-structured-response.json`, JSON.stringify({
    error: structuredError.message,
    rawResponseFile: 'invalid-structured-response.txt'
  }, null, 2))
}
