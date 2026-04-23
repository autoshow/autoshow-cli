import { describe, expect, test } from 'bun:test'
import {
  buildSttAcquireRows,
  buildSttAsyncJobRows,
  buildSttCacheRows,
  buildSttRunStatusRows,
  buildSttSegmentLifecycleRows
} from '~/cli/commands/process-steps/step-2-stt/stt-logging'
import {
  buildAudioDownloadRows,
  buildAudioNormalizeRows
} from '~/cli/commands/process-steps/step-1-download/audio/audio-logging'
import {
  buildResumeItemTable,
  buildResumeSummaryTable
} from '~/cli/commands/process-steps/resume/resume-logging'
import { buildSetupToolStatusRows } from '~/cli/commands/setup-and-utilities/setup/setup-logging'
import { buildMediaGenerationStatusRows } from '~/cli/commands/process-steps/generation-command-utils'
import { buildSuitePriceSummaryRows } from '~/cli/commands/process-steps/suite-price-logging'
import { logKeyValueTable, logSingleRowTable } from '~/logger/human-table'
import type { Logger, LogSinkEvent } from '~/logger/types'

describe('table logging builders', () => {
  test('builds audio download rows for table logs', () => {
    expect(buildAudioDownloadRows({
      source: 'yt-dlp',
      status: 'downloaded',
      target: 'output/run/source.webm'
    })).toEqual([{
      status: 'downloaded',
      source: 'yt-dlp',
      target: 'output/run/source.webm',
      detail: ''
    }])
  })

  test('builds audio normalization rows with mode and codec details', () => {
    expect(buildAudioNormalizeRows({
      status: 'planned',
      inputPath: 'output/run/source.webm',
      outputPath: 'output/run/source.ogg',
      plan: {
        profile: 'default',
        mode: 'copy-stream',
        outputExtension: '.ogg',
        outputFormat: 'ogg',
        outputCodecName: 'opus',
        sourceCodecName: 'opus',
        reason: 'extract or remux Opus/Vorbis audio without re-encoding',
        stripMetadata: false,
        stripChapters: false
      }
    })).toEqual([{
      status: 'planned',
      mode: 'copy-stream',
      input: 'source.webm',
      output: 'source.ogg',
      codec: 'opus->opus',
      detail: 'extract or remux Opus/Vorbis audio without re-encoding'
    }])
  })

  test('builds STT cache rows with stable columns', () => {
    expect(buildSttCacheRows({
      artifact: 'source_media',
      status: 'rebuild',
      key: 'cache-key-1',
      detail: 'refreshed requested artifact'
    })).toEqual([{
      artifact: 'source_media',
      status: 'rebuild',
      key: 'cache-key-1',
      detail: 'refreshed requested artifact'
    }])
  })

  test('builds STT acquire rows with item, source media, and elapsed time', () => {
    expect(buildSttAcquireRows({
      item: 'episode-slug',
      sourceMedia: 'hit',
      elapsedMs: 128
    })).toEqual([{
      item: 'episode-slug',
      sourceMedia: 'hit',
      elapsedMs: 128
    }])
  })

  test('builds async STT job lifecycle rows', () => {
    expect(buildSttAsyncJobRows({
      provider: 'soniox/stt-async-v4',
      action: 'resumed',
      remoteId: 'tx-123',
      state: 'polling'
    })).toEqual([{
      provider: 'soniox/stt-async-v4',
      action: 'resumed',
      remoteId: 'tx-123',
      state: 'polling'
    }])
  })

  test('builds STT run status rows', () => {
    expect(buildSttRunStatusRows({
      completionStatus: 'incomplete',
      requested: 4,
      succeeded: 3,
      failed: 1,
      missing: 1,
      skipped: 0
    })).toEqual([{
      completionStatus: 'incomplete',
      requested: 4,
      succeeded: 3,
      failed: 1,
      missing: 1,
      skipped: 0
    }])
  })

  test('builds STT segment lifecycle rows', () => {
    expect(buildSttSegmentLifecycleRows({
      provider: 'mistral',
      action: 'completed',
      segmentNumber: 2,
      totalSegments: 4,
      model: 'voxtral-mini',
      processingTimeMs: 1530
    })).toEqual([{
      provider: 'mistral',
      action: 'completed',
      segment: '2/4',
      model: 'voxtral-mini',
      processingTimeMs: 1530,
      detail: ''
    }])
  })

  test('logs single-row helper tables with metadata', () => {
    const events: LogSinkEvent[] = []
    const logger = {
      write: (...args: Parameters<Logger['write']>) => {
        const [level, message, options] = args
        events.push({
          timestamp: 'now',
          runId: 'test',
          indent: true,
          args: [],
          level,
          message,
          category: options?.category ?? 'general',
          ...(options?.metadata ? { metadata: options.metadata } : {}),
          ...(options?.humanTable ? { humanTable: options.humanTable } : {})
        })
      }
    }

    logSingleRowTable(logger, 'Setup Status', { tool: 'uv', status: 'installed' }, { columns: ['tool', 'status'] })

    expect(events[0]?.humanTable?.rows).toEqual([{ tool: 'uv', status: 'installed' }])
    expect(events[0]?.metadata).toEqual({ tool: 'uv', status: 'installed' })
  })

  test('logs key-value helper tables with labels', () => {
    const events: LogSinkEvent[] = []
    const logger = {
      write: (...args: Parameters<Logger['write']>) => {
        const [level, message, options] = args
        events.push({
          timestamp: 'now',
          runId: 'test',
          indent: true,
          args: [],
          level,
          message,
          category: options?.category ?? 'general',
          ...(options?.metadata ? { metadata: options.metadata } : {}),
          ...(options?.humanTable ? { humanTable: options.humanTable } : {})
        })
      }
    }

    logKeyValueTable(logger, 'Pinned Versions', [
      ['whisper.cpp', 'v1.7.6'],
      ['llama.cpp', 'b4400']
    ], { keyLabel: 'dependency', valueLabel: 'version' })

    expect(events[0]?.humanTable?.columns).toEqual(['dependency', 'version'])
    expect(events[0]?.humanTable?.rows).toEqual([
      { dependency: 'whisper.cpp', version: 'v1.7.6' },
      { dependency: 'llama.cpp', version: 'b4400' }
    ])
  })

  test('builds suite price summary rows', () => {
    expect(buildSuitePriceSummaryRows({
      checkedLabel: 'commands',
      checkedCount: 3,
      totalEstimatedCost: 12.345678
    })).toEqual([{
      checked: '3 commands',
      totalEstimatedCost: '12.34568¢'
    }])
  })

  test('builds media generation status rows', () => {
    expect(buildMediaGenerationStatusRows({
      mediaType: 'video',
      provider: 'gemini',
      model: 'veo-3.1-fast-generate-preview',
      status: 'completed',
      processingTimeMs: 4200,
      outputCount: 1,
      detail: 'estimated billing'
    })).toEqual([{
      mediaType: 'video',
      provider: 'gemini',
      model: 'veo-3.1-fast-generate-preview',
      status: 'completed',
      processingTimeMs: 4200,
      outputCount: 1,
      detail: 'estimated billing'
    }])
  })

  test('builds setup tool status rows', () => {
    expect(buildSetupToolStatusRows({
      tool: 'uv',
      status: 'installed',
      detail: '/usr/local/bin/uv'
    })).toEqual([{
      tool: 'uv',
      status: 'installed',
      detail: '/usr/local/bin/uv'
    }])
  })

  test('builds resume item tables with providers and detail columns', () => {
    expect(buildResumeItemTable({
      item: '2/5',
      status: 'processing',
      outputDir: '/tmp/output/run',
      providers: ['mistral/mistral-ocr-2512', 'glm/glm-ocr'],
      detail: 'resuming missing providers'
    }).rows).toEqual([{
      item: '2/5',
      status: 'processing',
      outputDir: '/tmp/output/run',
      providers: 'mistral/mistral-ocr-2512, glm/glm-ocr',
      detail: 'resuming missing providers'
    }])
  })

  test('builds resume summary tables', () => {
    expect(buildResumeSummaryTable({
      full: 3,
      incomplete: 1,
      failed: 0
    }).rows).toEqual([{
      full: 3,
      incomplete: 1,
      failed: 0
    }])
  })
})
