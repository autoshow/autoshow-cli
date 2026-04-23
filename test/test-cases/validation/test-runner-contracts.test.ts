import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseRunnerArgs } from '../../test-runner/args'
import { parseJunit } from '../../test-runner/parsers'
import { resolvePriceSelection } from '../../test-runner/price-commands'
import { evaluatePriceObservations } from '../../test-runner/price-evaluation'
import { formatSelectedPathsLabel } from '../../test-runner/path-selection'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('test-runner contracts', () => {
  test('arg parsing separates path filters from runner flags', () => {
    const parsed = parseRunnerArgs([
      'bun',
      'test/test-runner.ts',
      'test/test-cases/validation-next/',
      '--test-price',
      '--budget',
      '5',
      '--bail'
    ])

    expect(parsed.pathFilters).toEqual(['test/test-cases/validation-next/'])
    expect(parsed.priceMode).toBe(true)
    expect(parsed.budgetCents).toBe(5)
    expect(parsed.passthroughArgs).toEqual(['--bail'])
  })

  test('path-selection labels strip the test/test-cases prefix for validation paths', () => {
    expect(formatSelectedPathsLabel(['test/test-cases/validation-next/'])).toBe('Selected paths: validation-next')
    expect(formatSelectedPathsLabel(['test/test-cases/validation/'])).toBe('Selected paths: validation')
  })

  test('JUnit XML parsing returns pass, fail, and skip counts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-validation-next-junit-'))
    tempDirs.push(dir)
    const junitPath = join(dir, 'junit.xml')
    await writeFile(junitPath, `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="suite" file="test/test-cases/validation-next/example.test.ts">
    <testcase name="passes" file="test/test-cases/validation-next/example.test.ts" line="1" time="0.01" />
    <testcase name="fails" file="test/test-cases/validation-next/example.test.ts" line="2" time="0.02"><failure message="bad" /></testcase>
    <testcase name="skips" file="test/test-cases/validation-next/example.test.ts" line="3" time="0.03"><skipped /></testcase>
  </testsuite>
</testsuites>`)

    const cases = await parseJunit(junitPath)
    expect(cases.map((entry) => entry.status)).toEqual(['passed', 'failed', 'skipped'])
    expect(cases.filter((entry) => entry.status === 'passed')).toHaveLength(1)
    expect(cases.filter((entry) => entry.status === 'failed')).toHaveLength(1)
    expect(cases.filter((entry) => entry.status === 'skipped')).toHaveLength(1)
  })

  test('validation paths stay mappedless in price selection', () => {
    const allFiles = [
      'test/test-cases/validation-next/test-runner-contracts.test.ts',
      'test/test-cases/validation/test-runner-contracts.test.ts'
    ]

    expect(resolvePriceSelection(allFiles, ['test/test-cases/validation-next/'])).toEqual({
      suiteName: 'Selected paths: validation-next',
      commands: []
    })
    expect(resolvePriceSelection(allFiles, ['test/test-cases/validation/'])).toEqual({
      suiteName: 'Selected paths: validation',
      commands: []
    })
  })

  test('budget-skip entries are emitted from skipped entry keys', () => {
    const evaluation = evaluatePriceObservations('Selected paths: step-3-write-e2e/write-services/service-models.test.ts', [
      {
        name: 'write-openai-gpt-5.4',
        key: 'write-openai-gpt-5.4',
        args: ['cmd-a'],
        exitCode: 0,
        durationMs: 10,
        costCents: 3,
        failureMessage: null,
        budgetSkippable: true
      },
      {
        name: 'write-openai-gpt-5.4-mini',
        key: 'write-openai-gpt-5.4-mini',
        args: ['cmd-b'],
        exitCode: 0,
        durationMs: 10,
        costCents: 1,
        failureMessage: null,
        budgetSkippable: true
      }
    ], 2)

    expect(evaluation.budgetSummary?.skipKeys).toEqual(['write-openai-gpt-5.4'])
    expect(evaluation.budgetSummary?.skippedEntries).toEqual([
      { key: 'write-openai-gpt-5.4', selectedCostCents: 3 }
    ])
    expect(evaluation.commandResults.map((result) => result.status)).toEqual(['skipped', 'passed'])
  })
})
