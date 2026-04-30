import { expect, test } from 'bun:test'
import { runCommand } from '../../test-utils/test-helpers'

const articleUrl = 'https://ajcwebdev.com'

test('bun as extract https://ajcwebdev.com --url-backend firecrawl --price', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', articleUrl, '--url-backend', 'firecrawl', '--price'],
    { testName: 'bun as extract https://ajcwebdev.com --url-backend firecrawl --price' }
  )

  expect(result.exitCode).toBe(0)
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('firecrawl')
  expect(output).not.toContain('Firecrawl credits apply; exact cost is not estimated locally.')
})

test('bun as extract https://ajcwebdev.com --url-backend glm-reader --price', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', articleUrl, '--url-backend', 'glm-reader', '--price'],
    { testName: 'bun as extract https://ajcwebdev.com --url-backend glm-reader --price' }
  )

  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Total estimated cost: 0.00000¢')
  expect(`${result.stdout}\n${result.stderr}`).toContain('extraction.txt')
  expect(`${result.stdout}\n${result.stderr}`).toContain('run.json')
})
