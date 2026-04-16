import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import type { PersistedTranscriptionEvidence, TranscriptionEvidenceCapabilities, TranscriptionEvidenceSegment, TranscriptionEvidenceWord } from '~/types'
import { commandExists, exec, fileExists } from '~/utils/cli-utils'

type ProviderTranscript = {
  id: string
  service: string
  model: string
  label: string
  transcriptPath: string
  evidencePath: string
  metadataPath: string
  rawText: string
  evidence: PersistedTranscriptionEvidence
  tokenCount: number | null
  actualCostCents: number | null
  estimatedCostCents: number | null
  actualProcessingTimeMs: number | null
  estimatedProcessingTimeMs: number | null
}

type ProviderVariant = {
  providerId: string
  label: string
  text: string
  similarity: number
  wordCount: number
  speaker?: string
  supportsWindow: boolean
}

type ComparisonRow = {
  id: string
  startSeconds: number
  endSeconds: number
  startTimestamp: string
  endTimestamp: string
  speaker?: string
  consensusText: string
  confidence: number
  averageSimilarity: number
  reviewReasons: string[]
  variants: ProviderVariant[]
}

type ProviderSummary = {
  providerId: string
  label: string
  similarity: number
  rowCoverage: number
  wordCount: number
  timingQuality: PersistedTranscriptionEvidence['timingQuality']
  capabilities: TranscriptionEvidenceCapabilities
  tokenCount: number | null
  actualCostCents: number | null
  estimatedCostCents: number | null
  actualProcessingTimeMs: number | null
  estimatedProcessingTimeMs: number | null
}

type ReviewWindow = {
  rowId: string
  startTimestamp: string
  endTimestamp: string
  speaker?: string
  consensusText: string
  confidence: number
  reasons: string[]
  clipPath: string | null
}

export type RunMetadataSummary = {
  title: string | null
  duration: string | null
  completionStatus: string | null
  actualTotalCostCents: number | null
  estimatedTotalCostCents: number | null
  actualTotalProcessingTimeMs: number | null
  estimatedTotalProcessingTimeMs: number | null
  wallTimeMs: number | null
  requestedProviderKeys: string[]
  producedProviderKeys: string[]
}

export type RunConsensusAnalysis = {
  runDir: string
  runLabel: string
  metadata: RunMetadataSummary
  providers: ProviderTranscript[]
  rows: ComparisonRow[]
  reviewWindows: ReviewWindow[]
  providerSummary: ProviderSummary[]
  consensusText: string
  audioPath: string | null
}

type TimeObservation = {
  time: number
  providerId: string
}

type TimeCluster = {
  time: number
  observations: TimeObservation[]
  providerIds: Set<string>
}

type SpeakerTrack = {
  key: string
  providerId: string
  speaker: string
  intervals: Array<{ start: number, end: number }>
  totalDuration: number
  firstStart: number
}

type SpeakerCluster = {
  tracks: SpeakerTrack[]
  providerIds: Set<string>
  intervals: Array<{ start: number, end: number }>
  totalDuration: number
  firstStart: number
}

type WordObservation = {
  providerId: string
  label: string
  text: string
  normalized: string
  midpoint: number
  relative: number
  weight: number
}

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.flac', '.webm', '.mp4'])
const WORD_PATTERN = /[A-Za-z0-9]+(?:[/'’-][A-Za-z0-9]+)*/g

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

const median = (values: number[]): number => {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0)
}

const normalizeProviderKey = (service: string, model: string): string => `${service}/${model}`

const normalizeText = (text: string): string => text
  .normalize('NFKC')
  .replace(/[‘’]/g, '\'')
  .replace(/[“”]/g, '"')
  .replace(/[—–]/g, '-')

const tokenizeWords = (text: string): string[] =>
  [...normalizeText(text).matchAll(WORD_PATTERN)].map((match) => match[0].toLowerCase())

const formatSecondsToTimestamp = (seconds: number): string => {
  const rounded = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  const remainder = rounded % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

const cleanSpacing = (text: string): string =>
  text
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()

const joinWordTexts = (words: Array<{ text: string }>): string => cleanSpacing(words.map((word) => word.text).join(' '))

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
    values.set(normalizeProviderKey(provider, model), cost)
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
    values.set(normalizeProviderKey(provider, model), timing)
  }

  return values
}

const extractRequestedProviderKeys = (metadata: unknown): string[] => {
  if (!isRecord(metadata) || !Array.isArray(metadata['requestedProviders'])) {
    return []
  }

  return metadata['requestedProviders'].flatMap((entry) => {
    if (!isRecord(entry)) {
      return []
    }
    const service = getString(entry['service'])
    const model = getString(entry['model'])
    return service && model ? [normalizeProviderKey(service, model)] : []
  })
}

const extractProducedProviderKeys = (metadata: unknown): string[] => {
  if (!isRecord(metadata) || !Array.isArray(metadata['step2'])) {
    return []
  }

  return metadata['step2'].flatMap((entry) => {
    if (!isRecord(entry)) {
      return []
    }
    const service = getString(entry['transcriptionService'])
    const model = getString(entry['transcriptionModel'])
    return service && model ? [normalizeProviderKey(service, model)] : []
  })
}

const summarizeRunMetadata = (metadata: unknown): RunMetadataSummary => ({
  title: isRecord(metadata) && isRecord(metadata['step1']) ? getString(metadata['step1']['title']) : null,
  duration: isRecord(metadata) && isRecord(metadata['step1']) ? getString(metadata['step1']['duration']) : null,
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
  requestedProviderKeys: extractRequestedProviderKeys(metadata),
  producedProviderKeys: extractProducedProviderKeys(metadata)
})

