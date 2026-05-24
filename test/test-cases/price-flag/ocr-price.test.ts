import { expect, test } from 'bun:test'
import { runCommand } from '../../test-utils/test-helpers'

const articleUrl = 'https://ajcwebdev.com'

test('bun as extract https://ajcwebdev.com --url-provider firecrawl --price', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', articleUrl, '--url-provider', 'firecrawl', '--price'],
    { testName: 'bun as extract https://ajcwebdev.com --url-provider firecrawl --price' }
  )

  expect(result.exitCode).toBe(0)
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('firecrawl')
  expect(output).not.toContain('Firecrawl credits apply; exact cost is not estimated locally.')
})

test('bun as extract https://ajcwebdev.com --url-provider glm-reader --price', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', articleUrl, '--url-provider', 'glm-reader', '--price'],
    { testName: 'bun as extract https://ajcwebdev.com --url-provider glm-reader --price' }
  )

  expect(result.exitCode).toBe(0)
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Total estimated cost: 1.00¢ (1.000¢)')
  expect(output).toContain('glm-reader')
  expect(output).toContain('extraction.txt')
  expect(output).toContain('run.json')
})

test('bun as extract document --provider unstructured=hi_res_and_enrichment --price', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'unstructured=hi_res_and_enrichment', '--price'],
    { testName: 'bun as extract document --provider unstructured=hi_res_and_enrichment --price' }
  )

  expect(result.exitCode).toBe(0)
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Total estimated cost: 3.00¢ (3.000¢)')
  expect(output).toContain('unstructured')
  expect(output).toContain('hi_res_and_enrichment')
  expect(output).not.toContain('Total estimated cost: free')
})
