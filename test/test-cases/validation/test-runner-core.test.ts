import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { shouldSkipBudgetKey } from '../../test-utils/budget'
import { parseRunnerArgs } from '../../test-runner/args'
import { parseJunit } from '../../test-runner/parsers'
import { formatElapsedForOutput, formatTimedOutputPrefix } from '../../test-runner/utils'

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

describe('test-runner args', () => {
  test('parses path filters, passthrough args, and price mode together', () => {
    const parsed = parseRunnerArgs([
      'bun',
      'test/test-runner.ts',
      'test/test-cases/e2e/step-3-write-e2e/write-services/service-models.test.ts',
      'test/test-cases/validation/test-runner-args.test.ts',
      '--test-price',
      '--bail',
    ])

    expect(parsed.pathFilters).toEqual([
      'test/test-cases/e2e/step-3-write-e2e/write-services/service-models.test.ts',
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
})

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

describe('test runner junit parsing', () => {
  test('marks self-closing failure tags as failed tests', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-cli-bun-junit-'))
    const junitPath = join(rootDir, 'junit.xml')

    try {
      await writeFile(junitPath, `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="suite" file="test/test-cases/e2e/example.test.ts">
    <testcase name="example failure" file="test/test-cases/e2e/example.test.ts" line="12" time="1.25">
      <failure type="AssertionError" />
    </testcase>
  </testsuite>
</testsuites>`)

      const cases = await parseJunit(junitPath)
      expect(cases).toEqual([
        {
          id: 'test/test-cases/e2e/example.test.ts::example failure',
          file: 'test/test-cases/e2e/example.test.ts',
          name: 'example failure',
          line: 12,
          durationMs: 1250,
          status: 'failed',
          failureMessage: 'Test failed',
        }
      ])
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})
