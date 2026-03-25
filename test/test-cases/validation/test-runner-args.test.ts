import { describe, expect, test } from 'bun:test'
import { parseRunnerArgs } from '../../test-runner/args'

describe('test-runner args', () => {
  test('parses path filters, passthrough args, and price mode together', () => {
    const parsed = parseRunnerArgs([
      'bun',
      'test/test-runner.ts',
      'test/test-cases/e2e/step-3-write-e2e/write-services/openai/',
      'test/test-cases/validation/test-runner-args.test.ts',
      '--test-price',
      '--bail',
    ])

    expect(parsed.pathFilters).toEqual([
      'test/test-cases/e2e/step-3-write-e2e/write-services/openai/',
      'test/test-cases/validation/test-runner-args.test.ts',
    ])
    expect(parsed.priceMode).toBe(true)
    expect(parsed.passthroughArgs).toEqual(['--bail'])
  })

  test('parses whole-number budget cents', () => {
    const parsed = parseRunnerArgs(['bun', 'test/test-runner.ts', '--budget', '5'])
    expect(parsed.budgetCents).toBe(5)
    expect(parsed.priceMode).toBe(false)
  })

  test('accepts zero budget', () => {
    const parsed = parseRunnerArgs(['bun', 'test/test-runner.ts', '--budget', '0'])
    expect(parsed.budgetCents).toBe(0)
  })

  test('accepts using --budget with --test-price', () => {
    const parsed = parseRunnerArgs([
      'bun',
      'test/test-runner.ts',
      'test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts',
      '--test-price',
      '--budget',
      '5',
    ])

    expect(parsed.pathFilters).toEqual(['test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts'])
    expect(parsed.priceMode).toBe(true)
    expect(parsed.budgetCents).toBe(5)
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

  test('rejects removed --tier flag', () => {
    expect(() => parseRunnerArgs(['bun', 'test/test-runner.ts', '--tier', 'api'])).toThrow('--tier has been removed')
  })

  test('rejects removed --api flag', () => {
    expect(() => parseRunnerArgs(['bun', 'test/test-runner.ts', '--api'])).toThrow('--api has been removed')
  })

  test('rejects removed --api-cheap flag', () => {
    expect(() => parseRunnerArgs(['bun', 'test/test-runner.ts', '--api-cheap'])).toThrow('--api-cheap has been removed')
  })

  test('ignores legacy --timestamps without forwarding it to bun test', () => {
    const parsed = parseRunnerArgs(['bun', 'test/test-runner.ts', '--timestamps', '--bail'])

    expect(parsed.passthroughArgs).toEqual(['--bail'])
  })
})
