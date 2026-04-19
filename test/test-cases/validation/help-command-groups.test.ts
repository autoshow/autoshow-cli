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

test('root help groups report under setup and utilities', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', '--help'], {
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(0)

  const setupSection = getSection(result.stdout, '  Setup & Utilities\n', '  Processing & Generation\n')
  const processingSection = getSection(result.stdout, '  Processing & Generation\n')
  const reportMatches = result.stdout.match(/^\s+report\s+/gm) ?? []

  expect(setupSection).toContain('    report')
  expect(processingSection).not.toContain('    report')
  expect(reportMatches).toHaveLength(1)
})
