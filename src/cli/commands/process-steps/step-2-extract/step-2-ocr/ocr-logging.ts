import { createKeyValueTable } from '~/utils/logger/human-table'
import type { HumanLogTable, HumanLogTableRow, LogLevel, TableLogger } from '~/types'

const ANSI_PATTERN = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g

export type OcrProviderLifecycle = {
  provider: string
  model: string
  status: string
  elapsedMs?: number | undefined
  reason?: string | undefined
  detail?: string | undefined
}

export type OcrPagesProgress = {
  status: string
  ocrPages: number
  totalPages: number
  renderConcurrency: number
  ocrConcurrency: number
}

export type OcrJobProgress = {
  provider: string
  action: string
  remoteId?: string | undefined
  state: string
  pages?: number | string | undefined
  detail?: string | undefined
}

export type OcrTransferEvent = {
  action: string
  file: string
  destination: string
}

export type OcrmypdfRunConfig = {
  status: string
  input: string
  jobs: number | string
  languages: string
}

export type OcrmypdfOutputEvent = {
  stream: 'stdout' | 'stderr'
  page?: number | undefined
  detail: string
  rawLine?: string | undefined
}

export type PaddleOcrPrepareEvent = {
  status: string
  input: string
  dimensions?: string | { width: number, height: number } | undefined
  maxSide: number | string
  detail?: string | undefined
}

const formatDimensions = (
  dimensions: PaddleOcrPrepareEvent['dimensions']
): string => {
  if (typeof dimensions === 'string') {
    return dimensions
  }
  if (dimensions) {
    return `${dimensions.width}x${dimensions.height}`
  }
  return ''
}

const compactDetail = (detail: string): string =>
  detail.replace(/\s+/g, ' ').trim()

type KeyValueEntry = readonly [string, unknown]

const addOptionalEntry = (
  entries: KeyValueEntry[],
  key: string,
  value: unknown
): void => {
  if (value !== undefined && value !== '') {
    entries.push([key, value])
  }
}

const parseOcrmypdfPageLine = (
  detail: string
): { page: number, detail: string } | undefined => {
  const match = detail.match(/^(?:page\s+)?(\d+)(?:\s*\/\s*\d+)?(?:(?:\s*[:.)-]\s*)|\s+(?=page\b|image\b|ocr\b|raster|skip|deskew|rotate|orientation|tesseract\b))(.*)$/i)
  if (!match) {
    return undefined
  }

  const page = Number(match[1])
  if (!Number.isFinite(page) || page < 1) {
    return undefined
  }

  const parsedDetail = compactDetail(match[2] ?? '')
  return {
    page,
    detail: parsedDetail.length > 0 ? parsedDetail : detail
  }
}

export const parseOcrmypdfOutputLine = (
  stream: OcrmypdfOutputEvent['stream'],
  line: string
): OcrmypdfOutputEvent | undefined => {
  const detail = compactDetail(line.replace(ANSI_PATTERN, ''))
  if (detail.length === 0) {
    return undefined
  }

  const parsedPage = parseOcrmypdfPageLine(detail)
  return {
    stream,
    detail: parsedPage?.detail ?? detail,
    ...(parsedPage ? { page: parsedPage.page } : {}),
    rawLine: line
  }
}

export const buildOcrProviderLifecycleRows = (
  lifecycle: OcrProviderLifecycle
): Array<{ provider: string, model: string, status: string, elapsedMs: number | '', reason: string }> => [{
  provider: lifecycle.provider,
  model: lifecycle.model,
  status: lifecycle.status,
  elapsedMs: lifecycle.elapsedMs ?? '',
  reason: lifecycle.reason ?? ''
}]

export const buildOcrProviderLifecycleTable = (
  lifecycle: OcrProviderLifecycle
): HumanLogTable => {
  const entries: KeyValueEntry[] = [
    ['provider', lifecycle.provider],
    ['model', lifecycle.model],
    ['status', lifecycle.status]
  ]
  addOptionalEntry(entries, 'elapsedMs', lifecycle.elapsedMs)
  addOptionalEntry(entries, 'reason', lifecycle.reason)
  addOptionalEntry(entries, 'detail', lifecycle.detail)
  return createKeyValueTable(entries)
}

export const logOcrProviderLifecycle = (
  logger: TableLogger,
  lifecycle: OcrProviderLifecycle,
  level: LogLevel = lifecycle.status === 'succeeded'
    ? 'success'
    : lifecycle.status === 'failed' ? 'warn' : 'info'
): void => {
  logger.write(level, 'OCR Provider', {
    category: 'pipeline',
    humanTable: buildOcrProviderLifecycleTable(lifecycle),
    metadata: lifecycle
  })
}

export const buildOcrPagesProgressRows = (
  progress: OcrPagesProgress
): Array<{
  status: string
  ocrPages: number
  totalPages: number
  renderConcurrency: number
  ocrConcurrency: number
}> => [{
  status: progress.status,
  ocrPages: progress.ocrPages,
  totalPages: progress.totalPages,
  renderConcurrency: progress.renderConcurrency,
  ocrConcurrency: progress.ocrConcurrency
}]

