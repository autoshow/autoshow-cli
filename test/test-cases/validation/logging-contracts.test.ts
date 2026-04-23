import { describe, expect, test } from 'bun:test'
import { buildResumeSummaryTable } from '~/cli/commands/process-steps/resume/resume-logging'
import { buildSuitePriceSummaryRows } from '~/cli/commands/process-steps/suite-price-logging'
import { createHumanTable } from '~/logger/human-table'
import { sanitizeLogText } from '~/logger/redaction'
import { createHumanSink } from '~/logger/sinks/human-sink'
import { createJsonSink } from '~/logger/sinks/json-sink'
import type { LogSinkEvent } from '~/logger/types'

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

describe('logging contracts', () => {
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
    expect(captured.stdout[0]).toContain('output/run/run.json')
  })

  test('json sink routes warnings and errors to stderr and info to stdout', () => {
    const sink = createJsonSink()
    const captured = captureConsole(() => {
      sink(makeEvent('info'))
      sink(makeEvent('warn'))
      sink(makeEvent('error'))
    })

    expect(captured.stdout).toHaveLength(1)
    expect(captured.stderr).toHaveLength(2)
    expect(JSON.parse(captured.stdout[0] as string)).toMatchObject({ level: 'info', runId: 'run-id' })
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
      totalEstimatedCost: '12.34568\u00a2'
    }])
  })
})
