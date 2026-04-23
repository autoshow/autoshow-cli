import { basename } from 'node:path'
import { createHumanTable, createLocationsTable } from '~/utils/logger/human-table'
import type { HumanLogTable, LogLevel, Logger } from '~/utils/logger/types'
import type { NormalizedAudioPlan } from './audio-normalize'

type TableLogger = Pick<Logger, 'write'>

export type AudioDownloadSource = 'yt-dlp' | 'direct-audio-url' | 'direct-media-url'
export type AudioDownloadStatus = 'started' | 'downloaded'

export type AudioDownloadSummary = {
  source: AudioDownloadSource
  status: AudioDownloadStatus
  target: string
  detail?: string
}

export type AudioNormalizeSummary = {
  status: 'planned'
  inputPath: string
  outputPath: string
  plan: NormalizedAudioPlan
}

export const buildAudioDownloadRows = (
  summary: AudioDownloadSummary
): Array<{ status: string, source: string, target: string, detail: string }> => [{
  status: summary.status,
  source: summary.source,
  target: summary.target,
  detail: summary.detail ?? ''
}]

export const buildAudioDownloadTable = (
  summary: AudioDownloadSummary
): HumanLogTable =>
  createHumanTable(buildAudioDownloadRows(summary), ['status', 'source', 'target', 'detail'])

export const logAudioDownload = (
  logger: TableLogger,
  summary: AudioDownloadSummary,
  level: LogLevel = summary.status === 'downloaded' ? 'success' : 'info'
): void => {
  logger.write(level, 'Audio Download', {
    category: 'pipeline',
    humanTable: buildAudioDownloadTable(summary),
    metadata: summary
  })
}

export const buildAudioNormalizeRows = (
  summary: AudioNormalizeSummary
): Array<{ status: string, mode: string, input: string, output: string, codec: string, detail: string }> => [{
  status: summary.status,
  mode: summary.plan.mode,
  input: basename(summary.inputPath) || 'audio',
  output: basename(summary.outputPath) || 'audio',
  codec: `${summary.plan.sourceCodecName}->${summary.plan.outputCodecName}`,
  detail: summary.plan.reason
}]

export const buildAudioNormalizeTable = (
  summary: AudioNormalizeSummary
): HumanLogTable =>
  createHumanTable(buildAudioNormalizeRows(summary), ['status', 'mode', 'input', 'output', 'codec', 'detail'])

export const logAudioNormalize = (
  logger: TableLogger,
  summary: AudioNormalizeSummary
): void => {
  logger.write('info', 'Audio Normalize', {
    category: 'pipeline',
    humanTable: buildAudioNormalizeTable(summary),
    metadata: {
      status: summary.status,
      inputPath: summary.inputPath,
      outputPath: summary.outputPath,
      plan: summary.plan
    }
  })
}

export const logAudioOutput = (
  logger: TableLogger,
  audioPath: string
): void => {
  logger.write('success', 'Audio Output', {
    category: 'artifact',
    humanTable: createLocationsTable([{ artifact: 'audio', path: audioPath }]),
    metadata: { audioPath }
  })
}