const normalizeEvidenceCapabilities = (value: unknown): TranscriptionEvidenceCapabilities => {
  const record = isRecord(value) ? value : {}
  return {
    hasNativeWordTiming: record['hasNativeWordTiming'] === true,
    hasConfidence: record['hasConfidence'] === true,
    hasSpeakerLabels: record['hasSpeakerLabels'] === true
  }
}

const normalizeEvidenceSegments = (value: unknown): TranscriptionEvidenceSegment[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return []
    }

    const startSeconds = getFiniteNumber(entry['startSeconds'])
    const endSeconds = getFiniteNumber(entry['endSeconds'])
    const text = getString(entry['text'])
    if (startSeconds === null || endSeconds === null || text === null) {
      return []
    }

    return [{
      startSeconds,
      endSeconds,
      text,
      ...(getString(entry['speaker']) ? { speaker: getString(entry['speaker']) ?? undefined } : {}),
      ...(getFiniteNumber(entry['confidence']) !== null ? { confidence: getFiniteNumber(entry['confidence']) ?? undefined } : {})
    }]
  })
}

const normalizeEvidenceWords = (value: unknown): TranscriptionEvidenceWord[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return []
    }

    const startSeconds = getFiniteNumber(entry['startSeconds'])
    const endSeconds = getFiniteNumber(entry['endSeconds'])
    const text = getString(entry['text'])
    if (startSeconds === null || endSeconds === null || text === null) {
      return []
    }

    const normalized = getString(entry['normalized']) ?? text.toLowerCase()
    const timingSource = entry['timingSource'] === 'native' ? 'native' : 'interpolated'
    return [{
      startSeconds,
      endSeconds,
      text,
      normalized,
      ...(getString(entry['speaker']) ? { speaker: getString(entry['speaker']) ?? undefined } : {}),
      ...(getFiniteNumber(entry['confidence']) !== null ? { confidence: getFiniteNumber(entry['confidence']) ?? undefined } : {}),
      timingSource
    }]
  })
}

const normalizePersistedEvidence = (value: unknown): PersistedTranscriptionEvidence | null => {
  if (!isRecord(value)) {
    return null
  }

  const service = getString(value['service'])
  const model = getString(value['model'])
  const label = getString(value['label'])
  const transcriptText = getString(value['transcriptText'])
  if (!service || !model || !label || transcriptText === null) {
    return null
  }

  const segments = normalizeEvidenceSegments(value['segments'])
  const words = normalizeEvidenceWords(value['words'])
  return {
    service,
    model,
    label,
    transcriptText,
    segments,
    words,
    capabilities: normalizeEvidenceCapabilities(value['capabilities']),
    timingQuality: value['timingQuality'] === 'native_word'
      ? 'native_word'
      : value['timingQuality'] === 'coarse'
        ? 'coarse'
        : 'segment_interpolated',
    speakerInventory: Array.isArray(value['speakerInventory'])
      ? value['speakerInventory'].filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      : []
  }
}

const loadProviderTranscript = async (
  runDir: string,
  providerDirName: string,
  costActualByKey: Map<string, number>,
  costEstimatedByKey: Map<string, number>,
  timingActualByKey: Map<string, number>,
  timingEstimatedByKey: Map<string, number>
): Promise<ProviderTranscript | null> => {
  const providerDir = join(runDir, 'providers', providerDirName)
  const transcriptPath = join(providerDir, 'transcription.txt')
  const evidencePath = join(providerDir, 'transcription.evidence.json')
  const metadataPath = join(providerDir, 'metadata.json')

  const [transcriptRaw, evidenceRaw, providerMetadata] = await Promise.all([
    readFile(transcriptPath, 'utf8').catch(() => null),
    readJsonFile(evidencePath),
    readJsonFile(metadataPath)
  ])

  if (typeof transcriptRaw !== 'string' || transcriptRaw.trim().length === 0) {
    return null
  }

  const evidence = normalizePersistedEvidence(evidenceRaw)
  if (!evidence) {
    throw new Error(`Run requires transcription.evidence.json for providers/${providerDirName}. Rerun STT with the updated evidence persistence before generating a consensus report.`)
  }

  const providerMetadataRecord = isRecord(providerMetadata) ? providerMetadata : {}
  const providerKey = normalizeProviderKey(evidence.service, evidence.model)

  return {
    id: providerDirName,
    service: evidence.service,
    model: evidence.model,
    label: evidence.label,
    transcriptPath,
    evidencePath,
    metadataPath,
    rawText: transcriptRaw,
    evidence,
    tokenCount: getFiniteNumber(providerMetadataRecord['tokenCount']),
    actualCostCents: costActualByKey.get(providerKey) ?? null,
    estimatedCostCents: costEstimatedByKey.get(providerKey) ?? null,
    actualProcessingTimeMs: timingActualByKey.get(providerKey) ?? getFiniteNumber(providerMetadataRecord['processingTime']),
    estimatedProcessingTimeMs: timingEstimatedByKey.get(providerKey) ?? null
  }
}

export const discoverAnalyzableRunDirectories = async (targetPath: string): Promise<string[]> => {
  const resolvedTarget = resolve(targetPath)
  const directEntries = await readdir(resolvedTarget).catch(() => null)
  if (!directEntries) {
    throw new Error(`Target path does not exist or is not readable: ${resolvedTarget}`)
  }

  if (directEntries.includes('providers') && directEntries.includes('metadata.json')) {
    return [resolvedTarget]
  }

  const childEntries = await readdir(resolvedTarget, { withFileTypes: true })
  const runDirectories: string[] = []

  for (const entry of childEntries) {
    if (!entry.isDirectory()) {
      continue
    }
    const childDir = join(resolvedTarget, entry.name)
    const childDirEntries = await readdir(childDir).catch((): string[] => [])
    if (childDirEntries.includes('providers') && childDirEntries.includes('metadata.json')) {
      runDirectories.push(childDir)
    }
  }

  if (runDirectories.length === 0) {
    throw new Error(`No STT output runs found under ${resolvedTarget}`)
  }

  return runDirectories.sort()
}

