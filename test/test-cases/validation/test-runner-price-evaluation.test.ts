import { describe, expect, test } from 'bun:test'
import type { PriceCommandResult, TestRunArtifacts } from '~/types/tests-dir-types'
import { evaluatePriceObservations } from '../../test-runner/price-evaluation'
import { buildPriceReportData, type BudgetPreflightSummary } from '../../test-runner/reports'

const artifacts: TestRunArtifacts = {
  rootDir: 'test-output',
  runId: 'test-run',
  runDir: 'test-output/test-run',
  runnerLogPath: 'test-output/test-run/runner.log',
  commandLogPath: 'test-output/test-run/commands.log',
  metricsLogPath: 'test-output/test-run/metrics.ndjson',
  junitPath: 'test-output/test-run/junit.xml',
  reportJsonPath: 'test-output/test-run/report.json',
  e2eReportJsonPath: 'test-output/test-run/e2e-report.json',
  calibrationReportJsonPath: 'test-output/test-run/model-calibration.json',
  metadataDirPath: 'test-output/test-run/metadata',
  startedAtMs: 1000,
  startedAtIso: '2026-03-19T00:00:01.000Z',
}

describe('test runner price evaluation', () => {
  test('applies budget decisions at the test-key level using the max variant cost', () => {
    const evaluation = evaluatePriceObservations('Tier api', [
      {
        name: 'write-openai-gpt-5.2',
        args: ['cmd-a'],
        exitCode: 0,
        durationMs: 10,
        costCents: 1,
        failureMessage: null,
      },
      {
        name: 'write-openai-gpt-5.2',
        args: ['cmd-b'],
        exitCode: 0,
        durationMs: 12,
        costCents: 3,
        failureMessage: null,
      },
      {
        name: 'write-openai-gpt-4.1-mini',
        args: ['cmd-c'],
        exitCode: 0,
        durationMs: 9,
        costCents: 1.5,
        failureMessage: null,
      },
    ], 2)

    expect(evaluation.commandResults.map(result => result.status)).toEqual(['skipped', 'skipped', 'passed'])
    expect(evaluation.budgetSummary).toEqual({
      suiteName: 'Tier api',
      budgetCents: 2,
      commandsChecked: 2,
      commandsRunnable: 1,
      commandsSkipped: 1,
      commandsFailed: 0,
      runnableEstimatedCostCents: 1.5,
      skipKeys: ['write-openai-gpt-5.2'],
      skippedEntries: [
        {
          key: 'write-openai-gpt-5.2',
          selectedCostCents: 3,
        },
      ],
    })
    expect(evaluation.totalEstimatedCostCents).toBe(1.5)
  })

  test('skipped entries are ranked from highest to lowest cost', () => {
    const evaluation = evaluatePriceObservations('Tier api', [
      {
        name: 'video-sora-sora-2',
        args: ['cmd-a'],
        exitCode: 0,
        durationMs: 10,
        costCents: 25,
        failureMessage: null,
      },
      {
        name: 'image-openai-gpt-image-1',
        args: ['cmd-b'],
        exitCode: 0,
        durationMs: 10,
        costCents: 7,
        failureMessage: null,
      },
      {
        name: 'write-openai-gpt-5.2',
        args: ['cmd-c'],
        exitCode: 0,
        durationMs: 10,
        costCents: 3,
        failureMessage: null,
      },
    ], 2)

    expect(evaluation.budgetSummary?.skipKeys).toEqual([
      'video-sora-sora-2',
      'image-openai-gpt-image-1',
      'write-openai-gpt-5.2',
    ])
    expect(evaluation.budgetSummary?.skippedEntries).toEqual([
      { key: 'video-sora-sora-2', selectedCostCents: 25 },
      { key: 'image-openai-gpt-image-1', selectedCostCents: 7 },
      { key: 'write-openai-gpt-5.2', selectedCostCents: 3 },
    ])
  })

  test('price report totals exclude skipped commands and include budget metadata', () => {
    const results: PriceCommandResult[] = [
      {
        name: 'write-openai-gpt-4.1-mini',
        args: ['cmd-a'],
        status: 'passed',
        exitCode: 0,
        durationMs: 10,
        costCents: 1.5,
        failureMessage: null,
      },
      {
        name: 'write-openai-gpt-5.2',
        args: ['cmd-b'],
        status: 'skipped',
        exitCode: 0,
        durationMs: 12,
        costCents: 3,
        failureMessage: null,
      },
      {
        name: 'write-anthropic-claude',
        args: ['cmd-c'],
        status: 'failed',
        exitCode: 1,
        durationMs: 8,
        costCents: null,
        failureMessage: 'command failed with exit code 1',
      },
    ]
    const budgetSummary: BudgetPreflightSummary = {
      suiteName: 'Tier api',
      budgetCents: 2,
      commandsChecked: 2,
      commandsRunnable: 1,
      commandsSkipped: 1,
      commandsFailed: 1,
      runnableEstimatedCostCents: 1.5,
      skipKeys: ['write-openai-gpt-5.2'],
      skippedEntries: [
        { key: 'write-openai-gpt-5.2', selectedCostCents: 3 },
      ],
    }

    const report = buildPriceReportData(
      results,
      'Tier api',
      artifacts,
      '2026-03-19T00:00:11.000Z',
      11_000,
      ['--tier', 'api', '--test-price', '--budget', '2'],
      budgetSummary
    ) as {
      run: Record<string, unknown>
      summary: Record<string, unknown>
    }

    expect(report.summary['passed']).toBe(1)
    expect(report.summary['failed']).toBe(1)
    expect(report.summary['skipped']).toBe(1)
    expect(report.summary['totalEstimatedCostCents']).toBe(1.5)
    expect(report.run['budgetCents']).toBe(2)
    expect(report.run['budgetPreflightSuite']).toBe('Tier api')
    expect(report.run['budgetPreflightSkipped']).toBe(1)
    expect(report.run['budgetSkipKeys']).toEqual(['write-openai-gpt-5.2'])
    expect(report.run['budgetSkippedEntries']).toEqual([
      { key: 'write-openai-gpt-5.2', selectedCostCents: 3 },
    ])
  })
})
