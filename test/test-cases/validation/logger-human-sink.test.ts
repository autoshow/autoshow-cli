import { expect, test } from 'bun:test'
import { createHumanSink } from '~/logger/sinks/human-sink'
import type { LogSinkEvent } from '~/logger/types'

test('human sink prefixes batch item context for concurrent batch logs', () => {
  const sink = createHumanSink()
  const stderrLines: string[] = []
  const originalError = console.error

  console.error = (...args: unknown[]) => {
    stderrLines.push(String(args[0] ?? ''))
  }

  try {
    sink({
      timestamp: '2026-04-13T02:05:09.186Z',
      level: 'info',
      message: 'Processing 2/5: input/example.mp3',
      category: 'general',
      runId: 'run-id',
      context: {
        itemIndex: 2,
        itemCount: 5
      },
      indent: true,
      args: []
    } satisfies LogSinkEvent)
  } finally {
    console.error = originalError
  }

  expect(stderrLines).toHaveLength(1)
  expect(stderrLines[0]).toContain('[2/5]')
  expect(stderrLines[0]).toContain('Processing 2/5: input/example.mp3')
})