const buildSpeakerTracks = (providers: ProviderTranscript[]): SpeakerTrack[] =>
  providers.flatMap((provider) => {
    const trackMap = new Map<string, SpeakerTrack>()

    for (const segment of provider.evidence.segments) {
      if (!segment.speaker) {
        continue
      }

      const key = `${provider.id}:${segment.speaker}`
      const existing = trackMap.get(key) ?? {
        key,
        providerId: provider.id,
        speaker: segment.speaker,
        intervals: [],
        totalDuration: 0,
        firstStart: segment.startSeconds
      }

      existing.intervals.push({
        start: segment.startSeconds,
        end: Math.max(segment.startSeconds, segment.endSeconds)
      })
      existing.totalDuration += Math.max(0.1, segment.endSeconds - segment.startSeconds)
      existing.firstStart = Math.min(existing.firstStart, segment.startSeconds)
      trackMap.set(key, existing)
    }

    return [...trackMap.values()]
  })

const computeIntervalOverlap = (
  left: Array<{ start: number, end: number }>,
  right: Array<{ start: number, end: number }>
): number => {
  let overlap = 0
  for (const leftInterval of left) {
    for (const rightInterval of right) {
      const start = Math.max(leftInterval.start, rightInterval.start)
      const end = Math.min(leftInterval.end, rightInterval.end)
      if (end > start) {
        overlap += end - start
      }
    }
  }
  return overlap
}

const buildSpeakerAliasMap = (providers: ProviderTranscript[]): Map<string, string> => {
  const tracks = buildSpeakerTracks(providers).sort((left, right) => left.firstStart - right.firstStart)
  const clusters: SpeakerCluster[] = []

  for (const track of tracks) {
    let bestClusterIndex = -1
    let bestScore = -1
    let bestDistance = Number.POSITIVE_INFINITY

    clusters.forEach((cluster, index) => {
      if (cluster.providerIds.has(track.providerId)) {
        return
      }

      const overlap = computeIntervalOverlap(track.intervals, cluster.intervals)
      const score = clamp(overlap / Math.max(0.5, Math.min(track.totalDuration, cluster.totalDuration)), 0, 1)
      const distance = Math.abs(track.firstStart - cluster.firstStart)
      if (score > bestScore || (score === bestScore && distance < bestDistance)) {
        bestClusterIndex = index
        bestScore = score
        bestDistance = distance
      }
    })

    if (bestClusterIndex >= 0 && (bestScore >= 0.2 || bestDistance <= 1.5)) {
      const cluster = clusters[bestClusterIndex]!
      cluster.tracks.push(track)
      cluster.providerIds.add(track.providerId)
      cluster.intervals.push(...track.intervals)
      cluster.totalDuration += track.totalDuration
      cluster.firstStart = Math.min(cluster.firstStart, track.firstStart)
      continue
    }

    clusters.push({
      tracks: [track],
      providerIds: new Set([track.providerId]),
      intervals: [...track.intervals],
      totalDuration: track.totalDuration,
      firstStart: track.firstStart
    })
  }

  const aliasByTrack = new Map<string, string>()
  clusters
    .sort((left, right) => left.firstStart - right.firstStart)
    .forEach((cluster, index) => {
      const canonical = `speaker-${index + 1}`
      cluster.tracks.forEach((track) => {
        aliasByTrack.set(track.key, canonical)
      })
    })

  return aliasByTrack
}

const applyCanonicalSpeakers = (providers: ProviderTranscript[]): ProviderTranscript[] => {
  const aliasByTrack = buildSpeakerAliasMap(providers)
  return providers.map((provider) => ({
    ...provider,
    evidence: {
      ...provider.evidence,
      speakerInventory: provider.evidence.speakerInventory
        .map((speaker) => aliasByTrack.get(`${provider.id}:${speaker}`) ?? speaker)
        .filter((speaker, index, array) => array.indexOf(speaker) === index),
      segments: provider.evidence.segments.map((segment) => ({
        ...segment,
        ...(segment.speaker ? { speaker: aliasByTrack.get(`${provider.id}:${segment.speaker}`) ?? segment.speaker } : {})
      })),
      words: provider.evidence.words.map((word) => ({
        ...word,
        ...(word.speaker ? { speaker: aliasByTrack.get(`${provider.id}:${word.speaker}`) ?? word.speaker } : {})
      }))
    }
  }))
}

const clusterTimes = (observations: TimeObservation[], thresholdSeconds: number): TimeCluster[] => {
  if (observations.length === 0) {
    return []
  }

  const sorted = [...observations].sort((left, right) => left.time - right.time)
  const clusters: TimeCluster[] = []

  for (const observation of sorted) {
    const current = clusters[clusters.length - 1]
    if (!current || Math.abs(observation.time - current.time) > thresholdSeconds) {
      clusters.push({
        time: observation.time,
        observations: [observation],
        providerIds: new Set([observation.providerId])
      })
      continue
    }

    current.observations.push(observation)
    current.providerIds.add(observation.providerId)
    current.time = median(current.observations.map((entry) => entry.time))
  }

  return clusters
}

