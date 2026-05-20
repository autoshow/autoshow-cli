import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_TEST_RUNNER_CONCURRENCY, parseRunnerArgs, withDefaultTestConcurrency } from '../../test-runner/args'
import { cleanupTestOutputRoot, createRunArtifacts, writeDashboardReportFiles, writeLatestRunLog } from '../../test-runner/artifacts'
import { applyModelConfigCalibrations } from '../../test-runner/model-calibration'
import { parseJunit } from '../../test-runner/parsers'
import { EMPTY_PRICE_CONFIG_PATH, withEmptyPriceConfig } from '../../test-runner/price-command-config'
import { resolvePriceSelection } from '../../test-runner/price-commands'
import { BUDGET_PRICE_SELECTION_REGISTRY } from '../../test-runner/price-commands/registry'
import { evaluatePriceObservations } from '../../test-runner/price-evaluation'
import { buildDashboardReportData } from '../../test-runner/reports'
import { formatSelectedPathsLabel } from '../../test-runner/path-selection'
import { parseCommandEstimatedTotal } from '../../test-runner/utils'
import { shouldSkipBudgetKeys } from '../../test-utils/budget'
import type { ParsedCommandMetric, ParsedJunitCase } from '~/types'
import {
  MINIMAX_INSTRUMENTAL_MUSIC_MODELS,
  SUPPORTED_DEAPI_MUSIC_MODELS,
  SUPPORTED_DEAPI_RUNNABLE_TTS_MODELS,
  DEEPGRAM_DEFAULT_VOICE,
} from '~/cli/commands/setup-and-utilities/models/model-options'

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

const isBudgetKeyLiteral = (value: string): boolean => {
  return /^(?:extract|image|music|transcribe|tts|video|write)-/.test(value)
}

