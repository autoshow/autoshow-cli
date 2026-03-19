import { test } from 'bun:test'

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

export const shouldSkipBudgetKey = (key: string): boolean => {
  return parseBudgetSkipKeys().has(key)
}

export const budgetedTest = (
  budgetKey: string,
  name: string,
  fn: () => void | Promise<void>
): void => {
  if (shouldSkipBudgetKey(budgetKey)) {
    test.skip(name, fn)
    return
  }
  test(name, fn)
}