const extractWindowWords = (
  provider: ProviderTranscript,
  startSeconds: number,
  endSeconds: number,
  isFinalWindow: boolean
): TranscriptionEvidenceWord[] => {
  const words = provider.evidence.words.filter((word) => {
    const midpoint = (word.startSeconds + word.endSeconds) / 2
    if (isFinalWindow) {
      return midpoint >= startSeconds && midpoint <= endSeconds
    }
    return midpoint >= startSeconds && midpoint < endSeconds
  })

  if (words.length > 0) {
    return words
  }

  return provider.evidence.words.filter((word) => {
    const overlaps = word.endSeconds > startSeconds && word.startSeconds < endSeconds
    return isFinalWindow ? overlaps || word.endSeconds === endSeconds : overlaps
  })
}

const extractWindowSpeaker = (words: TranscriptionEvidenceWord[], segments: TranscriptionEvidenceSegment[]): string | undefined => {
  const durations = new Map<string, number>()

  for (const word of words) {
    if (!word.speaker) {
      continue
    }
    durations.set(word.speaker, (durations.get(word.speaker) ?? 0) + Math.max(0.05, word.endSeconds - word.startSeconds))
  }

  if (durations.size === 0) {
    for (const segment of segments) {
      if (!segment.speaker) {
        continue
      }
      durations.set(segment.speaker, (durations.get(segment.speaker) ?? 0) + Math.max(0.05, segment.endSeconds - segment.startSeconds))
    }
  }

  let bestSpeaker: string | undefined
  let bestDuration = -1
  for (const [speaker, duration] of durations) {
    if (duration > bestDuration) {
      bestSpeaker = speaker
      bestDuration = duration
    }
  }
  return bestSpeaker
}

const providerBaseWeight = (provider: ProviderTranscript): number => {
  const timingWeight = provider.evidence.timingQuality === 'native_word'
    ? 1.15
    : provider.evidence.timingQuality === 'coarse'
      ? 0.9
      : 1
  const confidenceWeight = provider.evidence.capabilities.hasConfidence ? 1.05 : 1
  return timingWeight * confidenceWeight
}