const extractBudgetKeyVariableLiterals = (source: string): string[] => {
  const keys: string[] = []

  for (const match of source.matchAll(/\bbudgetKey\s*:\s*(['"`])([^'"`$]+)\1/g)) {
    keys.push(match[2] as string)
  }

  for (const assignmentMatch of source.matchAll(/\b(?:const|let)\s+budgetKey\s*=\s*([^\n]+)/g)) {
    const assignmentSource = assignmentMatch[1] ?? ''
    for (const stringMatch of assignmentSource.matchAll(/(['"`])([^'"`$]+)\1/g)) {
      const value = stringMatch[2] as string
      if (isBudgetKeyLiteral(value)) {
        keys.push(value)
      }
    }
  }

  return keys
}

const readStringProperty = (source: string, propertyName: string): string | undefined => {
  const match = source.match(new RegExp(`${propertyName}\\s*:\\s*(['"])([^'"]+)\\1`))
  return match?.[2]
}

const readModelsProperty = (source: string, mode: 'strings' | 'objects'): string[] => {
  const startMatch = /models\s*:\s*\[/.exec(source)
  if (!startMatch) {
    return []
  }

  const start = startMatch.index + startMatch[0].length - 1
  let depth = 0
  let quote: string | undefined
  for (let index = start; index < source.length; index++) {
    const char = source[index]
    const previousChar = source[index - 1]
    if (quote) {
      if (char === quote && previousChar !== '\\') {
        quote = undefined
      }
      continue
    }

    if (char === '\'' || char === '"' || char === '`') {
      quote = char
      continue
    }

    if (char === '[') {
      depth++
    } else if (char === ']') {
      depth--
      if (depth === 0) {
        const body = source.slice(start + 1, index)
        if (mode === 'objects') {
          return [...body.matchAll(/\bmodel\s*:\s*(['"`])([^'"`]+)\1/g)].map(match => match[2] as string)
        }
        return [...body.matchAll(/(['"`])([^'"`]+)\1/g)].map(match => match[2] as string)
      }
    }
  }

  return []
}

const extractCallBodies = (source: string, callName: string): string[] => {
  const bodies: string[] = []
  let from = 0

  while (true) {
    const callIndex = source.indexOf(`${callName}(`, from)
    if (callIndex === -1) {
      break
    }

    const openParen = source.indexOf('(', callIndex)
    let depth = 0
    let quote: string | undefined
    for (let index = openParen; index < source.length; index++) {
      const char = source[index]
      const previousChar = source[index - 1]
      if (quote) {
        if (char === quote && previousChar !== '\\') {
          quote = undefined
        }
        continue
      }

      if (char === '\'' || char === '"' || char === '`') {
        quote = char
        continue
      }

      if (char === '(') {
        depth++
      } else if (char === ')') {
        depth--
        if (depth === 0) {
          bodies.push(source.slice(openParen + 1, index))
          from = index + 1
          break
        }
      }
    }

    if (from <= callIndex) {
      break
    }
  }

  return bodies
}

type HelperBudgetKeySpecBase = {
  callName: string
  prefix: string
  modelMode: 'strings' | 'objects'
}

type HelperBudgetKeySpec =
  | (HelperBudgetKeySpecBase & { serviceProperty: string; serviceFromCliFlag?: false })
  | (HelperBudgetKeySpecBase & { serviceFromCliFlag: true; serviceProperty?: never })

const helperBudgetKeySpecs: HelperBudgetKeySpec[] = [
  { callName: 'defineLLMWriteTest', prefix: 'write', serviceProperty: 'llmService', modelMode: 'strings' },
  { callName: 'defineSTTServiceTest', prefix: 'transcribe', serviceProperty: 'sttService', modelMode: 'strings' },
  { callName: 'defineOCRServiceTest', prefix: 'extract', serviceFromCliFlag: true, modelMode: 'strings' },
  { callName: 'defineImageServiceTest', prefix: 'image', serviceProperty: 'imageService', modelMode: 'objects' },
  { callName: 'defineVideoServiceTest', prefix: 'video', serviceProperty: 'videoService', modelMode: 'objects' },
  { callName: 'defineMusicServiceTest', prefix: 'music', serviceProperty: 'musicService', modelMode: 'objects' },
  { callName: 'defineTTSServiceTest', prefix: 'tts', serviceProperty: 'ttsService', modelMode: 'strings' },
] as const

const extractHelperGeneratedBudgetKeys = (source: string): string[] => {
  const keys: string[] = []

  for (const spec of helperBudgetKeySpecs) {
    for (const callBody of extractCallBodies(source, spec.callName)) {
      const service = spec.serviceFromCliFlag
        ? readStringProperty(callBody, 'expectedService')
          ?? readStringProperty(callBody, 'cliFlag')?.replace(/^--/, '').replace(/-ocr$/, '')
        : readStringProperty(callBody, spec.serviceProperty)
      if (!service) {
        continue
      }

      for (const model of readModelsProperty(callBody, spec.modelMode)) {
        keys.push(`${spec.prefix}-${service}-${model}`)
      }
    }
  }

  return keys
}

const extractTemplateLoopBudgetKeys = (file: string, source: string): string[] => {
  if (!file.endsWith('whisper-models-price.test.ts') || !source.includes('`transcribe-whisper-${model}`')) {
    return []
  }

  const modelsMatch = /const\s+models\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(source)
  const modelsSource = modelsMatch?.[1]
  if (!modelsSource) {
    return []
  }

  return [...modelsSource.matchAll(/(['"`])([^'"`]+)\1/g)].map(match => `transcribe-whisper-${match[2]}`)
}

const extractE2EBudgetKeys = (file: string, source: string): string[] => {
  return [
    ...extractExplicitBudgetedTestKeys(source),
    ...extractBudgetKeyVariableLiterals(source),
    ...extractHelperGeneratedBudgetKeys(source),
    ...extractTemplateLoopBudgetKeys(file, source)
  ]
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
    expect(parsed.preserveTestOutput).toBe(false)
    expect(parsed.passthroughArgs).toEqual(['--bail'])
  })

  test('arg parsing rejects the --testprice typo', () => {
    expect(() => parseRunnerArgs([
      'bun',
      'test/test-runner.ts',
      '--testprice',
    ])).toThrow('Use --test-price')
  })

  test('arg parsing uses --no-cleanup as the explicit keep flag', () => {
    const parsed = parseRunnerArgs([
      'bun',
      'test/test-runner.ts',
      '--cleanup',
      '--no-cleanup',
      'test/test-cases/validation/'
    ])

    expect(parsed.pathFilters).toEqual(['test/test-cases/validation/'])
    expect(parsed.preserveTestOutput).toBe(true)
  })

  test('normal test mode defaults bun test max concurrency', () => {
    expect(withDefaultTestConcurrency(['--bail'])).toEqual([
      `--max-concurrency=${DEFAULT_TEST_RUNNER_CONCURRENCY}`,
      '--bail',
    ])
  })

  test('normal test mode preserves explicit bun test max concurrency', () => {
    expect(withDefaultTestConcurrency(['--max-concurrency=8', '--bail'])).toEqual([
      '--max-concurrency=8',
      '--bail',
    ])
    expect(withDefaultTestConcurrency(['--max-concurrency', '8'])).toEqual([
      '--max-concurrency',
      '8',
    ])
  })

  test('price config isolation appends empty config to mapped write price commands', () => {
    const args = ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--openai', 'gpt-5.4', '--price']

    expect(withEmptyPriceConfig(args)).toEqual([
      ...args,
      '--config-path',
      EMPTY_PRICE_CONFIG_PATH,
    ])
  })

  test('price config isolation appends empty config to mapped tts price commands', () => {
    const args = ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--openai', 'gpt-4o-mini-tts', '--price']

    expect(withEmptyPriceConfig(args)).toEqual([
      ...args,
      '--config-path',
      EMPTY_PRICE_CONFIG_PATH,
    ])
  })

  test('price config isolation preserves explicit config paths', () => {
    const separateConfigArgs = [
      'src/cli/create-cli.ts',
      'write',
      'https://ajc.pics/autoshow/examples/1-audio.mp3',
      '--openai',
      'gpt-5.4',
      '--price',
      '--config-path',
      'config/custom-autoshow.json',
    ]
    const equalsConfigArgs = [
      'src/cli/create-cli.ts',
      'tts',
      'input/examples/tts/1-tts.md',
      '--openai',
      'gpt-4o-mini-tts',
      '--price',
      '--config-path=config/custom-autoshow.json',
    ]

    expect(withEmptyPriceConfig(separateConfigArgs)).toEqual(separateConfigArgs)
    expect(withEmptyPriceConfig(equalsConfigArgs)).toEqual(equalsConfigArgs)
  })

  test('price config isolation leaves non-CLI runner commands unchanged', () => {
    const args = ['test/test-runner.ts', 'test/test-cases/e2e/step-3-write-e2e', '--test-price']

    expect(withEmptyPriceConfig(args)).toEqual(args)
  })

  test('estimated-cost parser accepts readable totals and exact parenthetical cents', () => {
    expect(parseCommandEstimatedTotal('Total estimated cost: $3.59 (358.690¢)')).toBe(358.690)
    expect(parseCommandEstimatedTotal('Total estimated cost: free (0.000¢)')).toBe(0)
    expect(parseCommandEstimatedTotal('Suite total estimated cost: $3.59')).toBe(359)
    expect(parseCommandEstimatedTotal('Total estimated cost: 16.00¢')).toBe(16)
    expect(parseCommandEstimatedTotal('Total estimated cost: free')).toBe(0)
    expect(parseCommandEstimatedTotal('{"estimate":{"totalEstimatedCostCents":12.345}}')).toBe(12.345)
  })

  test('test-output cleanup preserves latest.log only', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-test-output-cleanup-'))
    tempDirs.push(dir)

    await writeFile(join(dir, 'latest.log'), 'previous run\n')
    await mkdir(join(dir, 'stale-run'), { recursive: true })
    await writeFile(join(dir, 'stale-run', 'report.json'), '{}\n')
    await mkdir(join(dir, '.test-cache'), { recursive: true })
    await writeFile(join(dir, '.test-cache', 'cache.txt'), 'cache\n')

    await cleanupTestOutputRoot(dir)

    expect((await readdir(dir)).sort()).toEqual(['latest.log'])
    expect(await readFile(join(dir, 'latest.log'), 'utf8')).toBe('previous run\n')
  })

  test('test-output cleanup can preserve active runner artifacts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-test-output-active-cleanup-'))
    tempDirs.push(dir)

    const current = await createRunArtifacts(dir)
    const activeRun = join(dir, 'active-run')
    const staleRun = join(dir, 'stale-run')
    const cacheDir = join(dir, '.test-cache')

    await mkdir(activeRun, { recursive: true })
    await mkdir(staleRun, { recursive: true })
    await mkdir(cacheDir, { recursive: true })
    await writeFile(join(activeRun, '.active-run.json'), `${JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
    })}\n`)
    await writeFile(join(staleRun, 'report.json'), '{}\n')
    await writeFile(join(cacheDir, 'cache.txt'), 'cache\n')

    await cleanupTestOutputRoot(dir, {
      keepRunDir: current.runDir,
      preserveActiveRuns: true,
    })

    expect((await readdir(dir)).sort()).toEqual([
      '.test-cache',
      'active-run',
      current.runId,
    ].sort())
  })

  test('latest log captures failure diagnostics before cleanup', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-test-output-latest-log-'))
    tempDirs.push(dir)

    const artifacts = await createRunArtifacts(dir)
    await writeFile(artifacts.runnerLogPath, 'runner transcript\n')
    await writeFile(artifacts.commandLogPath, 'command transcript\n')
    await writeFile(artifacts.reportJsonPath, `${JSON.stringify({
      run: {
        id: artifacts.runId,
        mode: 'test',
        startedAt: artifacts.startedAtIso,
        endedAt: '2026-05-09T00:00:01.000Z',
        durationMs: 1000,
        argv: ['test/test-cases/example.test.ts']
      },
      summary: {
        total: 1,
        passed: 0,
        failed: 1,
        skipped: 0
      },
      tests: [{
        file: 'test/test-cases/example.test.ts',
        name: 'fails usefully',
        status: 'failed',
        failureMessage: 'expected true'
      }]
    }, null, 2)}\n`)

    const latestLogPath = await writeLatestRunLog(artifacts, 1)
    await cleanupTestOutputRoot(dir)
    const latestLog = await readFile(latestLogPath, 'utf8')

    expect((await readdir(dir)).sort()).toEqual(['latest.log'])
    expect(latestLog).toContain(`Run ID: ${artifacts.runId}`)
    expect(latestLog).toContain('Exit code: 1')
    expect(latestLog).toContain('test/test-cases/example.test.ts :: fails usefully: expected true')
    expect(latestLog).toContain('runner transcript')
    expect(latestLog).toContain('command transcript')
  })

  test('path-selection labels strip the test/test-cases prefix for validation paths', () => {
    expect(formatSelectedPathsLabel(['test/test-cases/validation-next/'])).toBe('Selected paths: validation-next')
    expect(formatSelectedPathsLabel(['test/test-cases/validation/'])).toBe('Selected paths: validation')
    expect(formatSelectedPathsLabel(['test/test-cases/e2e/step-4-tts-e2e/tts-services/'])).toBe('Selected paths: step-4-tts-e2e/tts-services')
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

  test('model calibration scans copied run manifests', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-calibration-run-manifest-'))
    tempDirs.push(dir)

    const configPath = join(dir, 'image-config.json')
    await writeFile(configPath, `${JSON.stringify({
      openai: {
        description: 'OpenAI image generation',
        type: 'api',
        models: {
          'gpt-image-1.5': {
            description: 'GPT Image 1.5',
            costPerImageUSD: 0.08,
            costPerImageCents: 8,
            estimation: {
              costMultiplier: 1,
              msPerImage: 1000
            }
          }
        }
      }
    }, null, 2)}\n`)

    const runDir = join(dir, '2026-05-01_00-00-00_test-run')
    const copiedRunDir = join(runDir, 'run')
    await mkdir(copiedRunDir, { recursive: true })
    await writeFile(join(copiedRunDir, '2026-05-01_00-00-01_image-gen.json'), `${JSON.stringify({
      schemaVersion: 2,
      kind: 'image',
      metadata: {
        cost: {
          estimated: {
            steps: [{
              step: 'image',
              provider: 'openai',
              model: 'gpt-image-1.5',
              cost: 2,
              costMultiplier: 1
            }]
          },
          actual: {
            steps: [{
              step: 'image',
              provider: 'openai',
              model: 'gpt-image-1.5',
              cost: 2,
              inputMetric: 'images',
              inputValue: 1
            }]
          }
        },
        timing: {
          actual: {
            steps: [{
              step: 'image',
              provider: 'openai',
              model: 'gpt-image-1.5',
              processingTimeMs: 3000,
              msPerUnit: 1800,
              timingScope: 'wall',
              inputMetric: 'images',
              inputValue: 1
            }]
          }
        }
      }
    }, null, 2)}\n`)

    const report = await applyModelConfigCalibrations(dir, { image: configPath })
    const updatedConfig = await Bun.file(configPath).json() as {
      openai: { models: { 'gpt-image-1.5': { estimation: { msPerImage: number } } } }
    }

    expect(report.runsScanned).toBe(1)
    expect(report.metadataFilesScanned).toBe(1)
    expect(report.updatedModels).toBe(1)
    expect(updatedConfig.openai.models['gpt-image-1.5'].estimation.msPerImage).toBe(1280)
    expect(report.updates[0]?.timeSamples).toBe(1)
    expect(report.updates[0]?.medianTimeValue).toBe(1800)
    expect(report.updates[0]?.notes).toEqual(['Timing calibration uses wall-clock latency observations.'])
  })

  test('model calibration writes split STT provider fragments', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-calibration-stt-fragment-'))
    tempDirs.push(dir)

    const runsRoot = join(dir, 'runs')
    const configDir = join(dir, 'config', 'stt-config')
    await mkdir(configDir, { recursive: true })
    const deepgramConfigPath = join(configDir, 'stt-deepgram.json')
    const openaiConfigPath = join(configDir, 'stt-openai-stt.json')

    await writeFile(deepgramConfigPath, `${JSON.stringify({
      deepgram: {
        description: 'Deepgram transcription',
        type: 'api',
        models: {
          'nova-3': {
            description: 'Nova 3',
            costPerHourCents: 27,
            estimation: {
              costMultiplier: 1,
              msPerSecond: 1000
            }
          }
        }
      }
    }, null, 2)}\n`)
    await writeFile(openaiConfigPath, `${JSON.stringify({
      'openai-stt': {
        description: 'OpenAI transcription',
        type: 'api',
        models: {
          'gpt-4o-mini-transcribe': {
            description: 'GPT-4o mini transcribe',
            costPerHourCents: 36,
            estimation: {
              costMultiplier: 1,
              msPerSecond: 2000
            }
          }
        }
      }
    }, null, 2)}\n`)

    const runDir = join(runsRoot, '2026-05-01_00-00-00_test-run')
    const copiedRunDir = join(runDir, 'run')
    await mkdir(copiedRunDir, { recursive: true })
    await writeFile(join(copiedRunDir, '2026-05-01_00-00-01_stt.json'), `${JSON.stringify({
      schemaVersion: 2,
      kind: 'stt',
      metadata: {
        timing: {
          actual: {
            steps: [{
              step: 'stt',
              provider: 'deepgram',
              model: 'nova-3',
              processingTimeMs: 3000,
              inputMetric: 'durationSeconds',
              inputValue: 1
            }]
          }
        }
      }
    }, null, 2)}\n`)

    const report = await applyModelConfigCalibrations(runsRoot, { stt: configDir })
    const updatedDeepgramConfig = await Bun.file(deepgramConfigPath).json() as {
      deepgram: { models: { 'nova-3': { estimation: { msPerSecond: number } } } }
    }
    const untouchedOpenaiConfig = await Bun.file(openaiConfigPath).json() as {
      'openai-stt': { models: { 'gpt-4o-mini-transcribe': { estimation: { msPerSecond: number } } } }
    }

    expect(report.runsScanned).toBe(1)
    expect(report.metadataFilesScanned).toBe(1)
    expect(report.updatedModels).toBe(1)
    expect(updatedDeepgramConfig.deepgram.models['nova-3'].estimation.msPerSecond).toBe(1500)
    expect(untouchedOpenaiConfig['openai-stt'].models['gpt-4o-mini-transcribe'].estimation.msPerSecond).toBe(2000)
  })

  test('dashboard report builder expands manifest rows and converts cents to USD', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-dashboard-report-'))
    tempDirs.push(dir)

    const artifacts = await createRunArtifacts(dir)
    const runManifestDir = join(artifacts.runDir, 'run')
    await mkdir(runManifestDir, { recursive: true })

    const urlFile = 'test/test-cases/e2e/step-2-ocr-e2e/url-backends.test.ts'
    const urlName = 'extract url with all backends'
    const docFile = 'test/test-cases/e2e/step-2-ocr-e2e/document.test.ts'
    const docName = 'extract pdf with tesseract'
    const writeFilePath = 'test/test-cases/e2e/step-3-write-e2e/write-services/service-models.test.ts'
    const writeName = 'gpt-5.4-mini model generates summary'
    const downloadFile = 'test/test-cases/e2e/download.test.ts'
    const downloadName = 'download local document input'
    const urlOutputDir = join(artifacts.runDir, 'outputs', 'all-url-run')
    const docOutputDir = join(artifacts.runDir, 'outputs', 'document-run')
    const writeOutputDir = join(artifacts.runDir, 'outputs', 'write-run')

    await writeFile(join(runManifestDir, 'all-url-run.json'), `${JSON.stringify({
      schemaVersion: 2,
      kind: 'extract',
      metadata: {
        resolvedStep2: {
          route: 'article',
          sourceKind: 'article',
          backend: 'defuddle',
          backends: ['defuddle', 'firecrawl', 'glm-reader', 'spider', 'zyte'],
        },
        requestedProviders: [
          { service: 'defuddle', model: 'defuddle' },
          { service: 'firecrawl', model: 'firecrawl' },
          { service: 'glm-reader', model: 'glm-reader' },
          { service: 'spider', model: 'spider' },
          { service: 'zyte', model: 'zyte' },
        ],
        step2: [
          { extractionMethod: 'html+defuddle', processingTime: 100 },
          { extractionMethod: 'html+firecrawl', processingTime: 200 },
        ],
        cost: {
          estimated: {
            steps: [
              { step: 'extract', provider: 'defuddle', model: 'defuddle', cost: 0 },
              { step: 'extract', provider: 'firecrawl', model: 'firecrawl', cost: 0.083 },
            ],
          },
          actual: {
            steps: [
              { step: 'extract', provider: 'defuddle', model: 'defuddle', cost: 0 },
              { step: 'extract', provider: 'firecrawl', model: 'firecrawl', cost: 0.085 },
            ],
          },
        },
        timing: {
          estimated: {
            steps: [
              { step: 'extract', provider: 'defuddle', model: 'defuddle', processingTimeMs: 90 },
              { step: 'extract', provider: 'firecrawl', model: 'firecrawl', processingTimeMs: 180, msPerUnit: 45 },
            ],
          },
          actual: {
            steps: [
              { step: 'extract', provider: 'defuddle', model: 'defuddle', processingTimeMs: 100 },
              { step: 'extract', provider: 'firecrawl', model: 'firecrawl', processingTimeMs: 200, msPerUnit: 50 },
            ],
          },
        },
      },
    }, null, 2)}\n`)
    await writeFile(join(runManifestDir, 'document-run.json'), `${JSON.stringify({
      schemaVersion: 2,
      kind: 'extract',
      metadata: {
        resolvedStep2: {
          route: 'ocr',
          sourceKind: 'document',
          providers: [{ service: 'tesseract', model: 'tesseract' }],
        },
        cost: {
          estimated: {
            steps: [
              { step: 'extract', provider: 'tesseract', model: 'tesseract', cost: 2 },
            ],
          },
          actual: {
            steps: [
              { step: 'extract', provider: 'tesseract', model: 'tesseract', cost: 3 },
            ],
          },
        },
        timing: {
          actual: {
            steps: [
              { step: 'extract', provider: 'tesseract', model: 'tesseract', processingTimeMs: 120 },
            ],
          },
        },
      },
    }, null, 2)}\n`)
    await writeFile(join(runManifestDir, 'write-run.json'), `${JSON.stringify({
      schemaVersion: 2,
      kind: 'write',
      metadata: {
        step2: {
          transcriptionService: 'whisper',
          transcriptionModel: '/Users/example/runtime/models/whisper/ggml-tiny.bin | coreml:/Users/example/runtime/models/whisper/ggml-tiny-encoder.mlmodelc',
          processingTime: 50,
        },
        step3: {
          llmService: 'openai',
          llmModel: 'gpt-5.4-mini',
          processingTime: 400,
        },
        cost: {
          estimated: {
            steps: [
              { step: 'stt', provider: 'whisper', model: 'ggml-tiny.bin', cost: 0 },
              { step: 'llm', provider: 'openai', model: 'gpt-5.4-mini', cost: 0.031 },
            ],
          },
          actual: {
            steps: [
              { step: 'stt', provider: 'whisper', model: 'ggml-tiny.bin', cost: 0 },
              { step: 'llm', provider: 'openai', model: 'gpt-5.4-mini', cost: 0.033 },
            ],
          },
        },
        timing: {
          actual: {
            steps: [
              { step: 'stt', provider: 'whisper', model: 'ggml-tiny.bin', processingTimeMs: 50 },
              { step: 'llm', provider: 'openai', model: 'gpt-5.4-mini', processingTimeMs: 400 },
            ],
          },
        },
      },
    }, null, 2)}\n`)

    const junitCases: ParsedJunitCase[] = [
      {
        id: `${urlFile}::${urlName}`,
        file: urlFile,
        name: urlName,
        line: 10,
        durationMs: 5000,
        status: 'passed',
        failureMessage: null,
      },
      {
        id: `${docFile}::${docName}`,
        file: docFile,
        name: docName,
        line: 20,
        durationMs: 3000,
        status: 'passed',
        failureMessage: null,
      },
      {
        id: `${writeFilePath}::${writeName}`,
        file: writeFilePath,
        name: writeName,
        line: 30,
        durationMs: 2000,
        status: 'passed',
        failureMessage: null,
      },
      {
        id: `${downloadFile}::${downloadName}`,
        file: downloadFile,
        name: downloadName,
        line: 40,
        durationMs: 1000,
        status: 'passed',
        failureMessage: null,
      },
    ]
    const metrics: ParsedCommandMetric[] = [
      {
        source: 'runCommand',
        command: 'bun src/cli/create-cli.ts extract https://example.com --all-url',
        args: ['src/cli/create-cli.ts', 'extract', 'https://example.com', '--all-url'],
        exitCode: 0,
        durationMs: 5000,
        outputDir: urlOutputDir,
        callerFile: urlFile,
        callerLine: 10,
        callerColumn: 1,
        at: '2026-05-14T12:00:05.000Z',
        testName: urlName,
        estimatedCostCents: 0.083,
        actualCostCents: 0.085,
        estimatedProcessingTimeMs: 270,
        actualProcessingTimeMs: 300,
      },
      {
        source: 'runCommand',
        command: 'bun src/cli/create-cli.ts extract input/examples/document/1-document.pdf --tesseract',
        args: ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--tesseract'],
        exitCode: 0,
        durationMs: 3000,
        outputDir: docOutputDir,
        callerFile: docFile,
        callerLine: 20,
        callerColumn: 1,
        at: '2026-05-14T12:00:09.000Z',
        testName: docName,
        estimatedCostCents: 2,
        actualCostCents: 3,
        estimatedProcessingTimeMs: null,
        actualProcessingTimeMs: 120,
      },
      {
        source: 'runCommand',
        command: 'bun src/cli/create-cli.ts write https://ajc.pics/autoshow/examples/1-audio.mp3 --openai gpt-5.4-mini',
        args: ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--openai', 'gpt-5.4-mini'],
        exitCode: 0,
        durationMs: 2000,
        outputDir: writeOutputDir,
        callerFile: writeFilePath,
        callerLine: 30,
        callerColumn: 1,
        at: '2026-05-14T12:00:11.000Z',
        testName: writeName,
        estimatedCostCents: 0.031,
        actualCostCents: 0.033,
        estimatedProcessingTimeMs: null,
        actualProcessingTimeMs: 450,
      },
      {
        source: 'runCommand',
        command: 'bun src/cli/create-cli.ts download input/examples/document/1-document.pdf',
        args: ['src/cli/create-cli.ts', 'download', 'input/examples/document/1-document.pdf'],
        exitCode: 0,
        durationMs: 1000,
        outputDir: null,
        callerFile: downloadFile,
        callerLine: 40,
        callerColumn: 1,
        at: '2026-05-14T12:00:12.000Z',
        testName: downloadName,
        estimatedCostCents: 0,
        actualCostCents: 0,
        estimatedProcessingTimeMs: null,
        actualProcessingTimeMs: null,
      },
    ]

    const report = await buildDashboardReportData(
      junitCases,
      metrics,
      artifacts,
      '2026-05-14T12:00:10.000Z',
      artifacts.startedAtMs + 10_000,
      ['test/test-cases/e2e/step-2-ocr-e2e']
    )
    const rows = report['tests'] as Array<Record<string, unknown>>
    const urlRows = rows.filter(row => row['category'] === 'url')
    const documentRows = rows.filter(row => row['category'] === 'document')
    const llmRows = rows.filter(row => row['category'] === 'llm')
    const firecrawl = urlRows.find(row => row['serviceName'] === 'firecrawl') as Record<string, unknown>
    const firecrawlCost = firecrawl['cost'] as Record<string, unknown>
    const firecrawlDurations = firecrawl['durations'] as Record<string, Record<string, unknown>>

    expect(report['schemaVersion']).toBe(2)
    expect(urlRows.map(row => row['serviceName']).sort()).toEqual([
      'defuddle',
      'firecrawl',
      'glm-reader',
      'spider',
      'zyte',
    ])
    expect(documentRows.map(row => row['serviceName'])).toEqual(['tesseract'])
    expect(llmRows.map(row => row['serviceName'])).toEqual(['openai'])
    expect(rows.some(row => row['serviceName'] === 'whisper')).toBe(false)
    expect(rows.some(row => row['testName'] === downloadName)).toBe(false)
    expect(firecrawlCost['estimatedUsd']).toBeCloseTo(0.00083)
    expect(firecrawlCost['runtimeEstimatedUsd']).toBeCloseTo(0.00085)
    expect(firecrawlDurations['primaryStep']?.['actualMs']).toBe(200)
    expect(firecrawlDurations['primaryStep']?.['actualMsPerUnit']).toBe(50)
  })

  test('dashboard report writer copies results and maintains an index', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-dashboard-write-'))
    tempDirs.push(dir)

    const artifacts = await createRunArtifacts(dir)
    const resultsRoot = join(dir, 'reports', 'results')
    const report = {
      schemaVersion: 2,
      generatedAt: '2026-05-14T12:00:00.000Z',
      run: { id: artifacts.runId },
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      tests: [],
    }

    const paths = await writeDashboardReportFiles(artifacts, report, { resultsRoot })
    const copiedReport = JSON.parse(await readFile(paths.resultsReportPath, 'utf8')) as Record<string, unknown>
    const runReport = JSON.parse(await readFile(paths.runReportPath, 'utf8')) as Record<string, unknown>
    const index = JSON.parse(await readFile(paths.indexPath, 'utf8')) as Record<string, unknown>

    expect(copiedReport['schemaVersion']).toBe(2)
    expect(runReport['schemaVersion']).toBe(2)
    expect(index['files']).toEqual([`${artifacts.runId}-dashboard-report.json`])
  })

  test('validation and setup paths stay mappedless in price selection', () => {
    const allFiles = [
      'test/test-cases/setup/tts-models/tts-setup.test.ts',
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
    expect(resolvePriceSelection(allFiles, ['test/test-cases/setup/'])).toEqual({
      suiteName: 'Selected paths: setup',
      commands: []
    })
  })

  test('price mode uses e2e path selections', () => {
    const allFiles = [
      'test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts',
      'test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts',
      'test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts',
      'test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ocr-paddle-ocr-image.test.ts'
    ]

    const selected = resolvePriceSelection(allFiles, ['test/test-cases/e2e/step-2-ocr-e2e/ocr-services/'])
    const keys = selected.commands.map((command) => command.key)

    expect(selected.suiteName).toBe('Selected paths: step-2-ocr-e2e/ocr-services')
    expect(keys).toContain('extract-mistral-mistral-ocr-2512')
    expect(keys).toContain('extract-firecrawl-url')
    expect(keys).not.toContain('extract-paddle-ocr-image')
  })

  test('price mode with no path filters resolves all mapped tests', () => {
    const selected = resolvePriceSelection([], [])
    const keys = selected.commands.map((command) => command.key)

    expect(selected.suiteName).toBe('All mapped tests')
    expect(keys).toContain('extract-firecrawl-url')
    expect(keys).toContain('music-elevenlabs-music_v1')
    expect(keys).toContain('tts-openai-gpt-4o-mini-tts')
  })

  test('extract price registry commands use public selector flags', () => {
    const internalExtractSelectorFlags = new Set([
      '--aws-textract',
      '--gcloud-docai',
      '--gemini-ocr',
      '--gemini-stt',
      '--glm-stt',
      '--openai-ocr',
      '--openai-stt',
      '--scrapecreators-stt',
      '--supadata-stt',
      '--unstructured-ocr'
    ])

    const offenders = BUDGET_PRICE_SELECTION_REGISTRY
      .filter(entry => entry.args[0] === 'src/cli/create-cli.ts' && entry.args[1] === 'extract')
      .flatMap(entry =>
        entry.args
          .filter(arg => internalExtractSelectorFlags.has(arg))
          .map(arg => `${entry.key}: ${arg}`)
      )

    expect(offenders).toEqual([])
  })

  test('specific e2e files resolve only their mapped price commands', () => {
    const allFiles = [
      'test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts',
      'test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts'
    ]

    const serviceModelKeys = resolvePriceSelection(allFiles, [
      'test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts'
    ]).commands.map((command) => command.key)
    const firecrawlKeys = resolvePriceSelection(allFiles, [
      'test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts'
    ]).commands.map((command) => command.key)

    expect(serviceModelKeys).toContain('extract-mistral-mistral-ocr-2512')
    expect(serviceModelKeys).not.toContain('extract-firecrawl-url')
    expect(firecrawlKeys).toEqual(['extract-firecrawl-url'])
  })

  test('price mode rejects legacy test-price selectors', () => {
    const allFiles = [
      'test/test-cases/e2e/step-4-tts-e2e/tts-services/service-models.test.ts'
    ]

    expect(() => resolvePriceSelection(allFiles, [
      'test/test-price/step-4-tts/services'
    ])).toThrow('--test-price now uses normal test paths')
  })

  test('price path selections match path boundaries', () => {
    const allFiles = [
      'test/test-cases/e2e/step-7-music-gen-e2e/elevenlabs-music-gen.test.ts',
      'test/test-cases/e2e/step-7-music-gen-e2e/deapi-music-gen.test.ts',
      'test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts',
      'test/test-cases/e2e/step-7-music-gen-e2e/gemini-music-gen.test.ts',
      'test/test-cases/e2e/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts'
    ]

    const musicKeys = resolvePriceSelection(allFiles, ['test/test-cases/e2e/step-7-music-gen-e2e/'])
      .commands.map((command) => command.key)
    const lyricsVideoKeys = resolvePriceSelection(allFiles, ['test/test-cases/e2e/step-7-music-lyrics-video-e2e/'])
      .commands.map((command) => command.key)

    expect(musicKeys).toContain('music-elevenlabs-music_v1')
    expect(musicKeys).toContain('music-deapi-AceStep_1_5_Turbo')
    expect(musicKeys).not.toContain('transcribe-whisper-large-v3-turbo')
    expect(lyricsVideoKeys).toContain('transcribe-whisper-large-v3-turbo')
    expect(lyricsVideoKeys).not.toContain('music-elevenlabs-music_v1')
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

  test('e2e budget keys resolve to budget-skippable price registry entries', async () => {
    const glob = new Bun.Glob('test/test-cases/e2e/**/*.test.ts')
    const allFiles = (await Array.fromAsync(glob.scan({ dot: false }))).sort()
    const budgetSkippableKeys = new Set(
      BUDGET_PRICE_SELECTION_REGISTRY
        .filter((entry) => entry.budgetSkippable)
        .map((entry) => entry.key)
    )
    const missing: string[] = []
    const unselected: string[] = []

    for (const file of allFiles) {
      const source = await Bun.file(file).text()
      const budgetKeys = [...new Set(extractE2EBudgetKeys(file, source))]
      if (budgetKeys.length === 0) {
        continue
      }

      const selectedKeys = new Set(
        resolvePriceSelection(allFiles, [file], true).commands.map((command) => command.key)
      )

      for (const key of budgetKeys) {
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

  test('e2e test files do not contain direct --price command coverage', async () => {
    const glob = new Bun.Glob('test/test-cases/e2e/**/*.test.ts')
    const allFiles = (await Array.fromAsync(glob.scan({ dot: false }))).sort()
    const filesWithPriceFlag: string[] = []

    for (const file of allFiles) {
      const source = await Bun.file(file).text()
      if (source.includes('--price')) {
        filesWithPriceFlag.push(file)
      }
    }

    expect(filesWithPriceFlag).toEqual([])
  })

  test('TTS service budget preflight includes remaining voice clone entries', () => {
    const allFiles = [
      'test/test-cases/e2e/step-4-tts-e2e/tts-services/service-models.test.ts'
    ]

    const keys = resolvePriceSelection(allFiles, [
      'test/test-cases/e2e/step-4-tts-e2e/tts-services/service-models.test.ts'
    ], true).commands.map((command) => command.key)

    expect(keys).toContain('tts-deapi-qwen3-voice-clone')
    expect(keys).toContain('tts-groq-canopylabs/orpheus-v1-english')
    expect(keys).not.toContain(['tts-groq-canopylabs/orpheus', 'arabic-saudi'].join('-'))
    expect(keys).toContain('tts-gcloud-studio')
    expect(keys.filter((key) => key.startsWith('tts-deepgram-'))).toEqual([`tts-deepgram-${DEEPGRAM_DEFAULT_VOICE}`])
    for (const model of SUPPORTED_DEAPI_RUNNABLE_TTS_MODELS) {
      expect(keys).toContain(`tts-deapi-${model}`)
    }
    expect(keys).not.toContain('tts-minimax-speech-2.8-turbo-clone')
  })

  test('music selected-file budget preflight includes keys for live ElevenLabs music skips', () => {
    const allFiles = [
      'test/test-cases/e2e/step-7-music-gen-e2e/elevenlabs-music-gen.test.ts',
      'test/test-cases/e2e/step-7-music-gen-e2e/deapi-music-gen.test.ts',
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
    expect(minimaxKeys).toContain('music-multi-minimax-music-2.5-gemini-lyria-3-clip-preview')
    expect(minimaxKeys).toContain('music-pipeline-minimax-music-2.5')
    for (const model of MINIMAX_INSTRUMENTAL_MUSIC_MODELS) {
      expect(minimaxKeys).toContain(`music-minimax-${model}`)
    }
    expect(minimaxKeys).not.toContain('music-minimax-music-2.5')

    const deapiKeys = resolvePriceSelection(allFiles, [
      'test/test-cases/e2e/step-7-music-gen-e2e/deapi-music-gen.test.ts'
    ], true).commands.map((command) => command.key)
    for (const model of SUPPORTED_DEAPI_MUSIC_MODELS) {
      expect(deapiKeys).toContain(`music-deapi-${model}`)
    }

    const geminiKeys = resolvePriceSelection(allFiles, [
      'test/test-cases/e2e/step-7-music-gen-e2e/gemini-music-gen.test.ts'
    ], true).commands.map((command) => command.key)
    expect(geminiKeys).toContain('music-gemini-lyria-3-pro-preview')
    expect(geminiKeys).not.toContain('music-gemini-lyria-3-clip-preview')
  })
})
