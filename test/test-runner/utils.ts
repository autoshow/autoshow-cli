import { isAbsolute, normalize, relative, resolve } from 'node:path'

export const normalizeRepoPath = (path: string | null | undefined): string | null => {
  if (!path || path.trim().length === 0) {
    return null
  }

  const trimmed = path.trim().replace(/^file:\/\//, '')
  const abs = isAbsolute(trimmed) ? trimmed : resolve(process.cwd(), trimmed)
  return normalize(relative(process.cwd(), abs)).replace(/\\/g, '/')
}

export const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

export const parseCommandEstimatedTotal = (text: string): number | null => {
  const clean = stripAnsi(text)
  const re = /(Suite total estimated cost|Total estimated cost):\s*(?:\$([0-9]+(?:\.[0-9]+)?)|([0-9]+(?:\.[0-9]+)?)¢)|"totalEstimatedCost":\s*"([0-9]+(?:\.[0-9]+)?)¢"/g
  const matches = Array.from(clean.matchAll(re))
  const last = matches[matches.length - 1]
  if (!last) {
    return null
  }
  const usdRaw = last[2]
  const centsRaw = last[3] ?? last[4]
  if (usdRaw) {
    const value = Number.parseFloat(usdRaw)
    return Number.isFinite(value) ? value * 100 : null
  }
  if (centsRaw) {
    const cents = Number.parseFloat(centsRaw)
    return Number.isFinite(cents) ? cents : null
  }
  return null
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

export const formatElapsedForOutput = (elapsedMs: number): string => {
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
