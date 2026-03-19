import { describe, expect, test } from 'bun:test'
import { parseRunnerArgs } from '../../test-runner/args'

describe('test-runner args --budget', () => {
  test('parses whole-number budget cents', () => {
    const parsed = parseRunnerArgs(['bun', 'test/test-runner.ts', '--budget', '5'])
    expect(parsed.budgetCents).toBe(5)
    expect(parsed.priceMode).toBe(false)
  })

  test('accepts zero budget', () => {
    const parsed = parseRunnerArgs(['bun', 'test/test-runner.ts', '--budget', '0'])
    expect(parsed.budgetCents).toBe(0)
  })

  test('rejects missing budget value', () => {
    expect(() => parseRunnerArgs(['bun', 'test/test-runner.ts', '--budget'])).toThrow()
  })

  test('rejects decimal budget value', () => {
    expect(() => parseRunnerArgs(['bun', 'test/test-runner.ts', '--budget', '5.5'])).toThrow()
  })

  test('rejects negative budget value', () => {
    expect(() => parseRunnerArgs(['bun', 'test/test-runner.ts', '--budget', '-1'])).toThrow()
  })

  test('rejects non-numeric budget value', () => {
    expect(() => parseRunnerArgs(['bun', 'test/test-runner.ts', '--budget', 'abc'])).toThrow()
  })

  test('accepts using --budget with --test-price', () => {
    const parsed = parseRunnerArgs(['bun', 'test/test-runner.ts', '--test-price', '--budget', '5'])
    expect(parsed.priceMode).toBe(true)
    expect(parsed.budgetCents).toBe(5)
  })

  test('rejects removed --api-cheap flag', () => {
    expect(() => parseRunnerArgs(['bun', 'test/test-runner.ts', '--api-cheap'])).toThrow('--api-cheap has been removed')
  })

  test('ignores legacy --timestamps without forwarding it to bun test', () => {
    const parsed = parseRunnerArgs(['bun', 'test/test-runner.ts', '--timestamps', '--bail'])

    expect(parsed.passthroughArgs).toEqual(['--bail'])
  })
})
