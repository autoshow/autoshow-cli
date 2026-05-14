import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { runAnthropicModel } from '~/cli/commands/process-steps/step-3-write/write-services/anthropic/run-anthropic'
import { runMinimaxModel } from '~/cli/commands/process-steps/step-3-write/write-services/minimax/run-minimax'
import type { StructuredRequestOptions } from '~/types'
import {
  ANTHROPIC_FILES_API_BETA,
  createAnthropicMessage,
  deleteAnthropicFile,
  uploadAnthropicFile
} from '~/utils/anthropic/client'

const originalFetch = globalThis.fetch
const previousEnv: Record<string, string | undefined> = {}
const envKeys = ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'MINIMAX_API_KEY']

const structuredOpts: StructuredRequestOptions = {
  schemaName: 'summary',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary'],
    properties: {
      summary: { type: 'string' }
    }
  },
  strict: true,
  strategy: 'native'
}

const restoreEnv = (): void => {
  for (const key of envKeys) {
    if (previousEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = previousEnv[key]
    }
  }
}

beforeEach(() => {
  for (const key of envKeys) {
    previousEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  restoreEnv()
  globalThis.fetch = originalFetch
})

describe('Anthropic REST contracts', () => {
  test('Anthropic write sends documented message headers and extracts text blocks', async () => {
    const calls: Array<{
      url: string
      method: string
      headers: {
        apiKey: string | null
        version: string | null
        contentType: string | null
        beta: string | null
      }
      body: Record<string, unknown>
    }> = []

    process.env['ANTHROPIC_API_KEY'] = 'anthropic-key'
    process.env['ANTHROPIC_BASE_URL'] = 'https://mock.anthropic.local'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const headers = new Headers(init?.headers)
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        headers: {
          apiKey: headers.get('x-api-key'),
          version: headers.get('anthropic-version'),
          contentType: headers.get('content-type'),
          beta: headers.get('anthropic-beta')
        },
        body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      })
      return Response.json({
        id: 'msg_1',
        type: 'message',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'thinking', thinking: 'hidden' },
          { type: 'text', text: 'from Claude.' }
        ],
        usage: { input_tokens: 11, output_tokens: 3 }
      })
    }) as typeof fetch

    const result = await runAnthropicModel('Summarize this.', 'claude-haiku-4-5', structuredOpts)

    expect(result.result).toBe('Hello from Claude.')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: 'https://mock.anthropic.local/v1/messages',
      method: 'POST',
      headers: {
        apiKey: 'anthropic-key',
        version: '2023-06-01',
        contentType: 'application/json',
        beta: null
      },
      body: {
        model: 'claude-haiku-4-5',
        max_tokens: 16000,
        messages: [{ role: 'user', content: 'Summarize this.' }],
        output_config: {
          format: {
            type: 'json_schema',
            schema: structuredOpts.schema
          }
        }
      }
    })
  })

  test('MiniMax uses the Anthropic-compatible messages path without Anthropic structured output', async () => {
    const calls: Array<{ url: string, method: string, apiKey: string | null, body: Record<string, unknown> }> = []

    process.env['MINIMAX_API_KEY'] = 'minimax-key'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        apiKey: new Headers(init?.headers).get('x-api-key'),
        body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      })
      return Response.json({
        content: [{ type: 'text', text: 'MiniMax response.' }],
        usage: { input_tokens: 4, output_tokens: 2 }
      })
    }) as typeof fetch

    const result = await runMinimaxModel('Draft this.', 'MiniMax-M2.5', structuredOpts)

    expect(result.result).toBe('MiniMax response.')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: 'https://api.minimax.io/anthropic/v1/messages',
      method: 'POST',
      apiKey: 'minimax-key',
      body: {
        model: 'MiniMax-M2.5',
        max_tokens: 16000,
        messages: [{ role: 'user', content: 'Draft this.' }]
      }
    })
    expect(calls[0]?.body['output_config']).toBeUndefined()
  })

  test('message responses expose Anthropic usage token fields', async () => {
    globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]): Promise<Response> =>
      Response.json({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 123, output_tokens: 45 }
      })
    ) as typeof fetch

    const message = await createAnthropicMessage(
      { apiKey: 'anthropic-key', baseURL: 'https://mock.anthropic.local/v1' },
      {
        model: 'claude-haiku-4-5',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Hello' }]
      }
    )

    expect(message.usage?.input_tokens).toBe(123)
    expect(message.usage?.output_tokens).toBe(45)
  })

  test('Files upload uses multipart form data with beta header and no manual content-type', async () => {
    const calls: Array<{
      url: string
      method: string
      apiKey: string | null
      version: string | null
      beta: string | null
      contentType: string | null
      fileName: string | undefined
      fileType: string | undefined
      fileSize: number | undefined
    }> = []

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const headers = new Headers(init?.headers)
      const form = init?.body instanceof FormData ? init.body : undefined
      const file = form?.get('file')
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        apiKey: headers.get('x-api-key'),
        version: headers.get('anthropic-version'),
        beta: headers.get('anthropic-beta'),
        contentType: headers.get('content-type'),
        fileName: file instanceof File ? file.name : undefined,
        fileType: file instanceof File ? file.type : undefined,
        fileSize: file instanceof File ? file.size : undefined
      })
      return Response.json({
        id: 'file_123',
        type: 'file',
        filename: 'document.pdf',
        mime_type: 'application/pdf',
        size_bytes: 7,
        created_at: '2025-01-01T00:00:00Z',
        downloadable: false
      })
    }) as typeof fetch

    const uploaded = await uploadAnthropicFile(
      { apiKey: 'anthropic-key', baseURL: 'https://mock.anthropic.local' },
      new File(['pdf-ish'], 'document.pdf', { type: 'application/pdf' })
    )

    expect(uploaded.id).toBe('file_123')
    expect(calls).toEqual([{
      url: 'https://mock.anthropic.local/v1/files',
      method: 'POST',
      apiKey: 'anthropic-key',
      version: '2023-06-01',
      beta: ANTHROPIC_FILES_API_BETA,
      contentType: null,
      fileName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 7
    }])
  })

  test('file-backed PDF messages use beta headers and document file_id sources', async () => {
    const calls: Array<{ url: string, beta: string | null, body: Record<string, unknown> }> = []

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      calls.push({
        url: String(input),
        beta: new Headers(init?.headers).get('anthropic-beta'),
        body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      })
      return Response.json({
        content: [{ type: 'text', text: '{"pages":[{"pageNumber":1,"text":"ok"}]}' }],
        usage: { input_tokens: 10, output_tokens: 5 }
      })
    }) as typeof fetch

    await createAnthropicMessage(
      { apiKey: 'anthropic-key', baseURL: 'https://mock.anthropic.local' },
      {
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'OCR this.' },
            {
              type: 'document',
              source: {
                type: 'file',
                file_id: 'file_123'
              }
            }
          ]
        }]
      },
      { beta: ANTHROPIC_FILES_API_BETA }
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://mock.anthropic.local/v1/messages')
    expect(calls[0]?.beta).toBe(ANTHROPIC_FILES_API_BETA)
    const messages = calls[0]?.body['messages'] as Array<{ content: Array<Record<string, unknown>> }>
    expect(messages[0]?.content[1]).toMatchObject({
      type: 'document',
      source: {
        type: 'file',
        file_id: 'file_123'
      }
    })
    expect(calls[0]?.body['betas']).toBeUndefined()
  })

  test('delete calls DELETE /v1/files/{file_id} with the Files API beta header', async () => {
    const calls: Array<{ url: string, method: string, beta: string | null, contentType: string | null }> = []

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const headers = new Headers(init?.headers)
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        beta: headers.get('anthropic-beta'),
        contentType: headers.get('content-type')
      })
      return Response.json({ id: 'file_123', type: 'file_deleted' })
    }) as typeof fetch

    await deleteAnthropicFile(
      { apiKey: 'anthropic-key', baseURL: 'https://mock.anthropic.local' },
      'file_123'
    )

    expect(calls).toEqual([{
      url: 'https://mock.anthropic.local/v1/files/file_123',
      method: 'DELETE',
      beta: ANTHROPIC_FILES_API_BETA,
      contentType: null
    }])
  })

  test('HTTP errors preserve status, headers, and response body for retry classification', async () => {
    globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]): Promise<Response> =>
      Response.json({
        type: 'error',
        error: {
          type: 'rate_limit_error',
          message: 'slow down'
        }
      }, {
        status: 429,
        headers: { 'retry-after': '7' }
      })
    ) as typeof fetch

    try {
      await createAnthropicMessage(
        { apiKey: 'anthropic-key', baseURL: 'https://mock.anthropic.local' },
        {
          model: 'claude-haiku-4-5',
          max_tokens: 16,
          messages: [{ role: 'user', content: 'Hello' }]
        }
      )
      throw new Error('Expected Anthropic request to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as { status?: number }).status).toBe(429)
      expect((error as { headers?: Headers }).headers?.get('retry-after')).toBe('7')
      expect((error as { body?: string }).body).toContain('rate_limit_error')
      expect((error as { errorType?: string }).errorType).toBe('rate_limit_error')
      expect((error as Error).message).toContain('slow down')
    }
  })
})
