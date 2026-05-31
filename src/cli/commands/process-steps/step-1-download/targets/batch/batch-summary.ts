import { basename } from 'node:path'
import * as l from '~/utils/logger'
import { createHumanTable, logBatchItemTable } from '~/utils/logger/human-table'
import { readBatchManifest } from '~/cli/commands/process-steps/manifest-utils'
import { formatSttTargetLabel } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import type { BatchManifestEntry, BatchManifestErrorEntry, ProcessCommand, SttBatchItemSummary, SttManifestProviderSummary } from '~/types'
import { getBatchManifestCompletionStatus, getBatchManifestErrors, isRecord } from './batch-manifest'

const getBatchManifestTitle = (
  entry: BatchManifestEntry,
  fallbackIndex: number
): string => {
  const step1 = isRecord(entry['step1']) ? entry['step1'] : undefined
  const titleCandidates = [
    step1?.['title'],
    step1?.['slug'],
    entry['title']
  ]

  for (const candidate of titleCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  const url = typeof step1?.['url'] === 'string'
    ? step1['url']
    : typeof entry['url'] === 'string'
      ? entry['url']
      : undefined
  if (typeof url === 'string' && url.length > 0) {
    try {
      const parsed = new URL(url)
      const leaf = basename(parsed.pathname).replace(/\.[^.]+$/, '')
      if (leaf.length > 0) {
        return leaf
      }
    } catch {
    }
  }

  const outputDir = entry['outputDir']
  if (typeof outputDir === 'string' && outputDir.trim().length > 0) {
    return basename(outputDir)
  }

  return `item-${fallbackIndex + 1}`
}

const parseSttManifestProviderSummaries = (
  entry: BatchManifestEntry
): SttManifestProviderSummary[] => {
  const providerStates = Array.isArray(entry['providerStates']) ? entry['providerStates'] : []
  const summaries: SttManifestProviderSummary[] = []

  for (const value of providerStates) {
    if (!isRecord(value) || typeof value['service'] !== 'string' || typeof value['model'] !== 'string') {
      continue
    }

    const status = value['status']
    if (status !== 'succeeded' && status !== 'missing' && status !== 'failed' && status !== 'skipped') {
      continue
    }

    const lastError = isRecord(value['lastError']) ? value['lastError'] : undefined
    const message = typeof lastError?.['message'] === 'string' && lastError['message'].trim().length > 0
      ? lastError['message'].trim()
      : undefined

    summaries.push({
      label: formatSttTargetLabel({
        service: value['service'] as Parameters<typeof formatSttTargetLabel>[0]['service'],
        model: value['model']
      }),
      status,
      ...(message ? { message } : {})
    })
  }

  return summaries
}

const countStep2Entries = (entry: BatchManifestEntry): number => {
  const step2 = entry['step2']
  if (Array.isArray(step2)) {
    return step2.filter((value) => isRecord(value)).length
  }

  return isRecord(step2) ? 1 : 0
}

const getSttManifestProviderCounts = (
  entry: BatchManifestEntry | null
): {
  succeeded: number
  failed: number
  missing: number
  skipped: number
} => {
  if (!entry) {
    return {
      succeeded: 0,
      failed: 0,
      missing: 0,
      skipped: 0
    }
  }

  const summaries = parseSttManifestProviderSummaries(entry)
  if (summaries.length > 0) {
    return summaries.reduce((counts, summary) => {
      if (summary.status === 'succeeded') {
        counts.succeeded += 1
      } else if (summary.status === 'failed') {
        counts.failed += 1
      } else if (summary.status === 'missing') {
        counts.missing += 1
      } else {
        counts.skipped += 1
      }
      return counts
    }, {
      succeeded: 0,
      failed: 0,
      missing: 0,
      skipped: 0
    })
  }

  const errors = getBatchManifestErrors(entry)
  return {
    succeeded: countStep2Entries(entry),
    failed: errors.filter((value) => value.skipped !== true).length,
    missing: 0,
    skipped: errors.filter((value) => value.skipped === true).length
  }
}

const formatBatchProviderCount = (
  count: number,
  label: string
): string => `${count} ${label}${count === 1 ? '' : 's'}`

export const buildSttBatchItemDetail = (
  entry: BatchManifestEntry | null
): string | undefined => {
  const counts = getSttManifestProviderCounts(entry)
  const parts = [
    counts.failed > 0 ? formatBatchProviderCount(counts.failed, 'provider failure') : undefined,
    counts.missing > 0 ? formatBatchProviderCount(counts.missing, 'provider missing') : undefined,
    counts.skipped > 0 ? formatBatchProviderCount(counts.skipped, 'provider skipped') : undefined
  ].filter((value): value is string => typeof value === 'string')

  return parts.length > 0 ? parts.join(', ') : undefined
}

const resolveSttBatchManifestCompletionStatus = (
  entry: BatchManifestEntry
): 'full' | 'incomplete' | 'failed' | 'skipped' => {
  const completionStatus = getBatchManifestCompletionStatus(entry)
  if (completionStatus) {
    return completionStatus
  }

  const counts = getSttManifestProviderCounts(entry)
  if (counts.succeeded === 0) {
    return 'failed'
  }

  return counts.failed === 0 && counts.missing === 0 ? 'full' : 'incomplete'
}

const summarizeSttBatchManifestEntries = (
  entries: BatchManifestEntry[]
): SttBatchItemSummary[] =>
  entries.map((entry, index) => ({
    label: getBatchManifestTitle(entry, index),
    completionStatus: resolveSttBatchManifestCompletionStatus(entry),
    providers: parseSttManifestProviderSummaries(entry)
  }))

const buildSttBatchFinalSummaryTable = (
  entries: BatchManifestEntry[]
) => {
  const summaries = summarizeSttBatchManifestEntries(entries)
  const rows = summaries.flatMap((summary, index) => {
    const base = {
      item: `${index + 1}/${summaries.length}`,
      label: summary.label,
      status: summary.completionStatus
    }

    if (summary.providers.length === 0) {
      return [{
        ...base,
        provider: 'unavailable',
        providerStatus: 'unavailable',
        detail: ''
      }]
    }

    return summary.providers.map((provider) => ({
      ...base,
      provider: provider.label,
      providerStatus: provider.status,
      detail: provider.message ?? ''
    }))
  })

  return createHumanTable(rows, ['item', 'label', 'status', 'provider', 'providerStatus', 'detail'])
}

export const logSttBatchFinalSummary = async (batchDir: string): Promise<void> => {
  const manifest = await readBatchManifest(batchDir, 'extract').catch(() => undefined)
  if (!manifest) {
    return
  }

  const summaries = summarizeSttBatchManifestEntries(manifest.manifest.items)
  if (summaries.length === 0) {
    return
  }

  const table = buildSttBatchFinalSummaryTable(manifest.manifest.items)
  const hasFailed = summaries.some((summary) =>
    summary.completionStatus === 'failed'
    || summary.providers.some((provider) => provider.status === 'failed')
  )
  const hasWarnings = hasFailed || summaries.some((summary) =>
    summary.completionStatus === 'incomplete'
    || summary.completionStatus === 'skipped'
    || summary.providers.some((provider) =>
      provider.status === 'skipped' || provider.status === 'missing'
    )
  )
  const level = hasFailed ? 'error' : hasWarnings ? 'warn' : 'success'
  l.write(level, 'STT final provider status by item', {
    category: 'artifact',
    humanTable: table,
    metadata: {
      items: summaries.map((summary, index) => ({
        item: `${index + 1}/${summaries.length}`,
        label: summary.label,
        status: summary.completionStatus,
        providers: summary.providers
      }))
    }
  })
}

const buildNonSttBatchSummaryTable = (
  ok: number,
  partial: number,
  fail: number
) =>
  createHumanTable([{
    completed: ok,
    full: ok - partial,
    partial,
    failed: fail
  }], ['completed', 'full', 'partial', 'failed'])

const buildSttBatchSummaryTable = (
  ok: number,
  incomplete: number,
  fail: number
) =>
  createHumanTable([{
    full: ok,
    incomplete,
    failed: fail
  }], ['full', 'incomplete', 'failed'])

export const buildBatchPartialFailureTable = (
  entries: BatchManifestErrorEntry[]
) => {
  const counts = new Map<string, number>()

  for (const entry of entries) {
    if (entry.skipped === true) {
      continue
    }
    if (typeof entry.service !== 'string' || typeof entry.model !== 'string') {
      continue
    }

    const key = `${entry.service}/${entry.model}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const rows = [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([provider, failures]) => ({ provider, failures }))

  return createHumanTable(rows, ['provider', 'failures'])
}

export const logBatchItemStatus = (
  level: 'info' | 'success' | 'warn' | 'error',
  item: string,
  status: 'processing' | 'done' | 'incomplete' | 'failed',
  detail?: string
): void => {
  logBatchItemTable(l, [{
    status,
    input: item,
    ...(detail ? { detail } : {})
  }], { level })
}

const buildBatchCompletionTable = (
  command: ProcessCommand,
  ok: number,
  partial: number,
  incomplete: number,
  fail: number,
  sttLike = false
)=> {
  void command
  return sttLike
    ? buildSttBatchSummaryTable(ok, incomplete, fail)
    : buildNonSttBatchSummaryTable(ok, partial, fail)
}

export const logBatchCompletionTable = (
  command: ProcessCommand,
  ok: number,
  partial: number,
  incomplete: number,
  fail: number,
  sttLike = false
): void => {
  l.write(
    sttLike
      ? (incomplete > 0 || fail > 0 ? 'warn' : 'success')
      : (partial > 0 || fail > 0 ? 'warn' : 'success'),
    'Batch Summary',
    {
      category: 'pipeline',
      humanTable: buildBatchCompletionTable(command, ok, partial, incomplete, fail, sttLike),
      metadata: sttLike
        ? { full: ok, incomplete, failed: fail }
        : { completed: ok, full: ok - partial, partial, failed: fail }
    }
  )
}
