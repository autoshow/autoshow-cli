import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'


export type ReportKind = 'stt' | 'ocr'

export type DetectedReportTarget = {
  targetDir: string
  runDirectories: string[]
  kind: ReportKind
}

const OCR_ARTIFACT_FILES = new Set([
  'result.json',
  'extraction.txt',
  'extraction.tsv',
  'extraction.hocr'
])

const isRunDirectory = async (targetDir: string): Promise<boolean> => {
  const entries = await readdir(targetDir).catch(() => null)
  if (!entries) {
    return false
  }

  return entries.includes('providers') && entries.includes('run.json')
}

const listProviderDirectories = async (runDir: string): Promise<string[]> => {
  const providerEntries = await readdir(join(runDir, 'providers'), { withFileTypes: true }).catch(() => [])
  return providerEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
}

export const classifyReportRunDirectory = async (
  runDir: string
): Promise<ReportKind | 'mixed' | null> => {
  const providerDirectories = await listProviderDirectories(runDir)
  let hasSttArtifacts = false
  let hasOcrArtifacts = false

  for (const providerDirectory of providerDirectories) {
    const providerEntries = await readdir(join(runDir, 'providers', providerDirectory)).catch((): string[] => [])
    if (providerEntries.includes('transcription.evidence.json')) {
      hasSttArtifacts = true
    }

    if (
      providerEntries.includes('result.json')
      && providerEntries.some((entry) => OCR_ARTIFACT_FILES.has(entry))
    ) {
      hasOcrArtifacts = true
    }
  }

  if (hasSttArtifacts && hasOcrArtifacts) {
    return 'mixed'
  }
  if (hasSttArtifacts) {
    return 'stt'
  }
  if (hasOcrArtifacts) {
    return 'ocr'
  }

  return null
}

export const discoverReportRunDirectories = async (targetPath: string): Promise<string[]> => {
  const resolvedTarget = resolve(targetPath)
  const directEntries = await readdir(resolvedTarget, { withFileTypes: true }).catch(() => null)
  if (!directEntries) {
    throw new Error(`Target path does not exist or is not readable: ${resolvedTarget}`)
  }

  if (await isRunDirectory(resolvedTarget)) {
    return [resolvedTarget]
  }

  const runDirectories: string[] = []
  for (const entry of directEntries) {
    if (!entry.isDirectory()) {
      continue
    }

    const childDir = join(resolvedTarget, entry.name)
    if (await isRunDirectory(childDir)) {
      runDirectories.push(childDir)
    }
  }

  if (runDirectories.length === 0) {
    throw new Error(
      `No reportable runs found under ${resolvedTarget}. Expected a run directory with providers/ and run.json, or a batch root whose immediate child directories contain those artifacts.`
    )
  }

  return runDirectories.sort()
}

export const detectReportTarget = async (targetPath: string): Promise<DetectedReportTarget> => {
  const targetDir = resolve(targetPath)
  const runDirectories = await discoverReportRunDirectories(targetDir)
  const classifications = await Promise.all(runDirectories.map(async (runDir) => ({
    runDir,
    kind: await classifyReportRunDirectory(runDir)
  })))

  const mixedRuns = classifications.filter((entry) => entry.kind === 'mixed')
  if (mixedRuns.length > 0) {
    throw new Error(
      `Report target contains runs with mixed STT and OCR artifacts: ${mixedRuns.map((entry) => entry.runDir).join(', ')}`
    )
  }

  const unclassifiedRuns = classifications.filter((entry) => entry.kind === null)
  if (unclassifiedRuns.length > 0) {
    throw new Error(
      `Could not infer report type from these runs: ${unclassifiedRuns.map((entry) => entry.runDir).join(', ')}. STT runs need transcription.evidence.json; OCR runs need provider result.json plus extraction.* artifacts.`
    )
  }

  const kinds = new Set(classifications.flatMap((entry) => entry.kind === null || entry.kind === 'mixed' ? [] : [entry.kind]))
  if (kinds.size !== 1) {
    throw new Error(
      `Mixed report kinds are not supported in one invocation. Found ${classifications.map((entry) => `${entry.runDir}=${entry.kind ?? 'unknown'}`).join(', ')}`
    )
  }

  const [kind] = [...kinds]
  if (!kind) {
    throw new Error(`Could not determine report type for ${targetDir}`)
  }

  return {
    targetDir,
    runDirectories,
    kind
  }
}
