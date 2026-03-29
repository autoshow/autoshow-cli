import { describe, expect, test } from 'bun:test'
import { shouldSkipBudgetKey } from '../../test-utils/budget'

describe('budget helper', () => {
  test('returns true for configured skip keys', () => {
    const previous = process.env['AUTOSHOW_TEST_BUDGET_SKIP_KEYS']
    process.env['AUTOSHOW_TEST_BUDGET_SKIP_KEYS'] = JSON.stringify(['write-openai-gpt-5.4'])
    try {
      expect(shouldSkipBudgetKey('write-openai-gpt-5.4')).toBe(true)
      expect(shouldSkipBudgetKey('write-openai-gpt-5.4-mini')).toBe(false)
    } finally {
      if (previous === undefined) {
        delete process.env['AUTOSHOW_TEST_BUDGET_SKIP_KEYS']
      } else {
        process.env['AUTOSHOW_TEST_BUDGET_SKIP_KEYS'] = previous
      }
    }
  })

  test('returns false when env json is invalid', () => {
    const previous = process.env['AUTOSHOW_TEST_BUDGET_SKIP_KEYS']
    process.env['AUTOSHOW_TEST_BUDGET_SKIP_KEYS'] = 'not-json'
    try {
      expect(shouldSkipBudgetKey('write-openai-gpt-5.4')).toBe(false)
    } finally {
      if (previous === undefined) {
        delete process.env['AUTOSHOW_TEST_BUDGET_SKIP_KEYS']
      } else {
        process.env['AUTOSHOW_TEST_BUDGET_SKIP_KEYS'] = previous
      }
    }
  })
})
