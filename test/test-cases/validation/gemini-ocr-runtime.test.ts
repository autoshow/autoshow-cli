import { afterEach, expect, test } from 'bun:test'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdtemp, open, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DocumentMetadata } from '~/types'
import { runGeminiOcr } from '~/cli/commands/process-steps/step-2-ocr/ocr-services/gemini-ocr/run-gemini-ocr'
import { GEMINI_INLINE_PDF_BYTES } from '~/cli/commands/process-steps/step-2-ocr/ocr-services/gemini-ocr/gemini'
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

test('runGeminiOcr sends inline image bytes and parses usage metadata', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-gemini-ocr-inline-'))
  cleanupPaths.add(tempDir)

  const imagePath = join(tempDir, 'page.png')
  await ensurePageImageFixture(imagePath)

  let capturedGenerateBody = ''

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    if (req.method === 'POST' && url.pathname === '/v1beta/models/gemini-3.1-flash-lite-preview:generateContent') {
      capturedGenerateBody = await readRequestBody(req)

      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        candidates: [{
          content: {
            role: 'model',
            parts: [{
              text: JSON.stringify({
                pages: [{
                  pageNumber: 1,
                  text: 'Recovered Gemini OCR text.'
                }]
              })
            }]
          },
          finishReason: 'STOP',
          index: 0
        }],
        usageMetadata: {
          promptTokenCount: 321,
          candidatesTokenCount: 45,
          totalTokenCount: 366
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
    throw new Error('Failed to start local Gemini OCR test server')
  }

  const previousApiKey = process.env['GEMINI_API_KEY']
  const previousBaseUrl = process.env['GEMINI_BASE_URL']

  process.env['GEMINI_API_KEY'] = 'gemini-test-key'
  process.env['GEMINI_BASE_URL'] = `http://127.0.0.1:${address.port}`

  try {
    const step1Metadata: DocumentMetadata = {
      title: 'Gemini OCR Fixture',
      slug: 'gemini-ocr-fixture',
      author: 'AutoShow',
      pageCount: 1,
      format: 'png',
      fileSize: 1
    }

    const result = await runGeminiOcr(imagePath, step1Metadata, 'gemini-3.1-flash-lite-preview')

    expect(result.extractionMethod).toBe('gemini-ocr')
    expect(result.totalPages).toBe(1)
    expect(result.promptTokens).toBe(321)
    expect(result.completionTokens).toBe(45)
    expect(result.pages).toEqual([{
      pageNumber: 1,
      method: 'ocr',
      text: 'Recovered Gemini OCR text.'
    }])

    expect(capturedGenerateBody).toContain('"inlineData"')
    expect(capturedGenerateBody).toContain('Perform OCR on the provided document or image.')
  } finally {
    if (previousApiKey === undefined) {
      delete process.env['GEMINI_API_KEY']
    } else {
      process.env['GEMINI_API_KEY'] = previousApiKey
    }

    if (previousBaseUrl === undefined) {
      delete process.env['GEMINI_BASE_URL']
    } else {
      process.env['GEMINI_BASE_URL'] = previousBaseUrl
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

test('runGeminiOcr uploads oversized PDFs through the Files API and ignores delete failures', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-gemini-ocr-upload-'))
  cleanupPaths.add(tempDir)

  const pdfPath = join(tempDir, 'large.pdf')
  await Bun.write(pdfPath, await Bun.file('input/examples/document/1-document.pdf').arrayBuffer())
  const fileHandle = await open(pdfPath, 'r+')
  try {
    await fileHandle.truncate(GEMINI_INLINE_PDF_BYTES + 1)
  } finally {
    await fileHandle.close()
  }

  let uploadStarted = 0
  let uploadChunkCalls = 0
  let uploadFinalized = 0
  let deleteCalls = 0
  let capturedGenerateBody = ''
  let serverPort = 0

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    if (req.method === 'POST' && url.pathname === '/upload/v1beta/files') {
      uploadStarted += 1
      await readRequestBody(req)
      res.statusCode = 200
      res.setHeader('x-goog-upload-url', `http://127.0.0.1:${serverPort}/upload-session/gemini-test-file`)
      res.setHeader('content-type', 'application/json')
      res.end('{}')
      return
    }

    if (req.method === 'POST' && url.pathname === '/upload-session/gemini-test-file') {
      const uploadCommand = String(req.headers['x-goog-upload-command'] ?? '')
      await readRequestBody(req)

      res.statusCode = 200
      res.setHeader('content-type', 'application/json')

      if (uploadCommand.includes('finalize')) {
        uploadFinalized += 1
        res.setHeader('x-goog-upload-status', 'final')
        res.end(JSON.stringify({
          file: {
            name: 'files/gemini-test-file',
            uri: 'https://generativelanguage.googleapis.com/v1beta/files/gemini-test-file',
            mimeType: 'application/pdf'
          }
        }))
        return
      }

      uploadChunkCalls += 1
      res.setHeader('x-goog-upload-status', 'active')
      res.end('{}')
      return
    }

    if (req.method === 'POST' && url.pathname === '/v1beta/models/gemini-3.1-flash-lite-preview:generateContent') {
      capturedGenerateBody = await readRequestBody(req)

      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        candidates: [{
          content: {
            role: 'model',
            parts: [{
              text: JSON.stringify({
                pages: [{
                  pageNumber: 1,
                  text: 'Recovered Gemini OCR upload text.'
                }]
              })
            }]
          },
          finishReason: 'STOP',
          index: 0
        }],
        usageMetadata: {
          promptTokenCount: 222,
          candidatesTokenCount: 33,
          totalTokenCount: 255
        }
      }))
      return
    }

    if (req.method === 'DELETE' && url.pathname === '/v1beta/files/gemini-test-file') {
      deleteCalls += 1
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

    res.statusCode = 404
    res.end('not found')
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start local Gemini OCR upload test server')
  }
  serverPort = address.port

  const previousApiKey = process.env['GEMINI_API_KEY']
  const previousBaseUrl = process.env['GEMINI_BASE_URL']

  process.env['GEMINI_API_KEY'] = 'gemini-test-key'
  process.env['GEMINI_BASE_URL'] = `http://127.0.0.1:${serverPort}`

  try {
    const step1Metadata: DocumentMetadata = {
      title: 'Gemini OCR Upload Fixture',
      slug: 'gemini-ocr-upload-fixture',
      author: 'AutoShow',
      pageCount: 1,
      format: 'pdf',
      fileSize: GEMINI_INLINE_PDF_BYTES + 1
    }

    const result = await runGeminiOcr(pdfPath, step1Metadata, 'gemini-3.1-flash-lite-preview')

    expect(result.extractionMethod).toBe('gemini-ocr')
    expect(result.totalPages).toBe(1)
    expect(result.promptTokens).toBe(222)
    expect(result.completionTokens).toBe(33)
    expect(result.pages).toEqual([{
      pageNumber: 1,
      method: 'ocr',
      text: 'Recovered Gemini OCR upload text.'
    }])

    expect(uploadStarted).toBe(1)
    expect(uploadChunkCalls).toBeGreaterThan(0)
    expect(uploadFinalized).toBe(1)
    expect(deleteCalls).toBe(1)
    expect(capturedGenerateBody).toContain('"fileData"')
    expect(capturedGenerateBody).toContain('https://generativelanguage.googleapis.com/v1beta/files/gemini-test-file')
  } finally {
    if (previousApiKey === undefined) {
      delete process.env['GEMINI_API_KEY']
    } else {
      process.env['GEMINI_API_KEY'] = previousApiKey
    }

    if (previousBaseUrl === undefined) {
      delete process.env['GEMINI_BASE_URL']
    } else {
      process.env['GEMINI_BASE_URL'] = previousBaseUrl
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
}, 60_000)
