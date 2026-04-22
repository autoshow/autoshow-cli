import { describe, expect, test } from 'bun:test'
import { createLogger } from '~/logger/core'
import { runWithLogContext } from '~/logger/context-store'
import { buildCompleteResultData, buildHumanCompletionTables, createReporter } from '~/logger/reporter'
import type { LogSinkEvent } from '~/logger/types'

const ANSI_ESCAPE_PATTERN = /\x1b\[[0-9;]*m/

const collectEvents = (): { events: LogSinkEvent[], sink: (event: LogSinkEvent) => void } => {
  const events: LogSinkEvent[] = []
  return {
    events,
    sink: (event) => {
      events.push(event)
    }
  }
}

const createCollector = (): { events: LogSinkEvent[], logger: ReturnType<typeof createLogger> } => {
  const events: LogSinkEvent[] = []
  const logger = createLogger({
    minLevel: 'debug',
    sinks: [event => {
      events.push(event)
    }]
  })
  return { events, logger }
}

describe('logger core levels', () => {
  test('logger minLevel=warn emits warn/error only', () => {
    const { events, sink } = collectEvents()
    const logger = createLogger({ minLevel: 'warn', sinks: [sink] })

    logger.debug('debug')
    logger.info('info')
    logger.success('success')
    logger.warn('warn')
    logger.error('error')

    expect(events.map(event => event.level)).toEqual(['warn', 'error'])
  })

  test('logger minLevel=debug emits all levels', () => {
    const { events, sink } = collectEvents()
    const logger = createLogger({ minLevel: 'debug', sinks: [sink] })

    logger.debug('debug')
    logger.info('info')
    logger.success('success')
    logger.warn('warn')
    logger.error('error')

    expect(events.map(event => event.level)).toEqual(['debug', 'info', 'success', 'warn', 'error'])
  })
})

describe('logger context', () => {
  test('runWithLogContext attaches context to events', async () => {
    const { events, logger } = createCollector()

    await runWithLogContext({ command: 'write', step: 'step-2-stt', requestId: 'req-1' }, async () => {
      logger.info('event')
    })

    const first = events[0]
    expect(first?.command).toBe('write')
    expect(first?.step).toBe('step-2-stt')
    expect(first?.context?.['requestId']).toBe('req-1')
  })

  test('nested runWithLogContext merges parent and child fields', async () => {
    const { events, logger } = createCollector()

    await runWithLogContext({ command: 'write', batchId: 'batch-1' }, async () => {
      await runWithLogContext({ itemIndex: 2 }, async () => {
        logger.info('event')
      })
    })

    const first = events[0]
    expect(first?.context?.['batchId']).toBe('batch-1')
    expect(first?.context?.['itemIndex']).toBe(2)
  })

  test('runWithLogContext isolates concurrent async branches', async () => {
    const { events, logger } = createCollector()

    await Promise.all([
      runWithLogContext({ batchId: 'A' }, async () => {
        await Bun.sleep(20)
        logger.info('a')
      }),
      runWithLogContext({ batchId: 'B' }, async () => {
        logger.info('b')
      })
    ])

    const batchIds = events
      .map(event => event.context?.['batchId'])
      .filter((id): id is string => typeof id === 'string')
      .sort()

    expect(batchIds).toEqual(['A', 'B'])
  })
})

describe('logger sink failures', () => {
  test('emits a plain-text fallback once when a sink throws', () => {
    const logger = createLogger({
      minLevel: 'debug',
      sinks: [() => {
        throw new Error('sink exploded')
      }]
    })
    const stderrLines: string[] = []
    const originalError = console.error

    console.error = (...args: unknown[]) => {
      stderrLines.push(String(args[0] ?? ''))
    }

    try {
      logger.info('first event')
      logger.info('second event')
    } finally {
      console.error = originalError
    }

    expect(stderrLines).toHaveLength(1)
    expect(stderrLines[0]).toMatch(/^\[[^\]]+\] ✖   Logger sink failure: sink exploded$/)
    expect(stderrLines[0]).not.toMatch(ANSI_ESCAPE_PATTERN)
  })
})

