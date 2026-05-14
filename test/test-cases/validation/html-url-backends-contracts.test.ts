import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractHtmlToMarkdown } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-local/defuddle/run-defuddle-url'
import { assertUrlArticleOptionsSupported } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-provider-adapter'
import {
  HOSTED_URL_ARTICLE_BACKENDS,
  getUrlArticleProviderAdapter,
  URL_ARTICLE_BACKENDS,
  URL_ARTICLE_PROVIDER_ADAPTERS
} from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-provider-registry'
import { processUrlArticle } from '~/cli/commands/process-steps/step-2-extract/step-2-url/process-url'
import { runOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/run-ocr'
import { runFirecrawlUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/firecrawl/run-firecrawl-url'
import { runGlmReaderUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/glm-reader/run-glm-reader-url'
import { runSpiderUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/spider/run-spider-url'
import { runZyteUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/zyte/run-zyte-url'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import type { DocumentMetadata, ExtractionOptions, HtmlArticleBackend } from '~/types'
import type { UrlArticleProviderAdapter } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-provider-adapter'
import type { UrlArticleRunResult } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-utils'

const originalFetch = globalThis.fetch
const envKeys = [
  'FIRECRAWL_API_URL',
  'FIRECRAWL_API_KEY',
  'GLM_API_KEY',
  'ZAI_BASE_URL',
  'SPIDER_API_URL',
  'SPIDER_API_KEY',
  'ZYTE_API_URL',
  'ZYTE_API_KEY'
] as const
const originalEnv = new Map<string, string | undefined>(
  envKeys.map(key => [key, process.env[key]])
)
const originalAdapterRuns = new Map<HtmlArticleBackend, UrlArticleProviderAdapter['run']>(
  URL_ARTICLE_BACKENDS.map((backend) => [backend, URL_ARTICLE_PROVIDER_ADAPTERS[backend].run])
)

const longMarkdown = 'This article contains enough meaningful markdown content for the URL backend extraction contract to pass without reaching any hosted provider.'
const htmlDocument = `<!doctype html>
<html>
  <head>
    <title>Moved Backend Article</title>
    <meta name="description" content="Backend extraction fixture">
  </head>
  <body>
    <article>
      <h1>Moved Backend Article</h1>
      <p>${longMarkdown}</p>
    </article>
  </body>
</html>`

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const backend of URL_ARTICLE_BACKENDS) {
    const originalRun = originalAdapterRuns.get(backend)
    if (originalRun) {
      URL_ARTICLE_PROVIDER_ADAPTERS[backend].run = originalRun
    }
  }
  for (const key of envKeys) {
    const originalValue = originalEnv.get(key)
    if (originalValue === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = originalValue
    }
  }
})

const buildMockArticle = (
  backend: HtmlArticleBackend,
  source: string,
  sourceUrl: string | undefined
): UrlArticleRunResult => {
  const markdown = `# ${backend} Article\n\n${longMarkdown} Mock provider ${backend} returned canonical URL article markdown for comparison.`
  return {
    markdown,
    title: `${backend} Article`,
    fileSize: markdown.length,
    web: {
      sourceUrl: sourceUrl ?? source,
      finalUrl: sourceUrl ? `https://article.test/final/${backend}` : `file://${source}`,
      title: `${backend} Article`,
      wordCount: markdown.split(/\s+/).filter(Boolean).length
    }
  }
}

test('defuddle URL backend extracts markdown from supplied HTML', async () => {
  const result = await extractHtmlToMarkdown({
    html: htmlDocument,
    documentUrl: 'https://example.test/final',
    sourceUrl: 'https://example.test/source',
    finalUrl: 'https://example.test/final'
  })

  expect(result.markdown).toContain('meaningful markdown content')
  expect(result.web).toMatchObject({
    sourceUrl: 'https://example.test/source',
    finalUrl: 'https://example.test/final'
  })
  expect(result.web.wordCount).toBeGreaterThan(5)
})

test('prepared article markdown carries backend duration into extraction metadata', async () => {
  const step1Metadata: DocumentMetadata = {
    title: 'Zyte Article',
    slug: 'zyte-article',
    pageCount: 1,
    format: 'html',
    fileSize: longMarkdown.length
  }
  const opts: ExtractionOptions = {
    filePath: 'unused.html',
    outputDir: '/tmp/autoshow-html-duration-test',
    dpi: 300,
    languages: 'eng',
    oem: 1,
    psm: 3,
    outputFormat: 'text',
    pageSeparator: '\n\n',
    ocrProviderConcurrency: 2,
    ocrLocalConcurrency: 1,
    preserveInterwordSpaces: false,
    rotate: 0,
    pdfChapterMode: 'local',
    preparedMarkdown: longMarkdown,
    htmlArticleProcessingTimeMs: 4321,
    htmlArticleBackend: 'zyte'
  }

  const result = await runOcr('unused.html', step1Metadata, opts)

  expect(result.step2Metadata.extractionMethod).toBe('html+zyte')
  expect(result.step2Metadata.processingTime).toBeGreaterThanOrEqual(4321)
})

test('firecrawl URL backend posts scrape request and normalizes article metadata', async () => {
  process.env['FIRECRAWL_API_URL'] = 'https://firecrawl.local'
  delete process.env['FIRECRAWL_API_KEY']

  const requests: Array<{ url: string, method: string, body?: unknown }> = []
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
    const url = String(input)
    requests.push({
      url,
      method: init?.method ?? 'GET',
      ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) as unknown } : {})
    })

    if (url === 'https://firecrawl.local/v2/scrape') {
      return Response.json({
        data: {
          markdown: longMarkdown,
          metadata: {
            title: 'Firecrawl Title',
            author: 'Firecrawl Author',
            sourceURL: 'https://article.test/story',
            url: 'https://article.test/final',
            siteName: 'Example Site',
            wordCount: 17
          }
        }
      })
    }

    if (url === 'https://article.test/story') {
      return new Response(htmlDocument, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    throw new Error(`Unexpected Firecrawl mock fetch: ${url}`)
  }) as typeof fetch

  const result = await runFirecrawlUrl('https://article.test/story', 'https://article.test/story')

  expect(requests[0]).toMatchObject({
    url: 'https://firecrawl.local/v2/scrape',
    method: 'POST',
    body: {
      url: 'https://article.test/story',
      formats: ['markdown'],
      onlyMainContent: true
    }
  })
  expect(result).toMatchObject({
    markdown: longMarkdown,
    title: 'Firecrawl Title',
    author: 'Firecrawl Author',
    web: {
      sourceUrl: 'https://article.test/story',
      finalUrl: 'https://article.test/final',
      site: 'Example Site',
      wordCount: 17
    }
  })
  expect(result.fileSize).toBeGreaterThan(longMarkdown.length)
})

