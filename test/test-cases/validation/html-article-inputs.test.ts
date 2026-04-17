import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildExpectedFilesList } from '~/cli/commands/process-steps/step-1-download/targets/handle-process-target'
import { buildOptsFromFlags, classifyUrlInput } from '~/cli/commands/process-steps/step-1-download/targets/target-utils'
import { prepareHtmlArticle } from '~/cli/commands/process-steps/step-1-download/document/prepare-html-article'
import { buildAggregatedPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { runCommand } from '../../test-utils/test-helpers'
import { readRunMetadata } from '../../test-utils/manifest-helpers'

const ARTICLE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <title>Example Article Title</title>
    <meta name="author" content="Example Author" />
    <meta name="description" content="Example article description." />
  </head>
  <body>
    <article>
      <h1>Example Article Title</h1>
      <p>This article body has enough text for the defuddle backend to treat it as meaningful content instead of an empty shell.</p>
      <p>It includes a second paragraph so the markdown output is not tiny and the extracted content can flow through the document pipeline.</p>
    </article>
  </body>
</html>`
const GLM_READER_MARKDOWN = '# GLM Reader Title\n\nThis markdown came from the mocked GLM Reader service.'

const cleanupPaths = new Set<string>()

afterEach(async () => {
  for (const path of cleanupPaths) {
    await rm(path, { recursive: true, force: true }).catch(() => {})
  }
  cleanupPaths.clear()
})

const startClassificationServer = async () => {
  const pdfBytes = await Bun.file('input/examples/document/1-document.pdf').bytes()
  const server = createServer((req, res) => {
    if (req.url === '/article') {
      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      if (req.method === 'HEAD') {
        res.end()
        return
      }
      res.end(ARTICLE_HTML)
      return
    }

    if (req.url === '/article-blocked-probe') {
      if (req.method === 'HEAD') {
        res.statusCode = 405
        res.end('method not allowed')
        return
      }

      if (req.headers.range) {
        res.statusCode = 403
        res.end('range requests are blocked')
        return
      }

      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.end(ARTICLE_HTML)
      return
    }

    if (req.url === '/article-not-found') {
      res.statusCode = 404
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.end(ARTICLE_HTML)
      return
    }

    if (req.url === '/report') {
      res.statusCode = 200
      res.setHeader('content-type', 'application/pdf')
      if (req.method === 'HEAD') {
        res.end()
        return
      }
      res.end(Buffer.from(pdfBytes))
      return
    }

    if (req.url === '/api/paas/v4/reader' && req.method === 'POST') {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        reader_result: {
          content: GLM_READER_MARKDOWN,
          title: 'GLM Reader Title',
          description: 'Mocked GLM Reader description.',
          url: `http://${req.headers.host ?? '127.0.0.1'}/article`
        }
      }))
      return
    }

    res.statusCode = 404
    res.end('not found')
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  return server
}

const stopServer = async (server: ReturnType<typeof createServer>): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