const buildConsensusForWindow = (
  providers: ProviderTranscript[],
  startSeconds: number,
  endSeconds: number
): {
  consensusText: string
  confidence: number
  lowMargin: boolean
  variants: Array<{ provider: ProviderTranscript, words: TranscriptionEvidenceWord[], text: string, speaker?: string }>
} => {
  const isFinalWindow = false
  const variants: Array<{ provider: ProviderTranscript, words: TranscriptionEvidenceWord[], text: string, speaker?: string }> = providers.map((provider) => {
    const words = extractWindowWords(provider, startSeconds, endSeconds, isFinalWindow)
    const overlappingSegments = provider.evidence.segments.filter((segment) => segment.endSeconds > startSeconds && segment.startSeconds < endSeconds)
    const speaker = extractWindowSpeaker(words, overlappingSegments)
    return {
      provider,
      words,
      text: words.length > 0 ? joinWordTexts(words) : cleanSpacing(overlappingSegments.map((segment) => segment.text).join(' ')),
      ...(speaker ? { speaker } : {})
    }
  })

  const variantsWithWords = variants.filter((variant) => variant.words.length > 0)
  if (variantsWithWords.length === 0) {
    return {
      consensusText: '',
      confidence: 0,
      lowMargin: true,
      variants
    }
  }

  const targetWordCount = Math.max(1, Math.round(median(variantsWithWords.map((variant) => variant.words.length))))
  const relativeThreshold = clamp(0.45 / targetWordCount, 0.03, 0.18)
  const timeThreshold = clamp((endSeconds - startSeconds) / Math.max(targetWordCount * 1.4, 1), 0.12, 0.85)
  const observations: WordObservation[] = variantsWithWords.flatMap((variant) => {
    const baseWeight = providerBaseWeight(variant.provider)
    return variant.words.map((word, index) => ({
      providerId: variant.provider.id,
      label: variant.provider.label,
      text: word.text,
      normalized: word.normalized,
      midpoint: (word.startSeconds + word.endSeconds) / 2,
      relative: (index + 0.5) / variant.words.length,
      weight: baseWeight * (typeof word.confidence === 'number' ? clamp(word.confidence, 0.25, 1) : 1)
    }))
  }).sort((left, right) => {
    if (left.relative !== right.relative) {
      return left.relative - right.relative
    }
    return left.midpoint - right.midpoint
  })

  const slots: WordObservation[][] = []
  for (const observation of observations) {
    const current = slots[slots.length - 1]
    if (!current) {
      slots.push([observation])
      continue
    }

    const meanRelative = average(current.map((entry) => entry.relative))
    const meanMidpoint = average(current.map((entry) => entry.midpoint))
    const hasProvider = current.some((entry) => entry.providerId === observation.providerId)
    const relativeDistance = Math.abs(observation.relative - meanRelative)
    const timeDistance = Math.abs(observation.midpoint - meanMidpoint)

    if (hasProvider || relativeDistance > relativeThreshold || timeDistance > timeThreshold) {
      slots.push([observation])
    } else {
      current.push(observation)
    }
  }

  const chosenTokens: string[] = []
  const supports: number[] = []
  let lowMargin = false

  for (const slot of slots) {
    const votes = new Map<string, { weight: number, contributors: Set<string>, surfaces: Map<string, number> }>()
    let totalWeight = 0
    for (const observation of slot) {
      totalWeight += observation.weight
      const entry = votes.get(observation.normalized) ?? {
        weight: 0,
        contributors: new Set<string>(),
        surfaces: new Map<string, number>()
      }
      entry.weight += observation.weight
      entry.contributors.add(observation.providerId)
      entry.surfaces.set(observation.text, (entry.surfaces.get(observation.text) ?? 0) + observation.weight)
      votes.set(observation.normalized, entry)
    }

    const ranked = [...votes.entries()].sort((left, right) => {
      const contributorDelta = right[1].contributors.size - left[1].contributors.size
      if (contributorDelta !== 0) {
        return contributorDelta
      }
      return right[1].weight - left[1].weight
    })
    const winner = ranked[0]
    if (!winner) {
      continue
    }

    const support = totalWeight > 0 ? winner[1].weight / totalWeight : 0
    const secondWeight = ranked[1]?.[1].weight ?? 0
    const margin = totalWeight > 0 ? (winner[1].weight - secondWeight) / totalWeight : 0
    lowMargin ||= margin < 0.12

    const chosenSurface = [...winner[1].surfaces.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? winner[0]
    chosenTokens.push(chosenSurface)
    supports.push(support)
  }

  let consensusText = cleanSpacing(chosenTokens.join(' '))
  if (consensusText.length > 0) {
    consensusText = `${consensusText.charAt(0).toUpperCase()}${consensusText.slice(1)}`
    if (!/[.!?]$/.test(consensusText) && chosenTokens.length >= 4) {
      consensusText = `${consensusText}.`
    }
  }

  return {
    consensusText,
    confidence: average(supports),
    lowMargin,
    variants
  }
}

const buildConsensusWindows = (
  providers: ProviderTranscript[],
  maxEndSeconds: number
): Array<{ startSeconds: number, endSeconds: number }> => {
  const startClusters = clusterTimes(
    providers.flatMap((provider) => provider.evidence.segments.map((segment) => ({
      time: segment.startSeconds,
      providerId: provider.id
    }))),
    1.1
  )

  const keptBoundaries: number[] = []
  for (const cluster of startClusters) {
    if (keptBoundaries.length === 0) {
      keptBoundaries.push(cluster.time)
      continue
    }

    const lastBoundary = keptBoundaries[keptBoundaries.length - 1] ?? 0
    if (cluster.providerIds.size >= 2 || cluster.time - lastBoundary >= 8) {
      keptBoundaries.push(cluster.time)
    }
  }

  if (keptBoundaries.length === 0) {
    keptBoundaries.push(0)
  }
  if ((keptBoundaries[0] ?? 0) > 0) {
    keptBoundaries.unshift(0)
  }
  if ((keptBoundaries[keptBoundaries.length - 1] ?? 0) < maxEndSeconds) {
    keptBoundaries.push(maxEndSeconds)
  }

  const allClusterTimes = startClusters.map((cluster) => cluster.time)
  const windows: Array<{ startSeconds: number, endSeconds: number }> = []

  const maybeSplitWindow = (startSeconds: number, endSeconds: number): void => {
    const duration = endSeconds - startSeconds
    const averageWordCount = average(providers.map((provider) => extractWindowWords(provider, startSeconds, endSeconds, false).length))
    if (duration <= 12 && averageWordCount <= 28) {
      windows.push({ startSeconds, endSeconds })
      return
    }

    const candidate = allClusterTimes
      .filter((time) => time > startSeconds + 2 && time < endSeconds - 2)
      .map((time) => ({
        time,
        support: providers.filter((provider) => provider.evidence.segments.some((segment) => Math.abs(segment.startSeconds - time) <= 1.2)).length,
        midpointDistance: Math.abs(((startSeconds + endSeconds) / 2) - time)
      }))
      .sort((left, right) => {
        if (right.support !== left.support) {
          return right.support - left.support
        }
        return left.midpointDistance - right.midpointDistance
      })[0]

    if (!candidate || candidate.support === 0) {
      windows.push({ startSeconds, endSeconds })
      return
    }

    maybeSplitWindow(startSeconds, candidate.time)
    maybeSplitWindow(candidate.time, endSeconds)
  }

  for (let index = 0; index < keptBoundaries.length - 1; index += 1) {
    const startSeconds = keptBoundaries[index] ?? 0
    const endSeconds = keptBoundaries[index + 1] ?? startSeconds
    if (endSeconds <= startSeconds) {
      continue
    }
    maybeSplitWindow(startSeconds, endSeconds)
  }

  const merged: Array<{ startSeconds: number, endSeconds: number }> = []
  for (const window of windows.sort((left, right) => left.startSeconds - right.startSeconds)) {
    const previous = merged[merged.length - 1]
    if (previous && window.startSeconds < previous.endSeconds && previous.endSeconds - window.startSeconds < 0.5) {
      previous.endSeconds = Math.max(previous.endSeconds, window.endSeconds)
      continue
    }
    merged.push({ ...window })
  }

  return merged
}

const locateAudioPath = async (runDir: string, metadata: unknown): Promise<string | null> => {
  if (isRecord(metadata) && isRecord(metadata['step1'])) {
    const audioFileName = getString(metadata['step1']['audioFileName'])
    if (audioFileName) {
      const candidate = join(runDir, audioFileName)
      if (await fileExists(candidate)) {
        return candidate
      }
    }
  }

  const entries = await readdir(runDir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }
    if (AUDIO_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      return join(runDir, entry.name)
    }
  }

  return null
}

