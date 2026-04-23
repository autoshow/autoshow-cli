import { expect, test } from 'bun:test'
import { runCommand } from '../../test-utils/test-helpers'

const helpEnv = { NO_COLOR: '1' }

const getSection = (output: string, heading: string, nextHeading?: string): string => {
  const start = output.indexOf(heading)
  expect(start).toBeGreaterThanOrEqual(0)

  const sectionStart = start + heading.length
  const end = nextHeading ? output.indexOf(nextHeading, sectionStart) : output.length
  expect(end).toBeGreaterThan(sectionStart)

  return output.slice(sectionStart, end)
}

test('root help groups setup utilities separately from processing commands', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)

  const setupSection = getSection(result.stdout, '  Setup & Utilities\n', '  Processing & Generation\n')
  const processingSection = getSection(result.stdout, '  Processing & Generation\n')

  expect(setupSection).toContain('    links')
  expect(setupSection).toContain('    setup')
  expect(processingSection).toContain('    resume')
  expect(processingSection).toContain('    write')
  expect(processingSection).not.toContain('    links')
})

test('extract help exposes shared batch and all-provider flags', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'extract', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--batch-limit')
  expect(result.stdout).toContain('--batch-all')
  expect(result.stdout).toContain('--batch-concurrency')
  expect(result.stdout).toContain('--all-stt')
  expect(result.stdout).toContain('--all-ocr')
})

test('help for a removed command exits 2 with an unknown-command message', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'help', 'report'], { env: helpEnv })

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Usage error: Unknown command "report". Run: bun as help')
})
