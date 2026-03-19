import { test, expect } from 'bun:test'
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
