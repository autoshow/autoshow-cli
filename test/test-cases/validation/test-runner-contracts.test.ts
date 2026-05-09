import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseRunnerArgs } from '../../test-runner/args'
import { cleanupTestOutputRoot, createRunArtifacts, writeLatestRunLog } from '../../test-runner/artifacts'
import { applyModelConfigCalibrations } from '../../test-runner/model-calibration'
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
        ? readStringProperty(callBody, 'cliFlag')?.replace(/^--/, '').replace(/-ocr$/, '')
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
          'gpt-image-1-mini': {
            description: 'GPT Image 1 Mini',
            costPerImageUSD: 0.02,
            costPerImageCents: 2,
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
              model: 'gpt-image-1-mini',
              cost: 2,
              costMultiplier: 1
            }]
          },
          actual: {
            steps: [{
              step: 'image',
              provider: 'openai',
              model: 'gpt-image-1-mini',
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
              model: 'gpt-image-1-mini',
              processingTimeMs: 3000,
              inputMetric: 'images',
              inputValue: 1
            }]
          }
        }
      }
    }, null, 2)}\n`)

    const report = await applyModelConfigCalibrations(dir, { image: configPath })
    const updatedConfig = await Bun.file(configPath).json() as {
      openai: { models: { 'gpt-image-1-mini': { estimation: { msPerImage: number } } } }
    }

    expect(report.runsScanned).toBe(1)
    expect(report.metadataFilesScanned).toBe(1)
    expect(report.updatedModels).toBe(1)
    expect(updatedConfig.openai.models['gpt-image-1-mini'].estimation.msPerImage).toBe(1500)
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

  test('e2e budget keys resolve to budget-skippable price registry entries', async () => {
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

  test('TTS service budget preflight includes voice clone entries', () => {
    const allFiles = [
      'test/test-cases/e2e/step-4-tts-e2e/tts-services/service-models.test.ts'
    ]

    const keys = resolvePriceSelection(allFiles, [
      'test/test-cases/e2e/step-4-tts-e2e/tts-services/service-models.test.ts'
    ], true).commands.map((command) => command.key)

    expect(keys).toContain('tts-deapi-qwen3-voice-clone')
    expect(keys).toContain('tts-minimax-speech-2.8-turbo-clone')
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
