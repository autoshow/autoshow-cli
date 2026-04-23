import { basename } from 'node:path'
import { createHumanTable, createLocationsTable } from '~/utils/logger/human-table'
import type {
  AudioDownloadSummary,
  AudioLoggingTableLogger,
  AudioNormalizeSummary,
  HumanLogTable,
  LogLevel
} from '~/types'

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
  logger: AudioLoggingTableLogger,
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
  logger: AudioLoggingTableLogger,
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
  logger: AudioLoggingTableLogger,
  audioPath: string
): void => {
  logger.write('success', 'Audio Output', {
    category: 'artifact',
    humanTable: createLocationsTable([{ artifact: 'audio', path: audioPath }]),
    metadata: { audioPath }
  })
}
