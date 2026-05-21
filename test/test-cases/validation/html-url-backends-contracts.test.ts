import { afterEach, expect, test } from 'bun:test'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractHtmlToMarkdown } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-local/defuddle/run-defuddle-url'
import { assertUrlArticleOptionsSupported } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-provider-adapter'
import {
  HOSTED_URL_ARTICLE_BACKENDS,
  getUrlArticleProviderAdapter,
  runUrlArticleProviderWithStats,
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
import type { UrlArticleProviderAdapter, UrlArticleRunOptions } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-provider-adapter'
import { DEFAULT_URL_REQUEST_TIMEOUT_MS } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-utils'
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
  'ZYTE_API_KEY',
  'AUTOSHOW_DEFUDDLE_BIN',
  'AUTOSHOW_DEFUDDLE_ARGS_LOG',
  'AUTOSHOW_FAKE_DEFUDDLE_MODE',
  'AUTOSHOW_FAKE_DEFUDDLE_STDERR'
] as const
const originalEnv = new Map<string, string | undefined>(
  envKeys.map(key => [key, process.env[key]])
)
const originalAdapterRuns = new Map<HtmlArticleBackend, UrlArticleProviderAdapter['run']>(
  URL_ARTICLE_BACKENDS.map((backend) => [backend, URL_ARTICLE_PROVIDER_ADAPTERS[backend].run])
)
const tempDirs: string[] = []

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

