const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const getFiniteNumber = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const readCostTotal = (metadata: Record<string, unknown>, key: 'estimated' | 'actual'): number | null => {
  const cost = metadata['cost']
  if (!isRecord(cost)) return null

  const section = cost[key]
  if (!isRecord(section)) return null

  return getFiniteNumber(section['totalCost'])
}

const readActualProcessingTime = (metadata: Record<string, unknown>): number | null => {
  let total = 0
  let found = false

  const readEntryProcessingTime = (value: unknown): number => {
    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + readEntryProcessingTime(item), 0)
    }

    if (!isRecord(value)) {
      return 0
    }

    const processingTime = getFiniteNumber(value['processingTime'])
    return processingTime ?? 0
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (key === 'cost' || key === 'timing') {
      continue
    }

    const processingTime = readEntryProcessingTime(value)
    if (processingTime <= 0) {
      continue
    }

    total += processingTime
    found = true
  }

  return found ? total : null
}

const readTimingTotal = (
  metadata: Record<string, unknown>,
  phase: 'estimated' | 'actual'
): number | null => {
  const timing = metadata['timing']
  if (!isRecord(timing)) return null

  const section = timing[phase]
  if (!isRecord(section)) return null

  return getFiniteNumber(section['totalProcessingTimeMs'])
}

export type OutputMetadataSummary = {
  estimatedCostCents: number | null
  actualCostCents: number | null
  estimatedProcessingTimeMs: number | null
  actualProcessingTimeMs: number | null
}

export const summarizeOutputMetadataValue = (value: unknown): OutputMetadataSummary | null => {
  if (!isRecord(value)) {
    return null
  }

  return {
    estimatedCostCents: readCostTotal(value, 'estimated'),
    actualCostCents: readCostTotal(value, 'actual'),
    estimatedProcessingTimeMs: readTimingTotal(value, 'estimated'),
    actualProcessingTimeMs: readTimingTotal(value, 'actual') ?? readActualProcessingTime(value),
  }
}

export const readOutputMetadataSummary = async (metadataPath: string): Promise<OutputMetadataSummary | null> => {
  try {
    const raw = JSON.parse(await Bun.file(metadataPath).text()) as unknown
    return summarizeOutputMetadataValue(raw)
  } catch {
    return null
  }
}
