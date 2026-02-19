import { describe, expect, test } from 'bun:test'
import { generateComparisonReport, generateRuntimeMarkdownReport } from '../../.github/report/lib/report-generator.ts'
import { normalizeReport } from '../../.github/report/lib/report-type.ts'
import type { RuntimeReport, SetupOnlyReport } from '../../.github/report/types.ts'

const baseEnvironment = {
  platform: 'darwin',
  arch: 'arm64',
  bunVersion: '1.2.0',
  cwd: '/tmp/autoshow-cli',
}

describe('report type normalization', () => {
  test('infers legacy run report type when reportType is missing', () => {
    const report = normalizeReport({
      command: 'tts:qwen3',
      setupCommand: 'setup:tts:qwen3',
      startTime: '2026-02-19T00:00:00.000Z',
      endTime: '2026-02-19T00:00:10.000Z',
      durationMs: 10000,
      success: true,
      exitCode: 0,
    })

    expect(report.reportType).toBe('run')
  })

  test('infers setup report type from readiness fields', () => {
    const report = normalizeReport({
      command: 'tts:qwen3',
      setupCommand: 'setup:tts:qwen3',
      startTime: '2026-02-19T00:00:00.000Z',
      endTime: '2026-02-19T00:00:30.000Z',
      durationMs: 30000,
      success: true,
      exitCode: 0,
      modelPreparation: { durationMs: 1000 },
      readinessKey: 'setup-tts-qwen3-default',
    })

    expect(report.reportType).toBe('setup')
  })

  test('infers runtime report type from warmupRun field', () => {
    const report = normalizeReport({
      command: 'tts:qwen3',
      setupCommand: 'setup:tts:qwen3',
      startTime: '2026-02-19T00:00:00.000Z',
      endTime: '2026-02-19T00:00:20.000Z',
      durationMs: 20000,
      success: true,
      exitCode: 0,
      warmupRun: { durationMs: 10000 },
    })

    expect(report.reportType).toBe('runtime')
  })
})

describe('report rendering', () => {
  test('rejects mixed type comparisons in markdown output', () => {
    const setupReport: SetupOnlyReport = {
      schemaVersion: 2,
      reportType: 'setup',
      command: 'tts:qwen3',
      setupCommand: 'setup:tts:qwen3',
      startTime: '2026-02-19T00:00:00.000Z',
      endTime: '2026-02-19T00:00:20.000Z',
      durationMs: 20000,
      success: true,
      exitCode: 0,
      freshRun: true,
      phases: [],
      fileOperations: [],
      downloads: [],
      errors: [],
      storage: {
        totalBytesAdded: 0,
        totalBytesModified: 0,
        largestFiles: [],
        byDirectory: {},
      },
      environment: baseEnvironment,
      stdout: '',
      stderr: '',
      model: 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice',
      modelPreparation: {
        model: 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice',
        method: 'python-prefetch',
        startTime: '2026-02-19T00:00:10.000Z',
        endTime: '2026-02-19T00:00:20.000Z',
        durationMs: 10000,
        success: true,
      },
      readinessKey: 'setup-tts-qwen3-default',
      readinessMarkerPath: 'build/config/.report-ready/setup-tts-qwen3-default.json',
    }

    const runtimeReport: RuntimeReport = {
      schemaVersion: 2,
      reportType: 'runtime',
      command: 'tts:qwen3',
      setupCommand: 'setup:tts:qwen3',
      startTime: '2026-02-19T00:01:00.000Z',
      endTime: '2026-02-19T00:01:20.000Z',
      durationMs: 20000,
      success: true,
      exitCode: 0,
      model: 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice',
      inputFile: 'input/sample.md',
      benchmarkRun: 'measured',
      warmupRun: {
        command: 'bun as -- tts input/sample.md --qwen3',
        inputFile: 'input/sample.md',
        inputSize: 100,
        inputCharacters: 100,
        inputWords: 20,
        startTime: '2026-02-19T00:01:00.000Z',
        endTime: '2026-02-19T00:01:08.000Z',
        durationMs: 8000,
        success: true,
        exitCode: 0,
        stdout: '',
        stderr: '',
      },
      measuredRun: {
        command: 'bun as -- tts input/sample.md --qwen3',
        inputFile: 'input/sample.md',
        inputSize: 100,
        inputCharacters: 100,
        inputWords: 20,
        startTime: '2026-02-19T00:01:10.000Z',
        endTime: '2026-02-19T00:01:20.000Z',
        durationMs: 10000,
        success: true,
        exitCode: 0,
        stdout: '',
        stderr: '',
        charactersPerSecond: 10,
        wordsPerSecond: 2,
        realTimeRatio: 0.5,
      },
      errors: [],
      environment: baseEnvironment,
      stdout: '',
      stderr: '',
    }

    const output = generateComparisonReport(setupReport, runtimeReport)
    expect(output).toContain('Cannot compare different report types')
  })

  test('includes warm-up and measured sections in runtime markdown report', () => {
    const report: RuntimeReport = {
      schemaVersion: 2,
      reportType: 'runtime',
      command: 'tts:qwen3',
      setupCommand: 'setup:tts:qwen3',
      startTime: '2026-02-19T00:01:00.000Z',
      endTime: '2026-02-19T00:01:20.000Z',
      durationMs: 20000,
      success: true,
      exitCode: 0,
      inputFile: 'input/sample.md',
      benchmarkRun: 'measured',
      warmupRun: {
        command: 'warmup',
        inputFile: 'input/sample.md',
        inputSize: 100,
        inputCharacters: 100,
        inputWords: 20,
        startTime: '2026-02-19T00:01:00.000Z',
        endTime: '2026-02-19T00:01:08.000Z',
        durationMs: 8000,
        success: true,
        exitCode: 0,
        stdout: '',
        stderr: '',
      },
      measuredRun: {
        command: 'measured',
        inputFile: 'input/sample.md',
        inputSize: 100,
        inputCharacters: 100,
        inputWords: 20,
        startTime: '2026-02-19T00:01:10.000Z',
        endTime: '2026-02-19T00:01:20.000Z',
        durationMs: 10000,
        success: true,
        exitCode: 0,
        stdout: '',
        stderr: '',
      },
      errors: [],
      environment: baseEnvironment,
      stdout: '',
      stderr: '',
    }

    const markdown = generateRuntimeMarkdownReport(report)
    expect(markdown).toContain('## Warm-up Run')
    expect(markdown).toContain('## Measured Run')
    expect(markdown).toContain('## Benchmark Summary')
  })
})