describe('HTML article inputs', () => {
  test('classifies html and pdf URLs via HTTP headers when the path has no extension', async () => {
    const server = await startClassificationServer()
    try {
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Failed to determine server port')
      }

      const baseUrl = `http://127.0.0.1:${address.port}`
      await expect(classifyUrlInput(`${baseUrl}/article`)).resolves.toBe('url_html_article')
      await expect(classifyUrlInput(`${baseUrl}/article-blocked-probe`)).resolves.toBe('url_html_article')
      await expect(classifyUrlInput(`${baseUrl}/report`)).resolves.toBe('url_direct_document')
    } finally {
      await stopServer(server)
    }
  })

  test('runs local html through the ocr document pipeline with defuddle markdown output', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-html-local-'))
    cleanupPaths.add(tempDir)

    const htmlPath = join(tempDir, 'page.html')
    await Bun.write(htmlPath, ARTICLE_HTML)

    const result = await runCommand(
      ['src/cli/create-cli.ts', 'ocr', htmlPath, '--out', 'text'],
      { testName: 'local html uses defuddle extraction path' }
    )

    expect(result.exitCode).toBe(0)
    expect(result.outputDir).not.toBeNull()
    if (!result.outputDir) {
      return
    }

    cleanupPaths.add(result.outputDir)
    const metadata = await readRunMetadata(result.outputDir) as {
      step1: { format?: string }
      step2: { extractionMethod?: string }
      web?: { title?: string }
    }
    const extractionText = await Bun.file(`${result.outputDir}/extraction.txt`).text()

    expect(metadata.step1.format).toBe('html')
    expect(metadata.step2.extractionMethod).toBe('html+defuddle')
    expect(metadata.web?.title).toBe('Example Article Title')
    expect(extractionText).toContain('This article body has enough text')
    expect(extractionText.startsWith('Page 1\n')).toBe(false)
  })

  test('runs remote article URLs through the ocr document pipeline when cheap URL probes fail', async () => {
    const server = await startClassificationServer()
    try {
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Failed to determine server port')
      }

      const articleUrl = `http://127.0.0.1:${address.port}/article-blocked-probe`
      const result = await runCommand(
        ['src/cli/create-cli.ts', 'ocr', articleUrl, '--url-backend', 'defuddle', '--out', 'text'],
        { testName: 'remote article uses defuddle extraction path after probe fallback' }
      )

      expect(result.exitCode).toBe(0)
      expect(result.outputDir).not.toBeNull()
      if (!result.outputDir) {
        return
      }

      cleanupPaths.add(result.outputDir)
      const metadata = await readRunMetadata(result.outputDir) as {
        step1: { format?: string }
        step2: { extractionMethod?: string }
        web?: { title?: string }
      }
      const extractionText = await Bun.file(`${result.outputDir}/extraction.txt`).text()

      expect(metadata.step1.format).toBe('html')
      expect(metadata.step2.extractionMethod).toBe('html+defuddle')
      expect(metadata.web?.title).toBe('Example Article Title')
      expect(extractionText).toContain('This article body has enough text')
      expect(extractionText.startsWith('Page 1\n')).toBe(false)
    } finally {
      await stopServer(server)
    }
  })

  test('runs remote article URLs through glm-reader when requested', async () => {
    const server = await startClassificationServer()
    try {
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Failed to determine server port')
      }

      const baseUrl = `http://127.0.0.1:${address.port}`
      const articleUrl = `${baseUrl}/article`
      const result = await runCommand(
        ['src/cli/create-cli.ts', 'ocr', articleUrl, '--url-backend', 'glm-reader', '--out', 'text'],
        {
          testName: 'remote article uses glm-reader extraction path',
          env: {
            GLM_API_KEY: 'glm-test-key',
            ZAI_BASE_URL: baseUrl
          }
        }
      )

      expect(result.exitCode).toBe(0)
      expect(result.outputDir).not.toBeNull()
      if (!result.outputDir) {
        return
      }

      cleanupPaths.add(result.outputDir)
      const metadata = await readRunMetadata(result.outputDir) as {
        step1: { format?: string }
        step2: { extractionMethod?: string }
        web?: { title?: string; description?: string }
      }
      const extractionText = await Bun.file(`${result.outputDir}/extraction.txt`).text()

      expect(metadata.step1.format).toBe('html')
      expect(metadata.step2.extractionMethod).toBe('html+glm-reader')
      expect(metadata.web?.title).toBe('GLM Reader Title')
      expect(metadata.web?.description).toBe('Mocked GLM Reader description.')
      expect(extractionText).toContain('This markdown came from the mocked GLM Reader service.')
      expect(extractionText.startsWith('Page 1\n')).toBe(false)
    } finally {
      await stopServer(server)
    }
  })

  test('explicit --url-backend routes unresolved html URLs through article extraction instead of usage validation', async () => {
    const server = await startClassificationServer()
    try {
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Failed to determine server port')
      }

      const articleUrl = `http://127.0.0.1:${address.port}/article-not-found`
      const opts = buildOptsFromFlags(false, {
        'url-backend': 'defuddle'
      }, [], {}, new Set(['url-backend']))

      await expect(classifyUrlInput(articleUrl)).resolves.toBe('url_streaming')
      await expect(classifyUrlInput(articleUrl, opts)).resolves.toBe('url_html_article')

      const result = await runCommand(
        ['src/cli/create-cli.ts', 'ocr', articleUrl, '--url-backend', 'defuddle'],
        { testName: 'explicit article backend bypasses ocr usage validation for unresolved html urls' }
      )

      expect(result.exitCode).not.toBe(0)
      expect(result.stdout).not.toContain('Unsupported ocr input')
      expect(result.stderr).not.toContain('Unsupported ocr input')
      expect(`${result.stdout}\n${result.stderr}`).toContain('Failed to fetch article HTML (404 Not Found)')
    } finally {
      await stopServer(server)
    }
  })

  test('prices article URLs as document writes without STT and without extract provider fan-out', async () => {
    const server = await startClassificationServer()
    try {
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Failed to determine server port')
      }

      const articleUrl = `http://127.0.0.1:${address.port}/article`
      const opts = buildOptsFromFlags(false, {
        openai: 'gpt-5.4',
        'mistral-ocr': 'mistral-ocr-2512',
        'url-backend': 'defuddle'
      }, [], {}, new Set(['openai', 'mistral-ocr', 'url-backend']))

      const estimate = await buildAggregatedPriceEstimate('write', articleUrl, opts)
      const expectedFiles = await buildExpectedFilesList('write', opts, articleUrl)

      expect(estimate.steps.some((step) => step.step === 'stt')).toBe(false)
      expect(estimate.steps.some((step) => step.step === 'extract')).toBe(false)
      expect(estimate.notes).toContain('OCR flags are ignored for HTML/article inputs.')
      expect(expectedFiles).toContain('result.json')
      expect(expectedFiles).toContain('text.json')
      expect(expectedFiles).toContain('prompt.md')
      expect(expectedFiles).toContain('run.json')
      expect(expectedFiles).not.toContain('Audio file')
      expect(expectedFiles).not.toContain('transcription.txt')
    } finally {
      await stopServer(server)
    }
  })

  test('prices glm-reader article URLs with a note instead of an extract step', async () => {
    const server = await startClassificationServer()
    try {
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Failed to determine server port')
      }

      const articleUrl = `http://127.0.0.1:${address.port}/article`
      const opts = buildOptsFromFlags(false, {
        openai: 'gpt-5.4',
        'glm-ocr': 'glm-ocr',
        'url-backend': 'glm-reader'
      }, [], {}, new Set(['openai', 'glm-ocr', 'url-backend']))

      const estimate = await buildAggregatedPriceEstimate('write', articleUrl, opts)
      expect(estimate.steps.some((step) => step.step === 'extract')).toBe(false)
      expect(estimate.notes).toContain('GLM Reader cost is not estimated locally during preflight.')
      expect(estimate.notes).toContain('OCR flags are ignored for HTML/article inputs.')
    } finally {
      await stopServer(server)
    }
  })

  test('prices firecrawl article URLs as extract steps instead of note-only placeholders', async () => {
    const server = await startClassificationServer()
    try {
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Failed to determine server port')
      }

      const articleUrl = `http://127.0.0.1:${address.port}/article`
      const opts = buildOptsFromFlags(false, {
        'url-backend': 'firecrawl'
      }, [], {}, new Set(['url-backend']))

      const estimate = await buildAggregatedPriceEstimate('ocr', articleUrl, opts)
      const extractStep = estimate.steps.find((step) => step.step === 'extract')

      expect(extractStep).toBeDefined()
      expect(extractStep).toMatchObject({
        step: 'extract',
        provider: 'firecrawl',
        model: 'firecrawl',
        pageCount: 1,
        costPer1kPagesCents: 83,
        estimateType: 'exact'
      })
      expect(extractStep?.totalCost).toBeCloseTo(0.083, 6)
      expect(extractStep?.note).toContain('Firecrawl Standard plan rate')
      expect(estimate.notes ?? []).not.toContain('Firecrawl credits apply; exact cost is not estimated locally.')
    } finally {
      await stopServer(server)
    }
  })

  test('requires FIRECRAWL_API_KEY for hosted firecrawl article extraction', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-firecrawl-'))
    cleanupPaths.add(tempDir)

    const originalApiKey = process.env['FIRECRAWL_API_KEY']
    const originalApiUrl = process.env['FIRECRAWL_API_URL']
    delete process.env['FIRECRAWL_API_KEY']
    delete process.env['FIRECRAWL_API_URL']

    try {
      await expect(
        prepareHtmlArticle('https://ajcwebdev.com', tempDir, 'firecrawl')
      ).rejects.toThrow('FIRECRAWL_API_KEY is required')
    } finally {
      if (originalApiKey === undefined) {
        delete process.env['FIRECRAWL_API_KEY']
      } else {
        process.env['FIRECRAWL_API_KEY'] = originalApiKey
      }

      if (originalApiUrl === undefined) {
        delete process.env['FIRECRAWL_API_URL']
      } else {
        process.env['FIRECRAWL_API_URL'] = originalApiUrl
      }
    }
  })

  test('requires GLM_API_KEY for hosted glm-reader article extraction', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-glm-reader-'))
    cleanupPaths.add(tempDir)

    const originalApiKey = process.env['GLM_API_KEY']
    const originalBaseUrl = process.env['ZAI_BASE_URL']
    delete process.env['GLM_API_KEY']
    delete process.env['ZAI_BASE_URL']

    try {
      await expect(
        prepareHtmlArticle('https://ajcwebdev.com', tempDir, 'glm-reader')
      ).rejects.toThrow('GLM_API_KEY environment variable is required for GLM Reader')
    } finally {
      if (originalApiKey === undefined) {
        delete process.env['GLM_API_KEY']
      } else {
        process.env['GLM_API_KEY'] = originalApiKey
      }

      if (originalBaseUrl === undefined) {
        delete process.env['ZAI_BASE_URL']
      } else {
        process.env['ZAI_BASE_URL'] = originalBaseUrl
      }
    }
  })

  test('local html ignores glm-reader and falls back to defuddle', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-html-local-glm-'))
    cleanupPaths.add(tempDir)

    const htmlPath = join(tempDir, 'page.html')
    await Bun.write(htmlPath, ARTICLE_HTML)

    const result = await runCommand(
      ['src/cli/create-cli.ts', 'ocr', htmlPath, '--url-backend', 'glm-reader', '--out', 'text'],
      { testName: 'local html ignores glm-reader backend' }
    )

    expect(result.exitCode).toBe(0)
    expect(`${result.stdout}\n${result.stderr}`).toContain('Ignoring --url-backend glm-reader for local HTML inputs; using defuddle instead')
    expect(result.outputDir).not.toBeNull()
    if (!result.outputDir) {
      return
    }

    cleanupPaths.add(result.outputDir)
    const metadata = await readRunMetadata(result.outputDir) as {
      step2: { extractionMethod?: string }
    }
    expect(metadata.step2.extractionMethod).toBe('html+defuddle')
  })
})
