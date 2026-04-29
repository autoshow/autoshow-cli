import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseRunnerArgs } from '../../test-runner/args'
import { parseJunit } from '../../test-runner/parsers'
import { resolvePriceSelection } from '../../test-runner/price-commands'
import { PRICE_SELECTION_REGISTRY } from '../../test-runner/price-commands/registry'
import { evaluatePriceObservations } from '../../test-runner/price-evaluation'
import { formatSelectedPathsLabel } from '../../test-runner/path-selection'
import { shouldSkipBudgetKeys } from '../../test-utils/budget'

const tempDirs: string[] = []

const extractExplicitBudgetedTestKeys = (source: string): string[] => {
  const keys: string[] = []
  const callPattern = /budgetedTest\s*\(\s*(?:(['"`])([^'"`$]*)\1|\[([\s\S]*?)\])/g
  let callMatch: RegExpExecArray | null

  while ((callMatch = callPattern.exec(source)) !== null) {
    const singleKey = callMatch[2]
    if (singleKey) {
      keys.push(singleKey)
      continue
    }

    const arraySource = callMatch[3]
    if (!arraySource) {
      continue
    }

    const arrayStringPattern = /(['"`])([^'"`$]*)\1/g
    let arrayMatch: RegExpExecArray | null
    while ((arrayMatch = arrayStringPattern.exec(arraySource)) !== null) {
      keys.push(arrayMatch[2] as string)
    }
  }

  return keys
}

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
      '500',
      '--bail'
    ])

    expect(parsed.pathFilters).toEqual(['test/test-cases/validation-next/'])
    expect(parsed.priceMode).toBe(true)
    expect(parsed.budgetHundredthCents).toBe(500)
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
    ], 200)

    expect(evaluation.budgetSummary?.skipKeys).toEqual(['write-openai-gpt-5.4'])
    expect(evaluation.budgetSummary?.budgetHundredthCents).toBe(200)
    expect(evaluation.budgetSummary?.skippedEntries).toEqual([
      { key: 'write-openai-gpt-5.4', selectedCostCents: 3 }
    ])
    expect(evaluation.commandResults.map((result) => result.status)).toEqual(['skipped', 'passed'])
  })

  test('sub-cent budget values compare against cent-denominated estimates', () => {
    const evaluation = evaluatePriceObservations('Selected paths: sub-cent-budget.test.ts', [
      {
        name: 'sub-cent-pass',
        key: 'sub-cent-pass',
        args: ['cmd-a'],
        exitCode: 0,
        durationMs: 10,
        costCents: 0.009,
        failureMessage: null,
        budgetSkippable: true
      },
      {
        name: 'sub-cent-skip',
        key: 'sub-cent-skip',
        args: ['cmd-b'],
        exitCode: 0,
        durationMs: 10,
        costCents: 0.031,
        failureMessage: null,
        budgetSkippable: true
      }
    ], 1)

    expect(evaluation.budgetSummary?.budgetHundredthCents).toBe(1)
    expect(evaluation.budgetSummary?.skipKeys).toEqual(['sub-cent-skip'])
    expect(evaluation.commandResults.map((result) => result.status)).toEqual(['passed', 'skipped'])
  })

  test('multi-key budget predicate skips when any component key is skipped', () => {
    const previous = process.env['AUTOSHOW_TEST_BUDGET_SKIP_KEYS']
    try {
      process.env['AUTOSHOW_TEST_BUDGET_SKIP_KEYS'] = JSON.stringify(['component-b'])

      expect(shouldSkipBudgetKeys(['component-a', 'component-b'])).toBe(true)
      expect(shouldSkipBudgetKeys(['component-a', 'component-c'])).toBe(false)
    } finally {
      if (previous === undefined) {
        delete process.env['AUTOSHOW_TEST_BUDGET_SKIP_KEYS']
      } else {
        process.env['AUTOSHOW_TEST_BUDGET_SKIP_KEYS'] = previous
      }
    }
  })

  test('explicit e2e budgetedTest keys resolve to budget-skippable price registry entries', async () => {
    const glob = new Bun.Glob('test/test-cases/e2e/**/*.test.ts')
    const allFiles = (await Array.fromAsync(glob.scan({ dot: false }))).sort()
    const budgetSkippableKeys = new Set(
      PRICE_SELECTION_REGISTRY
        .filter((entry) => entry.budgetSkippable)
        .map((entry) => entry.key)
    )
    const missing: string[] = []
    const unselected: string[] = []

    for (const file of allFiles) {
      const source = await Bun.file(file).text()
      const explicitKeys = [...new Set(extractExplicitBudgetedTestKeys(source))]
      if (explicitKeys.length === 0) {
        continue
      }

      const selectedKeys = new Set(
        resolvePriceSelection(allFiles, [file], true).commands.map((command) => command.key)
      )

      for (const key of explicitKeys) {
        if (!budgetSkippableKeys.has(key)) {
          missing.push(`${file}: ${key}`)
          continue
        }
        if (!selectedKeys.has(key)) {
          unselected.push(`${file}: ${key}`)
        }
      }
    }

    expect(missing).toEqual([])
    expect(unselected).toEqual([])
  })

  test('music selected-file budget preflight includes keys for live ElevenLabs music skips', () => {
    const allFiles = [
      'test/test-cases/e2e/step-7-music-gen-e2e/elevenlabs-music-gen.test.ts',
      'test/test-cases/e2e/step-7-music-gen-e2e/gemini-music-gen.test.ts',
      'test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts'
    ]

    const elevenlabsKeys = resolvePriceSelection(allFiles, [
      'test/test-cases/e2e/step-7-music-gen-e2e/elevenlabs-music-gen.test.ts'
    ], true).commands.map((command) => command.key)
    expect(elevenlabsKeys).toContain('music-elevenlabs-music_v1')
    expect(elevenlabsKeys).toContain('music-pipeline-elevenlabs-music_v1')

    const minimaxKeys = resolvePriceSelection(allFiles, [
      'test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts'
    ], true).commands.map((command) => command.key)
    expect(minimaxKeys).toContain('music-elevenlabs-music_v1')
    expect(minimaxKeys).toContain('music-minimax-music-2.5')

    const geminiKeys = resolvePriceSelection(allFiles, [
      'test/test-cases/e2e/step-7-music-gen-e2e/gemini-music-gen.test.ts'
    ], true).commands.map((command) => command.key)
    expect(geminiKeys).toContain('music-gemini-lyria-3-clip-preview')
    expect(geminiKeys).toContain('music-gemini-lyria-3-pro-preview')
  })
})
