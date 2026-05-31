import { stat } from 'node:fs/promises'
import { CLIUsageError } from '~/utils/error-handler'

export type JsonObject = Record<string, unknown>

export const isRecord = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const getObject = (object: JsonObject, key: string): JsonObject | undefined => {
  const value = object[key]
  return isRecord(value) ? value : undefined
}

export const getString = (object: JsonObject, key: string): string | undefined => {
  const value = object[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

export const getNumber = (object: JsonObject, key: string): number | undefined => {
  const value = object[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export const getArray = (object: JsonObject, key: string): unknown[] => {
  const value = object[key]
  return Array.isArray(value) ? value : []
}

export const round2 = (value: number): number => Math.round(value * 100) / 100

export const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

export const optionalAverage = (values: readonly number[]): number | undefined =>
  values.length === 0 ? undefined : round2(average(values))

export const providerKey = (service: string, model: string): string => `${service}/${model}`

export const providerGroup = (service: string): 'local' | 'service' =>
  service === 'local' ? 'local' : 'service'

export const ensureDirectory = async (path: string, label: string): Promise<void> => {
  try {
    const pathStat = await stat(path)
    if (!pathStat.isDirectory()) {
      throw CLIUsageError(`${label} must be a run directory: ${path}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'CLIUsageError') {
      throw error
    }
    throw CLIUsageError(`${label} not found: ${path}`)
  }
}

export const ensureFile = async (path: string, message: string): Promise<void> => {
  try {
    const pathStat = await stat(path)
    if (!pathStat.isFile()) {
      throw CLIUsageError(message)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'CLIUsageError') {
      throw error
    }
    throw CLIUsageError(message)
  }
}

export const costFromRunCostSteps = (runJson: JsonObject, service: string, model: string): number | undefined => {
  const metadata = getObject(runJson, 'metadata')
  const cost = metadata ? getObject(metadata, 'cost') : undefined
  const sources = [
    cost ? getObject(cost, 'actual') : undefined,
    cost ? getObject(cost, 'estimated') : undefined
  ]

  for (const source of sources) {
    if (!source) {
      continue
    }

    for (const step of getArray(source, 'steps').filter(isRecord)) {
      if (getString(step, 'provider') === service && getString(step, 'model') === model) {
        const value = getNumber(step, 'cost') ?? getNumber(step, 'costCents') ?? getNumber(step, 'actualCostCents')
        if (value !== undefined) {
          return value
        }
      }
    }
  }

  return undefined
}

const stripJsonCodeFence = (rawText: string): string => {
  const trimmed = rawText.trim()
  if (!trimmed.startsWith('```')) {
    return trimmed
  }

  return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

export const parseJsonObjectFromText = (rawText: string, errorMessage: string): JsonObject => {
  const direct = stripJsonCodeFence(rawText)

  try {
    const parsed = JSON.parse(direct) as unknown
    if (isRecord(parsed)) {
      return parsed
    }
  } catch {
  }

  const start = direct.indexOf('{')
  const end = direct.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const parsed = JSON.parse(direct.slice(start, end + 1)) as unknown
    if (isRecord(parsed)) {
      return parsed
    }
  }

  throw new Error(errorMessage)
}

export const stringArray = (object: JsonObject, key: string): string[] =>
  getArray(object, key)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())

export const uniqueStrings = (values: readonly string[]): string[] => [...new Set(values)]

export const escapeCell = (value: string): string => value.replaceAll('|', '\\|').replaceAll('\n', ' ')

export const formatScore = (value: number): string => value.toFixed(2)

export const formatSeconds = (value: number | undefined): string =>
  value === undefined ? 'n/a' : `${(value / 1000).toFixed(2)}s`

export const formatCost = (value: number | undefined): string =>
  value === undefined ? 'n/a' : `$${(value / 100).toFixed(4)}`
