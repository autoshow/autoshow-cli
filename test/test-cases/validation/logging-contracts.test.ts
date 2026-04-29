import { describe, expect, test } from 'bun:test'
import { buildAudioNormalizeTable } from '~/cli/commands/process-steps/step-1-download/audio/audio-logging'
import { buildResumeSummaryTable } from '~/cli/commands/process-steps/resume/resume-logging'
import { buildSuitePriceSummaryRows } from '~/cli/commands/process-steps/suite-price-logging'
import { createReporter } from '~/utils/logger/reporter'
import { createHumanTable, createKeyValueTable, renderHumanTable } from '~/utils/logger/human-table'
import { sanitizeLogText } from '~/utils/logger/redaction'
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

  test('reporter prints estimate notes after the human cost table', () => {
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
      'Total estimated cost: 0.00000\u00a2',
      'Cost Estimate',
      'TTS estimate omitted: step 4 only runs when write produces exactly one summary.',
      'Second aggregate estimate note.'
    ])
    expect(writes[1]?.options?.humanTable).toBeDefined()
    expect(writes[2]?.options?.humanTable).toBeUndefined()
    expect(writes[3]?.options?.humanTable).toBeUndefined()
  })

  test('reporter renders aggregate cost estimates as key/value rows', () => {
    const { logger, writes } = createCapturingLogger()
    const reporter = createReporter(logger)

    reporter.estimate({
      totalEstimatedCost: 21.25,
      steps: [
        {
          step: 'video',
          provider: 'gemini',
          model: 'veo-3.1-lite-generate-preview',
          totalCost: 20
        },
        {
          step: 'tts',
          provider: 'kitten',
          model: 'kitten-tts-mini',
          totalCost: 1.25
        }
      ]
    })

    const humanTable = writes[1]?.options?.humanTable
    expect(humanTable).toEqual({
      columns: ['key', 'value'],
      rows: [
        { key: 'step', value: 'video' },
        { key: 'provider', value: 'gemini' },
        { key: 'model', value: 'veo-3.1-lite-generate-preview' },
        { key: 'cost', value: '20.00000\u00a2' },
        { key: 'step', value: 'tts' },
        { key: 'provider', value: 'kitten' },
        { key: 'model', value: 'kitten-tts-mini' },
        { key: 'cost', value: '1.25000\u00a2' }
      ]
    })

    if (!humanTable) throw new Error('Expected cost estimate human table')
    const rendered = stripAnsi(renderHumanTable(humanTable))
    expect(rendered).toContain('\u2502 step     \u2502 video')
    expect(rendered).toContain('\u2502 provider \u2502 gemini')
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