const buildRows = (providers: ProviderTranscript[]): ComparisonRow[] => {
  const maxEndSeconds = Math.max(
    ...providers.flatMap((provider) => provider.evidence.segments.map((segment) => segment.endSeconds)),
    0
  )
  const windows = buildConsensusWindows(providers, maxEndSeconds)
  const rows: ComparisonRow[] = []

  for (const [index, window] of windows.entries()) {
    const consensus = buildConsensusForWindow(providers, window.startSeconds, window.endSeconds)
    if (consensus.consensusText.length === 0 && consensus.variants.every((variant) => variant.text.length === 0)) {
      continue
    }

    const consensusWords = tokenizeWords(consensus.consensusText)
    const variants: ProviderVariant[] = consensus.variants.map((variant) => {
      const variantWords = variant.words.map((word) => word.normalized)
      return {
        providerId: variant.provider.id,
        label: variant.provider.label,
        text: variant.text,
        similarity: computeWordSimilarity(consensusWords, variantWords) * 100,
        wordCount: variantWords.length,
        ...(variant.speaker ? { speaker: variant.speaker } : {}),
        supportsWindow: variant.text.length > 0
      }
    })

    const averageSimilarity = average(variants.map((variant) => variant.similarity))
    const providerSupportCount = variants.filter((variant) => variant.supportsWindow).length
    const dominantSpeaker = (() => {
      const counts = new Map<string, number>()
      for (const variant of variants) {
        if (!variant.speaker) {
          continue
        }
        counts.set(variant.speaker, (counts.get(variant.speaker) ?? 0) + 1)
      }
      let winner: string | undefined
      let best = -1
      for (const [speaker, count] of counts) {
        if (count > best) {
          winner = speaker
          best = count
        }
      }
      return winner
    })()

    const reviewReasons: string[] = []
    if (providerSupportCount < 2) {
      reviewReasons.push('Only one provider contributed words to this window')
    }
    if (consensus.confidence < 0.72) {
      reviewReasons.push('Low consensus confidence')
    }
    if (averageSimilarity < 70) {
      reviewReasons.push('Low provider agreement')
    }
    if (consensus.lowMargin) {
      reviewReasons.push('Small winning margin between competing token votes')
    }

    rows.push({
      id: `row-${String(index + 1).padStart(4, '0')}`,
      startSeconds: window.startSeconds,
      endSeconds: window.endSeconds,
      startTimestamp: formatSecondsToTimestamp(window.startSeconds),
      endTimestamp: formatSecondsToTimestamp(window.endSeconds),
      ...(dominantSpeaker ? { speaker: dominantSpeaker } : {}),
      consensusText: consensus.consensusText,
      confidence: consensus.confidence * 100,
      averageSimilarity,
      reviewReasons,
      variants
    })
  }

  return rows
}

const buildProviderSummary = (
  providers: ProviderTranscript[],
  rows: ComparisonRow[]
): ProviderSummary[] => {
  const consensusWords = rows.flatMap((row) => tokenizeWords(row.consensusText))

  return providers.map((provider) => {
    const providerWords = provider.evidence.words.map((word) => word.normalized)
    const rowCoverage = rows.filter((row) => row.variants.some((variant) => variant.providerId === provider.id && variant.supportsWindow)).length
    return {
      providerId: provider.id,
      label: provider.label,
      similarity: computeWordSimilarity(consensusWords, providerWords) * 100,
      rowCoverage,
      wordCount: providerWords.length,
      timingQuality: provider.evidence.timingQuality,
      capabilities: provider.evidence.capabilities,
      tokenCount: provider.tokenCount,
      actualCostCents: provider.actualCostCents,
      estimatedCostCents: provider.estimatedCostCents,
      actualProcessingTimeMs: provider.actualProcessingTimeMs,
      estimatedProcessingTimeMs: provider.estimatedProcessingTimeMs
    }
  }).sort((left, right) => right.similarity - left.similarity)
}

const formatTranscriptRows = (rows: ComparisonRow[]): string =>
  rows.map((row) => {
    const speakerPrefix = row.speaker ? `[${row.speaker}] ` : ''
    return `[${row.startTimestamp}] ${speakerPrefix}${row.consensusText}`.trim()
  }).join('\n')

const formatCents = (value: number | null): string => value === null ? 'n/a' : `${value.toFixed(4)}¢ ($${(value / 100).toFixed(4)})`

const formatDurationMs = (value: number | null): string => {
  if (value === null) {
    return 'n/a'
  }
  if (value < 1000) {
    return `${value} ms`
  }
  const totalSeconds = value / 1000
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(2)} s`
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds.toFixed(2)}s`
}

