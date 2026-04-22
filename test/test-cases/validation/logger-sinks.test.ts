import { expect, test } from 'bun:test'
import { createBatchItemTable, createHumanTable } from '~/logger/human-table'
import { createHumanSink } from '~/logger/sinks/human-sink'
import { createJsonSink } from '~/logger/sinks/json-sink'
import type { LogSinkEvent } from '~/logger/types'

const ANSI_ESCAPE_PATTERN = /\x1b\[[0-9;]*m/

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
  const sink = createHumanSink({ interactive: true })
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
    sink({
      timestamp: '2026-04-13T02:05:09.186Z',
      level: 'info',
      message: 'Batch Item',
      category: 'pipeline',
      runId: 'run-id',
      context: {
        itemIndex: 2,
        itemCount: 5
      },
      indent: true,
      args: [],
      humanTable: createBatchItemTable([
        { status: 'processing', input: 'input/example.mp3' }
      ])
    } satisfies LogSinkEvent)
  } finally {
    console.log = originalLog
    console.error = originalError
  }

  expect(stdoutLines).toHaveLength(1)
  expect(stderrLines).toHaveLength(0)
  expect(stdoutLines[0]).toContain('[2/5]')
  expect(stdoutLines[0]).toContain('Batch Item')
  expect(stdoutLines[0]).toContain('processing')
  expect(stdoutLines[0]).toContain('input/example.mp3')
  expect(stdoutLines[0]).not.toMatch(ANSI_ESCAPE_PATTERN)
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
  expect(infoPayload['humanTable']).toEqual(undefined)
})

test('human sink appends Bun table output for humanTable events', () => {
  const sink = createHumanSink({ interactive: true })
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
    sink({
      ...makeEvent('info'),
      message: 'Artifacts',
      humanTable: createHumanTable([
        { artifact: 'run', path: 'output/run/run.json' }
      ], ['artifact', 'path'])
    })
  } finally {
    console.log = originalLog
    console.error = originalError
  }

  expect(stdoutLines).toHaveLength(1)
  expect(stderrLines).toHaveLength(0)
  expect(stdoutLines[0]).toContain('Artifacts')
  expect(stdoutLines[0]).toContain('artifact')
  expect(stdoutLines[0]).toContain('output/run/run.json')
  expect(stdoutLines[0]).toContain('┌')
  expect(stdoutLines[0]).not.toMatch(ANSI_ESCAPE_PATTERN)
})

test('human sink keeps non-error logs on stderr for non-interactive runs', () => {
  const sink = createHumanSink({ interactive: false })
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
  } finally {
    console.log = originalLog
    console.error = originalError
  }

  expect(stdoutLines).toHaveLength(0)
  expect(stderrLines).toHaveLength(1)
  expect(stderrLines[0]).toContain('message')
})

test('json sink preserves humanTable payloads', () => {
  const sink = createJsonSink()
  const stdoutLines: string[] = []
  const originalLog = console.log

  console.log = (...args: unknown[]) => {
    stdoutLines.push(String(args[0] ?? ''))
  }

  try {
    sink({
      ...makeEvent('info'),
      message: 'Locations',
      humanTable: createHumanTable([
        { artifact: 'outputDir', path: 'output/run' }
      ], ['artifact', 'path'])
    })
  } finally {
    console.log = originalLog
  }

  expect(stdoutLines).toHaveLength(1)
  expect(JSON.parse(stdoutLines[0] as string)).toMatchObject({
    message: 'Locations',
    humanTable: {
      rows: [{ artifact: 'outputDir', path: 'output/run' }],
      columns: ['artifact', 'path']
    }
  })
})
