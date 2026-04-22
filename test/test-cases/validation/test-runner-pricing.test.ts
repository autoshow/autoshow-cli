import { describe, expect, test } from 'bun:test'
import type { PriceCommandResult, TestRunArtifacts } from '~/types/tests-dir-types'
import { PRICE_SELECTION_REGISTRY, resolvePriceSelection } from '../../test-runner/price-commands'
import { evaluatePriceObservations } from '../../test-runner/price-evaluation'
import { buildPriceReportData, type BudgetPreflightSummary } from '../../test-runner/reports'
import {
  appendApiCheapImageArgs,
  buildApiCheapPriceCommands
} from '../../test-utils/api-cheap-config'

const listAllTestFiles = async (): Promise<string[]> => {
  const glob = new Bun.Glob('test/test-cases/**/*.test.ts')
  return (await Array.fromAsync(glob.scan({ dot: false }))).sort()
}

const uniqueBudgetKeys = [...new Set(
  PRICE_SELECTION_REGISTRY
    .filter(entry => entry.budgetSkippable)
    .map(entry => entry.key)
)].sort()

const EXPECTED_BUDGET_KEYS = [
  'extract-firecrawl-url',
  'extract-mistral-mistral-ocr-2512',
  'extract-glm-glm-ocr',
  'extract-openai-gpt-5.4-nano',
  'extract-anthropic-claude-haiku-4-5',
  'extract-gemini-gemini-3.1-flash-lite-preview',
  'extract-paddle-ocr-image',
  'image-gemini-gemini-3-pro-image-preview',
  'image-gemini-imagen-4.0-fast-generate-001',
  'image-gemini-imagen-4.0-generate-001',
  'image-gemini-imagen-4.0-ultra-generate-001',
  'image-minimax-image-01',
  'image-openai-gpt-image-1',
  'image-openai-gpt-image-1-mini',
  'image-openai-gpt-image-1.5',
  'music-elevenlabs-music_v1',
  'music-minimax-music-2.5',
  'music-pipeline-minimax-music-2.5',
  'transcribe-assemblyai-universal-3-pro',
  'transcribe-aws-standard',
  'transcribe-deepgram-nova-3',
  'transcribe-elevenlabs-scribe_v2',
  'transcribe-gcloud-chirp_3',
  'transcribe-gladia-default',
  'transcribe-groq-whisper-large-v3',
  'transcribe-groq-whisper-large-v3-turbo',
  'transcribe-mistral-voxtral-mini-2602',
  'transcribe-rev-low_cost',
  'transcribe-rev-machine',
  'transcribe-reverb',
  'transcribe-soniox-stt-async-v4',
  'transcribe-speechmatics-enhanced',
  'transcribe-speechmatics-standard',
  'transcribe-whisper-base',
  'transcribe-whisper-large-v3-turbo',
  'transcribe-whisper-large-v3-turbo-split',
  'transcribe-whisper-medium',
  'transcribe-whisper-small',
  'transcribe-whisper-split',
  'transcribe-whisper-tiny',
  'tts-elevenlabs-eleven_flash_v2_5',
  'tts-elevenlabs-eleven_turbo_v2_5',
  'tts-elevenlabs-eleven_v3',
  'tts-gemini-gemini-2.5-flash-preview-tts',
  'tts-gemini-gemini-2.5-pro-preview-tts',
  'tts-groq-canopylabs/orpheus-v1-english',
  'tts-kitten-micro',
  'tts-kitten-mini',
  'tts-kitten-nano',
  'tts-kitten-nano-0.8-int8',
  'tts-minimax-speech-2.8-hd',
  'tts-minimax-speech-2.8-turbo',
  'tts-openai-gpt-4o-mini-tts',
  'video-gemini-veo-3.1-fast-generate-preview',
  'video-gemini-veo-3.1-generate-preview',
  'video-minimax-MiniMax-Hailuo-02',
  'video-minimax-MiniMax-Hailuo-2.3',
  'video-minimax-T2V-01',
  'video-minimax-T2V-01-Director',
  'write-anthropic-claude-haiku-4-5',
  'write-anthropic-claude-opus-4-6',
  'write-anthropic-claude-sonnet-4-6',
  'write-gemini-gemini-3.1-flash-lite-preview',
  'write-gemini-gemini-3.1-pro-preview',
  'write-groq-openai/gpt-oss-120b',
  'write-groq-openai/gpt-oss-20b',
  'write-llama-gemma-3-270m',
  'write-llama-qwen3-0.6b',
  'write-llama-qwen3-0.6b-document',
  'write-minimax-MiniMax-M2.5',
  'write-minimax-MiniMax-M2.5-highspeed',
  'write-openai-gpt-5.4',
  'write-openai-gpt-5.4-mini',
  'write-openai-gpt-5.4-nano',
  'write-openai-gpt-5.4-pro',
].sort()

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