test('URL article provider adapters expose neutral capabilities and reject unsupported explicit options', () => {
  expect(getUrlArticleProviderAdapter('firecrawl').capabilities).toContain('selectors')
  expect(getUrlArticleProviderAdapter('spider').capabilities).toContain('selectors')
  expect(getUrlArticleProviderAdapter('zyte').capabilities).toContain('structured-extraction')
  expect(() => assertUrlArticleOptionsSupported(
    getUrlArticleProviderAdapter('zyte'),
    { includeSelectors: ['article'] }
  )).toThrow('Zyte does not support URL article option "selectors".')
})

test('GLM Reader URL backend posts reader request and normalizes article metadata', async () => {
  process.env['GLM_API_KEY'] = 'glm-test-key'
  process.env['ZAI_BASE_URL'] = 'https://glm.local'

  const requests: Array<{ url: string, method: string, body?: unknown }> = []
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
    const url = String(input)
    requests.push({
      url,
      method: init?.method ?? 'GET',
      ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) as unknown } : {})
    })

    if (url === 'https://glm.local/api/paas/v4/reader') {
      return new Response(JSON.stringify({
        reader_result: {
          content: longMarkdown,
          title: 'GLM Reader Title',
          description: 'GLM Reader description',
          url: 'https://article.test/glm-final'
        }
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    if (url === 'https://article.test/glm') {
      return new Response(htmlDocument, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    throw new Error(`Unexpected GLM Reader mock fetch: ${url}`)
  }) as typeof fetch

  const result = await runGlmReaderUrl('https://article.test/glm', 'https://article.test/glm')

  expect(requests[0]).toMatchObject({
    url: 'https://glm.local/api/paas/v4/reader',
    method: 'POST',
    body: {
      url: 'https://article.test/glm',
      return_format: 'markdown',
      timeout: 20,
      no_cache: false,
      retain_images: false,
      no_gfm: false,
      keep_img_data_url: false,
      with_images_summary: false,
      with_links_summary: false
    }
  })
  expect(result).toMatchObject({
    markdown: longMarkdown,
    title: 'GLM Reader Title',
    web: {
      sourceUrl: 'https://article.test/glm',
      finalUrl: 'https://article.test/glm-final',
      description: 'GLM Reader description'
    }
  })
  expect(result.fileSize).toBeGreaterThan(longMarkdown.length)
})

test('Spider URL backend posts scrape request and normalizes article metadata', async () => {
  process.env['SPIDER_API_URL'] = 'https://spider.local'
  delete process.env['SPIDER_API_KEY']

  const requests: Array<{ url: string, method: string, body?: unknown }> = []
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
    const url = String(input)
    requests.push({
      url,
      method: init?.method ?? 'GET',
      ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) as unknown } : {})
    })

    if (url === 'https://spider.local/scrape') {
      return Response.json([{
        url: 'https://article.test/spider-final',
        content: longMarkdown,
        metadata: {
          title: 'Spider Title',
          author: 'Spider Author',
          siteName: 'Spider Site',
          description: 'Spider description',
          wordCount: 17
        }
      }])
    }

    if (url === 'https://article.test/spider') {
      return new Response(htmlDocument, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    throw new Error(`Unexpected Spider mock fetch: ${url}`)
  }) as typeof fetch

  const result = await runSpiderUrl('https://article.test/spider', 'https://article.test/spider')

  expect(requests[0]).toMatchObject({
    url: 'https://spider.local/scrape',
    method: 'POST',
    body: {
      url: 'https://article.test/spider',
      return_format: 'markdown',
      metadata: true,
      filter_output_main_only: true
    }
  })
  expect(result).toMatchObject({
    markdown: longMarkdown,
    title: 'Spider Title',
    author: 'Spider Author',
    web: {
      sourceUrl: 'https://article.test/spider',
      finalUrl: 'https://article.test/spider-final',
      site: 'Spider Site',
      description: 'Spider description',
      wordCount: 17
    }
  })
  expect(result.fileSize).toBeGreaterThan(longMarkdown.length)
})

