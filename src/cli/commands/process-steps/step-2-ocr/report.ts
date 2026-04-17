import { readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

import {
  ExtractionMetadataSchema,
  ExtractionResultSchema,
  type ExtractionMetadata,
  type ExtractionResult,
  type OcrTarget,
  type PageResult
} from '~/types'
import {
  buildMissingTargetsFromEntry,
  getOcrTargetKey,
  parseStoredRequestedTargets,
  readExistingOcrRun,
  type OcrProviderState
} from '~/cli/commands/process-steps/step-2-ocr/ocr-run-state'
import { validateData } from '~/utils/validate/validation'
import { detectReportTarget } from '~/cli/commands/setup-and-utilities/report/report-target-detection'

type OcrProviderArtifact = {
  id: string
  service: OcrTarget['service']
  model: string
  label: string
  metadataPath: string
  metadata: ExtractionMetadata
  result: ExtractionResult
  actualCostCents: number | null
  estimatedCostCents: number | null
  actualProcessingTimeMs: number | null
  estimatedProcessingTimeMs: number | null
}

type MissingOcrProviderSummary = {
  providerId: string
  label: string
  status: OcrProviderState['status']
  artifactDir: string
  retryable: boolean
  lastError: string | null
}

type OcrProviderVariant = {
  providerId: string
  label: string
  text: string
  similarity: number
  confidence: number | null
}

export type OcrComparisonRow = {
  id: string
  pageNumber: number
  windowIndex: number
  consensusText: string
  confidence: number
  averageSimilarity: number
  reviewReasons: string[]
  variants: OcrProviderVariant[]
}

export type OcrProviderSummary = {
  providerId: string
  label: string
  similarity: number
  rowCoverage: number
  pageCoverage: number
  totalPages: number
  tokenEstimate: number
  promptTokens: number | null
  completionTokens: number | null
  actualCostCents: number | null
  estimatedCostCents: number | null
  actualProcessingTimeMs: number | null
  estimatedProcessingTimeMs: number | null
}

export type OcrRunMetadataSummary = {
  title: string | null
  author: string | null
  pageCount: number | null
  format: string | null
  completionStatus: string | null
  actualTotalCostCents: number | null
  estimatedTotalCostCents: number | null
  actualTotalProcessingTimeMs: number | null
  estimatedTotalProcessingTimeMs: number | null
  wallTimeMs: number | null
  requestedProviderKeys: string[]
  producedProviderKeys: string[]
}

export type OcrRunConsensusAnalysis = {
  runDir: string
  runLabel: string
  metadata: OcrRunMetadataSummary
  providers: OcrProviderArtifact[]
  missingProviders: MissingOcrProviderSummary[]
  rows: OcrComparisonRow[]
  reviewRows: OcrComparisonRow[]
  providerSummary: OcrProviderSummary[]
  consensusText: string
  averageSimilarity: number
  pageCountMismatch: boolean
}

type ProviderPageData = {
  pageNumber: number
  normalizedText: string
  tokens: string[]
  confidence: number | null
  localWindows: Array<{ startRel: number, endRel: number }>
}

const OCR_PROVIDER_PREFIXES: OcrTarget['service'][] = ['tesseract', 'paddle-ocr', 'ocrmypdf', 'mistral', 'glm']
const WORD_PATTERN = /[A-Za-z0-9]+(?:[/'’-][A-Za-z0-9]+)*/g
const SENTENCE_SPLIT_PATTERN = /(?<=[.!?])\s+(?=[^\s])/g

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const getString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null

const getFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const average = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

const cleanSpacing = (text: string): string =>
  text
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

const normalizeText = (text: string): string =>
  text
    .normalize('NFKC')
    .replace(/\r\n/g, '\n')
    .replace(/[‘’]/g, '\'')
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-')

const normalizePageText = (text: string): string =>
  normalizeText(text)
    .split(/\n{2,}/)
    .map((paragraph) => cleanSpacing(paragraph.replace(/\s*\n\s*/g, ' ')))
    .filter(Boolean)
    .join('\n\n')
    .trim()

const tokenizeWords = (text: string): string[] =>
  [...normalizeText(text).matchAll(WORD_PATTERN)].map((match) => match[0].toLowerCase())

const tokenizeSurfaceWords = (text: string): string[] =>
  [...normalizeText(text).matchAll(WORD_PATTERN)].map((match) => match[0])

const buildNgramCounts = (words: string[], size: number): Map<string, number> => {
  const counts = new Map<string, number>()
  if (words.length === 0) {
    return counts
  }

  if (words.length < size) {
    counts.set(words.join(' '), 1)
    return counts
  }

  for (let index = 0; index <= words.length - size; index += 1) {
    const gram = words.slice(index, index + size).join(' ')
    counts.set(gram, (counts.get(gram) ?? 0) + 1)
  }

  return counts
}

const computeDiceCoefficient = (left: Map<string, number>, right: Map<string, number>): number => {
  if (left.size === 0 && right.size === 0) {
    return 1
  }
  if (left.size === 0 || right.size === 0) {
    return 0
  }

  let overlap = 0
  let leftTotal = 0
  let rightTotal = 0

  for (const value of left.values()) {
    leftTotal += value
  }
  for (const value of right.values()) {
    rightTotal += value
  }

  const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left]
  for (const [key, value] of smaller) {
    overlap += Math.min(value, larger.get(key) ?? 0)
  }

  return (2 * overlap) / (leftTotal + rightTotal)
}

const computeWordSimilarity = (leftWords: string[], rightWords: string[]): number => {
  if (leftWords.length === 0 && rightWords.length === 0) {
    return 1
  }
  if (leftWords.length === 0 || rightWords.length === 0) {
    return 0
  }

  const gramSize = Math.min(leftWords.length, rightWords.length) >= 2 ? 2 : 1
  const gramScore = computeDiceCoefficient(
    buildNgramCounts(leftWords, gramSize),
    buildNgramCounts(rightWords, gramSize)
  )
  const lengthPenalty = 1 - Math.min(1, Math.abs(leftWords.length - rightWords.length) / Math.max(leftWords.length, rightWords.length))
  return (gramScore * 0.8) + (lengthPenalty * 0.2)
}

const formatCents = (value: number | null): string =>
  value === null ? 'n/a' : `$${(value / 100).toFixed(2)}`

const formatDurationMs = (value: number | null): string => {
  if (value === null) {
    return 'n/a'
  }

  if (value < 1000) {
    return `${Math.round(value)}ms`
  }

  const totalSeconds = Math.round(value / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

const normalizeConfidence = (value: number | null): number | null => {
  if (value === null) {
    return null
  }

  const scaled = value <= 1 ? value * 100 : value
  return clamp(scaled, 0, 100)
}

const readJsonFile = async (path: string): Promise<unknown> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown
  } catch {
    return null
  }
}

const extractCostStepMap = (metadata: unknown, phase: 'actual' | 'estimated'): Map<string, number> => {
  const values = new Map<string, number>()
  if (!isRecord(metadata) || !isRecord(metadata['cost']) || !isRecord(metadata['cost'][phase])) {
    return values
  }

  const steps = metadata['cost'][phase]['steps']
  if (!Array.isArray(steps)) {
    return values
  }

  for (const step of steps) {
    if (!isRecord(step)) {
      continue
    }

    const provider = getString(step['provider'])
    const model = getString(step['model'])
    const cost = getFiniteNumber(step['cost'])
    if (!provider || !model || cost === null) {
      continue
    }

    values.set(getOcrTargetKey({ service: provider as OcrTarget['service'], model }), cost)
  }

  return values
}

const extractTimingStepMap = (metadata: unknown, phase: 'actual' | 'estimated'): Map<string, number> => {
  const values = new Map<string, number>()
  if (!isRecord(metadata) || !isRecord(metadata['timing']) || !isRecord(metadata['timing'][phase])) {
    return values
  }

  const steps = metadata['timing'][phase]['steps']
  if (!Array.isArray(steps)) {
    return values
  }

  for (const step of steps) {
    if (!isRecord(step)) {
      continue
    }

    const provider = getString(step['provider'])
    const model = getString(step['model'])
    const timing = getFiniteNumber(step['processingTimeMs'])
    if (!provider || !model || timing === null) {
      continue
    }

    values.set(getOcrTargetKey({ service: provider as OcrTarget['service'], model }), timing)
  }

  return values
}

const summarizeRunMetadata = (metadata: unknown): OcrRunMetadataSummary => {
  const step1 = isRecord(metadata) && isRecord(metadata['step1']) ? metadata['step1'] : null

  return {
    title: step1 ? getString(step1['title']) : null,
    author: step1 ? getString(step1['author']) : null,
    pageCount: step1 ? getFiniteNumber(step1['pageCount']) : null,
    format: step1 ? getString(step1['format']) : null,
    completionStatus: isRecord(metadata) ? getString(metadata['completionStatus']) : null,
    actualTotalCostCents: isRecord(metadata) && isRecord(metadata['cost']) && isRecord(metadata['cost']['actual'])
      ? getFiniteNumber(metadata['cost']['actual']['totalCost'])
      : null,
    estimatedTotalCostCents: isRecord(metadata) && isRecord(metadata['cost']) && isRecord(metadata['cost']['estimated'])
      ? getFiniteNumber(metadata['cost']['estimated']['totalCost'])
      : null,
    actualTotalProcessingTimeMs: isRecord(metadata) && isRecord(metadata['timing']) && isRecord(metadata['timing']['actual'])
      ? getFiniteNumber(metadata['timing']['actual']['totalProcessingTimeMs'])
      : null,
    estimatedTotalProcessingTimeMs: isRecord(metadata) && isRecord(metadata['timing']) && isRecord(metadata['timing']['estimated'])
      ? getFiniteNumber(metadata['timing']['estimated']['totalProcessingTimeMs'])
      : null,
    wallTimeMs: isRecord(metadata) && isRecord(metadata['timing']) && isRecord(metadata['timing']['aggregate'])
      ? getFiniteNumber(metadata['timing']['aggregate']['wallTimeMs'])
      : null,
    requestedProviderKeys: [],
    producedProviderKeys: []
  }
}

const inferProviderTargetFromDirectoryName = (providerDirName: string): OcrTarget | null => {
  for (const prefix of OCR_PROVIDER_PREFIXES) {
    const marker = `${prefix}-`
    if (providerDirName === prefix) {
      return { service: prefix, model: prefix }
    }
    if (providerDirName.startsWith(marker)) {
      return {
        service: prefix,
        model: providerDirName.slice(marker.length) || prefix
      }
    }
  }

  return null
}

const inferProviderService = (
  metadata: ExtractionMetadata,
  providerDirName: string
): OcrTarget['service'] | null => {
  const direct = getString(metadata.ocrService)
  if (
    direct === 'ocrmypdf'
    || direct === 'paddle-ocr'
    || direct === 'mistral'
    || direct === 'glm'
  ) {
    return direct
  }

  if (metadata.extractionMethod.includes('ocrmypdf')) {
    return 'ocrmypdf'
  }
  if (metadata.extractionMethod.includes('paddle-ocr')) {
    return 'paddle-ocr'
  }
  if (metadata.extractionMethod.includes('mistral-ocr')) {
    return 'mistral'
  }
  if (metadata.extractionMethod.includes('glm-ocr')) {
    return 'glm'
  }

  return inferProviderTargetFromDirectoryName(providerDirName)?.service ?? null
}

const inferProviderModel = (
  metadata: ExtractionMetadata,
  service: OcrTarget['service'],
  providerDirName: string
): string => {
  const direct = getString(metadata.ocrModel)
  if (direct) {
    return direct
  }

  if (service === 'ocrmypdf' || service === 'paddle-ocr') {
    return service
  }

  return inferProviderTargetFromDirectoryName(providerDirName)?.model ?? service
}

const buildSyntheticResult = (
  text: string,
  metadata: ExtractionMetadata
): ExtractionResult =>
  validateData(ExtractionResultSchema, {
    text,
    pages: text.trim().length > 0
      ? [{ pageNumber: 1, method: 'ocr', text }]
      : [],
    totalPages: metadata.totalPages,
    ocrPages: metadata.ocrPages,
    textPages: metadata.textPages
  }, 'stored OCR result')

const readStoredExtractionResult = async (
  providerDir: string,
  metadata: ExtractionMetadata
): Promise<ExtractionResult | undefined> => {
  const resultJsonPath = join(providerDir, 'result.json')
  const resultJson = await readJsonFile(resultJsonPath)
  if (resultJson !== null) {
    return validateData(ExtractionResultSchema, resultJson, 'stored OCR result')
  }

  const extractionJsonPath = join(providerDir, 'extraction.json')
  const extractionJson = await readJsonFile(extractionJsonPath)
  if (extractionJson !== null) {
    return validateData(ExtractionResultSchema, extractionJson, 'stored OCR result')
  }

  for (const artifact of ['extraction.txt', 'extraction.tsv', 'extraction.hocr'] as const) {
    try {
      const text = await readFile(join(providerDir, artifact), 'utf8')
      return buildSyntheticResult(text, metadata)
    } catch {
    }
  }

  return undefined
}

const loadOcrProviderArtifact = async (
  runDir: string,
  providerDirName: string,
  costActualByKey: Map<string, number>,
  costEstimatedByKey: Map<string, number>,
  timingActualByKey: Map<string, number>,
  timingEstimatedByKey: Map<string, number>
): Promise<OcrProviderArtifact | null> => {
  const providerDir = join(runDir, 'providers', providerDirName)
  const metadataPath = join(providerDir, 'metadata.json')
  const metadataRaw = await readJsonFile(metadataPath)
  if (metadataRaw === null) {
    return null
  }

  const metadata = validateData(ExtractionMetadataSchema, metadataRaw, 'stored OCR provider metadata')
  const result = await readStoredExtractionResult(providerDir, metadata)
  if (!result) {
    return null
  }

  const service = inferProviderService(metadata, providerDirName)
  if (!service) {
    return null
  }

  const model = inferProviderModel(metadata, service, providerDirName)
  const providerKey = getOcrTargetKey({ service, model })

  return {
    id: providerDirName,
    service,
    model,
    label: `${service}/${model}`,
    metadataPath,
    metadata,
    result,
    actualCostCents: costActualByKey.get(providerKey) ?? null,
    estimatedCostCents: costEstimatedByKey.get(providerKey) ?? null,
    actualProcessingTimeMs: timingActualByKey.get(providerKey) ?? metadata.processingTime,
    estimatedProcessingTimeMs: timingEstimatedByKey.get(providerKey) ?? null
  }
}

const splitLongTextIntoTokenWindows = (text: string, chunkSize: number): string[] => {
  const tokens = tokenizeSurfaceWords(text)
  if (tokens.length === 0) {
    return cleanSpacing(text).length > 0 ? [cleanSpacing(text)] : []
  }

  const windows: string[] = []
  for (let index = 0; index < tokens.length; index += chunkSize) {
    windows.push(tokens.slice(index, index + chunkSize).join(' '))
  }
  return windows
}

const splitParagraphIntoWindows = (paragraph: string): string[] => {
  const trimmed = cleanSpacing(paragraph)
  const tokenCount = tokenizeWords(trimmed).length
  if (tokenCount === 0) {
    return trimmed.length > 0 ? [trimmed] : []
  }
  if (tokenCount <= 80) {
    return [trimmed]
  }

  const sentences = trimmed.split(SENTENCE_SPLIT_PATTERN).map(cleanSpacing).filter(Boolean)
  if (sentences.length <= 1) {
    return splitLongTextIntoTokenWindows(trimmed, 40)
  }

  const windows: string[] = []
  let current: string[] = []
  let currentTokens = 0

  for (const sentence of sentences) {
    const sentenceTokens = tokenizeWords(sentence).length
    if (sentenceTokens > 80) {
      if (current.length > 0) {
        windows.push(current.join(' '))
        current = []
        currentTokens = 0
      }
      windows.push(...splitLongTextIntoTokenWindows(sentence, 40))
      continue
    }

    if (current.length > 0 && currentTokens + sentenceTokens > 80) {
      windows.push(current.join(' '))
      current = []
      currentTokens = 0
    }

    current.push(sentence)
    currentTokens += sentenceTokens
  }

  if (current.length > 0) {
    windows.push(current.join(' '))
  }

  return windows.filter(Boolean)
}

const splitPageIntoWindows = (text: string): string[] => {
  const normalized = normalizePageText(text)
  if (normalized.length === 0) {
    return []
  }

  const paragraphs = normalized.split(/\n{2,}/).map(cleanSpacing).filter(Boolean)
  const windows: string[] = []

  for (const paragraph of paragraphs) {
    const paragraphTokens = tokenizeWords(paragraph).length
    if (paragraphs.length > 1 && paragraphTokens <= 120) {
      windows.push(paragraph)
      continue
    }
    windows.push(...splitParagraphIntoWindows(paragraph))
  }

  if (windows.length === 0) {
    return splitParagraphIntoWindows(normalized)
  }

  return windows
}

const buildLocalPageWindows = (text: string): Array<{ startRel: number, endRel: number }> => {
  const windows = splitPageIntoWindows(text)
  if (windows.length === 0) {
    return [{ startRel: 0, endRel: 1 }]
  }

  const weights = windows.map((window) => Math.max(1, tokenizeWords(window).length))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  let offset = 0

  return windows.map((_, index) => {
    const weight = weights[index] ?? 1
    const startRel = offset / totalWeight
    offset += weight
    return {
      startRel,
      endRel: clamp(offset / totalWeight, 0, 1)
    }
  })
}

const buildProviderPageData = (page: PageResult): ProviderPageData => {
  const normalizedText = normalizePageText(page.text)
  return {
    pageNumber: page.pageNumber,
    normalizedText,
    tokens: tokenizeSurfaceWords(normalizedText),
    confidence: normalizeConfidence(getFiniteNumber(page.confidence)),
    localWindows: buildLocalPageWindows(normalizedText)
  }
}

const buildSharedWindowRanges = (pages: ProviderPageData[]): Array<{ startRel: number, endRel: number }> => {
  const boundaries = pages.flatMap((page) => page.localWindows.map((window) => window.endRel))
    .filter((value) => value > 0.02 && value < 0.98)
    .sort((left, right) => left - right)

  const merged: number[] = []
  let cluster: number[] = []
  const tolerance = 0.09

  for (const boundary of boundaries) {
    if (cluster.length === 0) {
      cluster = [boundary]
      continue
    }

    const clusterCenter = average(cluster)
    if (Math.abs(boundary - clusterCenter) <= tolerance) {
      cluster.push(boundary)
      continue
    }

    merged.push(average(cluster))
    cluster = [boundary]
  }

  if (cluster.length > 0) {
    merged.push(average(cluster))
  }

  const allBoundaries = [0, ...merged, 1]
  const windows: Array<{ startRel: number, endRel: number }> = []
  for (let index = 0; index < allBoundaries.length - 1; index += 1) {
    const startRel = allBoundaries[index] ?? 0
    const endRel = allBoundaries[index + 1] ?? 1
    if (endRel - startRel < 0.03) {
      continue
    }
    windows.push({ startRel, endRel })
  }

  return windows.length > 0 ? windows : [{ startRel: 0, endRel: 1 }]
}

const sliceProviderWindowText = (
  page: ProviderPageData,
  startRel: number,
  endRel: number
): string => {
  if (page.tokens.length === 0) {
    return page.normalizedText
  }

  const totalTokens = page.tokens.length
  const startIndex = clamp(Math.floor(startRel * totalTokens), 0, totalTokens - 1)
  const endIndex = clamp(Math.max(startIndex + 1, Math.ceil(endRel * totalTokens)), startIndex + 1, totalTokens)
  return cleanSpacing(page.tokens.slice(startIndex, endIndex).join(' '))
}

const pickRepresentativeVariant = (texts: string[]): string => {
  if (texts.length <= 1) {
    return texts[0] ?? ''
  }

  let bestText = texts[0] ?? ''
  let bestScore = -1

  for (const candidate of texts) {
    const candidateWords = tokenizeWords(candidate)
    const score = average(texts.map((text) => computeWordSimilarity(candidateWords, tokenizeWords(text))))
    if (score > bestScore) {
      bestScore = score
      bestText = candidate
    }
  }

  return bestText
}

const finalizeConsensusText = (text: string, variants: string[]): string => {
  let result = cleanSpacing(text)
  if (result.length === 0) {
    return result
  }

  const punctCounts = new Map<string, number>()
  for (const variant of variants) {
    const punct = variant.trim().match(/[.!?]$/)?.[0]
    if (punct) {
      punctCounts.set(punct, (punctCounts.get(punct) ?? 0) + 1)
    }
  }

  result = `${result.charAt(0).toUpperCase()}${result.slice(1)}`
  const bestPunctuation = [...punctCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0]
  if (bestPunctuation && !/[.!?]$/.test(result)) {
    result = `${result}${bestPunctuation}`
  }

  return result
}

const buildConsensusText = (variantTexts: string[]): { text: string, smallVoteMargin: boolean } => {
  const cleanedVariants = variantTexts.map(cleanSpacing).filter((text) => text.length > 0)
  if (cleanedVariants.length === 0) {
    return { text: '', smallVoteMargin: false }
  }
  if (cleanedVariants.length === 1) {
    return { text: finalizeConsensusText(cleanedVariants[0] ?? '', cleanedVariants), smallVoteMargin: false }
  }

  const tokenizedVariants = cleanedVariants.map((text) => tokenizeSurfaceWords(text))
  const slotCount = Math.max(...tokenizedVariants.map((tokens) => tokens.length))
  if (slotCount <= 0) {
    const representative = pickRepresentativeVariant(cleanedVariants)
    return { text: finalizeConsensusText(representative, cleanedVariants), smallVoteMargin: false }
  }

  let smallVoteMargin = false
  const votedTokens: string[] = []

  for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
    const votes = new Map<string, { count: number, surfaces: Map<string, number> }>()

    for (const tokens of tokenizedVariants) {
      if (tokens.length === 0) {
        continue
      }

      const tokenIndex = tokens.length === 1
        ? 0
        : Math.round((slotIndex / Math.max(slotCount - 1, 1)) * (tokens.length - 1))
      const surface = tokens[tokenIndex] ?? ''
      if (surface.length === 0) {
        continue
      }

      const normalized = surface.toLowerCase()
      const existing = votes.get(normalized) ?? { count: 0, surfaces: new Map<string, number>() }
      existing.count += 1
      existing.surfaces.set(surface, (existing.surfaces.get(surface) ?? 0) + 1)
      votes.set(normalized, existing)
    }

    const rankedVotes = [...votes.entries()].sort((left, right) => {
      const countDelta = right[1].count - left[1].count
      return countDelta !== 0 ? countDelta : left[0].localeCompare(right[0])
    })
    const bestVote = rankedVotes[0]
    const secondVote = rankedVotes[1]
    if (!bestVote) {
      continue
    }

    if (secondVote && bestVote[1].count - secondVote[1].count <= 1) {
      smallVoteMargin = true
    }

    const bestSurface = [...bestVote[1].surfaces.entries()]
      .sort((left, right) => {
        const countDelta = right[1] - left[1]
        return countDelta !== 0 ? countDelta : left[0].localeCompare(right[0])
      })[0]?.[0] ?? bestVote[0]
    votedTokens.push(bestSurface)
  }

  const votedText = cleanSpacing(votedTokens.join(' '))
  const representative = pickRepresentativeVariant(cleanedVariants)
  const votedScore = average(cleanedVariants.map((text) => computeWordSimilarity(tokenizeWords(votedText), tokenizeWords(text))))
  const representativeScore = average(cleanedVariants.map((text) => computeWordSimilarity(tokenizeWords(representative), tokenizeWords(text))))
  const bestText = representativeScore > votedScore + 0.03 ? representative : votedText

  return {
    text: finalizeConsensusText(bestText, cleanedVariants),
    smallVoteMargin
  }
}

const formatConsensusRows = (rows: OcrComparisonRow[]): string => {
  const pages = new Map<number, string[]>()

  for (const row of rows) {
    const existing = pages.get(row.pageNumber) ?? []
    if (row.consensusText.length > 0) {
      existing.push(row.consensusText)
      pages.set(row.pageNumber, existing)
    }
  }

  return [...pages.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([pageNumber, texts]) => `Page ${pageNumber}\n${texts.join('\n\n')}`.trim())
    .join('\n\n')
    .trim()
}

const buildProviderSummary = (
  providers: OcrProviderArtifact[],
  rows: OcrComparisonRow[]
): OcrProviderSummary[] =>
  providers
    .map((provider) => {
      const coveredRows = rows.filter((row) => row.variants.some((variant) => variant.providerId === provider.id))
      const similarities = coveredRows.flatMap((row) => row.variants
        .filter((variant) => variant.providerId === provider.id)
        .map((variant) => variant.similarity)
      )

      return {
        providerId: provider.id,
        label: provider.label,
        similarity: average(similarities),
        rowCoverage: coveredRows.length,
        pageCoverage: new Set(coveredRows.map((row) => row.pageNumber)).size,
        totalPages: provider.result.totalPages,
        tokenEstimate: provider.metadata.tokenEstimate,
        promptTokens: provider.metadata.promptTokens ?? null,
        completionTokens: provider.metadata.completionTokens ?? null,
        actualCostCents: provider.actualCostCents,
        estimatedCostCents: provider.estimatedCostCents,
        actualProcessingTimeMs: provider.actualProcessingTimeMs,
        estimatedProcessingTimeMs: provider.estimatedProcessingTimeMs
      }
    })
    .sort((left, right) => right.similarity - left.similarity)

const buildRunConsensusReportMarkdown = (analysis: OcrRunConsensusAnalysis): string => {
  const lines: string[] = []
  lines.push('# OCR Consensus Report')
  lines.push('')
  lines.push(`Source run: \`${analysis.runLabel}\``)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- Title: ${analysis.metadata.title ?? 'n/a'}`)
  lines.push(`- Author: ${analysis.metadata.author ?? 'n/a'}`)
  lines.push(`- Format: ${analysis.metadata.format ?? 'n/a'}`)
  lines.push(`- Completion status: ${analysis.metadata.completionStatus ?? 'n/a'}`)
  lines.push(`- Providers analyzed: ${analysis.providers.length}`)
  lines.push(`- Pages analyzed: ${new Set(analysis.rows.map((row) => row.pageNumber)).size}`)
  lines.push(`- Windows analyzed: ${analysis.rows.length}`)
  lines.push(`- Average similarity: ${analysis.averageSimilarity.toFixed(2)}/100`)
  lines.push(`- Review rows: ${analysis.reviewRows.length}`)
  lines.push(`- Missing providers: ${analysis.missingProviders.length === 0 ? 'none' : analysis.missingProviders.map((provider) => provider.label).join(', ')}`)
  lines.push(`- Provider page counts differ: ${analysis.pageCountMismatch ? 'yes' : 'no'}`)
  lines.push(`- Actual cost: ${formatCents(analysis.metadata.actualTotalCostCents)}`)
  lines.push(`- Wall time: ${formatDurationMs(analysis.metadata.wallTimeMs)}`)
  lines.push('')
  lines.push('## Missing Providers')
  lines.push('')

  if (analysis.missingProviders.length === 0) {
    lines.push('- No missing providers were recorded.')
  } else {
    lines.push('| Provider | Status | Retryable | Last Error |')
    lines.push('|---|---|---|---|')
    for (const provider of analysis.missingProviders) {
      lines.push(`| ${provider.label} | ${provider.status} | ${provider.retryable ? 'yes' : 'no'} | ${provider.lastError ?? 'n/a'} |`)
    }
  }

  lines.push('')
  lines.push('## Providers')
  lines.push('')
  lines.push('| Provider | Similarity | Pages | Rows | Total Pages | Prompt Tokens | Completion Tokens | Actual Cost | Time |')
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const provider of analysis.providerSummary) {
    lines.push(`| ${provider.label} | ${provider.similarity.toFixed(2)} | ${provider.pageCoverage} | ${provider.rowCoverage} | ${provider.totalPages} | ${provider.promptTokens ?? 0} | ${provider.completionTokens ?? 0} | ${formatCents(provider.actualCostCents)} | ${formatDurationMs(provider.actualProcessingTimeMs)} |`)
  }

  lines.push('')
  lines.push('## Comparison')
  lines.push('')

  if (analysis.rows.length === 0) {
    lines.push('- No comparison rows were generated from the available OCR artifacts.')
  } else {
    for (const row of analysis.rows) {
      lines.push(`### Page ${row.pageNumber} / Window ${row.windowIndex}`)
      lines.push('')
      lines.push(`- Consensus: ${row.consensusText.length > 0 ? row.consensusText : '(empty)'}`)
      lines.push(`- Confidence: ${row.confidence.toFixed(2)}/100`)
      lines.push(`- Average similarity: ${row.averageSimilarity.toFixed(2)}/100`)
      lines.push(`- Review: ${row.reviewReasons.length === 0 ? 'no' : row.reviewReasons.join('; ')}`)
      for (const variant of row.variants) {
        lines.push(`- ${variant.label}: ${variant.text.length > 0 ? variant.text : '(empty)'} (${variant.similarity.toFixed(2)}/100${variant.confidence !== null ? `, confidence ${variant.confidence.toFixed(2)}/100` : ''})`)
      }
      lines.push('')
    }
  }

  lines.push('## Artifacts')
  lines.push('')
  lines.push('- `consensus-extraction.txt` is the merged best-guess extraction assembled page by page.')
  lines.push('- `consensus-review.md` lists only flagged pages and windows.')
  lines.push('- `consensus-report.json` contains the structured rows, provider summaries, and missing-provider state.')

  return lines.join('\n')
}

