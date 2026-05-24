import { test, expect, beforeAll, afterAll } from 'bun:test'
import { readdir, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { runCommand, fileExists, findLatestDirectory, cleanupTestOutput, OUTPUT_DIR } from '../../../../test-utils/test-helpers'
import { readBatchItems, readBatchSource, readRunMetadata } from '../../../../test-utils/manifest-helpers'

const createdDirs: string[] = []
const TIMESTAMPED_CHILD_DIR_PATTERN = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}_/

type Step1Metadata = {
  audioFileName?: string
  audioFileSize?: number
  format?: string
  pageCount?: number
  fileSize?: number
  title?: string
  channel?: string
  slug?: string
}

export type Metadata = {
  step1?: Step1Metadata
  step2?: unknown
  step3?: unknown
}

type CaseInput = string | (() => string | Promise<string>)

export type SingleCase = {
  name: string
  input: CaseInput
  suffix?: string
  checks: (metadata: Metadata, outputDir: string) => Promise<void>
}

export type BatchCase = {
  name: string
  input: CaseInput
  extraArgs: string[]
  expectedSourceKind: string
  expectedSelectedCount?: number
}

type BatchSource = {
  sourceKind?: string
  selectedCount?: number
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  return value as Record<string, unknown>
}

const asString = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined

const asNumber = (value: unknown): number | undefined => typeof value === 'number' ? value : undefined

const withDefined = <T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void => {
  if (value !== undefined) {
    target[key] = value
  }
}

const resolveCaseInput = async (input: CaseInput): Promise<string> =>
  typeof input === 'function' ? await input() : input

const parseMetadata = (value: unknown): Metadata => {
  const root = asRecord(value)
  if (!root) {
    return {}
  }

  const step1Record = asRecord(root['step1'])
  const output: Metadata = {}
  if (step1Record) {
    const step1: Step1Metadata = {}
    withDefined(step1, 'audioFileName', asString(step1Record['audioFileName']))
    withDefined(step1, 'audioFileSize', asNumber(step1Record['audioFileSize']))
    withDefined(step1, 'format', asString(step1Record['format']))
    withDefined(step1, 'pageCount', asNumber(step1Record['pageCount']))
    withDefined(step1, 'fileSize', asNumber(step1Record['fileSize']))
    withDefined(step1, 'title', asString(step1Record['title']))
    withDefined(step1, 'channel', asString(step1Record['channel']))
    withDefined(step1, 'slug', asString(step1Record['slug']))
    output.step1 = step1
  }
  if ('step2' in root) {
    output.step2 = root['step2']
  }
  if ('step3' in root) {
    output.step3 = root['step3']
  }
  return output
}

const parseBatchSource = (value: unknown): BatchSource => {
  const root = asRecord(value)
  if (!root) {
    return {}
  }
  const source: BatchSource = {}
  withDefined(source, 'sourceKind', asString(root['sourceKind']))
  withDefined(source, 'selectedCount', asNumber(root['selectedCount']))
  return source
}

const rememberDir = (dir: string): void => {
  if (!createdDirs.includes(dir)) {
    createdDirs.push(dir)
  }
}