describe('test runner price selection', () => {
  test('resolves explicit file selection to file-mapped price commands', async () => {
    const resolved = resolvePriceSelection(
      await listAllTestFiles(),
      ['test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts']
    )

    expect(resolved.suiteName).toBe('Selected paths: step-4-tts-e2e/tts-local/kitten-tts.test.ts')
    expect(resolved.commands.map(command => command.key).sort()).toEqual([
      'tts-kitten-micro',
      'tts-kitten-mini',
      'tts-kitten-nano',
      'tts-kitten-nano-0.8-int8',
    ])
  })

  test('resolves directory selection to the union of matching commands', async () => {
    const resolved = resolvePriceSelection(
      await listAllTestFiles(),
      ['test/test-cases/e2e/step-6-video-gen-e2e/']
    )

    expect(resolved.suiteName).toBe('Selected paths: step-6-video-gen-e2e')
    expect(resolved.commands.map(command => command.key).sort()).toEqual([
      'video-gemini-veo-3.1-fast-generate-preview',
      'video-gemini-veo-3.1-generate-preview',
      'video-minimax-MiniMax-Hailuo-02',
      'video-minimax-MiniMax-Hailuo-2.3',
      'video-minimax-T2V-01',
      'video-minimax-T2V-01-Director',
    ])
  })

  test('resolves mixed path selection without reintroducing tier semantics', async () => {
    const resolved = resolvePriceSelection(
      await listAllTestFiles(),
      [
        'test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts',
        'test/test-cases/e2e/step-2-stt-e2e/stt-local/whisper/whisper-models-price.test.ts',
      ]
    )

    expect(resolved.suiteName).toBe('Selected paths: step-2-ocr-e2e/ocr-services/service-models.test.ts, step-2-stt-e2e/stt-local/whisper/whisper-models-price.test.ts')
    expect(resolved.commands.map(command => command.key).sort()).toEqual([
      'extract-anthropic-claude-haiku-4-5',
      'extract-gemini-gemini-3.1-flash-lite-preview',
      'extract-glm-glm-ocr',
      'extract-mistral-mistral-ocr-2512',
      'extract-openai-gpt-5.4-nano',
      'transcribe-whisper-base',
      'transcribe-whisper-large-v3-turbo',
      'transcribe-whisper-medium',
      'transcribe-whisper-small',
      'transcribe-whisper-tiny',
    ])
  })

  test('returns an empty selection for mappedless paths that still match tests', async () => {
    const resolved = resolvePriceSelection(
      await listAllTestFiles(),
      ['test/test-cases/validation/']
    )

    expect(resolved.suiteName).toBe('Selected paths: validation')
    expect(resolved.commands).toEqual([])
  })

  test('filters report-only commands out of budget preflight selection', async () => {
    const resolved = resolvePriceSelection(
      await listAllTestFiles(),
      ['test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts'],
      true
    )

    expect(resolved.suiteName).toBe('Selected paths: step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts')
    expect(resolved.commands).toEqual([])
  })

  test('api-cheap price command omits unsupported image-size for Gemini fast Imagen', () => {
    const command = buildApiCheapPriceCommands()
      .find((entry) => entry.name === 'image-gemini-imagen-4.0-fast-generate-001')

    expect(command).toBeDefined()
    expect(command?.args).toContain('--imagen-count')
    expect(command?.args).toContain('--image-aspect-ratio')
    expect(command?.args).not.toContain('--image-size')
  })

  test('api-cheap image args keep 1K size for size-capable Gemini Imagen models', () => {
    const args = appendApiCheapImageArgs(
      ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini-image', 'imagen-4.0-generate-001'],
      { service: 'gemini', model: 'imagen-4.0-generate-001' }
    )

    expect(args).toContain('--imagen-count')
    expect(args).toContain('--image-aspect-ratio')
    expect(args).toContain('--image-size')
    expect(args).toContain('1K')
  })

  test('registry budget keys stay aligned with the supported budget skip surface', () => {
    expect(uniqueBudgetKeys).toEqual(EXPECTED_BUDGET_KEYS)
  })
})