afterEach(async () => {
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
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
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

const buildAbortError = (message: string): Error => {
  const error = new Error(message)
  error.name = 'AbortError'
  return error
}

const writeFakeDefuddleBin = async (): Promise<{ bin: string, argsLog: string }> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-fake-defuddle-'))
  tempDirs.push(dir)
  const bin = join(dir, 'defuddle')
  const argsLog = join(dir, 'args.log')

  await writeFile(bin, [
    '#!/usr/bin/env bun',
    "import { appendFileSync, readFileSync } from 'node:fs'",
    'const args = process.argv.slice(2)',
    "if (args[0] === '--version') { console.log('0.17.0'); process.exit(0) }",
    "const logPath = process.env.AUTOSHOW_DEFUDDLE_ARGS_LOG",
    "if (logPath) appendFileSync(logPath, JSON.stringify(args) + '\\n')",
    "if (process.env.AUTOSHOW_FAKE_DEFUDDLE_STDERR) console.error(process.env.AUTOSHOW_FAKE_DEFUDDLE_STDERR)",
    "if (process.env.AUTOSHOW_FAKE_DEFUDDLE_MODE === 'nonzero') { console.log('partial stdout before failure'); console.error('fake defuddle failed'); process.exit(7) }",
    "if (process.env.AUTOSHOW_FAKE_DEFUDDLE_MODE === 'invalid-json') { console.log('{not valid json'); process.exit(0) }",
    "const sourcePath = args[1] ?? ''",
    "const html = sourcePath ? readFileSync(sourcePath, 'utf8') : ''",
    "const markdown = '# CLI Defuddle Article\\n\\nThis fake defuddle output includes enough meaningful markdown content from the CLI fixture. ' + (html.includes('Moved Backend Article') ? 'Moved Backend Article.' : 'Generic Article.')",
    "console.log(JSON.stringify({ contentMarkdown: markdown, content: 'SHOULD_NOT_USE_CONTENT', title: 'CLI Title', author: 'CLI Author', site: 'CLI Site', published: '2026-05-01T00:00:00Z', language: 'en', description: 'CLI description', wordCount: 88 }))"
  ].join('\n'))
  await chmod(bin, 0o755)

  process.env['AUTOSHOW_DEFUDDLE_BIN'] = bin
  process.env['AUTOSHOW_DEFUDDLE_ARGS_LOG'] = argsLog

  return { bin, argsLog }
}

test('defuddle URL backend extracts markdown from supplied HTML', async () => {
  const { argsLog } = await writeFakeDefuddleBin()

  const result = await extractHtmlToMarkdown({
    html: htmlDocument,
    documentUrl: 'https://example.test/final',
    sourceUrl: 'https://example.test/source',
    finalUrl: 'https://example.test/final'
  })

  expect(result.markdown).toContain('meaningful markdown content')
  expect(result.markdown).toContain('Moved Backend Article')
  expect(result.markdown).not.toContain('SHOULD_NOT_USE_CONTENT')
  expect(result.title).toBe('CLI Title')
  expect(result.author).toBe('CLI Author')
  expect(result.web).toMatchObject({
    sourceUrl: 'https://example.test/source',
    finalUrl: 'https://example.test/final',
    title: 'CLI Title',
    author: 'CLI Author',
    site: 'CLI Site',
    published: '2026-05-01T00:00:00Z',
    language: 'en',
    description: 'CLI description',
    wordCount: 88
  })

  const [parseArgs] = (await Bun.file(argsLog).text()).trim().split('\n').map((line) => JSON.parse(line) as string[])
  expect(parseArgs?.[0]).toBe('parse')
  expect(parseArgs?.[1]?.endsWith('article.html')).toBe(true)
  expect(parseArgs?.slice(2)).toEqual(['--markdown', '--json'])
  expect(await Bun.file(parseArgs![1]!).exists()).toBe(false)
})

test('defuddle URL backend includes captured output for nonzero CLI failures', async () => {
  await writeFakeDefuddleBin()
  process.env['AUTOSHOW_FAKE_DEFUDDLE_MODE'] = 'nonzero'

  let error: unknown
  try {
    await extractHtmlToMarkdown({
      html: htmlDocument,
      documentUrl: 'https://example.test/final'
    })
  } catch (caught) {
    error = caught
  }

  expect(error).toBeInstanceOf(Error)
  const message = (error as Error).message
  expect(message).toContain('Defuddle CLI failed')
  expect(message).toContain('exit code 7')
  expect(message).toContain('partial stdout before failure')
  expect(message).toContain('fake defuddle failed')
})

test('defuddle URL backend includes captured output for invalid JSON', async () => {
  await writeFakeDefuddleBin()
  process.env['AUTOSHOW_FAKE_DEFUDDLE_MODE'] = 'invalid-json'
  process.env['AUTOSHOW_FAKE_DEFUDDLE_STDERR'] = 'fake diagnostic stderr'

  let error: unknown
  try {
    await extractHtmlToMarkdown({
      html: htmlDocument,
      documentUrl: 'https://example.test/final'
    })
  } catch (caught) {
    error = caught
  }

  expect(error).toBeInstanceOf(Error)
  const message = (error as Error).message
  expect(message).toContain('Defuddle CLI returned invalid JSON')
  expect(message).toContain('{not valid json')
  expect(message).toContain('fake diagnostic stderr')
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
      onlyMainContent: true,
      timeout: DEFAULT_URL_REQUEST_TIMEOUT_MS
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
  expect(getUrlArticleProviderAdapter('defuddle').capabilities).toContain('timeout')
  expect(getUrlArticleProviderAdapter('zyte').capabilities).toContain('timeout')
  expect(getUrlArticleProviderAdapter('zyte').capabilities).toContain('structured-extraction')
  expect(() => assertUrlArticleOptionsSupported(
    getUrlArticleProviderAdapter('zyte'),
    { includeSelectors: ['article'] }
  )).toThrow('Zyte does not support URL article option "selectors".')
})

test('URL article provider retry wrapper retries timeout failures and reports attempts', async () => {
  const originalSleep = Bun.sleep
  const seenOptions: UrlArticleRunOptions[] = []
  let calls = 0

  try {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
    URL_ARTICLE_PROVIDER_ADAPTERS.zyte.run = async (source, sourceUrl, options) => {
      calls += 1
      seenOptions.push(options ?? {})
      if (calls === 1) {
        throw buildAbortError('Zyte request timed out after 25ms')
      }
      return buildMockArticle('zyte', source, sourceUrl)
    }

    const result = await runUrlArticleProviderWithStats('zyte', 'https://article.test/retry', 'https://article.test/retry', {
      timeoutMs: 25,
      requestAttempts: 2
    })

    expect(result.article.title).toBe('zyte Article')
    expect(result.attempts).toBe(2)
    expect(calls).toBe(2)
    expect(seenOptions).toHaveLength(2)
    for (const options of seenOptions) {
      expect(options).toMatchObject({
        timeoutMs: 25,
        requestAttempts: 2
      })
      expect(options.requestSignal).toBeInstanceOf(AbortSignal)
    }
  } finally {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = originalSleep
  }
})

test('URL article provider retry wrapper retries retryable HTTP status failures', async () => {
  const originalSleep = Bun.sleep
  let calls = 0

  try {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
    URL_ARTICLE_PROVIDER_ADAPTERS.firecrawl.run = async (source, sourceUrl) => {
      calls += 1
      if (calls === 1) {
        const error = new Error('Firecrawl scrape failed (503 Service Unavailable): overloaded')
        Object.assign(error, {
          status: 503,
          headers: new Headers()
        })
        throw error
      }
      return buildMockArticle('firecrawl', source, sourceUrl)
    }

    const result = await runUrlArticleProviderWithStats('firecrawl', 'https://article.test/status-retry', 'https://article.test/status-retry', {
      timeoutMs: 25,
      requestAttempts: 2
    })

    expect(result.article.title).toBe('firecrawl Article')
    expect(result.attempts).toBe(2)
    expect(calls).toBe(2)
  } finally {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = originalSleep
  }
})

test('URL article provider retry wrapper enriches exhausted timeout errors', async () => {
  const originalSleep = Bun.sleep

  try {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
    URL_ARTICLE_PROVIDER_ADAPTERS.zyte.run = async () => {
      throw buildAbortError('Zyte request timed out after 25ms')
    }

    await expect(runUrlArticleProviderWithStats('zyte', 'https://article.test/retry-fail', 'https://article.test/retry-fail', {
      timeoutMs: 25,
      requestAttempts: 2
    })).rejects.toThrow('Zyte request failed after 2/2 attempts with 25ms timeout')

    let error: unknown
    try {
      await runUrlArticleProviderWithStats('zyte', 'https://article.test/retry-fail', 'https://article.test/retry-fail', {
        timeoutMs: 25,
        requestAttempts: 2
      })
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(Error)
    const message = (error as Error).message
    expect(message).toContain('Zyte request failed after 2/2 attempts with 25ms timeout')
    expect(message).toContain('ms elapsed')
    expect(message).toContain('Zyte request timed out after 25ms')
    expect((error as { attemptsMade?: unknown }).attemptsMade).toBe(2)
  } finally {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = originalSleep
  }
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
      timeout: Math.ceil(DEFAULT_URL_REQUEST_TIMEOUT_MS / 1000),
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
      filter_output_main_only: true,
      request_timeout: Math.ceil(DEFAULT_URL_REQUEST_TIMEOUT_MS / 1000)
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
    const seenOptions = new Map<HtmlArticleBackend, UrlArticleRunOptions | undefined>()
    for (const backend of URL_ARTICLE_BACKENDS) {
      URL_ARTICLE_PROVIDER_ADAPTERS[backend].run = async (source, sourceUrl, options) => {
        seenOptions.set(backend, options)
        return buildMockArticle(backend, source, sourceUrl)
      }
    }

    const opts = buildOptsFromFlags(false, {
      'all-url': true,
      'url-request-timeout-ms': '25000',
      'url-request-attempts': '2'
    })
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
    for (const backend of URL_ARTICLE_BACKENDS) {
      expect(seenOptions.get(backend)).toMatchObject({
        timeoutMs: 25000,
        requestAttempts: 2
      })
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('--all-url manifest records one exhausted failed URL provider without an actual-cost artifact', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'autoshow-all-url-failed-provider-'))
  const originalSleep = Bun.sleep

  try {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
    for (const backend of URL_ARTICLE_BACKENDS) {
      URL_ARTICLE_PROVIDER_ADAPTERS[backend].run = async (source, sourceUrl) =>
        buildMockArticle(backend, source, sourceUrl)
    }
    URL_ARTICLE_PROVIDER_ADAPTERS.zyte.run = async () => {
      throw buildAbortError('Zyte request timed out after 25ms')
    }

    const opts = buildOptsFromFlags(false, {
      'all-url': true,
      'url-request-timeout-ms': '25',
      'url-request-attempts': '2'
    })
    const output = await processUrlArticle('https://article.test/partial.html', tempRoot, opts)

    expect(await Bun.file(join(output.outputDir, 'providers', 'zyte', 'result.json')).exists()).toBe(false)
    expect(await Bun.file(join(output.outputDir, 'providers', 'firecrawl', 'result.json')).exists()).toBe(true)

    const manifest = await Bun.file(join(output.outputDir, 'run.json')).json() as {
      metadata: {
        completionStatus: string
        missingProviders: Array<{ service: string, model: string }>
        errors?: Array<{ service: string, model: string, message: string }>
        providerStates: Array<{ service: string, status: string, attempts: number, lastError?: { message: string } }>
        cost: { actual: { steps?: unknown[], totalCost: number } }
      }
    }

    expect(manifest.metadata.completionStatus).toBe('incomplete')
    expect(manifest.metadata.missingProviders).toEqual([{ service: 'zyte', model: 'zyte' }])
    expect(manifest.metadata.errors).toEqual([{
      service: 'zyte',
      model: 'zyte',
      message: expect.stringContaining('Zyte request failed after 2/2 attempts with 25ms timeout')
    }])
    expect(manifest.metadata.providerStates.find((state) => state.service === 'zyte')).toMatchObject({
      service: 'zyte',
      status: 'failed',
      attempts: 2,
      lastError: {
        message: expect.stringContaining('Zyte request timed out after 25ms')
      }
    })
    expect(manifest.metadata.cost.actual.steps?.some((step) =>
      typeof step === 'object' && step !== null && JSON.stringify(step).includes('zyte')
    )).toBe(false)
  } finally {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = originalSleep
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