const buildMissingProviderSummary = (analysis: RunConsensusAnalysis): string[] => {
  const produced = new Set(analysis.metadata.producedProviderKeys)
  const missing = analysis.metadata.requestedProviderKeys.filter((providerKey) => !produced.has(providerKey))
  return missing.length === 0
    ? ['- Missing requested providers: none']
    : [`- Missing requested providers: ${missing.map((provider) => `\`${provider}\``).join(', ')}`]
}

const buildRunConsensusReportMarkdown = (analysis: RunConsensusAnalysis): string => {
  const lines: string[] = []
  lines.push('# STT Consensus Report')
  lines.push('')
  lines.push(`Source run: \`${analysis.runLabel}\``)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- Title: ${analysis.metadata.title ? `\`${analysis.metadata.title}\`` : 'n/a'}`)
  lines.push(`- Duration: ${analysis.metadata.duration ? `\`${analysis.metadata.duration}\`` : 'n/a'}`)
  lines.push(`- Completion status: ${analysis.metadata.completionStatus ? `\`${analysis.metadata.completionStatus}\`` : 'n/a'}`)
  lines.push(`- Requested providers: ${analysis.metadata.requestedProviderKeys.length}`)
  lines.push(`- Produced transcripts: ${analysis.providers.length}`)
  lines.push(`- Comparison rows: ${analysis.rows.length}`)
  lines.push(`- Review windows: ${analysis.reviewWindows.length}`)
  lines.push(`- Actual total cost: ${formatCents(analysis.metadata.actualTotalCostCents)}`)
  lines.push(`- Actual total provider processing time: ${formatDurationMs(analysis.metadata.actualTotalProcessingTimeMs)}`)
  lines.push(`- Wall time: ${formatDurationMs(analysis.metadata.wallTimeMs)}`)
  lines.push(...buildMissingProviderSummary(analysis))
  lines.push(`- Audio grounding: provider-native evidence only${analysis.audioPath ? ' with review clip extraction' : ' (audio file unavailable for clip extraction)'}`)
  lines.push('')
  lines.push('## Provider Summary')
  lines.push('')
  lines.push('| Provider | Similarity | Coverage | Timing | Native Words | Confidence | Speakers | Actual Cost | Actual Time |')
  lines.push('|---|---:|---:|---|---:|---:|---:|---:|---:|')
  analysis.providerSummary.forEach((provider) => {
    lines.push(`| ${provider.label} | ${provider.similarity.toFixed(2)} | ${provider.rowCoverage}/${analysis.rows.length} | ${provider.timingQuality} | ${provider.capabilities.hasNativeWordTiming ? 'yes' : 'no'} | ${provider.capabilities.hasConfidence ? 'yes' : 'no'} | ${provider.capabilities.hasSpeakerLabels ? 'yes' : 'no'} | ${formatCents(provider.actualCostCents)} | ${formatDurationMs(provider.actualProcessingTimeMs)} |`)
  })
  lines.push('')
  lines.push('## Comparison')
  lines.push('')

  if (analysis.rows.length === 0) {
    lines.push('- No comparison rows were generated from the available evidence.')
  } else {
    analysis.rows.forEach((row) => {
      const speakerSuffix = row.speaker ? ` [${row.speaker}]` : ''
      lines.push(`### ${row.startTimestamp} - ${row.endTimestamp}${speakerSuffix}`)
      lines.push('')
      lines.push(`- Consensus: ${row.consensusText}`)
      lines.push(`- Confidence: ${row.confidence.toFixed(2)}/100`)
      lines.push(`- Average similarity: ${row.averageSimilarity.toFixed(2)}/100`)
      lines.push(`- Review: ${row.reviewReasons.length === 0 ? 'no' : row.reviewReasons.join('; ')}`)
      row.variants.forEach((variant) => {
        const speakerNote = variant.speaker ? ` [${variant.speaker}]` : ''
        lines.push(`- ${variant.label}${speakerNote}: ${variant.text.length > 0 ? variant.text : '(no aligned words)'} (${variant.similarity.toFixed(2)}/100)`)
      })
      lines.push('')
    })
  }

  lines.push('## Artifacts')
  lines.push('')
  lines.push('- `consensus-transcription.txt` is the clean best-guess transcript built from the merged provider windows.')
  lines.push('- `consensus-review.md` lists only the low-confidence windows.')
  lines.push('- `consensus-report.json` contains the structured rows and provider summary.')
  if (analysis.reviewWindows.some((window) => window.clipPath !== null)) {
    lines.push('- `review-clips/` contains extracted mp3 clips for review windows.')
  }

  return lines.join('\n')
}

