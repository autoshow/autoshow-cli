const DEFAULT_E2E_TEST_TIMEOUT_MS = 2 * 60 * 60_000

const readPositiveIntegerEnv = (key: string, fallback: number): number => {
  const raw = process.env[key]?.trim()
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const E2E_TEST_TIMEOUT_MS = readPositiveIntegerEnv(
  'AUTOSHOW_E2E_TEST_TIMEOUT_MS',
  DEFAULT_E2E_TEST_TIMEOUT_MS
)