const buildRunReviewMarkdown = (analysis: OcrRunConsensusAnalysis): string => {
  const lines: string[] = []
  lines.push('# OCR Consensus Review')
  lines.push('')
  lines.push(`Source run: \`${analysis.runLabel}\``)
  lines.push('')

  if (analysis.reviewRows.length === 0) {
    lines.push('- No review rows were flagged.')
    return lines.join('\n')
  }

  for (const row of analysis.reviewRows) {
    lines.push(`## Page ${row.pageNumber} / Window ${row.windowIndex}`)
    lines.push('')
    lines.push(`- Consensus: ${row.consensusText.length > 0 ? row.consensusText : '(empty)'}`)
    lines.push(`- Confidence: ${row.confidence.toFixed(2)}/100`)
    lines.push(`- Reasons: ${row.reviewReasons.join('; ')}`)
    lines.push('')
  }

  return lines.join('\n')
}

const toStructuredRunSummary = (analysis: OcrRunConsensusAnalysis): Record<string, unknown> => ({
  runDir: analysis.runDir,
  runLabel: analysis.runLabel,
  metadata: analysis.metadata,
  missingProviders: analysis.missingProviders,
  rows: analysis.rows,
  reviewRows: analysis.reviewRows,
  providerSummary: analysis.providerSummary,
  averageSimilarity: analysis.averageSimilarity,
  pageCountMismatch: analysis.pageCountMismatch
})