describe('test runner price evaluation', () => {
  test('applies budget decisions at the budget-key level using the max variant cost', () => {
    const evaluation = evaluatePriceObservations('Selected paths: step-3-write-e2e/write-services/service-models.test.ts', [
      {
        name: 'write-openai-gpt-5.4',
        key: 'write-openai-gpt-5.4',
        args: ['cmd-a'],
        exitCode: 0,
        durationMs: 10,
        costCents: 1,
        failureMessage: null,
        budgetSkippable: true,
      },
      {
        name: 'write-openai-gpt-5.4',
        key: 'write-openai-gpt-5.4',
        args: ['cmd-b'],
        exitCode: 0,
        durationMs: 12,
        costCents: 3,
        failureMessage: null,
        budgetSkippable: true,
      },
      {
        name: 'write-openai-gpt-5.4-mini',
        key: 'write-openai-gpt-5.4-mini',
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
      suiteName: 'Selected paths: step-3-write-e2e/write-services/service-models.test.ts',
      budgetCents: 2,
      commandsChecked: 2,
      commandsRunnable: 1,
      commandsSkipped: 1,
      commandsFailed: 0,
      runnableEstimatedCostCents: 1.5,
      skipKeys: ['write-openai-gpt-5.4'],
      skippedEntries: [
        {
          key: 'write-openai-gpt-5.4',
          selectedCostCents: 3,
        },
      ],
    })
    expect(evaluation.totalEstimatedCostCents).toBe(1.5)
  })

  test('budget summary ignores report-only commands while still reporting their cost', () => {
    const evaluation = evaluatePriceObservations('Selected paths: step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts', [
      {
        name: 'write-openai-gpt-5.4',
        key: 'write-openai-gpt-5.4',
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
      suiteName: 'Selected paths: step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts',
      budgetCents: 2,
      commandsChecked: 1,
      commandsRunnable: 0,
      commandsSkipped: 1,
      commandsFailed: 0,
      runnableEstimatedCostCents: 0,
      skipKeys: ['write-openai-gpt-5.4'],
      skippedEntries: [
        {
          key: 'write-openai-gpt-5.4',
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
        name: 'write-openai-gpt-5.4',
        key: 'write-openai-gpt-5.4',
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
      'write-openai-gpt-5.4',
    ])
    expect(evaluation.budgetSummary?.skippedEntries).toEqual([
      { key: 'video-gemini-veo-3.1-generate-preview', selectedCostCents: 25 },
      { key: 'image-openai-gpt-image-1', selectedCostCents: 7 },
      { key: 'write-openai-gpt-5.4', selectedCostCents: 3 },
    ])
  })

  test('price report totals exclude skipped commands and include path-based budget metadata', () => {
    const results: PriceCommandResult[] = [
      {
        name: 'write-openai-gpt-5.4-mini',
        key: 'write-openai-gpt-5.4-mini',
        args: ['cmd-a'],
        status: 'passed',
        exitCode: 0,
        durationMs: 10,
        costCents: 1.5,
        failureMessage: null,
      },
      {
        name: 'write-openai-gpt-5.4',
        key: 'write-openai-gpt-5.4',
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
      suiteName: 'Selected paths: step-3-write-e2e/write-services/service-models.test.ts',
      budgetCents: 2,
      commandsChecked: 2,
      commandsRunnable: 1,
      commandsSkipped: 1,
      commandsFailed: 1,
      runnableEstimatedCostCents: 1.5,
      skipKeys: ['write-openai-gpt-5.4'],
      skippedEntries: [
        { key: 'write-openai-gpt-5.4', selectedCostCents: 3 },
      ],
    }

    const report = buildPriceReportData(
      results,
      'Selected paths: step-3-write-e2e/write-services/service-models.test.ts',
      artifacts,
      '2026-03-19T00:00:11.000Z',
      11_000,
      ['test/test-cases/e2e/step-3-write-e2e/write-services/service-models.test.ts', '--test-price', '--budget', '2'],
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
    expect(report.run['budgetPreflightSuite']).toBe('Selected paths: step-3-write-e2e/write-services/service-models.test.ts')
    expect(report.run['budgetPreflightSkipped']).toBe(1)
    expect(report.run['budgetSkipKeys']).toEqual(['write-openai-gpt-5.4'])
    expect(report.run['budgetSkippedEntries']).toEqual([
      { key: 'write-openai-gpt-5.4', selectedCostCents: 3 },
    ])
  })
})
