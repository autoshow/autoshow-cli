import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import type { ParsedCommandMetric, ParsedJunitCase, TestRunArtifacts } from '~/types/tests-dir-types'
import { buildTestReportData } from '../../test-runner/reports'
import { summarizeOutputMetadataValue } from '../../test-utils/output-metadata-summary'

const createArtifacts = (rootDir: string, runId = 'test-run'): TestRunArtifacts => ({
  rootDir,
  runId,
  runDir: join(rootDir, runId),
  runnerLogPath: join(rootDir, runId, 'runner.log'),
  commandLogPath: join(rootDir, runId, 'commands.log'),
  metricsLogPath: join(rootDir, runId, 'metrics.ndjson'),
  junitPath: join(rootDir, runId, 'junit.xml'),
  reportJsonPath: join(rootDir, runId, 'report.json'),
  e2eReportJsonPath: join(rootDir, runId, 'e2e-report.json'),
  calibrationReportJsonPath: join(rootDir, runId, 'model-calibration.json'),
  metadataDirPath: join(rootDir, runId, 'metadata'),
  startedAtMs: 1000,
  startedAtIso: '2026-03-19T00:00:01.000Z',
})

describe('test runner cost/time metrics', () => {
  test('summarizes output metadata cost and processing time', () => {
    const summary = summarizeOutputMetadataValue({
      step2: { processingTime: 200 },
      step3: { processingTime: 1300 },
      cost: {
        estimated: { totalCost: 0.3 },
        actual: { totalCost: 0.0402 }
      }
      ,
      timing: {
        estimated: { totalProcessingTimeMs: 1200 },
        actual: { totalProcessingTimeMs: 1500 }
      }
    })

    expect(summary).toEqual({
      estimatedCostCents: 0.3,
      actualCostCents: 0.0402,
      estimatedProcessingTimeMs: 1200,
      actualProcessingTimeMs: 1500,
    })
  })

  test('includes metadata-derived cost plus current and fallback processing-time estimates in test reports', async () => {
    const junitCases: ParsedJunitCase[] = [
      {
        id: 'test/test-cases/e2e/example.test.ts::example test',
        file: 'test/test-cases/e2e/example.test.ts',
        name: 'example test',
        line: 12,
        durationMs: 2500,
        status: 'passed',
        failureMessage: null,
      }
    ]

    const metrics: ParsedCommandMetric[] = [
      {
        source: 'runCommand',
        command: 'bun src/cli/create-cli.ts write input.mp3 --openai gpt-5.4',
        args: ['src/cli/create-cli.ts', 'write', 'input.mp3', '--openai', 'gpt-5.4'],
        exitCode: 0,
        durationMs: 2400,
        outputDir: 'output/2026-03-19_00-00-00_example',
        callerFile: 'test/test-cases/e2e/example.test.ts',
        callerLine: 12,
        callerColumn: 3,
        at: '2026-03-19T00:00:02.000Z',
        testName: 'example test',
        estimatedCostCents: 0.3,
        actualCostCents: 0.0402,
        estimatedProcessingTimeMs: 1400,
        actualProcessingTimeMs: 1500,
      }
    ]

    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-cli-bun-test-runner-metrics-'))
    try {
      const artifacts = createArtifacts(rootDir, 'current-run')
      const priorRunDir = join(rootDir, 'prior-run')
      await mkdir(priorRunDir, { recursive: true })
      await writeFile(join(priorRunDir, 'report.json'), JSON.stringify({
        run: {
          endedAt: '2026-03-18T00:00:04.000Z',
        },
        tests: [
          {
            file: 'test/test-cases/e2e/example.test.ts',
            name: 'example test',
            status: 'passed',
            durationMs: 2200,
            metrics: {
              actualProcessingTimeMs: 1300,
            }
          }
        ]
      }))

      const report = await buildTestReportData(
        junitCases,
        metrics,
        artifacts,
        '2026-03-19T00:00:04.000Z',
        4000,
        ['test/test-cases/e2e/example.test.ts']
      ) as {
        tests: Array<{ metrics: Record<string, unknown> }>
        e2e: {
          summary: Record<string, unknown>
          tests: Array<Record<string, unknown>>
        }
      }

      expect(report.tests).toHaveLength(1)
      expect(report.tests[0]?.metrics).toEqual({
        source: 'runCommand',
        matchedBy: 'name-file',
        commandDurationMs: 2400,
        estimatedCostCents: 0.3,
        actualCostCents: 0.0402,
        estimatedProcessingTimeMs: 1400,
        actualProcessingTimeMs: 1500,
        notes: [],
      })
      expect(report.e2e.summary['total']).toBe(1)
      expect(report.e2e.tests[0]).toMatchObject({
        file: 'test/test-cases/e2e/example.test.ts',
        name: 'example test',
        status: 'passed',
        serviceName: 'openai',
        modelName: 'gpt-5.4',
        estimatedDurationMs: 2200,
        actualDurationMs: 2500,
        estimatedProcessingTimeMs: 1400,
        actualProcessingTimeMs: 1500,
        estimatedCostCents: 0.3,
        actualCostCents: 0.0402,
      })
      expect(typeof report.e2e.tests[0]?.['runAt']).toBe('string')
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  test('heuristically matches shared-helper metrics back to e2e test cases', async () => {
    const junitCases: ParsedJunitCase[] = [
      {
        id: 'test/test-cases/e2e/step-4-tts-e2e/tts-services/gemini-tts.test.ts::gemini-2.5-pro-preview-tts generates speech.wav',
        file: 'test/test-cases/e2e/step-4-tts-e2e/tts-services/gemini-tts.test.ts',
        name: 'gemini-2.5-pro-preview-tts generates speech.wav',
        line: 37,
        durationMs: 17_552,
        status: 'passed',
        failureMessage: null,
      }
    ]

    const metrics: ParsedCommandMetric[] = [
      {
        source: 'runCommand',
        command: 'bun src/cli/create-cli.ts tts input/1-tts.md --gemini-tts gemini-2.5-pro-preview-tts',
        args: ['src/cli/create-cli.ts', 'tts', 'input/1-tts.md', '--gemini-tts', 'gemini-2.5-pro-preview-tts'],
        exitCode: 0,
        durationMs: 17_552,
        outputDir: null,
        callerFile: 'test/test-utils/define-tts-service-test.ts',
        callerLine: 60,
        callerColumn: 28,
        at: '2026-03-19T00:00:19.000Z',
        testName: null,
        estimatedCostCents: 0.018,
        actualCostCents: 0.018,
        estimatedProcessingTimeMs: null,
        actualProcessingTimeMs: 17_387,
      }
    ]

    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-cli-bun-test-runner-heuristic-'))
    try {
      const artifacts = createArtifacts(rootDir, 'current-run')
      const report = await buildTestReportData(
        junitCases,
        metrics,
        artifacts,
        '2026-03-19T00:00:21.000Z',
        21_000,
        ['test/test-cases/e2e/step-4-tts-e2e/tts-services/gemini-tts.test.ts']
      ) as {
        tests: Array<{ metrics: Record<string, unknown> }>
        e2e: { tests: Array<Record<string, unknown>> }
      }

      expect(report.tests[0]?.metrics).toEqual({
        source: 'runCommand',
        matchedBy: 'heuristic',
        commandDurationMs: 17_552,
        estimatedCostCents: 0.018,
        actualCostCents: 0.018,
        estimatedProcessingTimeMs: null,
        actualProcessingTimeMs: 17_387,
        notes: [
          'metric matched heuristically by provider/model/time',
        ],
      })
      expect(report.e2e.tests[0]).toMatchObject({
        serviceName: 'gemini',
        modelName: 'gemini-2.5-pro-preview-tts',
        estimatedProcessingTimeMs: null,
        actualProcessingTimeMs: 17_387,
        estimatedCostCents: 0.018,
        actualCostCents: 0.018,
      })
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})
