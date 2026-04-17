import { describe, expect, test } from 'bun:test'
import { computeBilledSttCost, resolveBilledSttDurationSeconds } from '~/utils/pricing/stt-billing'

describe('resolveBilledSttDurationSeconds', () => {
  test('applies second-level rounding and a 15 second minimum', () => {
    expect(resolveBilledSttDurationSeconds(0.2, { roundingIncrementSeconds: 1, minimumSeconds: 15 })).toBe(15)
    expect(resolveBilledSttDurationSeconds(14.01, { roundingIncrementSeconds: 1, minimumSeconds: 15 })).toBe(15)
  })

  test('uses the rounded duration above the minimum', () => {
    expect(resolveBilledSttDurationSeconds(61.01, { roundingIncrementSeconds: 1, minimumSeconds: 15 })).toBe(62)
  })
})

describe('computeBilledSttCost', () => {
  test('uses Rev low_cost model billing metadata', () => {
    const estimate = computeBilledSttCost('rev', 'low_cost', 3)

    expect(estimate.requestedDurationSeconds).toBe(3)
    expect(estimate.billedDurationSeconds).toBe(15)
    expect(estimate.cost).toBeCloseTo((15 / 3600) * 10, 8)
  })
})
