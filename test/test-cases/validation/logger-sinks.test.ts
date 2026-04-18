import { expect, test } from 'bun:test'
import { createHumanSink } from '~/logger/sinks/human-sink'
import { createJsonSink } from '~/logger/sinks/json-sink'
import type { LogSinkEvent } from '~/logger/types'

const makeEvent = (level: LogSinkEvent['level']): LogSinkEvent => ({
  timestamp: '2026-01-01T00:00:00.000Z',
  level,
  message: 'message',
  category: 'general',
  runId: 'run-id',
  context: { command: 'write', step: 'step-2-stt' },
  metadata: { key: 'value' },
  indent: true,
  args: []
})

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

test('json sink writes warn/error to stderr and others to stdout', () => {
  const sink = createJsonSink()

  const stdoutLines: string[] = []
  const stderrLines: string[] = []

  const originalLog = console.log
  const originalError = console.error

  console.log = (...args: unknown[]) => {
    stdoutLines.push(String(args[0] ?? ''))
  }

  console.error = (...args: unknown[]) => {
    stderrLines.push(String(args[0] ?? ''))
  }

  try {
    sink(makeEvent('info'))
    sink(makeEvent('warn'))
    sink(makeEvent('error'))
  } finally {
    console.log = originalLog
    console.error = originalError
  }

  expect(stdoutLines).toHaveLength(1)
  expect(stderrLines).toHaveLength(2)

  const infoPayload = JSON.parse(stdoutLines[0] as string) as Record<string, unknown>
  const warnPayload = JSON.parse(stderrLines[0] as string) as Record<string, unknown>

  expect(infoPayload['level']).toBe('info')
  expect(warnPayload['level']).toBe('warn')
  expect(infoPayload['runId']).toBe('run-id')
})