test('Zyte URL backend posts article extract request and normalizes article metadata', async () => {
  process.env['ZYTE_API_URL'] = 'https://zyte.local'
  delete process.env['ZYTE_API_KEY']

  const requests: Array<{ url: string, method: string, body?: unknown }> = []
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
    const url = String(input)
    requests.push({
      url,
      method: init?.method ?? 'GET',
      ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) as unknown } : {})
    })

    if (url === 'https://zyte.local/v1/extract') {
      return Response.json({
        article: {
          headline: 'Zyte Title',
          articleBody: longMarkdown,
          description: 'Zyte description',
          datePublished: '2026-05-01T12:00:00Z',
          canonicalUrl: 'https://article.test/zyte-final',
          authors: [{ name: 'Zyte Author' }],
          publisher: { name: 'Zyte Site' },
          inLanguage: 'en'
        }
      })
    }

    if (url === 'https://article.test/zyte') {
      return new Response(htmlDocument, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    throw new Error(`Unexpected Zyte mock fetch: ${url}`)
  }) as typeof fetch

  const result = await runZyteUrl('https://article.test/zyte', 'https://article.test/zyte')

  expect(requests[0]).toMatchObject({
    url: 'https://zyte.local/v1/extract',
    method: 'POST',
    body: {
      url: 'https://article.test/zyte',
      article: true
    }
  })
  expect(result.markdown).toContain(longMarkdown)
  expect(result).toMatchObject({
    title: 'Zyte Title',
    author: 'Zyte Author',
    web: {
      sourceUrl: 'https://article.test/zyte',
      finalUrl: 'https://article.test/zyte-final',
      site: 'Zyte Site',
      description: 'Zyte description',
      published: '2026-05-01T12:00:00Z',
      language: 'en'
    }
  })
  expect(result.fileSize).toBeGreaterThan(longMarkdown.length)
})