export const analyzeOcrRunDirectory = async (runDir: string): Promise<OcrRunConsensusAnalysis> => {
  const resolvedRunDir = resolve(runDir)
  const rootMetadata = await readJsonFile(join(resolvedRunDir, 'metadata.json'))
  const metadataSummary = summarizeRunMetadata(rootMetadata)
  const costActualByKey = extractCostStepMap(rootMetadata, 'actual')
  const costEstimatedByKey = extractCostStepMap(rootMetadata, 'estimated')
  const timingActualByKey = extractTimingStepMap(rootMetadata, 'actual')
  const timingEstimatedByKey = extractTimingStepMap(rootMetadata, 'estimated')
  const providerEntries = (await readdir(join(resolvedRunDir, 'providers'), { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))

  const providers = (await Promise.all(providerEntries.map((entry) =>
    loadOcrProviderArtifact(
      resolvedRunDir,
      entry.name,
      costActualByKey,
      costEstimatedByKey,
      timingActualByKey,
      timingEstimatedByKey
    )
  ))).filter((provider): provider is OcrProviderArtifact => provider !== null)

  const rootRecord = isRecord(rootMetadata) ? rootMetadata : {}
  const requestedTargets = parseStoredRequestedTargets(rootRecord)
  const requestedTargetList = requestedTargets.length > 0
    ? requestedTargets
    : providers.map((provider) => ({ service: provider.service, model: provider.model } satisfies OcrTarget))
  const existingRun = await readExistingOcrRun(resolvedRunDir, requestedTargetList)
  const analyzedProviderKeys = new Set(providers.map((provider) => getOcrTargetKey(provider)))
  const missingTargets = buildMissingTargetsFromEntry(rootRecord, requestedTargetList)
    .filter((target) => !analyzedProviderKeys.has(getOcrTargetKey(target)))
  const missingProviders = missingTargets.map((target) => {
    const providerKey = getOcrTargetKey(target)
    const state = existingRun.providerStates.get(providerKey)
    return {
      providerId: providerKey,
      label: `${target.service}/${target.model}`,
      status: state?.status ?? 'missing',
      artifactDir: state?.artifactDir ?? `providers/${target.service}-${target.model}`,
      retryable: state?.retryable === true,
      lastError: state?.lastError?.message ?? null
    } satisfies MissingOcrProviderSummary
  })

  if (providers.length === 0) {
    throw new Error(`No analyzable OCR provider artifacts found under ${resolvedRunDir}`)
  }

  metadataSummary.requestedProviderKeys = requestedTargetList.map((target) => getOcrTargetKey(target))
  metadataSummary.producedProviderKeys = providers.map((provider) => getOcrTargetKey(provider))

  const pageCountMismatch = new Set(providers.map((provider) => provider.result.totalPages)).size > 1
  const pageNumbers = [...new Set(providers.flatMap((provider) => provider.result.pages.map((page) => page.pageNumber)))].sort((left, right) => left - right)

  const rows: OcrComparisonRow[] = []
  for (const pageNumber of pageNumbers) {
    const pageVariants = providers.map((provider) => ({
      provider,
      page: provider.result.pages.find((entry) => entry.pageNumber === pageNumber)
    }))
    const availablePages = pageVariants
      .filter((entry) => entry.page && normalizePageText(entry.page.text).length > 0)
      .map((entry) => ({
        provider: entry.provider,
        pageData: buildProviderPageData(entry.page as PageResult)
      }))
    const missingPageProviders = pageVariants
      .filter((entry) => !entry.page || normalizePageText(entry.page.text).length === 0)
      .map((entry) => entry.provider.label)

    if (availablePages.length === 0) {
      continue
    }

    const windows = buildSharedWindowRanges(availablePages.map((entry) => entry.pageData))
    for (const [windowOffset, window] of windows.entries()) {
      const rawVariants = availablePages.map(({ provider, pageData }) => ({
        providerId: provider.id,
        label: provider.label,
        text: sliceProviderWindowText(pageData, window.startRel, window.endRel),
        confidence: pageData.confidence
      })).filter((variant) => variant.text.length > 0)

      if (rawVariants.length === 0) {
        continue
      }

      const consensus = buildConsensusText(rawVariants.map((variant) => variant.text))
      const variants = rawVariants.map((variant) => ({
        providerId: variant.providerId,
        label: variant.label,
        text: variant.text,
        similarity: computeWordSimilarity(tokenizeWords(consensus.text), tokenizeWords(variant.text)) * 100,
        confidence: variant.confidence
      }))
      const averageSimilarity = average(variants.map((variant) => variant.similarity))
      const confidence = average(
        variants.flatMap((variant) => variant.confidence === null ? [] : [variant.confidence])
      ) || averageSimilarity
      const reviewReasons: string[] = []

      if (variants.length === 1) {
        reviewReasons.push('Only one provider contributed this page window')
      }
      if (averageSimilarity < 82) {
        reviewReasons.push('Low provider agreement')
      }
      if (confidence < 60) {
        reviewReasons.push('Low OCR confidence')
      }
      if (variants.length > 1 && consensus.smallVoteMargin) {
        reviewReasons.push('Small vote margin between token votes')
      }
      if (windowOffset === 0 && missingPageProviders.length > 0) {
        reviewReasons.push(`Missing page ${pageNumber} from ${missingPageProviders.join(', ')}`)
      }
      if (windowOffset === 0 && pageCountMismatch) {
        reviewReasons.push('Provider total page counts differ')
      }

      rows.push({
        id: `page-${String(pageNumber).padStart(4, '0')}-window-${String(windowOffset + 1).padStart(2, '0')}`,
        pageNumber,
        windowIndex: windowOffset + 1,
        consensusText: consensus.text,
        confidence,
        averageSimilarity,
        reviewReasons,
        variants
      })
    }
  }

  const providerSummary = buildProviderSummary(providers, rows)
  const consensusText = formatConsensusRows(rows) || normalizePageText(providers[0]?.result.text ?? '')
  const reviewRows = rows.filter((row) => row.reviewReasons.length > 0)
  const averageSimilarity = average(rows.map((row) => row.averageSimilarity))

  return {
    runDir: resolvedRunDir,
    runLabel: basename(resolvedRunDir),
    metadata: metadataSummary,
    providers,
    missingProviders,
    rows,
    reviewRows,
    providerSummary,
    consensusText,
    averageSimilarity,
    pageCountMismatch
  }
}

export const writeOcrRunConsensusArtifacts = async (analysis: OcrRunConsensusAnalysis): Promise<{
  consensusPath: string
  reportPath: string
  jsonPath: string
  reviewPath: string
}> => {
  const consensusPath = join(analysis.runDir, 'consensus-extraction.txt')
  const reportPath = join(analysis.runDir, 'consensus-report.md')
  const jsonPath = join(analysis.runDir, 'consensus-report.json')
  const reviewPath = join(analysis.runDir, 'consensus-review.md')

  await Promise.all([
    writeFile(consensusPath, `${analysis.consensusText}\n`, 'utf8'),
    writeFile(reportPath, `${buildRunConsensusReportMarkdown(analysis)}\n`, 'utf8'),
    writeFile(jsonPath, `${JSON.stringify(toStructuredRunSummary(analysis), null, 2)}\n`, 'utf8'),
    writeFile(reviewPath, `${buildRunReviewMarkdown(analysis)}\n`, 'utf8')
  ])

  return { consensusPath, reportPath, jsonPath, reviewPath }
}

export const buildAggregateOcrConsensusReportMarkdown = (
  targetDir: string,
  analyses: OcrRunConsensusAnalysis[]
): string => {
  const lines: string[] = []
  lines.push('# OCR Consensus Batch Report')
  lines.push('')
  lines.push(`Target directory: \`${targetDir}\``)
  lines.push('')
  lines.push('## Runs')
  lines.push('')
  lines.push('| Run | Providers | Pages | Windows | Review Rows | Best Similarity | Missing Providers | Actual Cost | Wall Time |')
  lines.push('|---|---:|---:|---:|---:|---:|---|---:|---:|')

  for (const analysis of analyses) {
    const bestProvider = analysis.providerSummary[0]
    lines.push(`| ${analysis.runLabel} | ${analysis.providers.length} | ${new Set(analysis.rows.map((row) => row.pageNumber)).size} | ${analysis.rows.length} | ${analysis.reviewRows.length} | ${bestProvider ? bestProvider.similarity.toFixed(2) : 'n/a'} | ${analysis.missingProviders.length === 0 ? 'none' : analysis.missingProviders.map((provider) => provider.label).join(', ')} | ${formatCents(analysis.metadata.actualTotalCostCents)} | ${formatDurationMs(analysis.metadata.wallTimeMs)} |`)
  }

  lines.push('')
  lines.push('Each run directory also contains `consensus-extraction.txt`, `consensus-report.md`, `consensus-review.md`, and `consensus-report.json`.')
  return lines.join('\n')
}

export const analyzeAndWriteOcrConsensusReports = async (targetPath: string): Promise<{
  targetDir: string
  runArtifacts: Array<{
    runDir: string
    consensusPath: string
    reportPath: string
    jsonPath: string
    reviewPath: string
  }>
  aggregateReportPath: string | null
}> => {
  const detectedTarget = await detectReportTarget(targetPath)
  if (detectedTarget.kind !== 'ocr') {
    throw new Error(`Report target resolves to ${detectedTarget.kind.toUpperCase()} artifacts, not OCR: ${detectedTarget.targetDir}`)
  }

  const analyses = await Promise.all(detectedTarget.runDirectories.map((runDir) => analyzeOcrRunDirectory(runDir)))
  const runArtifacts = await Promise.all(analyses.map(async (analysis) => ({
    runDir: analysis.runDir,
    ...(await writeOcrRunConsensusArtifacts(analysis))
  })))

  if (detectedTarget.runDirectories.length === 1) {
    return {
      targetDir: detectedTarget.targetDir,
      runArtifacts,
      aggregateReportPath: null
    }
  }

  const aggregateReportPath = join(detectedTarget.targetDir, 'consensus-report.md')
  await writeFile(
    aggregateReportPath,
    `${buildAggregateOcrConsensusReportMarkdown(detectedTarget.targetDir, analyses)}\n`,
    'utf8'
  )

  return {
    targetDir: detectedTarget.targetDir,
    runArtifacts,
    aggregateReportPath
  }
}
