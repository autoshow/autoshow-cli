import { afterEach, expect, test } from 'bun:test'
import { extractHtmlToMarkdown } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-local/defuddle/run-defuddle-url'
import { runFirecrawlUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/firecrawl/run-firecrawl-url'
import { runGlmReaderUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/glm-reader/run-glm-reader-url'

const originalFetch = globalThis.fetch
const envKeys = ['FIRECRAWL_API_URL', 'FIRECRAWL_API_KEY', 'GLM_API_KEY', 'ZAI_BASE_URL'] as const
const originalEnv = new Map<string, string | undefined>(
  envKeys.map(key => [key, process.env[key]])
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
  for (const key of envKeys) {
    const originalValue = originalEnv.get(key)
    if (originalValue === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = originalValue
    }
  }
})

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

    if (url === 'https://firecrawl.local/v1/scrape') {
      return Response.json({
        data: {
          markdown: longMarkdown,
          metadata: {
            title: 'Firecrawl Title',
            author: 'Firecrawl Author',
            finalURL: 'https://article.test/final',
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
    url: 'https://firecrawl.local/v1/scrape',
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
