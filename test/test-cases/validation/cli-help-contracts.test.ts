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
  expect(processingSection).not.toContain('    lyrics')
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
  expect(result.stdout).toContain('--ocr-provider-concurrency')
  expect(result.stdout).toContain('--ocr-local-concurrency')
})

test('write and config help expose LLM concurrency flags', async () => {
  const writeResult = await runCommand(['src/cli/create-cli.ts', 'write', '--help'], { env: helpEnv })
  const configResult = await runCommand(['src/cli/create-cli.ts', 'config', '--help'], { env: helpEnv })

  expect(writeResult.exitCode).toBe(0)
  expect(configResult.exitCode).toBe(0)
  expect(writeResult.stdout).toContain('--llm-provider-concurrency')
  expect(writeResult.stdout).toContain('--llm-local-concurrency')
  expect(configResult.stdout).toContain('--llm-provider-concurrency')
  expect(configResult.stdout).toContain('--llm-local-concurrency')
})

test('help for a removed command exits 2 with an unknown-command message', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'help', 'report'], { env: helpEnv })

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Usage error: Unknown command "report". Run: bun as help')
})

test('music help includes hosted generation and lyric-video flags', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'music', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--elevenlabs-music')
  expect(result.stdout).toContain('--minimax-music')
  expect(result.stdout).toContain('--music-duration')
  expect(result.stdout).toContain('--music-lyrics-file')
  expect(result.stdout).toContain('--price')
  expect(result.stdout).toContain('--audio')
  expect(result.stdout).toContain('--captions')
  expect(result.stdout).toContain('--batch')
  expect(result.stdout).toContain('--model')
  expect(result.stdout).toContain('--font')
  expect(result.stdout).toContain('--keep-tmp')
  expect(result.stdout).not.toContain('--openai')
  expect(result.stdout).not.toContain('--prompt')
  expect(result.stdout).not.toContain('--prompt-file')
  expect(result.stdout).not.toContain('--track-list')
})
