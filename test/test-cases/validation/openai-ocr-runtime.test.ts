import { afterEach, expect, test } from 'bun:test'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DocumentMetadata } from '~/types'
import { runOpenAIOcr } from '~/cli/commands/process-steps/step-2-ocr/ocr-services/openai-ocr/run-openai-ocr'
import { ensurePageImageFixture } from '../../test-utils/test-helpers'

const cleanupPaths = new Set<string>()

const readRequestBody = async (req: AsyncIterable<Uint8Array | Buffer | string>): Promise<string> => {
  let body = ''
  for await (const chunk of req) {
    body += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
  }
  return body
}

afterEach(async () => {
  for (const path of cleanupPaths) {
    await rm(path, { recursive: true, force: true }).catch(() => {})
  }
  cleanupPaths.clear()
})

test('runOpenAIOcr uses the non-native JSON fallback path for gpt-5.4-pro', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-openai-ocr-pro-'))
  cleanupPaths.add(tempDir)

  const imagePath = join(tempDir, 'page.png')
  await ensurePageImageFixture(imagePath)

  let capturedRequest: Record<string, unknown> | undefined

  const server = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/responses') {
      res.statusCode = 404
      res.end('not found')
      return
    }

    const body = await readRequestBody(req)
    capturedRequest = JSON.parse(body) as Record<string, unknown>

    res.statusCode = 200
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({
      id: 'resp_openai_ocr_test',
      object: 'response',
      created_at: Math.floor(Date.now() / 1000),
      status: 'completed',
      error: null,
      incomplete_details: null,
      instructions: null,
      metadata: null,
      model: 'gpt-5.4-pro',
      output: [{
        id: 'msg_openai_ocr_test',
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{
          type: 'output_text',
          text: JSON.stringify({
            pages: [{
              pageNumber: 1,
              text: 'Recovered OpenAI OCR text.'
            }]
          }),
          annotations: []
        }]
      }],
      parallel_tool_calls: false,
      temperature: 0,
      tool_choice: 'auto',
      tools: [],
      top_p: 1,
      usage: {
        input_tokens: 321,
        output_tokens: 45,
        total_tokens: 366
      }
    }))
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start local OpenAI OCR test server')
  }

  const previousApiKey = process.env['OPENAI_API_KEY']
  const previousBaseUrl = process.env['OPENAI_BASE_URL']

  process.env['OPENAI_API_KEY'] = 'openai-test-key'
  process.env['OPENAI_BASE_URL'] = `http://127.0.0.1:${address.port}`

  try {
    const step1Metadata: DocumentMetadata = {
      title: 'OpenAI OCR Fixture',
      slug: 'openai-ocr-fixture',
      author: 'AutoShow',
      pageCount: 1,
      format: 'png',
      fileSize: 1
    }

    const result = await runOpenAIOcr(imagePath, step1Metadata, 'gpt-5.4-pro')

    expect(result.extractionMethod).toBe('openai-ocr')
    expect(result.totalPages).toBe(1)
    expect(result.promptTokens).toBe(321)
    expect(result.completionTokens).toBe(45)
    expect(result.pages).toEqual([{
      pageNumber: 1,
      method: 'ocr',
      text: 'Recovered OpenAI OCR text.'
    }])

    expect(capturedRequest?.['model']).toBe('gpt-5.4-pro')
    expect(capturedRequest?.['text']).toEqual({
      verbosity: 'low'
    })
  } finally {
    if (previousApiKey === undefined) {
      delete process.env['OPENAI_API_KEY']
    } else {
      process.env['OPENAI_API_KEY'] = previousApiKey
    }

    if (previousBaseUrl === undefined) {
      delete process.env['OPENAI_BASE_URL']
    } else {
      process.env['OPENAI_BASE_URL'] = previousBaseUrl
    }

    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => {
        if (error) {
          rejectClose(error)
          return
        }
        resolveClose()
      })
    })
  }
})
