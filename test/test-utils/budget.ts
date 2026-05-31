import { test } from 'bun:test'
import { E2E_TEST_TIMEOUT_MS } from './timeouts'

export { E2E_TEST_TIMEOUT_MS } from './timeouts'

const parseBudgetSkipKeys = (): Set<string> => {
  const raw = process.env['AUTOSHOW_TEST_BUDGET_SKIP_KEYS']
  if (!raw || raw.trim().length === 0) {
    return new Set()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return new Set()
  }

  if (!Array.isArray(parsed)) {
    return new Set()
  }

  const keys = parsed.filter((value): value is string => typeof value === 'string' && value.length > 0)
  return new Set(keys)
}

type BudgetKeyInput = string | readonly string[]

const normalizeBudgetKeys = (budgetKey: BudgetKeyInput): readonly string[] => {
  return typeof budgetKey === 'string' ? [budgetKey] : budgetKey
}

export const shouldSkipBudgetKeys = (budgetKey: BudgetKeyInput): boolean => {
  const skipKeys = parseBudgetSkipKeys()
  return normalizeBudgetKeys(budgetKey).some((key) => skipKeys.has(key))
}

export const budgetedTest = (
  budgetKey: BudgetKeyInput,
  name: string,
  fn: () => void | Promise<void>,
  timeoutMs: number = E2E_TEST_TIMEOUT_MS
): void => {
  if (shouldSkipBudgetKeys(budgetKey)) {
    test.skip(name, fn)
    return
  }
  test(name, fn, timeoutMs)
}

export const budgetedTestIf = (
  enabled: boolean,
  budgetKey: BudgetKeyInput,
  name: string,
  fn: () => void | Promise<void>,
  timeoutMs: number = E2E_TEST_TIMEOUT_MS
): void => {
  if (!enabled || shouldSkipBudgetKeys(budgetKey)) {
    test.skip(name, fn)
    return
  }
  test(name, fn, timeoutMs)
}
