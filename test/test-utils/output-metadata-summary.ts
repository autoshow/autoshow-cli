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

  for (const [key, value] of Object.entries(metadata)) {
    if (key === 'cost' || !isRecord(value)) {
      continue
    }

    const processingTime = getFiniteNumber(value['processingTime'])
    if (processingTime === null) {
      continue
    }

    total += processingTime
    found = true
  }

  return found ? total : null
}

export type OutputMetadataSummary = {
  estimatedCostCents: number | null
  actualCostCents: number | null
  actualProcessingTimeMs: number | null
}

export const summarizeOutputMetadataValue = (value: unknown): OutputMetadataSummary | null => {
  if (!isRecord(value)) {
    return null
  }

  return {
    estimatedCostCents: readCostTotal(value, 'estimated'),
    actualCostCents: readCostTotal(value, 'actual'),
    actualProcessingTimeMs: readActualProcessingTime(value),
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
