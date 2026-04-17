import { describe, expect, test } from 'bun:test'
import { createLogger } from '~/logger/core'
import { buildCompleteResultData, buildHumanCompletionMessages, createReporter } from '~/logger/reporter'
import type { LogSinkEvent } from '~/logger/types'

describe('reporter completion output', () => {
  test('builds compact human completion lines for non-verbose output', () => {
    const lines = buildHumanCompletionMessages('output/run', {
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

    expect(lines).toEqual([
      'Artifacts: prompt=output/run/prompt.md, run=output/run/run.json, audio=output/run/audio.mp3',
      'Providers: dir=output/run/providers, transcripts=1, results=1',
      'Metrics: providersRequested=4, providersSucceeded=4, providersFailed=0, partial=false, promptSource=elevenlabs/scribe_v2',
      'Step: Download, time=12.9s, cost=0.00000¢',
      'Step: Transcribe elevenlabs/scribe_v2, time=1m 27s, cost=17.01944¢',
      'Total: time=1m 48s, cost=92.21444¢'
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

  test('keeps detailed completion payloads when verbose logging is active', () => {
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

    expect(events.map((event) => event.message)).toContain(
      '{\n  "artifacts": {\n    "run": "output/run/run.json"\n  },\n  "metrics": {\n    "providersRequested": 4\n  }\n}'
    )
  })
})