const buildRunReviewMarkdown = (analysis: RunConsensusAnalysis): string => {
  const lines: string[] = []
  lines.push('# STT Consensus Review')
  lines.push('')
  lines.push(`Source run: \`${analysis.runLabel}\``)
  lines.push('')

  if (analysis.reviewWindows.length === 0) {
    lines.push('- No review windows were flagged.')
    return lines.join('\n')
  }

  analysis.reviewWindows.forEach((window) => {
    const speakerSuffix = window.speaker ? ` [${window.speaker}]` : ''
    lines.push(`## ${window.startTimestamp} - ${window.endTimestamp}${speakerSuffix}`)
    lines.push('')
    lines.push(`- Consensus: ${window.consensusText}`)
    lines.push(`- Confidence: ${window.confidence.toFixed(2)}/100`)
    lines.push(`- Reasons: ${window.reasons.join('; ')}`)
    lines.push(`- Clip: ${window.clipPath ? `\`${window.clipPath}\`` : 'not available'}`)
    lines.push('')
  })

  return lines.join('\n')
}

const toStructuredRunSummary = (analysis: RunConsensusAnalysis): Record<string, unknown> => ({
  runDir: analysis.runDir,
  runLabel: analysis.runLabel,
  metadata: analysis.metadata,
  rows: analysis.rows,
  reviewWindows: analysis.reviewWindows,
  providerSummary: analysis.providerSummary,
  audioPath: analysis.audioPath
})

const extractReviewClip = async (
  audioPath: string,
  clipPath: string,
  startSeconds: number,
  endSeconds: number
): Promise<boolean> => {
  const clipStart = Math.max(0, startSeconds - 2)
  const clipDuration = Math.max(1, (endSeconds - startSeconds) + 4)
  const result = await exec('ffmpeg', [
    '-v', 'error',
    '-y',
    '-i', audioPath,
    '-ss', String(clipStart),
    '-t', String(clipDuration),
    '-vn',
    '-codec:a', 'libmp3lame',
    '-q:a', '2',
    clipPath
  ])

  return result.exitCode === 0
}

const addReviewArtifacts = async (
  runDir: string,
  audioPath: string | null,
  rows: ComparisonRow[]
): Promise<ReviewWindow[]> => {
  const reviewRows = rows.filter((row) => row.reviewReasons.length > 0)
  if (reviewRows.length === 0) {
    return []
  }

  const clipsAvailable = audioPath !== null && commandExists('ffmpeg')
  const clipsDir = join(runDir, 'review-clips')
  if (clipsAvailable) {
    await mkdir(clipsDir, { recursive: true })
  }

  const reviewWindows: ReviewWindow[] = []
  for (const row of reviewRows) {
    let clipPath: string | null = null
    if (clipsAvailable && audioPath) {
      const clipFileName = `${row.id}-${row.startTimestamp.replace(/:/g, '-')}-${row.endTimestamp.replace(/:/g, '-')}.mp3`
      const absoluteClipPath = join(clipsDir, clipFileName)
      if (await extractReviewClip(audioPath, absoluteClipPath, row.startSeconds, row.endSeconds)) {
        clipPath = `review-clips/${clipFileName}`
      }
    }

    reviewWindows.push({
      rowId: row.id,
      startTimestamp: row.startTimestamp,
      endTimestamp: row.endTimestamp,
      ...(row.speaker ? { speaker: row.speaker } : {}),
      consensusText: row.consensusText,
      confidence: row.confidence,
      reasons: row.reviewReasons,
      clipPath
    })
  }

  return reviewWindows
}

export const analyzeSttRunDirectory = async (runDir: string): Promise<RunConsensusAnalysis> => {
  const resolvedRunDir = resolve(runDir)
  const rootMetadata = await readJsonFile(join(resolvedRunDir, 'metadata.json'))
  const metadataSummary = summarizeRunMetadata(rootMetadata)
  const costActualByKey = extractCostStepMap(rootMetadata, 'actual')
  const costEstimatedByKey = extractCostStepMap(rootMetadata, 'estimated')
  const timingActualByKey = extractTimingStepMap(rootMetadata, 'actual')
  const timingEstimatedByKey = extractTimingStepMap(rootMetadata, 'estimated')
  const providerDir = join(resolvedRunDir, 'providers')
  const providerEntries = (await readdir(providerDir, { withFileTypes: true }).catch(() => []))
    .sort((left, right) => left.name.localeCompare(right.name))

  let providers = (await Promise.all(
    providerEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => loadProviderTranscript(
        resolvedRunDir,
        entry.name,
        costActualByKey,
        costEstimatedByKey,
        timingActualByKey,
        timingEstimatedByKey
      ))
  )).filter((provider): provider is ProviderTranscript => provider !== null)

  if (providers.length === 0) {
    throw new Error(`No provider evidence artifacts found under ${resolvedRunDir}`)
  }

  providers = applyCanonicalSpeakers(providers)
  const rows = buildRows(providers)
  const providerSummary = buildProviderSummary(providers, rows)
  const consensusText = formatTranscriptRows(rows)
  const audioPath = await locateAudioPath(resolvedRunDir, rootMetadata)
  const reviewWindows = await addReviewArtifacts(resolvedRunDir, audioPath, rows)

  return {
    runDir: resolvedRunDir,
    runLabel: basename(resolvedRunDir),
    metadata: metadataSummary,
    providers,
    rows,
    reviewWindows,
    providerSummary,
    consensusText,
    audioPath
  }
}

export const writeRunConsensusArtifacts = async (analysis: RunConsensusAnalysis): Promise<{
  consensusPath: string
  reportPath: string
  jsonPath: string
  reviewPath: string
}> => {
  const consensusPath = join(analysis.runDir, 'consensus-transcription.txt')
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

export const buildAggregateConsensusReportMarkdown = (targetDir: string, analyses: RunConsensusAnalysis[]): string => {
  const lines: string[] = []
  lines.push('# STT Consensus Batch Report')
  lines.push('')
  lines.push(`Target directory: \`${targetDir}\``)
  lines.push('')
  lines.push('## Runs')
  lines.push('')
  lines.push('| Run | Produced Providers | Rows | Review Windows | Best Similarity | Missing Providers | Actual Cost | Wall Time |')
  lines.push('|---|---:|---:|---:|---:|---|---:|---:|')

  analyses.forEach((analysis) => {
    const bestProvider = analysis.providerSummary[0]
    const produced = new Set(analysis.metadata.producedProviderKeys)
    const missingProviders = analysis.metadata.requestedProviderKeys.filter((providerKey) => !produced.has(providerKey))
    lines.push(`| ${analysis.runLabel} | ${analysis.providers.length} | ${analysis.rows.length} | ${analysis.reviewWindows.length} | ${bestProvider ? bestProvider.similarity.toFixed(2) : 'n/a'} | ${missingProviders.length === 0 ? 'none' : missingProviders.join(', ')} | ${formatCents(analysis.metadata.actualTotalCostCents)} | ${formatDurationMs(analysis.metadata.wallTimeMs)} |`)
  })

  lines.push('')
  lines.push('Each run directory also contains `consensus-transcription.txt`, `consensus-report.md`, `consensus-review.md`, and `consensus-report.json`.')
  return lines.join('\n')
}

export const analyzeAndWriteConsensusReports = async (targetPath: string): Promise<{
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
  const runDirectories = await discoverAnalyzableRunDirectories(targetPath)
  const analyses = await Promise.all(runDirectories.map((runDir) => analyzeSttRunDirectory(runDir)))
  const runArtifacts = await Promise.all(analyses.map(async (analysis) => ({
    runDir: analysis.runDir,
    ...(await writeRunConsensusArtifacts(analysis))
  })))

  if (runDirectories.length === 1) {
    return {
      targetDir: resolve(targetPath),
      runArtifacts,
      aggregateReportPath: null
    }
  }

  const aggregateReportPath = join(resolve(targetPath), 'consensus-report.md')
  await writeFile(
    aggregateReportPath,
    `${buildAggregateConsensusReportMarkdown(resolve(targetPath), analyses)}\n`,
    'utf8'
  )

  return {
    targetDir: resolve(targetPath),
    runArtifacts,
    aggregateReportPath
  }
}
