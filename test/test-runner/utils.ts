import { isAbsolute, normalize, relative, resolve } from 'node:path'

export const normalizeRepoPath = (path: string | null | undefined): string | null => {
  if (!path || path.trim().length === 0) {
    return null
  }

  const trimmed = path.trim().replace(/^file:\/\//, '')
  const abs = isAbsolute(trimmed) ? trimmed : resolve(process.cwd(), trimmed)
  return normalize(relative(process.cwd(), abs)).replace(/\\/g, '/')
}

const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

export const getFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const parseEstimatedCostValue = (line: string): number | null => {
  const exactCents = line.match(/\(([0-9]+(?:\.[0-9]+)?)¢\)/)
  if (exactCents?.[1]) {
    const value = Number.parseFloat(exactCents[1])
    return Number.isFinite(value) ? value : null
  }

  const valueMatch = line.match(/(?:Suite total estimated cost|Total estimated cost):\s*(free|<0\.01¢|\$([0-9]+(?:\.[0-9]+)?)|([0-9]+(?:\.[0-9]+)?)¢)/i)
  if (!valueMatch) {
    return null
  }

  if (valueMatch[1]?.toLowerCase() === 'free') {
    return 0
  }

  if (valueMatch[1] === '<0.01¢') {
    return 0.01
  }

  const usdRaw = valueMatch[2]
  if (usdRaw) {
    const value = Number.parseFloat(usdRaw)
    return Number.isFinite(value) ? value * 100 : null
  }

  const centsRaw = valueMatch[3]
  if (centsRaw) {
    const value = Number.parseFloat(centsRaw)
    return Number.isFinite(value) ? value : null
  }

  return null
}

export const parseCommandEstimatedTotal = (text: string): number | null => {
  const clean = stripAnsi(text)
  const matches: Array<{ index: number; value: number }> = []

  for (const match of clean.matchAll(/(?:Suite total estimated cost|Total estimated cost):[^\r\n]*/gi)) {
    const value = parseEstimatedCostValue(match[0])
    if (value !== null) {
      matches.push({ index: match.index ?? 0, value })
    }
  }

  for (const match of clean.matchAll(/"totalEstimatedCostCents":\s*([0-9]+(?:\.[0-9]+)?)/g)) {
    const value = Number.parseFloat(match[1] ?? '')
    if (Number.isFinite(value)) {
      matches.push({ index: match.index ?? 0, value })
    }
  }

  for (const match of clean.matchAll(/"totalEstimatedCost":\s*"([0-9]+(?:\.[0-9]+)?)¢"/g)) {
    const value = Number.parseFloat(match[1] ?? '')
    if (Number.isFinite(value)) {
      matches.push({ index: match.index ?? 0, value })
    }
  }

  matches.sort((left, right) => left.index - right.index)
  const last = matches[matches.length - 1]
  if (!last) {
    return null
  }
  return last.value
}

export const decodeXml = (text: string): string => {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

export const parseXmlAttributes = (input: string): Record<string, string> => {
  const attrs: Record<string, string> = {}
  const re = /(\w+)="([^"]*)"/g
  for (const match of input.matchAll(re)) {
    const key = match[1]
    const value = match[2]
    if (key && value !== undefined) {
      attrs[key] = decodeXml(value)
    }
  }
  return attrs
}

export const formatTimestampForDir = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
}

const formatElapsedForOutput = (elapsedMs: number): string => {
  const safeElapsedMs = Math.max(0, Math.round(elapsedMs))
  const hours = Math.floor(safeElapsedMs / 3_600_000)
  const minutes = Math.floor((safeElapsedMs % 3_600_000) / 60_000)
  const seconds = Math.floor((safeElapsedMs % 60_000) / 1000)
  const milliseconds = safeElapsedMs % 1000

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0')
  ].join(':') + `.${String(milliseconds).padStart(3, '0')}`
}

export const formatTimedOutputPrefix = (atMs: number, startedAtMs: number): string => {
  return `[${formatElapsedForOutput(atMs - startedAtMs)}]`
}
