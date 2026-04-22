import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  LINKS_OUTPUT_DIR,
  collectLinks,
  getDefaultLinksOutputFileName,
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

test('links parser rejects dashed global section selectors', () => {
  expect(() => parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--stt',
    'tts'
  ])).toThrow('Unknown links selector "--stt". Known providers:')
})

test('links parser accepts bare global section selectors', () => {
  const parsed = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    'stt',
    'tts'
  ])

  expect(parsed.serviceSelections.size).toBe(0)
  expect(parsed.globalSections).toEqual(['stt', 'tts'])
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

test('links collector treats a bare global section selector consistently', () => {
  const parsed = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    'stt'
  ])

  expect(collectLinks(parsed.serviceSelections, parsed.globalSections)).toContain(
    'https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded.md'
  )
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

test('links collector includes Resend general links', () => {
  const parsed = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--resend'
  ])
  const resendLinks = collectLinks(parsed.serviceSelections, parsed.globalSections)

  expect(resendLinks).toHaveLength(20)
  expect(resendLinks).toContain('https://resend.com/docs/cli.md')
  expect(resendLinks).toContain('https://resend.com/docs/dashboard/emails/batch-sending.md')
  expect(resendLinks).toContain('https://resend.com/docs/dashboard/receiving/introduction.md')
  expect(resendLinks).toContain('https://resend.com/docs/dashboard/api-keys/introduction.md')
})

test('links collector includes Resend docs in the global general selection', () => {
  const parsed = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    'general'
  ])

  expect(collectLinks(parsed.serviceSelections, parsed.globalSections)).toContain('https://resend.com/docs/cli.md')
})

test('links collector includes Gladia general and STT links', () => {
  const parsed = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--gladia'
  ])
  const gladiaLinks = collectLinks(parsed.serviceSelections, parsed.globalSections)

  expect(gladiaLinks).toHaveLength(14)
  expect(gladiaLinks).toContain('https://docs.gladia.io/api-reference/authentication.md')
  expect(gladiaLinks).toContain('https://docs.gladia.io/chapters/pre-recorded-stt/quickstart.md')
  expect(gladiaLinks).toContain('https://docs.gladia.io/api-reference/v2/pre-recorded/webhook/success.md')
})

test('links default output directory points to project/links', () => {
  expect(decodeURIComponent(LINKS_OUTPUT_DIR.pathname).endsWith('/project/links/')).toBe(true)
})

test('links default output filename uses all-all for an unfiltered run', () => {
  const parsed = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links'
  ])

  expect(getDefaultLinksOutputFileName(parsed.serviceSelections, parsed.globalSections)).toBe('all-all-links.md')
})

test('links default output filename uses all for a bare provider selection', () => {
  const parsed = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--gemini'
  ])

  expect(getDefaultLinksOutputFileName(parsed.serviceSelections, parsed.globalSections)).toBe('gemini-all-links.md')
})

test('links default output filename keeps provider sections in a stable canonical order', () => {
  const parsed = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--gemini',
    'tts',
    'general'
  ])

  expect(getDefaultLinksOutputFileName(parsed.serviceSelections, parsed.globalSections)).toBe('gemini-general-tts-links.md')
})

test('links default output filename lowercases, dedupes, and sorts mixed selections', () => {
  const parsed = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    'TTS',
    'stt',
    'tts',
    '--OpenAI',
    'TEXT',
    'general',
    'text',
    '--Gemini'
  ])

  expect(getDefaultLinksOutputFileName(parsed.serviceSelections, parsed.globalSections)).toBe(
    'all-stt-tts--gemini-all--openai-general-text-links.md'
  )
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
  expect(content).not.toContain(String(LINKS_OUTPUT_DIR))
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

test('links command rejects dashed global sections as unknown selectors after a provider selector', async () => {
  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--openai',
    '--stt'
  ])).rejects.toThrow('Unknown links selector "--stt". Known providers:')
})

test('links command rejects dashed global sections as unknown selectors before a provider selector', async () => {
  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--stt',
    '--openai'
  ])).rejects.toThrow('Unknown links selector "--stt". Known providers:')
})

test('links command rejects unknown dashed selectors with provider and section guidance', async () => {
  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--bogus'
  ])).rejects.toThrow('Unknown links selector "--bogus". Known providers: assembly, claude, deapi, deepgram, elevenlabs, gemini, gladia, glm, grok, groq, happyscribe, minimax, openai, resend, rev, soniox, speechmatics, supadata. Known sections: general, image, music, ocr, stt, text, tts, video.')
})