describe('reporter completion output', () => {
  test('builds human completion tables for artifacts, providers, metrics, and timing', () => {
    const tables = buildHumanCompletionTables('output/run', {
      prompt: 'prompt.md',
      run: 'run.json',
      audio: 'audio.mp3',
      'transcript-elevenlabs-scribe_v2': 'providers/elevenlabs-scribe_v2/transcription.txt',
      'result-elevenlabs-scribe_v2': 'providers/elevenlabs-scribe_v2/result.json'
    }, {
      metrics: {
        providersRequested: 4,
        providersSucceeded: 4,
        providersFailed: 0,
        partial: false,
        promptSource: 'elevenlabs/scribe_v2'
      },
      steps: [
        { label: 'Download', processingTime: 12_900, cost: 0 },
        { label: 'Transcribe', providerModel: 'elevenlabs/scribe_v2', processingTime: 87_000, cost: 17.01944 }
      ],
      totalTimeMs: 108_000,
      totalCost: 92.21444
    })

    expect(tables.artifacts?.rows).toEqual([
      { artifact: 'audio', path: 'output/run/audio.mp3' },
      { artifact: 'prompt', path: 'output/run/prompt.md' },
      { artifact: 'run', path: 'output/run/run.json' }
    ])
    expect(tables.providers?.rows).toEqual([
      { dir: 'output/run/providers', transcripts: 1, results: 1 }
    ])
    expect(tables.metrics?.rows).toEqual([
      { metric: 'providersRequested', value: 4 },
      { metric: 'providersSucceeded', value: 4 },
      { metric: 'providersFailed', value: 0 },
      { metric: 'partial', value: false },
      { metric: 'promptSource', value: 'elevenlabs/scribe_v2' }
    ])
    expect(tables.timing?.rows).toEqual([
      { step: 'Download', providerModel: '', time: '12.9s', cost: '0.00000¢' },
      { step: 'Transcribe', providerModel: 'elevenlabs/scribe_v2', time: '1m 27s', cost: '17.01944¢' },
      { step: 'Total', providerModel: '', time: '1m 48s', cost: '92.21444¢' }
    ])
  })

  test('preserves numeric metrics in emitted completion result data', () => {
    const result = buildCompleteResultData('output/run', {
      run: 'run.json'
    }, {
      metrics: {
        providersRequested: 4,
        providersSucceeded: 3,
        providersFailed: 1,
        partial: false
      }
    })

    expect(result['metrics']).toEqual({
      providersRequested: 4,
      providersSucceeded: 3,
      providersFailed: 1,
      partial: false
    })
    expect(typeof (result['metrics'] as Record<string, unknown>)['providersRequested']).toBe('number')
  })

  test('includes lyrics artifacts in the artifacts table', () => {
    const tables = buildHumanCompletionTables('output/run', {
      run: 'run.json',
      video: 'song.mp4',
      vtt: 'song.vtt',
      srt: 'song.srt'
    })

    expect(tables.artifacts?.rows).toEqual([
      { artifact: 'run', path: 'output/run/run.json' },
      { artifact: 'srt', path: 'output/run/song.srt' },
      { artifact: 'video', path: 'output/run/song.mp4' },
      { artifact: 'vtt', path: 'output/run/song.vtt' }
    ])
  })

  test('emits human tables instead of JSON blobs when verbose logging is active', () => {
    const events: LogSinkEvent[] = []
    const logger = createLogger({
      minLevel: 'debug',
      sinks: [event => {
        events.push(event)
      }]
    })
    const reporter = createReporter(logger)

    reporter.complete('output/run', {
      run: 'run.json'
    }, {
      metrics: {
        providersRequested: 4
      }
    })

    expect(events.map((event) => event.message)).toEqual([
      'Locations',
      'Complete!',
      'Artifacts',
      'Metrics'
    ])
    expect(events[0]?.humanTable?.rows).toEqual([
      { artifact: 'outputDir', path: 'output/run' }
    ])
    expect(events[2]?.humanTable?.rows).toEqual([
      { artifact: 'run', path: 'output/run/run.json' }
    ])
    expect(events[3]?.humanTable?.rows).toEqual([
      { metric: 'providersRequested', value: 4 }
    ])
  })

  test('can hide selected human completion tables and override the success message', () => {
    const events: LogSinkEvent[] = []
    const logger = createLogger({
      minLevel: 'debug',
      sinks: [event => {
        events.push(event)
      }]
    })
    const reporter = createReporter(logger)

    reporter.complete('output/run', {
      audio: 'audio.mp3',
      result: 'result.json',
      run: 'run.json',
      transcript: 'transcription.txt'
    }, {
      steps: [
        { label: 'Download', processingTime: 30, cost: 0 },
        { label: 'Transcribe', providerModel: 'whisper.cpp/tiny', processingTime: 8_900, cost: 0 }
      ],
      totalTimeMs: 9_000,
      totalCost: 0,
      summaryMessage: 'Complete! whisper.cpp/tiny',
      hideHumanSections: ['artifacts', 'timing']
    })

    expect(events.map((event) => event.message)).toEqual([
      'Locations',
      'Complete! whisper.cpp/tiny'
    ])
    expect(events[0]?.humanTable?.rows).toEqual([
      { artifact: 'outputDir', path: 'output/run' }
    ])
  })
})
