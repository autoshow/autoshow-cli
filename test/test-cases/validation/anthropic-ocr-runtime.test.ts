import { afterEach, expect, test } from 'bun:test'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DocumentMetadata } from '~/types'
import { runAnthropicOcr } from '~/cli/commands/process-steps/step-2-ocr/ocr-services/anthropic-ocr/run-anthropic-ocr'
import {
  ANTHROPIC_OCR_FILES_BETA,
  ANTHROPIC_OCR_MAX_TOKENS
} from '~/cli/commands/process-steps/step-2-ocr/ocr-services/anthropic-ocr/anthropic-ocr'
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

const withAnthropicEnv = async (
  baseURL: string,
  run: () => Promise<void>
): Promise<void> => {
  const previousApiKey = process.env['ANTHROPIC_API_KEY']
  const previousBaseUrl = process.env['ANTHROPIC_BASE_URL']

  process.env['ANTHROPIC_API_KEY'] = 'anthropic-test-key'
  process.env['ANTHROPIC_BASE_URL'] = baseURL

  try {
    await run()
  } finally {
    if (previousApiKey === undefined) {
      delete process.env['ANTHROPIC_API_KEY']
    } else {
      process.env['ANTHROPIC_API_KEY'] = previousApiKey
    }

    if (previousBaseUrl === undefined) {
      delete process.env['ANTHROPIC_BASE_URL']
    } else {
      process.env['ANTHROPIC_BASE_URL'] = previousBaseUrl
    }
  }
}

const closeServer = async (server: ReturnType<typeof createServer>): Promise<void> => {
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

test('runAnthropicOcr sends inline image bytes and retries malformed JSON once', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-anthropic-ocr-inline-'))
  cleanupPaths.add(tempDir)

  const imagePath = join(tempDir, 'page.png')
  await ensurePageImageFixture(imagePath)

  let messageCalls = 0
  const capturedBodies: Array<Record<string, unknown>> = []
  const capturedPaths: string[] = []

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    if (req.method === 'POST' && url.pathname === '/v1/messages' && url.searchParams.get('beta') === 'true') {
      messageCalls += 1
      capturedPaths.push(req.url ?? '')
      capturedBodies.push(JSON.parse(await readRequestBody(req)) as Record<string, unknown>)

      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        id: `msg_${messageCalls}`,
        type: 'message',
        role: 'assistant',
        model: 'claude-haiku-4-5',
        stop_reason: 'end_turn',
        stop_sequence: null,
        content: [{
          type: 'text',
          text: messageCalls === 1
            ? 'not valid json'
            : JSON.stringify({
                pages: [{
                  pageNumber: 1,
                  text: 'Recovered Anthropic OCR text.'
                }]
              })
        }],
        usage: {
          input_tokens: messageCalls === 1 ? 111 : 321,
          output_tokens: messageCalls === 1 ? 11 : 45
        }
      }))
      return
    }

    res.statusCode = 404
    res.end('not found')
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start local Anthropic OCR test server')
  }

  try {
    await withAnthropicEnv(`http://127.0.0.1:${address.port}`, async () => {
      const step1Metadata: DocumentMetadata = {
        title: 'Anthropic OCR Fixture',
        slug: 'anthropic-ocr-fixture',
        author: 'AutoShow',
        pageCount: 1,
        format: 'png',
        fileSize: 1
      }

      const result = await runAnthropicOcr(imagePath, step1Metadata, 'claude-haiku-4-5')

      expect(result.extractionMethod).toBe('anthropic-ocr')
      expect(result.totalPages).toBe(1)
      expect(result.promptTokens).toBe(321)
      expect(result.completionTokens).toBe(45)
      expect(result.pages).toEqual([{
        pageNumber: 1,
        method: 'ocr',
        text: 'Recovered Anthropic OCR text.'
      }])
    })

    expect(messageCalls).toBe(2)
    expect(capturedPaths).toEqual(['/v1/messages?beta=true', '/v1/messages?beta=true'])

    const firstRequest = capturedBodies[0]
    expect(firstRequest?.['model']).toBe('claude-haiku-4-5')
    expect(firstRequest?.['max_tokens']).toBe(ANTHROPIC_OCR_MAX_TOKENS)
    expect(JSON.stringify(firstRequest?.['messages'])).toContain('"type":"image"')
    expect(JSON.stringify(firstRequest?.['messages'])).toContain('Perform OCR on the provided document or image.')
    expect(JSON.stringify(firstRequest?.['messages'])).toContain('"media_type":"image/png"')
  } finally {
    await closeServer(server)
  }
})