export const buildOcrPagesProgressTable = (
  progress: OcrPagesProgress
): HumanLogTable =>
  createKeyValueTable([
    ['status', progress.status],
    ['ocrPages', progress.ocrPages],
    ['totalPages', progress.totalPages],
    ['renderConcurrency', progress.renderConcurrency],
    ['ocrConcurrency', progress.ocrConcurrency]
  ])

export const logOcrPagesProgress = (
  logger: TableLogger,
  progress: OcrPagesProgress,
  level: LogLevel = 'info'
): void => {
  logger.write(level, 'OCR Pages', {
    category: 'pipeline',
    humanTable: buildOcrPagesProgressTable(progress),
    metadata: progress
  })
}

export const buildOcrJobProgressRows = (
  job: OcrJobProgress
): Array<{ provider: string, action: string, remoteId: string, state: string, pages: number | string, detail: string }> => [{
  provider: job.provider,
  action: job.action,
  remoteId: job.remoteId ?? '',
  state: job.state,
  pages: job.pages ?? '',
  detail: job.detail ?? ''
}]

export const buildOcrJobProgressTable = (
  job: OcrJobProgress
): HumanLogTable => {
  const entries: KeyValueEntry[] = [
    ['provider', job.provider],
    ['action', job.action]
  ]
  addOptionalEntry(entries, 'remoteId', job.remoteId)
  entries.push(['state', job.state])
  addOptionalEntry(entries, 'pages', job.pages)
  addOptionalEntry(entries, 'detail', job.detail)
  return createKeyValueTable(entries)
}

export const logOcrJobProgress = (
  logger: TableLogger,
  job: OcrJobProgress,
  level: LogLevel = job.state === 'failed' ? 'warn' : 'info'
): void => {
  logger.write(level, 'OCR Job', {
    category: 'pipeline',
    humanTable: buildOcrJobProgressTable(job),
    metadata: job
  })
}

export const buildOcrTransferTable = (
  event: OcrTransferEvent
): HumanLogTable =>
  createKeyValueTable([
    ['action', event.action],
    ['file', event.file],
    ['destination', event.destination]
  ])

export const logOcrTransfer = (
  logger: TableLogger,
  event: OcrTransferEvent,
  level: LogLevel = 'info'
): void => {
  logger.write(level, 'OCR Transfer', {
    category: 'pipeline',
    humanTable: buildOcrTransferTable(event),
    metadata: event
  })
}

export const buildOcrmypdfRunConfigTable = (
  config: OcrmypdfRunConfig
): HumanLogTable =>
  createKeyValueTable([
    ['status', config.status],
    ['input', config.input],
    ['jobs', config.jobs],
    ['languages', config.languages]
  ])

export const logOcrmypdfRunConfig = (
  logger: TableLogger,
  config: OcrmypdfRunConfig,
  level: LogLevel = 'info'
): void => {
  logger.write(level, 'OCRmyPDF', {
    category: 'pipeline',
    humanTable: buildOcrmypdfRunConfigTable(config),
    metadata: config
  })
}

export const buildOcrmypdfOutputRows = (
  event: OcrmypdfOutputEvent
): HumanLogTableRow[] => [{
  stream: event.stream,
  ...(event.page !== undefined ? { page: event.page } : {}),
  detail: event.detail
}]

export const buildOcrmypdfOutputTable = (
  event: OcrmypdfOutputEvent
): HumanLogTable => {
  const entries: KeyValueEntry[] = [
    ['stream', event.stream]
  ]
  addOptionalEntry(entries, 'page', event.page)
  entries.push(['detail', event.detail])
  return createKeyValueTable(entries)
}

export const logOcrmypdfOutput = (
  logger: TableLogger,
  event: OcrmypdfOutputEvent,
  level: LogLevel = 'info'
): void => {
  logger.write(level, 'OCRmyPDF Output', {
    category: 'pipeline',
    humanTable: buildOcrmypdfOutputTable(event),
    metadata: event
  })
}

export const buildPaddleOcrPrepareTable = (
  event: PaddleOcrPrepareEvent
): HumanLogTable => {
  const entries: Array<readonly [string, unknown]> = [
    ['status', event.status],
    ['input', event.input],
    ['dimensions', formatDimensions(event.dimensions)],
    ['maxSide', event.maxSide]
  ]

  if (event.detail && event.detail.length > 0) {
    entries.push(['detail', event.detail])
  }

  return createKeyValueTable(entries)
}

export const logPaddleOcrPrepare = (
  logger: TableLogger,
  event: PaddleOcrPrepareEvent,
  level: LogLevel = event.status === 'failed' || event.status.endsWith('-failed') ? 'warn' : 'info'
): void => {
  logger.write(level, 'PaddleOCR Prepare', {
    category: 'pipeline',
    humanTable: buildPaddleOcrPrepareTable(event),
    metadata: {
      ...event,
      dimensions: formatDimensions(event.dimensions)
    }
  })
}