test('--all-url orchestrator writes provider artifacts and a multi-provider run manifest', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'autoshow-all-url-'))

  try {
    for (const backend of URL_ARTICLE_BACKENDS) {
      URL_ARTICLE_PROVIDER_ADAPTERS[backend].run = async (source, sourceUrl) =>
        buildMockArticle(backend, source, sourceUrl)
    }

    const opts = buildOptsFromFlags(false, { 'all-url': true })
    const output = await processUrlArticle('https://article.test/story.html', tempRoot, opts)

    expect(await Bun.file(join(output.outputDir, 'result.json')).exists()).toBe(false)
    expect(await Bun.file(join(output.outputDir, 'extraction.txt')).exists()).toBe(false)

    for (const backend of URL_ARTICLE_BACKENDS) {
      const providerDir = join(output.outputDir, 'providers', backend)
      const extractionText = await Bun.file(join(providerDir, 'extraction.txt')).text()
      const providerResult = await Bun.file(join(providerDir, 'result.json')).json() as Record<string, unknown>

      expect(extractionText).toContain(`${backend} Article`)
      expect(providerResult).toMatchObject({
        schemaVersion: 2,
        kind: 'provider-result',
        provider: backend,
        model: backend
      })
      expect(providerResult['result']).toMatchObject({
        text: expect.stringContaining(`${backend} Article`)
      })
    }

    const manifest = await Bun.file(join(output.outputDir, 'run.json')).json() as {
      kind: string
      metadata: {
        completionStatus: string
        requestedProviders: Array<{ service: string, model: string }>
        providerStates: Array<{ service: string, model: string, status: string }>
        step2: unknown[]
        resolvedStep2: { backends?: string[] }
      }
    }

    expect(manifest.kind).toBe('extract')
    expect(manifest.metadata.completionStatus).toBe('full')
    expect(manifest.metadata.requestedProviders).toEqual(
      URL_ARTICLE_BACKENDS.map((backend) => ({ service: backend, model: backend }))
    )
    expect(manifest.metadata.providerStates.map((state) => state.status)).toEqual([
      'succeeded',
      'succeeded',
      'succeeded',
      'succeeded',
      'succeeded'
    ])
    expect(manifest.metadata.step2).toHaveLength(URL_ARTICLE_BACKENDS.length)
    expect(manifest.metadata.resolvedStep2.backends).toEqual([...URL_ARTICLE_BACKENDS])
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('--all-url with local HTML runs defuddle and marks hosted backends skipped', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'autoshow-local-all-url-'))

  try {
    const localHtml = join(tempRoot, 'local-article.html')
    await writeFile(localHtml, htmlDocument)

    URL_ARTICLE_PROVIDER_ADAPTERS.defuddle.run = async (source, sourceUrl) =>
      buildMockArticle('defuddle', source, sourceUrl)
    for (const backend of HOSTED_URL_ARTICLE_BACKENDS) {
      URL_ARTICLE_PROVIDER_ADAPTERS[backend].run = async () => {
        throw new Error(`${backend} should not run for local HTML --all-url`)
      }
    }

    const opts = buildOptsFromFlags(false, { 'all-url': true })
    const output = await processUrlArticle(localHtml, tempRoot, opts)

    expect(await Bun.file(join(output.outputDir, 'providers', 'defuddle', 'result.json')).exists()).toBe(true)
    expect(await Bun.file(join(output.outputDir, 'providers', 'defuddle', 'extraction.txt')).exists()).toBe(true)
    for (const backend of HOSTED_URL_ARTICLE_BACKENDS) {
      expect(await Bun.file(join(output.outputDir, 'providers', backend, 'result.json')).exists()).toBe(false)
      expect(await Bun.file(join(output.outputDir, 'providers', backend, 'extraction.txt')).exists()).toBe(false)
    }

    const manifest = await Bun.file(join(output.outputDir, 'run.json')).json() as {
      metadata: {
        completionStatus: string
        providerStates: Array<{ service: string, status: string }>
      }
    }

    expect(manifest.metadata.completionStatus).toBe('incomplete')
    expect(manifest.metadata.providerStates).toEqual([
      { service: 'defuddle', model: 'defuddle', artifactDir: 'providers/defuddle', status: 'succeeded', attempts: 1 },
      expect.objectContaining({ service: 'firecrawl', status: 'skipped' }),
      expect.objectContaining({ service: 'glm-reader', status: 'skipped' }),
      expect.objectContaining({ service: 'spider', status: 'skipped' }),
      expect.objectContaining({ service: 'zyte', status: 'skipped' })
    ])
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})
