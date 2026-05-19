import { readPositiveIntegerEnv } from '~/utils/timeouts'

export const DEFAULT_E2E_TEST_TIMEOUT_MS = 2 * 60 * 60_000
export const E2E_TEST_TIMEOUT_MS = readPositiveIntegerEnv(
  'AUTOSHOW_E2E_TEST_TIMEOUT_MS',
  DEFAULT_E2E_TEST_TIMEOUT_MS
)
