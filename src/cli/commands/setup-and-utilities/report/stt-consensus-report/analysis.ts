import { mkdir, readdir, readFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'

import { readProviderResultEntry, readRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import { commandExists, exec, fileExists } from '~/utils/cli-utils'
import { average, clamp, getFiniteNumber, getString, isRecord, median } from '~/cli/commands/setup-and-utilities/report/report-internals/primitives'
import { computeWordSimilarity, tokenizeWords } from '~/cli/commands/setup-and-utilities/report/report-internals/text'

import type {
  ComparisonRow,
  PersistedTranscriptionEvidence,
  ProviderSummary,
  ProviderTranscript,
  ReviewWindow,
  RunConsensusAnalysis,
  RunMetadataSummary,
  SpeakerCluster,
  SpeakerTrack,
  TimeCluster,
  TimeObservation,
  TranscriptionEvidenceCapabilities,
  TranscriptionEvidenceSegment,
  TranscriptionEvidenceWord,
  WordObservation
} from './types'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.flac', '.webm', '.mp4'])

const normalizeProviderKey = (service: string, model: string): string => `${service}/${model}`

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
  const resultPath = join(providerDir, 'result.json')

  const [transcriptRaw, evidenceRaw, providerResult] = await Promise.all([
    readFile(transcriptPath, 'utf8').catch(() => null),
    readJsonFile(evidencePath),
    readProviderResultEntry(providerDir)
  ])

  if (typeof transcriptRaw !== 'string' || transcriptRaw.trim().length === 0) {
    return null
  }

  const evidence = normalizePersistedEvidence(evidenceRaw)
  if (!evidence) {
    throw new Error(`Run requires transcription.evidence.json for providers/${providerDirName}. Rerun STT with the updated evidence persistence before generating a consensus report.`)
  }

  const providerMetadataRecord = isRecord(providerResult?.metadata) ? providerResult.metadata : {}
  const providerKey = normalizeProviderKey(evidence.service, evidence.model)

  return {
    id: providerDirName,
    service: evidence.service,
    model: evidence.model,
    label: evidence.label,
    transcriptPath,
    evidencePath,
    resultPath,
    rawText: transcriptRaw,
    evidence,
    tokenCount: getFiniteNumber(providerMetadataRecord['tokenCount']),
    actualCostCents: costActualByKey.get(providerKey) ?? null,
    estimatedCostCents: costEstimatedByKey.get(providerKey) ?? null,
    actualProcessingTimeMs: timingActualByKey.get(providerKey) ?? getFiniteNumber(providerMetadataRecord['processingTime']),
    estimatedProcessingTimeMs: timingEstimatedByKey.get(providerKey) ?? null
  }
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
    const variants = consensus.variants.map((variant) => {
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
  const rootMetadata = (await readRunManifest(resolvedRunDir, 'stt'))?.metadata ?? null
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
