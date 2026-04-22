import { describe, expect, test } from 'bun:test'
import {
  buildSttAcquireRows,
  buildSttAsyncJobRows,
  buildSttCacheRows,
  buildSttRunStatusRows
} from '~/cli/commands/process-steps/step-2-stt/stt-logging'
import {
  buildResumeItemTable,
  buildResumeSummaryTable
} from '~/cli/commands/process-steps/resume/resume-logging'

describe('table logging builders', () => {
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
      missing: 1
    })).toEqual([{
      completionStatus: 'incomplete',
      requested: 4,
      succeeded: 3,
      failed: 1,
      missing: 1
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
