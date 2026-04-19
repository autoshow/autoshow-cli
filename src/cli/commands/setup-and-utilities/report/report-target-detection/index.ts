import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { discoverRunDirectories, listProviderDirectories } from '~/cli/commands/setup-and-utilities/report/report-internals/run-discovery'
import {
  hasSttProviderResultMetadata,
  parseProviderResultEnvelope
} from '~/cli/commands/process-steps/step-2-stt/stt-utils/stt-result-artifacts'

export type ReportKind = 'stt' | 'ocr'

export type DetectedReportTarget = {
  targetDir: string
  runDirectories: string[]
  kind: ReportKind
}

const OCR_EXTRACTION_ARTIFACT_FILES = new Set([
  'extraction.txt',
  'extraction.tsv',
  'extraction.hocr'
])

const RESULT_PARSE_FAILED = Symbol('result-parse-failed')

const readArtifactResult = async (
  artifactDir: string
): Promise<unknown | typeof RESULT_PARSE_FAILED | undefined> => {
  const resultPath = join(artifactDir, 'result.json')
  if (!await Bun.file(resultPath).exists()) {
    return undefined
  }

  try {
    return await Bun.file(resultPath).json() as unknown
  } catch {
    return RESULT_PARSE_FAILED
  }
}

const classifyArtifactDirectory = async (
  artifactDir: string,
  entries: string[],
  allowGenericProviderResultOcr = false
): Promise<{ hasSttArtifacts: boolean, hasOcrArtifacts: boolean }> => {
  const hasTranscript = entries.includes('transcription.txt')
  const hasOcrExtraction = entries.some((entry) => OCR_EXTRACTION_ARTIFACT_FILES.has(entry))
  const rawResult = await readArtifactResult(artifactDir)

  const hasResult = rawResult !== undefined
  const hasSttResultMetadata = rawResult !== RESULT_PARSE_FAILED && hasSttProviderResultMetadata(rawResult)
  const hasGenericProviderResult = rawResult !== RESULT_PARSE_FAILED && parseProviderResultEnvelope(rawResult) !== undefined

  if (hasTranscript && hasResult && !hasSttResultMetadata && !hasOcrExtraction) {
    const resultPath = join(artifactDir, 'result.json')
    throw new Error(
      rawResult === RESULT_PARSE_FAILED
        ? `Stored STT artifact ${resultPath} could not be parsed as JSON.`
        : `Stored STT artifact ${resultPath} does not contain STT metadata (expected metadata.transcriptionService and metadata.transcriptionModel).`
    )
  }

  return {
    hasSttArtifacts: hasSttResultMetadata,
    hasOcrArtifacts: hasResult && (
      hasOcrExtraction
      || (
        allowGenericProviderResultOcr
        && !hasTranscript
        && !hasSttResultMetadata
        && hasGenericProviderResult
      )
    )
  }
}

export const classifyReportRunDirectory = async (
  runDir: string
): Promise<ReportKind | 'mixed' | null> => {
  const providerDirectories = await listProviderDirectories(runDir)
  const rootEntries = await readdir(runDir).catch((): string[] => [])
  let hasSttArtifacts = false
  let hasOcrArtifacts = false

  const rootClassification = await classifyArtifactDirectory(runDir, rootEntries)
  hasSttArtifacts ||= rootClassification.hasSttArtifacts
  hasOcrArtifacts ||= rootClassification.hasOcrArtifacts

  for (const providerDirectory of providerDirectories) {
    const artifactDir = join(runDir, 'providers', providerDirectory)
    const providerEntries = await readdir(artifactDir).catch((): string[] => [])
    const classification = await classifyArtifactDirectory(artifactDir, providerEntries, true)
    hasSttArtifacts ||= classification.hasSttArtifacts
    hasOcrArtifacts ||= classification.hasOcrArtifacts
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
    (resolvedTarget) => `No reportable runs found under ${resolvedTarget}. Expected a run directory with run.json plus report artifacts, or a batch root whose immediate child directories contain those artifacts.`
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
      `Could not infer report type from these runs: ${unclassifiedRuns.map((entry) => entry.runDir).join(', ')}. STT runs need result.json with STT metadata; OCR runs need current provider result artifacts.`
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
