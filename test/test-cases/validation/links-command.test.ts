import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  LINKS_OUTPUT_PATH,
  collectLinks,
  parseLinksArgv,
  runLinksWithArgv
} from '~/cli/commands/setup-and-utilities/links/define-links-command'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

test('links parser keeps provider selections and global sections', () => {
  const parsed = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    'tts',
    '--openai',
    'general',
    'text',
    '--minimax',
    'video'
  ])

  expect(parsed.serviceSelections.get('openai')).toEqual(['general', 'text'])
  expect(parsed.serviceSelections.get('minimax')).toEqual(['video'])
  expect(parsed.globalSections).toEqual(['tts'])
})

test('links collector treats a bare provider selection as all sections for that provider', () => {
  const parsed = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--openai'
  ])
  const openAiLinks = collectLinks(parsed.serviceSelections, parsed.globalSections)

  expect(openAiLinks.length).toBeGreaterThan(10)
  expect(openAiLinks).toContain('https://developers.openai.com/api/docs/pricing.md')
  expect(openAiLinks).toContain('https://developers.openai.com/api/docs/guides/video-generation.md')
})

test('links collector includes Speechmatics general and STT links', () => {
  const parsed = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--speechmatics'
  ])
  const speechmaticsLinks = collectLinks(parsed.serviceSelections, parsed.globalSections)

  expect(speechmaticsLinks).toHaveLength(16)
  expect(speechmaticsLinks).toContain('https://docs.speechmatics.com/get-started/authentication.md')
  expect(speechmaticsLinks).toContain('https://docs.speechmatics.com/api-ref/batch/get-usage-statistics.md')
})

test('links collector includes Rev general and STT links', () => {
  const parsed = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--rev'
  ])
  const revLinks = collectLinks(parsed.serviceSelections, parsed.globalSections)

  expect(revLinks).toHaveLength(13)
  expect(revLinks).toContain('https://docs.rev.ai/get-started.md')
  expect(revLinks).toContain('https://docs.rev.ai/api/asynchronous/reference.md')
  expect(revLinks).toContain('https://docs.rev.ai/faq.md')
})

test('links command writes combined fetched markdown to a single file', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-links-'))
  tempDirs.push(tempDir)

  const outputPath = join(tempDir, 'combined-links.md')
  const result = await runLinksWithArgv(
    [
      'bun',
      'src/cli/create-cli.ts',
      'links',
      '--openai',
      'general'
    ],
    {
      outputPath,
      fetchImpl: async (input) => {
        const url = typeof input === 'string' ? input : input.toString()
        return new Response(`# Mocked\n\nFetched from ${url}`)
      }
    }
  )

  const content = await Bun.file(outputPath).text()

  expect(result.outputPath).toBe(outputPath)
  expect(result.urlCount).toBe(5)
  expect(content).toContain('<!-- Source: https://developers.openai.com/api/docs/pricing.md -->')
  expect(content).toContain('Fetched from https://developers.openai.com/api/docs/guides/latest-model.md')
  expect(content).not.toContain(String(LINKS_OUTPUT_PATH))
})

test('links command rejects unknown sections', async () => {
  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--openai',
    'music'
  ])).rejects.toThrow('Unknown links section(s) for --openai: music')
})
