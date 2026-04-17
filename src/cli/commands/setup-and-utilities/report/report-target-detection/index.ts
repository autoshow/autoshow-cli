import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { discoverRunDirectories, listProviderDirectories } from '~/cli/commands/setup-and-utilities/report/report-internals/run-discovery'

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

export const discoverReportRunDirectories = async (targetPath: string): Promise<string[]> =>
  discoverRunDirectories(
    targetPath,
    (resolvedTarget) => `No reportable runs found under ${resolvedTarget}. Expected a run directory with providers/ and run.json, or a batch root whose immediate child directories contain those artifacts.`
  )

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