test('runAnthropicOcr uploads PDF chunks through the Files API, rebases page numbers, and ignores delete failures', async () => {
  let uploadCalls = 0
  let messageCalls = 0
  let deleteCalls = 0
  const uploadBetaHeaders: string[] = []
  const messageBetaHeaders: string[] = []
  const capturedMessageBodies: Array<Record<string, unknown>> = []

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    if (req.method === 'POST' && url.pathname === '/v1/files') {
      uploadCalls += 1
      uploadBetaHeaders.push(String(req.headers['anthropic-beta'] ?? ''))
      await readRequestBody(req)
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        id: `file_${uploadCalls}`,
        type: 'file',
        filename: `chunk-${uploadCalls}.pdf`
      }))
      return
    }

    if (req.method === 'POST' && url.pathname === '/v1/messages' && url.searchParams.get('beta') === 'true') {
      messageCalls += 1
      messageBetaHeaders.push(String(req.headers['anthropic-beta'] ?? ''))
      capturedMessageBodies.push(JSON.parse(await readRequestBody(req)) as Record<string, unknown>)

      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        id: `msg_pdf_${messageCalls}`,
        type: 'message',
        role: 'assistant',
        model: 'claude-haiku-4-5',
        stop_reason: 'end_turn',
        stop_sequence: null,
        content: [{
          type: 'text',
          text: JSON.stringify({
            pages: Array.from({ length: 10 }, (_, index) => ({
              pageNumber: index + 1,
              text: `Chunk ${messageCalls} page ${index + 1}`
            }))
          })
        }],
        usage: {
          input_tokens: messageCalls * 100,
          output_tokens: messageCalls * 10
        }
      }))
      return
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/v1/files/')) {
      deleteCalls += 1
      if (deleteCalls === 1) {
        res.statusCode = 500
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({
          error: {
            message: 'delete failed',
            status: 'INTERNAL',
            code: 500
          }
        }))
        return
      }

      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end('{}')
      return
    }

    res.statusCode = 404
    res.end('not found')
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start local Anthropic OCR PDF test server')
  }

  try {
    await withAnthropicEnv(`http://127.0.0.1:${address.port}`, async () => {
      const step1Metadata: DocumentMetadata = {
        title: 'Anthropic OCR PDF Fixture',
        slug: 'anthropic-ocr-pdf-fixture',
        author: 'AutoShow',
        pageCount: 30,
        format: 'pdf',
        fileSize: 1
      }

      const result = await runAnthropicOcr('input/examples/document/30-document.pdf', step1Metadata, 'claude-haiku-4-5')

      expect(result.extractionMethod).toBe('anthropic-ocr')
      expect(result.totalPages).toBe(30)
      expect(result.promptTokens).toBe(600)
      expect(result.completionTokens).toBe(60)
      expect(result.pages).toHaveLength(30)
      expect(result.pages[0]).toEqual({
        pageNumber: 1,
        method: 'ocr',
        text: 'Chunk 1 page 1'
      })
      expect(result.pages[9]).toEqual({
        pageNumber: 10,
        method: 'ocr',
        text: 'Chunk 1 page 10'
      })
      expect(result.pages[10]).toEqual({
        pageNumber: 11,
        method: 'ocr',
        text: 'Chunk 2 page 1'
      })
      expect(result.pages[29]).toEqual({
        pageNumber: 30,
        method: 'ocr',
        text: 'Chunk 3 page 10'
      })
    })

    expect(uploadCalls).toBe(3)
    expect(messageCalls).toBe(3)
    expect(deleteCalls).toBe(3)
    expect(uploadBetaHeaders.every((value) => value.includes(ANTHROPIC_OCR_FILES_BETA))).toBe(true)
    expect(messageBetaHeaders.every((value) => value.includes(ANTHROPIC_OCR_FILES_BETA))).toBe(true)
    expect(JSON.stringify(capturedMessageBodies[0]?.['messages'])).toContain('"type":"document"')
    expect(JSON.stringify(capturedMessageBodies[0]?.['messages'])).toContain('"file_id":"file_1"')
  } finally {
    await closeServer(server)
  }
})

test('runAnthropicOcr rejects incomplete PDF chunk output after retrying once', async () => {
  let uploadCalls = 0
  let messageCalls = 0
  let deleteCalls = 0

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    if (req.method === 'POST' && url.pathname === '/v1/files') {
      uploadCalls += 1
      await readRequestBody(req)
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        id: 'file_incomplete',
        type: 'file',
        filename: 'chunk.pdf'
      }))
      return
    }

    if (req.method === 'POST' && url.pathname === '/v1/messages' && url.searchParams.get('beta') === 'true') {
      messageCalls += 1
      await readRequestBody(req)
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        id: `msg_incomplete_${messageCalls}`,
        type: 'message',
        role: 'assistant',
        model: 'claude-haiku-4-5',
        stop_reason: 'end_turn',
        stop_sequence: null,
        content: [{
          type: 'text',
          text: JSON.stringify({
            pages: [
              { pageNumber: 1, text: 'Page 1' },
              { pageNumber: 2, text: 'Page 2' }
            ]
          })
        }],
        usage: {
          input_tokens: 222,
          output_tokens: 33
        }
      }))
      return
    }

    if (req.method === 'DELETE' && url.pathname === '/v1/files/file_incomplete') {
      deleteCalls += 1
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end('{}')
      return
    }

    res.statusCode = 404
    res.end('not found')
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start local Anthropic OCR truncation test server')
  }

  try {
    await withAnthropicEnv(`http://127.0.0.1:${address.port}`, async () => {
      const step1Metadata: DocumentMetadata = {
        title: 'Anthropic OCR Truncation Fixture',
        slug: 'anthropic-ocr-truncation-fixture',
        author: 'AutoShow',
        pageCount: 3,
        format: 'pdf',
        fileSize: 1
      }

      await expect(
        runAnthropicOcr('input/examples/document/3-document.pdf', step1Metadata, 'claude-haiku-4-5')
      ).rejects.toThrow('Anthropic OCR returned 2 pages for pages 1-3, expected 3. Split the document into smaller chunks and retry.')
    })

    expect(uploadCalls).toBe(1)
    expect(messageCalls).toBe(2)
    expect(deleteCalls).toBe(1)
  } finally {
    await closeServer(server)
  }
})