const normalizeOutputDir = (dir: string): string =>
  dir.replace(/\\/g, '/').replace(/^\.\//, '')

const getOutputDirs = async (): Promise<string[]> => {
  try {
    const entries = await readdir(OUTPUT_DIR, { withFileTypes: true })
    return entries.filter(entry => entry.isDirectory()).map(entry => join(OUTPUT_DIR, entry.name)).sort()
  } catch {
    return []
  }
}

const getNewOutputDir = async (dirsBefore: Set<string>): Promise<string | null> => {
  const dirsAfter = await getOutputDirs()
  const newDirs = dirsAfter.filter(dir => !dirsBefore.has(dir))
  const latest = newDirs.sort().at(-1) ?? null
  if (latest) {
    rememberDir(latest)
  }
  return latest
}

const resolveBatchOutputDir = async (outputDir: string | null, dirsBefore: Set<string>): Promise<string | null> => {
  if (outputDir) {
    const candidates = [outputDir, dirname(outputDir)]
    for (const candidate of candidates) {
      if (await fileExists(`${candidate}/source.json`) && await fileExists(`${candidate}/batch.json`)) {
        rememberDir(candidate)
        return candidate
      }
    }
  }

  return await getNewOutputDir(dirsBefore)
}

export const setupDownloadInputTypeLifecycle = (suffixes: string[]): void => {
  const uniqueSuffixes = Array.from(new Set(suffixes))

  beforeAll(async () => {
    await Promise.all(uniqueSuffixes.map(suffix => cleanupTestOutput(suffix)))
  })

  afterAll(async () => {
    if (process.env['AUTOSHOW_TEST_PRESERVE_ARTIFACTS'] === '0') {
      await Promise.all(createdDirs.map(dir => rm(dir, { recursive: true, force: true }).catch(() => {})))
      await Promise.all(uniqueSuffixes.map(suffix => cleanupTestOutput(suffix)))
    }
  })
}

export const assertDownloadOnlyArtifacts = async (outputDir: string, metadata: Metadata): Promise<void> => {
  expect(await fileExists(`${outputDir}/transcription.txt`)).toBe(false)
  expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(false)
  expect(await fileExists(`${outputDir}/text.json`)).toBe(false)
  expect(await fileExists(`${outputDir}/prompt.md`)).toBe(false)
  expect(metadata.step2).toBeUndefined()
  expect(metadata.step3).toBeUndefined()
}

export const defineSingleCaseTest = (tc: SingleCase): void => {
  test(tc.name, async () => {
    if (tc.suffix) {
      await cleanupTestOutput(tc.suffix)
    }

    const input = await resolveCaseInput(tc.input)
    const dirsBefore = tc.suffix ? null : new Set(await getOutputDirs())
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'download', input],
      { testName: tc.name }
    )
    expect(result.exitCode).toBe(0)

    const outputDir = result.outputDir
      ?? (tc.suffix
        ? await findLatestDirectory(tc.suffix)
        : (dirsBefore ? await getNewOutputDir(dirsBefore) : null))
    expect(outputDir).not.toBeNull()
    if (!outputDir) {
      return
    }
    rememberDir(outputDir)

    expect(await fileExists(`${outputDir}/run.json`)).toBe(true)
    const metadata = parseMetadata(await readRunMetadata(outputDir))
    expect(metadata.step1).toBeDefined()

    await tc.checks(metadata, outputDir)
    await assertDownloadOnlyArtifacts(outputDir, metadata)
  })
}

export const defineBatchCaseTest = (tc: BatchCase): void => {
  test(tc.name, async () => {
    const dirsBefore = new Set(await getOutputDirs())
    const input = await resolveCaseInput(tc.input)

    const result = await runCommand([
      'src/cli/create-cli.ts',
      'download',
      input,
      ...tc.extraArgs,
    ], {
      testName: tc.name
    })
    expect(result.exitCode).toBe(0)

    const batchDir = await resolveBatchOutputDir(result.outputDir, dirsBefore)
    expect(batchDir).not.toBeNull()
    if (!batchDir) {
      return
    }

    expect(await fileExists(`${batchDir}/source.json`)).toBe(true)
    expect(await fileExists(`${batchDir}/batch.json`)).toBe(true)
    const infoEntries = await readBatchItems(batchDir)

    const source = parseBatchSource(await readBatchSource(batchDir))
    expect(source.sourceKind).toBe(tc.expectedSourceKind)
    if (tc.expectedSelectedCount !== undefined) {
      expect(source.selectedCount).toBe(tc.expectedSelectedCount)
    } else {
      expect((source.selectedCount ?? 0) > 0).toBe(true)
    }

    const itemDirs = (await readdir(batchDir, { withFileTypes: true }))
      .filter(entry => entry.isDirectory())
      .map(entry => join(batchDir, entry.name))
      .sort()
    for (const itemDir of itemDirs) {
      expect(basename(itemDir)).not.toMatch(TIMESTAMPED_CHILD_DIR_PATTERN)
    }
    if (tc.expectedSelectedCount !== undefined) {
      expect(itemDirs.length).toBe(tc.expectedSelectedCount)
    } else {
      expect(itemDirs.length).toBeGreaterThan(0)
    }

    const firstItemDir = itemDirs[0]
    if (!firstItemDir) {
      return
    }

    expect(await fileExists(`${firstItemDir}/run.json`)).toBe(true)
    expect(infoEntries.length).toBe(itemDirs.length)
    const rawMetadata = await readRunMetadata(firstItemDir)
    const firstInfoEntry = asRecord(infoEntries[0])
    expect(firstInfoEntry).not.toBeNull()
    if (!firstInfoEntry) {
      return
    }
    const normalizedInfoEntry = {
      ...firstInfoEntry,
      outputDir: typeof firstInfoEntry['outputDir'] === 'string'
        ? normalizeOutputDir(firstInfoEntry['outputDir'])
        : firstInfoEntry['outputDir']
    }
    expect(normalizedInfoEntry).toMatchObject({
      ...rawMetadata,
      outputDir: normalizeOutputDir(firstItemDir)
    })
    const metadata = parseMetadata(await readRunMetadata(firstItemDir))
    expect(metadata.step1).toBeDefined()
    await assertDownloadOnlyArtifacts(firstItemDir, metadata)
  })
}
