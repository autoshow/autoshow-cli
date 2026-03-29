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
  test('applies budget decisions at the budget-key level using the max variant cost', () => {
    const evaluation = evaluatePriceObservations('Selected paths: step-3-write-e2e/write-services/openai', [
      {
        name: 'write-openai-gpt-5.2',
        key: 'write-openai-gpt-5.2',
        args: ['cmd-a'],
        exitCode: 0,
        durationMs: 10,
        costCents: 1,
        failureMessage: null,
        budgetSkippable: true,
      },
      {
        name: 'write-openai-gpt-5.2',
        key: 'write-openai-gpt-5.2',
        args: ['cmd-b'],
        exitCode: 0,
        durationMs: 12,
        costCents: 3,
        failureMessage: null,
        budgetSkippable: true,
      },
      {
        name: 'write-openai-gpt-5.1',
        key: 'write-openai-gpt-5.1',
        args: ['cmd-c'],
        exitCode: 0,
        durationMs: 9,
        costCents: 1.5,
        failureMessage: null,
        budgetSkippable: true,
      },
    ], 2)

    expect(evaluation.commandResults.map(result => result.status)).toEqual(['skipped', 'skipped', 'passed'])
    expect(evaluation.budgetSummary).toEqual({
      suiteName: 'Selected paths: step-3-write-e2e/write-services/openai',
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

  test('budget summary ignores report-only commands while still reporting their cost', () => {
    const evaluation = evaluatePriceObservations('Selected paths: api-cheap.test.ts', [
      {
        name: 'write-openai-gpt-5.2',
        key: 'write-openai-gpt-5.2',
        args: ['cmd-a'],
        exitCode: 0,
        durationMs: 10,
        costCents: 3,
        failureMessage: null,
        budgetSkippable: true,
      },
      {
        name: 'transcribe-youtube-single',
        key: 'transcribe-youtube-single',
        args: ['cmd-b'],
        exitCode: 0,
        durationMs: 10,
        costCents: 8,
        failureMessage: null,
        budgetSkippable: false,
      },
    ], 2)

    expect(evaluation.commandResults.map(result => result.status)).toEqual(['skipped', 'passed'])
    expect(evaluation.budgetSummary).toEqual({
      suiteName: 'Selected paths: api-cheap.test.ts',
      budgetCents: 2,
      commandsChecked: 1,
      commandsRunnable: 0,
      commandsSkipped: 1,
      commandsFailed: 0,
      runnableEstimatedCostCents: 0,
      skipKeys: ['write-openai-gpt-5.2'],
      skippedEntries: [
        {
          key: 'write-openai-gpt-5.2',
          selectedCostCents: 3,
        },
      ],
    })
    expect(evaluation.totalEstimatedCostCents).toBe(8)
  })

  test('skipped entries are ranked from highest to lowest cost', () => {
    const evaluation = evaluatePriceObservations('Selected paths: step-6-video-gen-e2e', [
      {
        name: 'video-gemini-veo-3.1-generate-preview',
        key: 'video-gemini-veo-3.1-generate-preview',
        args: ['cmd-a'],
        exitCode: 0,
        durationMs: 10,
        costCents: 25,
        failureMessage: null,
        budgetSkippable: true,
      },
      {
        name: 'image-openai-gpt-image-1',
        key: 'image-openai-gpt-image-1',
        args: ['cmd-b'],
        exitCode: 0,
        durationMs: 10,
        costCents: 7,
        failureMessage: null,
        budgetSkippable: true,
      },
      {
        name: 'write-openai-gpt-5.2',
        key: 'write-openai-gpt-5.2',
        args: ['cmd-c'],
        exitCode: 0,
        durationMs: 10,
        costCents: 3,
        failureMessage: null,
        budgetSkippable: true,
      },
    ], 2)

    expect(evaluation.budgetSummary?.skipKeys).toEqual([
      'video-gemini-veo-3.1-generate-preview',
      'image-openai-gpt-image-1',
      'write-openai-gpt-5.2',
    ])
    expect(evaluation.budgetSummary?.skippedEntries).toEqual([
      { key: 'video-gemini-veo-3.1-generate-preview', selectedCostCents: 25 },
      { key: 'image-openai-gpt-image-1', selectedCostCents: 7 },
      { key: 'write-openai-gpt-5.2', selectedCostCents: 3 },
    ])
  })

  test('price report totals exclude skipped commands and include path-based budget metadata', () => {
    const results: PriceCommandResult[] = [
      {
        name: 'write-openai-gpt-5.1',
        key: 'write-openai-gpt-5.1',
        args: ['cmd-a'],
        status: 'passed',
        exitCode: 0,
        durationMs: 10,
        costCents: 1.5,
        failureMessage: null,
      },
      {
        name: 'write-openai-gpt-5.2',
        key: 'write-openai-gpt-5.2',
        args: ['cmd-b'],
        status: 'skipped',
        exitCode: 0,
        durationMs: 12,
        costCents: 3,
        failureMessage: null,
      },
      {
        name: 'transcribe-youtube-single',
        key: 'transcribe-youtube-single',
        args: ['cmd-c'],
        status: 'passed',
        exitCode: 0,
        durationMs: 8,
        costCents: 8,
        failureMessage: null,
      },
      {
        name: 'write-anthropic-claude',
        key: 'write-anthropic-claude',
        args: ['cmd-d'],
        status: 'failed',
        exitCode: 1,
        durationMs: 8,
        costCents: null,
        failureMessage: 'command failed with exit code 1',
      },
    ]
    const budgetSummary: BudgetPreflightSummary = {
      suiteName: 'Selected paths: step-3-write-e2e/write-services/openai',
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
      'Selected paths: step-3-write-e2e/write-services/openai',
      artifacts,
      '2026-03-19T00:00:11.000Z',
      11_000,
      ['test/test-cases/e2e/step-3-write-e2e/write-services/openai/', '--test-price', '--budget', '2'],
      budgetSummary
    ) as {
      run: Record<string, unknown>
      summary: Record<string, unknown>
    }

    expect(report.summary['passed']).toBe(2)
    expect(report.summary['failed']).toBe(1)
    expect(report.summary['skipped']).toBe(1)
    expect(report.summary['totalEstimatedCostCents']).toBe(9.5)
    expect(report.run['budgetCents']).toBe(2)
    expect(report.run['budgetPreflightSuite']).toBe('Selected paths: step-3-write-e2e/write-services/openai')
    expect(report.run['budgetPreflightSkipped']).toBe(1)
    expect(report.run['budgetSkipKeys']).toEqual(['write-openai-gpt-5.2'])
    expect(report.run['budgetSkippedEntries']).toEqual([
      { key: 'write-openai-gpt-5.2', selectedCostCents: 3 },
    ])
  })
})
