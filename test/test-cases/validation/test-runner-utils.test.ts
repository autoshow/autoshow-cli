import { describe, expect, test } from 'bun:test'
import { formatElapsedForOutput, formatTimedOutputPrefix } from '../../test-runner/utils'

describe('test-runner output timestamps', () => {
  test('formats elapsed runtime as hh:mm:ss.mmm', () => {
    expect(formatElapsedForOutput(3_723_045)).toBe('01:02:03.045')
  })

  test('formats an elapsed-only prefix', () => {
    const startedAtMs = Date.parse('2026-03-19T00:00:00.000Z')
    const atMs = Date.parse('2026-03-19T00:00:01.234Z')

    expect(formatTimedOutputPrefix(atMs, startedAtMs)).toBe('[00:00:01.234]')
  })
})
