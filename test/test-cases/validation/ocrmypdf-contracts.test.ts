import { describe, expect, test } from 'bun:test'
import {
  buildOcrmypdfArgs,
  resolveOcrmypdfJobs
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/ocrmypdf/run-ocrmypdf'
import { exec } from '~/utils/cli-utils'

const getArgValue = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

describe('OCRmyPDF contracts', () => {
  test('job resolution uses page count for 1-page PDFs', () => {
    expect(resolveOcrmypdfJobs({ pageCount: 1, cpuCount: 16 })).toBe(1)

    const args = buildOcrmypdfArgs('/tmp/input.pdf', '/tmp/sidecar.txt', {}, {
      pageCount: 1,
      cpuCount: 16
    })

    expect(getArgValue(args, '--jobs')).toBe('1')
  })

  test('job resolution caps multi-page PDFs instead of defaulting to all CPUs', () => {
    expect(resolveOcrmypdfJobs({ pageCount: 25, cpuCount: 16 })).toBe(2)
    expect(resolveOcrmypdfJobs({ pageCount: 25, requestedConcurrency: 4, cpuCount: 16 })).toBe(4)
    expect(resolveOcrmypdfJobs({ pageCount: 2, requestedConcurrency: 4, cpuCount: 16 })).toBe(2)
  })

  test('sidecar extraction args keep force mode and disable output optimization', () => {
    const args = buildOcrmypdfArgs('/tmp/input.pdf', '/tmp/sidecar.txt', { languages: 'eng' }, {
      pageCount: 4,
      cpuCount: 12
    })

    expect(getArgValue(args, '--sidecar')).toBe('/tmp/sidecar.txt')
    expect(getArgValue(args, '--mode')).toBe('force')
    expect(getArgValue(args, '--output-type')).toBe('none')
    expect(getArgValue(args, '--optimize')).toBe('0')
    expect(getArgValue(args, '--jobs')).toBe('2')
    expect(args.slice(-2)).toEqual(['/tmp/input.pdf', '-'])
  })

  test('exec heartbeat reports progress without timing out the subprocess', async () => {
    const heartbeatMessages: string[] = []
    const result = await exec(process.execPath, ['--eval', 'await Bun.sleep(80); console.log("done")'], {
      progressLabel: 'heartbeat-test',
      heartbeatMs: 10,
      onHeartbeat: (_elapsedMs, message) => {
        heartbeatMessages.push(message)
      }
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('done')
    expect(heartbeatMessages.some((message) => message.startsWith('heartbeat-test still running after '))).toBe(true)
  })
})
