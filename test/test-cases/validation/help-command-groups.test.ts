import { expect, test } from 'bun:test'
import { runCommand } from '../../test-utils/test-helpers'

const getSection = (output: string, heading: string, nextHeading?: string): string => {
  const start = output.indexOf(heading)
  expect(start).toBeGreaterThanOrEqual(0)

  const sectionStart = start + heading.length
  const end = nextHeading ? output.indexOf(nextHeading, sectionStart) : output.length
  expect(end).toBeGreaterThan(sectionStart)

  return output.slice(sectionStart, end)
}

test('root help groups keep setup utilities separate from processing commands', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', '--help'], {
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(0)

  const setupSection = getSection(result.stdout, '  Setup & Utilities\n', '  Processing & Generation\n')
  const processingSection = getSection(result.stdout, '  Processing & Generation\n')
  const linksMatches = result.stdout.match(/^\s+links\s+/gm) ?? []
  const sampleMatches = result.stdout.match(/^\s+sample\s+/gm) ?? []
  const modelsMatches = result.stdout.match(/^\s+models\s+/gm) ?? []

  expect(setupSection).toContain('    links')
  expect(setupSection).toContain('    setup')
  expect(setupSection).not.toContain('    sample')
  expect(setupSection).not.toContain('    models')
  expect(processingSection).not.toContain('    links')
  expect(linksMatches).toHaveLength(1)
  expect(sampleMatches).toHaveLength(0)
  expect(modelsMatches).toHaveLength(0)
})

test('removed report command is rejected by help', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'help', 'report'], {
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Usage error: Unknown command "report". Run: bun as help')
})
