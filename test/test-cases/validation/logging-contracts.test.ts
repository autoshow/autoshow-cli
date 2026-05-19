import { describe, expect, test } from 'bun:test'
import { buildAudioNormalizeTable } from '~/cli/commands/process-steps/step-1-download/audio/audio-logging'
import {
  buildOcrJobProgressTable,
  buildOcrPagesProgressTable,
  buildOcrProviderLifecycleTable,
  buildOcrTransferTable,
  buildOcrmypdfOutputTable,
  buildOcrmypdfRunConfigTable,
  buildPaddleOcrPrepareTable,
  parseOcrmypdfOutputLine
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-logging'
import {
  buildSttCleanupArtifactsTable,
  buildSttCacheTable,
  buildSttDiarizationConfigTable,
  buildSttProviderSpeakerCountHintsTable,
  buildSttProviderConcurrencyTable,
  buildSttProviderSlotsTable,
  buildSttSplitDecisionTable,
  buildSttSplitSegmentsTable,
  buildSttTranscriptOutputTable,
  logSttProviderConcurrency
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import {
  buildProviderModelLabel,
  buildTimingProviderModelLabel
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-prompt'
import { buildResumeSummaryTable } from '~/cli/commands/process-steps/resume/resume-logging'
import { buildSuitePriceSummaryRows } from '~/cli/commands/process-steps/suite-price-logging'
import { buildWriteManifestConsoleSummary, logExtractManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log'
import { buildProviderReadinessTable } from '~/cli/commands/setup-and-utilities/setup/setup-logging'
import { createLogger } from '~/utils/logger/core'
import { formatCost } from '~/utils/logger/formatters'
import { createReporter } from '~/utils/logger/reporter'
import { createHumanTable, createKeyValueTable, createLocationsTable, renderHumanTable } from '~/utils/logger/human-table'
import { sanitizeLogText } from '~/utils/logger/redaction'
import { buildRetryAttemptTable } from '~/utils/retries'
import { createHumanSink } from '~/utils/logger/sinks/human-sink'
import { createJsonSink } from '~/utils/logger/sinks/json-sink'
import { stripAnsi } from '~/utils/terminal-colors'
import type { Logger, LogSinkEvent, LogWriteOptions } from '~/types'

const makeEvent = (level: LogSinkEvent['level']): LogSinkEvent => ({
  timestamp: '2026-01-01T00:00:00.000Z',
  level,
  message: 'message',
  category: 'general',
  runId: 'run-id',
  context: { command: 'write' },
  metadata: { key: 'value' },
  indent: true,
  args: []
})

const captureConsole = (fn: () => void): { stdout: string[]; stderr: string[] } => {
  const stdout: string[] = []
  const stderr: string[] = []
  const originalLog = console.log
  const originalWarn = console.warn
  const originalError = console.error

  console.log = (...args: unknown[]) => {
    stdout.push(String(args[0] ?? ''))
  }
  console.warn = (...args: unknown[]) => {
    stderr.push(String(args[0] ?? ''))
  }
  console.error = (...args: unknown[]) => {
    stderr.push(String(args[0] ?? ''))
  }

  try {
    fn()
  } finally {
    console.log = originalLog
    console.warn = originalWarn
    console.error = originalError
  }

  return { stdout, stderr }
}

const withColorEnv = <T>(
  env: { forceColor?: string | undefined; noColor?: string | undefined },
  fn: () => T
): T => {
  const originalForceColor = process.env['FORCE_COLOR']
  const originalNoColor = process.env['NO_COLOR']

  if (env.forceColor === undefined) {
    delete process.env['FORCE_COLOR']
  } else {
    process.env['FORCE_COLOR'] = env.forceColor
  }

  if (env.noColor === undefined) {
    delete process.env['NO_COLOR']
  } else {
    process.env['NO_COLOR'] = env.noColor
  }

  try {
    return fn()
  } finally {
    if (originalForceColor === undefined) {
      delete process.env['FORCE_COLOR']
    } else {
      process.env['FORCE_COLOR'] = originalForceColor
    }

    if (originalNoColor === undefined) {
      delete process.env['NO_COLOR']
    } else {
      process.env['NO_COLOR'] = originalNoColor
    }
  }
}

const hasAnsi = (text: string): boolean => stripAnsi(text) !== text

const createCapturingLogger = (): {
  logger: Logger
  writes: Array<{ message: string; options?: LogWriteOptions }>
} => {
  const writes: Array<{ message: string; options?: LogWriteOptions }> = []
  const logger: Logger = {
    write: (_level, message, options) => {
      writes.push(options === undefined ? { message } : { message, options })
    },
    debug: () => {},
    warn: () => {},
    error: () => {},
    withContext: () => logger,
    config: { sinks: [], minLevel: 'info' }
  }
  return { logger, writes }
}

describe('logging contracts', () => {
  test('formatCost renders exact cents with three fractional digits', () => {
    expect(formatCost(0.07343)).toBe('0.073\u00a2')
    expect(formatCost(0.0736)).toBe('0.074\u00a2')
  })

  test('human sink routes interactive info logs to stdout with table output', () => {
    const sink = createHumanSink({ interactive: true })
    const captured = captureConsole(() => {
      sink({
        ...makeEvent('info'),
        message: 'Locations',
        humanTable: createHumanTable([{ artifact: 'run', path: 'output/run/run.json' }], ['artifact', 'path'])
      })
    })

    expect(captured.stdout).toHaveLength(1)
    expect(captured.stderr).toHaveLength(0)
    expect(captured.stdout[0]).toContain('Locations')
    expect(stripAnsi(captured.stdout[0] as string)).toContain('output/run/run.json')
  })

  test('human sink colors log prefixes when color is enabled', () => {
    const sink = createHumanSink({ interactive: true })
    const captured = withColorEnv({ forceColor: '1' }, () => captureConsole(() => {
      sink({
        ...makeEvent('success'),
        message: 'Complete!',
        category: 'artifact'
      })
    }))

    const output = captured.stdout[0] as string
    expect(hasAnsi(output)).toBe(true)
    expect(stripAnsi(output)).toContain('[2026-01-01T00:00:00.000Z] \u2713   Complete!')
  })

  test('colored human table output strips back to plain output', () => {
    const table = createHumanTable([
      {
        status: 'completed',
        path: 'output/run/run.json',
        providerModel: 'openai/gpt-5.4',
        durationMs: '1250ms',
        cost: '1.25000\u00a2'
      }
    ], ['status', 'path', 'providerModel', 'durationMs', 'cost'])

    const plain = withColorEnv({ noColor: '1' }, () => renderHumanTable(table))
    const colored = withColorEnv({ forceColor: '1' }, () => renderHumanTable(table))

    expect(hasAnsi(colored)).toBe(true)
    expect(stripAnsi(colored)).toBe(plain)
  })

  test('colored human table output keeps visible column widths aligned', () => {
    const table = createHumanTable([
      {
        status: 'completed',
        cost: '1.25000\u00a2',
        path: 'output/run/run.json',
        providerModel: 'openai/gpt-5.4',
        durationMs: '1250ms'
      },
      {
        status: 'failed',
        cost: '123.45600\u00a2',
        path: 'output/providers/openai/result.json',
        providerModel: 'gemini/veo-3.1-lite',
        durationMs: '98765ms'
      }
    ], ['status', 'cost', 'path', 'providerModel', 'durationMs'])

    const stripped = stripAnsi(withColorEnv({ forceColor: '1' }, () => renderHumanTable(table)))
    const lineWidths = new Set(stripped.split('\n').map(line => line.length))
    expect(lineWidths.size).toBe(1)
    expect(stripped).toContain('\u2502 failed    \u2502 123.45600\u00a2')
    expect(stripped).toContain('\u2502 gemini/veo-3.1-lite')
  })

  test('provider model ids render as one color span', () => {
    const rendered = withColorEnv({ forceColor: '1' }, () => renderHumanTable(createHumanTable([
      { providerModel: 'elevenlabs/music_v1' }
    ], ['providerModel'])))

    expect(rendered).toMatch(/\x1b\[[0-9;]*melevenlabs\/music_v1\x1b\[0m/)
    expect(rendered).not.toMatch(/elevenlabs\x1b\[0m.*music_v1/)
  })

  test('Reverb provider model labels collapse runtime model paths', () => {
    const metadata = {
      transcriptionService: 'reverb',
      transcriptionModel: '/Users/ajc/c/as/autoshow-cli/runtime/models/reverb/reverb_asr_v1/reverb_asr_v1.pt | /Users/ajc/c/as/autoshow-cli/runtime/models/reverb/reverb_asr_v1/config.yaml | diarization:v2'
    } as const

    expect(buildProviderModelLabel(metadata)).toBe('reverb/reverb_asr_v1')
    expect(buildTimingProviderModelLabel(metadata)).toBe('reverb/reverb_asr_v1')
  })

  test('slash paths render as one non-filename color span', () => {
    const path = './output/2026-04-29_10-21-25-009_1-audio/generated-music.mp3'
    const filename = 'generated-music.mp3'
    const rendered = withColorEnv({ forceColor: '1' }, () => renderHumanTable(createHumanTable([
      { path, file: filename }
    ], ['path', 'file'])))
    const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pathMatch = rendered.match(new RegExp(`(\\x1b\\[[0-9;]*m)${escapedPath}\\x1b\\[0m`))
    const fileMatch = rendered.match(new RegExp(`(\\x1b\\[[0-9;]*m)${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\x1b\\[0m`))

    expect(pathMatch?.[1]).toBeDefined()
    expect(fileMatch?.[1]).toBeDefined()
    expect(pathMatch?.[1]).not.toBe(fileMatch?.[1])
    expect(rendered).not.toMatch(/\.\/output\/2026-04-29_10-21-25-009_1-audio\/\x1b\[0m.*generated-music\.mp3/)
  })

  test('media type values are not color coded', () => {
    const rendered = withColorEnv({ forceColor: '1' }, () => renderHumanTable(createKeyValueTable([
      ['mediaType', 'video']
    ])))

    expect(hasAnsi(rendered)).toBe(true)
    expect(rendered).not.toMatch(/\x1b\[[0-9;]*mvideo\x1b\[0m/)
  })

  test('ocr progress columns receive semantic colors', () => {
    const rendered = withColorEnv({ forceColor: '1' }, () => renderHumanTable(createHumanTable([
      {
        stream: 'stderr',
        page: 3,
        totalPages: 10,
        remoteId: 'job-123'
      }
    ], ['stream', 'page', 'totalPages', 'remoteId'])))

    expect(hasAnsi(rendered)).toBe(true)
    expect(rendered).toMatch(/\x1b\[[0-9;]*mstderr\x1b\[0m/)
    expect(rendered).toMatch(/\x1b\[[0-9;]*m3\x1b\[0m/)
    expect(rendered).toMatch(/\x1b\[[0-9;]*m10\x1b\[0m/)
    expect(rendered).toMatch(/\x1b\[[0-9;]*mjob-123\x1b\[0m/)
  })

  test('NO_COLOR disables human table ANSI output', () => {
    const rendered = withColorEnv({ noColor: '1' }, () => renderHumanTable(createHumanTable([
      { status: 'failed', cost: '2.00000\u00a2', path: 'output/run/run.json' }
    ], ['status', 'cost', 'path'])))

    expect(hasAnsi(rendered)).toBe(false)
  })

  test('human artifact/path table rendering omits artifact/path header row', () => {
    const rendered = stripAnsi(renderHumanTable(createHumanTable([
      { artifact: 'run', path: 'output/run/run.json' }
    ], ['artifact', 'path'])))

    expect(rendered).toContain('\u2502 run \u2502 output/run/run.json')
    expect(rendered).not.toContain('\u2502 artifact \u2502 path')
    expect(rendered).not.toContain('\u2502 0 \u2502')
  })

  test('human key/value table rendering omits key/value header row', () => {
    const rendered = stripAnsi(renderHumanTable(createKeyValueTable([
      ['mediaType', 'video'],
      ['provider', 'gemini']
    ])))

    expect(rendered).toContain('\u2502 mediaType \u2502 video')
    expect(rendered).toContain('\u2502 provider  \u2502 gemini')
    expect(rendered).not.toContain('\u2502   \u2502 key')
    expect(rendered).not.toContain('\u2502 0 \u2502')
  })

  test('long Locations paths render as sidecar details outside the boxed table', () => {
    const longPath = 'output/2026-05-13_22-39-03-656_ajcwebdevs-content-archive/run.json'
    const table = createLocationsTable([{ artifact: 'runManifest', path: longPath }])
    const rendered = stripAnsi(renderHumanTable(table))

    expect(table.rows).toEqual([])
    expect(table.details).toEqual([{ label: 'runManifest', value: longPath }])
    expect(rendered).toBe(`  runManifest: ${longPath}`)
    expect(rendered).not.toContain('\u250c')
    expect(rendered).not.toContain(`\u2502 ${longPath}`)
  })

  test('completion provider table keeps counts inline and lifts long provider directory', () => {
    const { logger, writes } = createCapturingLogger()
    const reporter = createReporter(logger)
    const outputDir = 'output/2026-05-13_22-39-03-656_ajcwebdevs-content-archive'

    reporter.complete(outputDir, {
      'result-openai': 'providers/openai/result.json',
      'result-gemini': 'providers/gemini/result.json',
      'result-anthropic': 'providers/anthropic/result.json',
      'result-mistral': 'providers/mistral/result.json',
      'result-groq': 'providers/groq/result.json'
    })

    const providersTable = writes.find(write => write.message === 'Providers')?.options?.humanTable
    if (!providersTable) throw new Error('Expected Providers human table')

    const rendered = stripAnsi(renderHumanTable(providersTable))
    expect(providersTable.columns).toEqual(['transcripts', 'results'])
    expect(providersTable.rows).toEqual([{ transcripts: 0, results: 5 }])
    expect(providersTable.details).toEqual([{ label: 'dir', value: `${outputDir}/providers` }])
    expect(rendered).toContain('\u2502 transcripts \u2502 results')
    expect(rendered).toContain('\u2502 0           \u2502 5')
    expect(rendered).toContain(`\n  dir: ${outputDir}/providers`)
    expect(rendered).not.toContain('\u2502 dir ')
    expect(rendered).not.toContain(`\u2502 ${outputDir}/providers`)
  })

  test('short filenames and short paths remain inline in human tables', () => {
    const table = createHumanTable([
      { artifact: 'run', path: 'output/run/run.json' },
      { artifact: 'audio', path: 'speech.wav' }
    ], ['artifact', 'path'])
    const rendered = stripAnsi(renderHumanTable(table))

    expect(table.details).toBeUndefined()
    expect(rendered).toContain('\u2502 run   \u2502 output/run/run.json')
    expect(rendered).toContain('\u2502 audio \u2502 speech.wav')
  })

  test('verbose error-like table cells render as sidecar details outside the box', () => {
    const rawError = [
      'Error: OpenAI OCR request failed',
      '    at request (/tmp/autoshow/openai.ts:42:10)',
      'stderr: provider returned a diagnostic line'
    ].join('\n')
    const table = createHumanTable([
      { provider: 'openai', status: 'failed', error: rawError }
    ], ['provider', 'status', 'error'])
    const rendered = stripAnsi(renderHumanTable(table))
    const boxedRows = rendered.split('\n').filter(line => line.includes('\u2502')).join('\n')

    expect(table.rows).toEqual([{
      provider: 'openai',
      status: 'failed',
      error: 'see details'
    }])
    expect(table.details).toEqual([{ label: 'openai error', value: rawError }])
    expect(boxedRows).not.toContain('OpenAI OCR request failed')
    expect(boxedRows).not.toContain('stderr: provider returned')
    expect(rendered).toContain('  openai error: Error: OpenAI OCR request failed')
    expect(rendered).toContain('    at request (/tmp/autoshow/openai.ts:42:10)')
    expect(rendered).toContain('stderr: provider returned a diagnostic line')
  })

  test('raw stderr key/value cells render as details while short progress details stay inline', () => {
    const rawStderr = 'fatal: first diagnostic line\nsecond diagnostic line'
    const stderrTable = createKeyValueTable([
      ['stderr', rawStderr]
    ])
    const renderedStderr = stripAnsi(renderHumanTable(stderrTable))
    const boxedRows = renderedStderr.split('\n').filter(line => line.includes('\u2502')).join('\n')

    expect(stderrTable.rows).toEqual([{ key: 'stderr', value: 'see details' }])
    expect(stderrTable.details).toEqual([{ label: 'stderr', value: rawStderr }])
    expect(boxedRows).not.toContain('fatal: first diagnostic line')
    expect(renderedStderr).toContain('  stderr: fatal: first diagnostic line')
    expect(renderedStderr).toContain('second diagnostic line')

    const progressTable = createHumanTable([
      { provider: 'aws-textract', detail: 'attempt 10' }
    ], ['provider', 'detail'])
    expect(progressTable.details).toBeUndefined()
    expect(stripAnsi(renderHumanTable(progressTable))).toContain('\u2502 aws-textract \u2502 attempt 10')
  })

  test('lifted path details are redacted like table cells', () => {
    const secret = 'secret-value-123'
    const longPath = `output/2026-05-13_12-34-56-789_process-video_with-a-very-long-title/OPENAI_API_KEY=${secret}/run.json`
    const events: LogSinkEvent[] = []
    const logger = createLogger({
      runId: 'run-id',
      sinks: [event => events.push(event)]
    })

    logger.write('info', 'Locations', {
      humanTable: createLocationsTable([{ artifact: 'runManifest', path: longPath }])
    })

    const detailValue = events[0]?.humanTable?.details?.[0]?.value
    expect(detailValue).toBe(`output/2026-05-13_12-34-56-789_process-video_with-a-very-long-title/OPENAI_API_KEY=REDACTED`)
    expect(String(detailValue)).not.toContain(secret)

    const captured = captureConsole(() => createJsonSink()(events[0] as LogSinkEvent))
    expect(JSON.parse(captured.stdout[0] as string).humanTable.details[0]).toEqual({
      label: 'runManifest',
      value: detailValue
    })
  })

  test('STT provider concurrency summary omits long provider slot details', () => {
    const table = buildSttProviderConcurrencyTable({
      mode: 'cloud_provider_concurrency',
      requested: 2,
      effective: 2,
      batchConcurrency: 1,
      hostedProviders: 27,
      providerSlots: 'aws/standard:create=2,poll=1, deepgram/nova-3:launch=4'
    })

    expect(table).toEqual({
      columns: ['mode', 'requested', 'effective', 'batch', 'providers'],
      rows: [{
        mode: 'cloud_provider_concurrency',
        requested: 2,
        effective: 2,
        batch: 1,
        providers: 27
      }]
    })

    const rendered = stripAnsi(renderHumanTable(table))
    expect(rendered).not.toContain('providerSlots')
    expect(rendered).not.toContain('aws/standard')
  })

  test('STT provider slot details render as provider rows', () => {
    const table = buildSttProviderSlotsTable([
      {
        service: 'deepgram',
        model: 'nova-3',
        provider: 'deepgram/nova-3',
        kind: 'sync',
        launchSlots: 4,
        pollSlots: null
      },
      {
        service: 'aws',
        model: 'standard',
        provider: 'aws/standard',
        kind: 'async',
        launchSlots: 2,
        pollSlots: 1
      }
    ])

    expect(table).toEqual({
      columns: ['provider', 'kind', 'launch', 'poll'],
      rows: [
        { provider: 'deepgram/nova-3', kind: 'sync', launch: 4, poll: '' },
        { provider: 'aws/standard', kind: 'async', launch: 2, poll: 1 }
      ]
    })

    const rendered = stripAnsi(renderHumanTable(table))
    expect(rendered).toContain('\u2502 deepgram/nova-3 \u2502 sync')
    expect(rendered).toContain('\u2502 aws/standard    \u2502 async \u2502 2      \u2502 1')
  })

  test('STT provider concurrency log emits compact summary and slot tables', () => {
    const { logger, writes } = createCapturingLogger()
    const providerSlots = 'deepgram/nova-3:launch=4, aws/standard:create=2,poll=1'
    const providerSlotDetails = [
      {
        service: 'deepgram',
        model: 'nova-3',
        provider: 'deepgram/nova-3',
        kind: 'sync',
        launchSlots: 4,
        pollSlots: null
      },
      {
        service: 'aws',
        model: 'standard',
        provider: 'aws/standard',
        kind: 'async',
        launchSlots: 2,
        pollSlots: 1
      }
    ] as const

    logSttProviderConcurrency(
      logger,
      { requested: 2, effective: 2, hostedProviderCount: 2 },
      1,
      false,
      providerSlots,
      providerSlotDetails
    )

    expect(writes.map(write => write.message)).toEqual([
      'STT Provider Concurrency',
      'STT Provider Slots'
    ])
    expect(writes[0]?.options?.humanTable?.columns).toEqual(['mode', 'requested', 'effective', 'batch', 'providers'])
    expect(writes[1]?.options?.humanTable?.columns).toEqual(['provider', 'kind', 'launch', 'poll'])
    expect(writes[0]?.options?.metadata).toMatchObject({
      providerSlots,
      providerSlotDetails
    })
  })

  test('STT split and retry table builders expose structured rows', () => {
    expect(buildSttSplitDecisionTable(
      { service: 'groq', model: 'whisper-large-v3-turbo' },
      {
        reasons: [{ kind: 'attachment_cap', attachmentCapBytes: 25_000_000, audioFileSizeBytes: 30_000_000 }],
        segmentDurationMinutes: 12.5
      }
    )).toEqual({
      columns: ['provider', 'model', 'trigger', 'reason', 'cap', 'inputSize', 'inputDuration', 'segmentDuration'],
      rows: [{
        provider: 'groq',
        model: 'whisper-large-v3-turbo',
        trigger: 'auto',
        reason: 'attachment_cap',
        cap: '23.8 MB',
        inputSize: '28.6 MB',
        inputDuration: '',
        segmentDuration: '12.5m'
      }]
    })

    expect(buildSttSplitDecisionTable(
      { service: 'openai-stt', model: 'gpt-4o-transcribe' },
      {
        reasons: [{ kind: 'request_budget', requestBudgetSeconds: 600, audioDurationSeconds: 2423 }],
        segmentDurationMinutes: 10
      }
    )).toEqual({
      columns: ['provider', 'model', 'trigger', 'reason', 'cap', 'inputSize', 'inputDuration', 'segmentDuration'],
      rows: [{
        provider: 'openai-stt',
        model: 'gpt-4o-transcribe',
        trigger: 'auto',
        reason: 'request_budget',
        cap: '600s',
        inputSize: '',
        inputDuration: '2423s',
        segmentDuration: '10m'
      }]
    })

    expect(buildRetryAttemptTable({
      operation: 'supadata-poll-transcript',
      attempt: 2,
      maxAttempts: 4,
      reason: 'retryable status 429',
      delayMs: 1000
    })).toEqual({
      columns: ['key', 'value'],
      rows: [
        { key: 'operation', value: 'supadata-poll-transcript' },
        { key: 'attempt', value: 2 },
        { key: 'maxAttempts', value: 4 },
        { key: 'reason', value: 'retryable status 429' },
        { key: 'delayMs', value: 1000 }
      ]
    })
  })

  test('STT segment, diarization, output, and cleanup tables use compact shapes', () => {
    expect(buildSttSplitSegmentsTable([
      {
        path: '/tmp/out/segments/segment_001.flac',
        segmentNumber: 1,
        totalSegments: 2,
        startSeconds: 0,
        durationSeconds: 1799.5
      },
      {
        path: '/tmp/out/segments/segment_002.flac',
        segmentNumber: 2,
        totalSegments: 2,
        startSeconds: 1799.5,
        durationSeconds: 60
      }
    ])).toEqual({
      columns: ['segment', 'start', 'duration', 'path'],
      rows: [
        { segment: '1/2', start: '0s', duration: '1799.5s', path: '/tmp/out/segments/segment_001.flac' },
        { segment: '2/2', start: '1799.5s', duration: '60s', path: '/tmp/out/segments/segment_002.flac' }
      ]
    })

    expect(buildSttDiarizationConfigTable({
      provider: 'aws',
      model: 'standard',
      enabled: true,
      speakerCount: 3,
      maxSpeakers: 3
    }).rows).toEqual([
      { key: 'provider', value: 'aws' },
      { key: 'model', value: 'standard' },
      { key: 'enabled', value: true },
      { key: 'speakerCount', value: 3 },
      { key: 'maxSpeakers', value: 3 }
    ])

    expect(buildSttTranscriptOutputTable({
      provider: 'reverb',
      path: '/tmp/out/transcription.txt',
      characters: 1234,
      speakers: 2
    }).columns).toEqual(['key', 'value'])

    expect(buildSttCacheTable({
      artifact: 'source_media',
      status: 'hit',
      key: 'cache-key'
    })).toEqual({
      columns: ['key', 'value'],
      rows: [
        { key: 'artifact', value: 'source_media' },
        { key: 'status', value: 'hit' },
        { key: 'key', value: 'cache-key' }
      ]
    })

    const cleanupRendered = stripAnsi(renderHumanTable(buildSttCleanupArtifactsTable([
      { artifact: 'ctm', path: '/tmp/out/reverb-output/file.ctm' }
    ])))
    expect(cleanupRendered).toContain('\u2502 ctm \u2502 /tmp/out/reverb-output/file.ctm')
    expect(cleanupRendered).not.toContain('\u2502 artifact \u2502 path')

    expect(buildSttProviderSpeakerCountHintsTable([
      { provider: 'aws/standard', speakerCount: 2, support: 'honored' },
      { provider: 'reverb/reverb_asr_v1', speakerCount: 2, support: 'ignored' }
    ]).columns).toEqual(['provider', 'speakerCount', 'support'])
  })

  test('json sink routes warnings and errors to stderr and info to stdout', () => {
    const sink = createJsonSink()
    const captured = withColorEnv({ forceColor: '1' }, () => captureConsole(() => {
      sink({
        ...makeEvent('info'),
        humanTable: createHumanTable([{ status: 'failed', cost: '2.00000\u00a2' }], ['status', 'cost'])
      })
      sink(makeEvent('warn'))
      sink(makeEvent('error'))
    }))

    expect(captured.stdout).toHaveLength(1)
    expect(captured.stderr).toHaveLength(2)
    expect(hasAnsi(captured.stdout[0] as string)).toBe(false)
    expect(JSON.parse(captured.stdout[0] as string)).toMatchObject({
      level: 'info',
      runId: 'run-id',
      humanTable: { rows: [{ status: 'failed', cost: '2.00000\u00a2' }] }
    })
    expect(JSON.parse(captured.stderr[0] as string)).toMatchObject({ level: 'warn', runId: 'run-id' })
  })

  test('sanitizeLogText redacts known secret patterns', () => {
    const secret = 'secret-value-123'
    const sanitized = sanitizeLogText([
      `https://example.com/file.mp3?token=${secret}`,
      `authorization: bearer ${secret}`,
      `OPENAI_API_KEY=${secret}`
    ].join('\n'))

    expect(sanitized).not.toContain(secret)
    expect(sanitized).toContain('token=REDACTED')
    expect(sanitized).toContain('authorization: bearer REDACTED')
    expect(sanitized).toContain('OPENAI_API_KEY=REDACTED')
  })

  test('logger error metadata preserves custom fields and redacts nested causes', () => {
    const secret = 'secret-value-123'
    const events: LogSinkEvent[] = []
    const logger = createLogger({
      runId: 'run-id',
      sinks: [event => events.push(event)]
    })
    const cause = Object.assign(new Error('nested failure'), {
      body: `OPENAI_API_KEY=${secret}`
    })
    const error = Object.assign(new Error('provider failed'), {
      status: 503,
      stage: 'poll',
      headers: new Headers({ authorization: `Bearer ${secret}` }),
      cause
    })

    logger.error('Command failed', error)

    const metadataError = events[0]?.metadata?.['error'] as Record<string, unknown> | undefined
    const serialized = JSON.stringify(metadataError)
    expect(metadataError?.['status']).toBe(503)
    expect(metadataError?.['stage']).toBe('poll')
    expect(serialized).not.toContain(secret)
    expect(serialized).toContain('REDACTED')
    expect(metadataError?.['cause']).toBeDefined()
  })

  test('table builders produce stable completion output', () => {
    expect(buildResumeSummaryTable({ full: 3, incomplete: 1, failed: 0 }).rows).toEqual([{
      full: 3,
      incomplete: 1,
      failed: 0
    }])
    expect(buildSuitePriceSummaryRows({
      checkedLabel: 'commands',
      checkedCount: 3,
      totalEstimatedCost: 12.345678
    })).toEqual([{
      checked: '3 commands',
      totalEstimatedCost: '12.35\u00a2'
    }])
    expect(buildProviderReadinessTable({
      provider: 'supadata',
      capability: 'transcription',
      status: 'ready',
      envKey: 'SUPADATA_API_KEY',
      detail: 'https://api.supadata.ai/v1'
    })).toEqual({
      columns: ['provider', 'capability', 'status', 'envKey', 'detail'],
      rows: [{
        provider: 'supadata',
        capability: 'transcription',
        status: 'ready',
        envKey: 'SUPADATA_API_KEY',
        detail: 'https://api.supadata.ai/v1'
      }]
    })
  })

  test('ocr log table builders use key/value rows for single-record progress', () => {
    expect(buildOcrProviderLifecycleTable({
      provider: 'openai',
      model: 'gpt-5.4-nano',
      status: 'succeeded',
      elapsedMs: 1234
    })).toEqual({
      columns: ['key', 'value'],
      rows: [
        { key: 'provider', value: 'openai' },
        { key: 'model', value: 'gpt-5.4-nano' },
        { key: 'status', value: 'succeeded' },
        { key: 'elapsedMs', value: 1234 }
      ]
    })

    expect(buildOcrPagesProgressTable({
      status: 'running',
      ocrPages: 2,
      totalPages: 5,
      renderConcurrency: 4,
      ocrConcurrency: 2
    })).toEqual({
      columns: ['key', 'value'],
      rows: [
        { key: 'status', value: 'running' },
        { key: 'ocrPages', value: 2 },
        { key: 'totalPages', value: 5 },
        { key: 'renderConcurrency', value: 4 },
        { key: 'ocrConcurrency', value: 2 }
      ]
    })

    expect(buildOcrJobProgressTable({
      provider: 'aws-textract',
      action: 'poll',
      remoteId: 'job-123',
      state: 'in_progress',
      pages: 7,
      detail: 'attempt 10'
    })).toEqual({
      columns: ['key', 'value'],
      rows: [
        { key: 'provider', value: 'aws-textract' },
        { key: 'action', value: 'poll' },
        { key: 'remoteId', value: 'job-123' },
        { key: 'state', value: 'in_progress' },
        { key: 'pages', value: 7 },
        { key: 'detail', value: 'attempt 10' }
      ]
    })

    expect(buildOcrJobProgressTable({
      provider: 'aws-textract',
      action: 'launch',
      state: 'queued'
    }).rows).toEqual([
      { key: 'provider', value: 'aws-textract' },
      { key: 'action', value: 'launch' },
      { key: 'state', value: 'queued' }
    ])
  })

  test('ocr log table builders use key/value rows for single-operation details', () => {
    expect(buildOcrmypdfRunConfigTable({
      status: 'running',
      input: '/tmp/input.pdf',
      jobs: 2,
      languages: 'eng'
    })).toEqual({
      columns: ['key', 'value'],
      rows: [
        { key: 'status', value: 'running' },
        { key: 'input', value: '/tmp/input.pdf' },
        { key: 'jobs', value: 2 },
        { key: 'languages', value: 'eng' }
      ]
    })

    expect(buildPaddleOcrPrepareTable({
      status: 'downsampled',
      input: 'page-001.png',
      dimensions: { width: 2400, height: 3200 },
      maxSide: 1000
    })).toEqual({
      columns: ['key', 'value'],
      rows: [
        { key: 'status', value: 'downsampled' },
        { key: 'input', value: 'page-001.png' },
        { key: 'dimensions', value: '2400x3200' },
        { key: 'maxSide', value: 1000 }
      ]
    })

    expect(buildOcrTransferTable({
      action: 'upload',
      file: 'document.pdf',
      destination: 's3://bucket/document.pdf'
    })).toEqual({
      columns: ['key', 'value'],
      rows: [
        { key: 'action', value: 'upload' },
        { key: 'file', value: 'document.pdf' },
        { key: 'destination', value: 's3://bucket/document.pdf' }
      ]
    })
  })

  test('ocrmypdf output parser creates compact stream/page rows', () => {
    const event = parseOcrmypdfOutputLine('stderr', '\x1b[31mPage 3: deskew complete\x1b[0m')
    expect(event).toEqual({
      stream: 'stderr',
      page: 3,
      detail: 'deskew complete',
      rawLine: '\x1b[31mPage 3: deskew complete\x1b[0m'
    })

    if (!event) throw new Error('Expected OCRmyPDF output event')
    expect(buildOcrmypdfOutputTable(event)).toEqual({
      columns: ['key', 'value'],
      rows: [
        { key: 'stream', value: 'stderr' },
        { key: 'page', value: 3 },
        { key: 'detail', value: 'deskew complete' }
      ]
    })

    const noPage = parseOcrmypdfOutputLine('stdout', 'Scanning contents')
    if (!noPage) throw new Error('Expected OCRmyPDF output event')
    expect(buildOcrmypdfOutputTable(noPage)).toEqual({
      columns: ['key', 'value'],
      rows: [
        { key: 'stream', value: 'stdout' },
        { key: 'detail', value: 'Scanning contents' }
      ]
    })
  })

  test('reporter ignores estimate notes in human pricing output', () => {
    const { logger, writes } = createCapturingLogger()
    const reporter = createReporter(logger)

    reporter.estimate({
      totalEstimatedCost: 0,
      steps: [{
        step: 'tts',
        provider: 'kitten',
        model: 'kitten-tts-mini',
        totalCost: 0
      }],
      notes: [
        'TTS estimate omitted: step 4 only runs when write produces exactly one summary.',
        'Second aggregate estimate note.'
      ]
    })

    expect(writes.map(write => write.message)).toEqual([
      'Total estimated cost: free (0.000\u00a2)',
      'Cost Estimate'
    ])
    expect(writes[1]?.options?.humanTable).toBeDefined()
    expect(writes.some(write => write.message.includes('Cost estimate notes:'))).toBe(false)
  })

  test('reporter displays Reverb cost estimates with the ASR model id', () => {
    const { logger, writes } = createCapturingLogger()
    const reporter = createReporter(logger)

    reporter.estimate({
      totalEstimatedCost: 0,
      steps: [{
        step: 'stt',
        provider: 'reverb',
        model: 'reverb',
        durationSeconds: 0,
        totalCost: 0
      }]
    })

    expect(writes[1]?.options?.humanTable?.rows[0]).toMatchObject({
      provider: 'reverb',
      model: 'reverb_asr_v1'
    })
  })

  test('extract manifest summary includes OCR cost calculation diagnostics', () => {
    const metadata = {
      step2: {
        extractionMethod: 'pdf+openai-ocr',
        totalPages: 2,
        ocrPages: 2,
        textPages: 0,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 5000,
        ocrService: 'openai',
        ocrModel: 'gpt-5.4-nano',
        promptTokens: 6000,
        completionTokens: 1500
      },
      cost: {
        estimated: {
          totalCost: 0.58044,
          steps: [{
            step: 'extract',
            provider: 'openai',
            model: 'gpt-5.4-nano',
            cost: 0.58044,
            pageCount: 2,
            promptTokens: 5972,
            completionTokens: 3688,
            inputCostPer1MCents: 20,
            outputCostPer1MCents: 125,
            estimateType: 'heuristic'
          }]
        },
        actual: {
          totalCost: 0.3075,
          steps: [{
            step: 'extract',
            provider: 'openai',
            model: 'gpt-5.4-nano',
            cost: 0.3075,
            inputMetric: 'tokens',
            inputValue: 7500,
            promptTokens: 6000,
            completionTokens: 1500
          }]
        },
        ocrDiagnostics: [{
          provider: 'openai',
          model: 'gpt-5.4-nano',
          pages: 2,
          predictedCostInputs: {
            costCents: 0.58044,
            pageCount: 2,
            inputMetric: 'tokens',
            inputValue: 9660,
            promptTokens: 5972,
            completionTokens: 3688,
            estimateType: 'heuristic'
          },
          actualCostInputs: {
            costCents: 0.3075,
            pageCount: 2,
            inputMetric: 'tokens',
            inputValue: 7500,
            promptTokens: 6000,
            completionTokens: 1500
          },
          ratesUsed: {
            inputCostPer1MCents: 20,
            outputCostPer1MCents: 125
          },
          delta: {
            costCents: -0.27294,
            percent: -47.02294810833162
          }
        }]
      }
    }

    const summary = buildWriteManifestConsoleSummary(metadata)
    expect(summary.runSummary?.rows[0]).toMatchObject({
      step: 'Extract',
      providerModel: 'openai/gpt-5.4-nano',
      predictedCostCents: 0.58044,
      actualCostCents: 0.3075
    })
    expect(summary.promptUsage?.rows[0]).toMatchObject({
      step: 'Extract',
      providerModel: 'openai/gpt-5.4-nano',
      usage: '6000/1500 tok'
    })
    expect(summary.ocrCostCalculation?.rows[0]).toMatchObject({
      providerModel: 'openai/gpt-5.4-nano',
      pages: 2,
      predictedInputs: '5972/3688 tok',
      actualInputs: '6000/1500 tok',
      rates: '20\u00a2/1M in / 125\u00a2/1M out',
      predictedCostCents: 0.58044,
      actualCostCents: 0.3075,
      deltaCents: -0.27294
    })

    const { logger, writes } = createCapturingLogger()
    logExtractManifestConsoleSummary('/tmp/autoshow-run', metadata, {}, logger)
    expect(writes.map((write) => write.message)).toEqual([
      'Locations',
      'Run Summary',
      'Prompt Usage',
      'OCR Cost Calculation'
    ])
    expect(writes[0]?.options?.humanTable).toMatchObject({
      columns: ['artifact', 'path'],
      rows: [{ artifact: 'runManifest', path: '/tmp/autoshow-run/run.json' }]
    })
    expect(writes[3]?.options?.humanTable?.columns).toEqual([
      'providerModel',
      'pages',
      'predInputs',
      'actInputs',
      'rates',
      'predCost',
      'actCost',
      'delta'
    ])
  })

  test('STT manifest summary displays concise Reverb ASR model label', () => {
    const reverbDescriptor = '/Users/ajc/c/as/autoshow-cli/runtime/models/reverb/reverb_asr_v1/reverb_asr_v1.pt | /Users/ajc/c/as/autoshow-cli/runtime/models/reverb/reverb_asr_v1/config.yaml | diarization:v2'
    const metadata = {
      step2: {
        transcriptionService: 'reverb',
        transcriptionModel: reverbDescriptor,
        processingTime: 67000,
        tokenCount: 1234
      },
      cost: {
        estimated: {
          totalCost: 0,
          steps: [{
            step: 'stt',
            provider: 'reverb',
            model: 'reverb',
            cost: 0
          }]
        },
        actual: {
          totalCost: 0,
          steps: [{
            step: 'stt',
            provider: 'reverb',
            model: reverbDescriptor,
            cost: 0
          }]
        }
      }
    }

    const summary = buildWriteManifestConsoleSummary(metadata)
    expect(summary.runSummary?.rows[0]).toMatchObject({
      step: 'Transcribe',
      providerModel: 'reverb/reverb_asr_v1',
      predictedCostCents: 0,
      actualCostCents: 0
    })
    expect(summary.promptUsage?.rows[0]).toMatchObject({
      step: 'Transcribe',
      providerModel: 'reverb/reverb_asr_v1',
      usage: '1234 tok'
    })
  })

  test('reporter renders aggregate cost estimates as compact rows without note output', () => {
    const { logger, writes } = createCapturingLogger()
    const reporter = createReporter(logger)

    reporter.estimate({
      totalEstimatedCost: 201.255,
      steps: [
        {
          step: 'video',
          provider: 'gemini',
          model: 'veo-3.1-lite-generate-preview',
          totalCost: 200
        },
        {
          step: 'tts',
          provider: 'kitten',
          model: 'kitten-tts-mini',
          totalCost: 1.25,
          characterCount: 100,
          note: 'Provider credits may apply outside local estimates.'
        },
        {
          step: 'extract',
          provider: 'firecrawl',
          model: 'firecrawl',
          totalCost: 0.005,
          note: 'Provider credits may apply outside local estimates.'
        }
      ],
      notes: ['Aggregate caveat.']
    })

    const humanTable = writes[1]?.options?.humanTable
    expect(humanTable).toEqual({
      columns: ['step', 'provider', 'model', 'details', 'cost'],
      align: { cost: 'right' },
      rows: [
        { step: 'video', provider: 'gemini', model: 'veo-3.1-lite-generate-preview', cost: '$2.00' },
        { step: 'tts', provider: 'kitten', model: 'kitten-tts-mini', details: 'characters 100', cost: '1.25\u00a2' },
        { step: 'extract', provider: 'firecrawl', model: 'firecrawl', cost: '<0.01\u00a2' }
      ]
    })
    expect(writes[0]?.message).toBe('Total estimated cost: $2.01 (201.255\u00a2)')
    expect(writes.some(write => write.message.includes('Cost estimate notes:'))).toBe(false)

    if (!humanTable) throw new Error('Expected cost estimate human table')
    const rendered = stripAnsi(renderHumanTable(humanTable))
    expect(rendered).toContain('\u2502 video   \u2502 gemini')
    expect(rendered).toContain('\u2502  $2.00 \u2502')
    expect(rendered).toContain('\u2502 <0.01\u00a2 \u2502')
    expect(rendered).not.toContain('[1]')
    expect(rendered).not.toContain('\u2502 key')
  })

  test('audio normalize table uses vertical key/value display rows', () => {
    expect(buildAudioNormalizeTable({
      status: 'planned',
      inputPath: '/tmp/autoshow/source episode.m4a',
      outputPath: '/tmp/autoshow/source episode.normalized.mp3',
      plan: {
        profile: 'default',
        mode: 'transcode-mp3',
        outputExtension: '.mp3',
        outputFormat: 'mp3',
        outputCodecName: 'mp3',
        sourceCodecName: 'aac',
        reason: 'container or codec requires normalization',
        stripMetadata: true,
        stripChapters: true
      }
    })).toEqual({
      columns: ['key', 'value'],
      rows: [
        { key: 'status', value: 'planned' },
        { key: 'mode', value: 'transcode-mp3' },
        { key: 'codec', value: 'aac->mp3' },
        { key: 'input', value: 'source episode.m4a' },
        { key: 'output', value: 'source episode.normalized.mp3' },
        { key: 'detail', value: 'container or codec requires normalization' }
      ]
    })
  })
})
