export const readPositiveIntegerEnv = (key: string, fallback: number): number => {
  const raw = process.env[key]?.trim()
  if (!raw || !/^\d+$/.test(raw)) {
    return fallback
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return fallback
  }

  return parsed
}

export const DEFAULT_MEDIA_GENERATION_TIMEOUT_MS = 10 * 60_000
export const MEDIA_GENERATION_TIMEOUT_MS = readPositiveIntegerEnv(
  'AUTOSHOW_MEDIA_GENERATION_TIMEOUT_MS',
  DEFAULT_MEDIA_GENERATION_TIMEOUT_MS
)

export const DEFAULT_LLM_REQUEST_TIMEOUT_MS = 30 * 60_000
export const LLM_REQUEST_TIMEOUT_MS = readPositiveIntegerEnv(
  'AUTOSHOW_LLM_REQUEST_TIMEOUT_MS',
  DEFAULT_LLM_REQUEST_TIMEOUT_MS
)

export const DEFAULT_OCR_REQUEST_TIMEOUT_MS = 30 * 60_000
export const OCR_REQUEST_TIMEOUT_MS = readPositiveIntegerEnv(
  'AUTOSHOW_OCR_REQUEST_TIMEOUT_MS',
  DEFAULT_OCR_REQUEST_TIMEOUT_MS
)

export const DEFAULT_LINKS_FETCH_TIMEOUT_MS = 60_000
export const LINKS_FETCH_TIMEOUT_MS = readPositiveIntegerEnv(
  'AUTOSHOW_LINKS_FETCH_TIMEOUT_MS',
  DEFAULT_LINKS_FETCH_TIMEOUT_MS
)
