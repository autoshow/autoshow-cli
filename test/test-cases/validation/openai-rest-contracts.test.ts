import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DocumentMetadata, StructuredRequestOptions } from '~/types'
import { runOpenAIOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/openai-ocr/run-openai-ocr'
import { runOpenAICompatibleChatModel } from '~/cli/commands/process-steps/step-3-write/write-services/openai-compatible-chat'
import { runGrokImageGen } from '~/cli/commands/process-steps/step-5-image/image-services/grok/run-grok-image-gen'
import { runOpenAIImageGen } from '~/cli/commands/process-steps/step-5-image/image-services/openai/run-openai-image-gen'
import { createImageOpenAi } from '~/cli/commands/process-steps/step-8-comic/image-services/openai/openai-image-service'
import {
  OpenAIRestError,
  createOpenAIResponse,
  createOpenAISpeech,
  createOpenAITranscription,
  createOpenAIVoiceConsent,
  extractOpenAIResponseText
} from '~/utils/openai/client'

type FetchCall = {
  url: string
  method: string
  headers: Headers
  bodyText: string
  bodyJson?: Record<string, unknown> | undefined
  form?: FormData | undefined
}

const originalFetch = globalThis.fetch
const previousEnv: Record<string, string | undefined> = {}
const envKeys = ['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'XAI_API_KEY']
const tempDirs: string[] = []

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

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init?.headers as Record<string, string> | undefined)
    }
  })

const readBody = async (body: RequestInit['body'] | null | undefined): Promise<{ text: string, form?: FormData | undefined }> => {
  if (typeof body === 'string') {
    return { text: body }
  }
  if (body instanceof FormData) {
    return { text: '', form: body }
  }
  return { text: '' }
}

const installFetch = (
  handler: (call: FetchCall) => Promise<Response> | Response
): FetchCall[] => {
  const calls: FetchCall[] = []
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
    const { text, form } = await readBody(init?.body)
    const call: FetchCall = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      bodyText: text,
      ...(text.trim().startsWith('{') ? { bodyJson: JSON.parse(text) as Record<string, unknown> } : {}),
      ...(form ? { form } : {})
    }
    calls.push(call)
    return await handler(call)
  }) as typeof fetch
  return calls
}

const withTempDir = async <T,>(fn: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-openai-rest-'))
  tempDirs.push(dir)
  return await fn(dir)
}

beforeEach(() => {
  for (const key of envKeys) {
    previousEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  for (const key of envKeys) {
    if (previousEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = previousEnv[key]
    }
  }
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('OpenAI REST contracts', () => {
  test('Responses requests use bearer JSON REST and extract output_text content parts', async () => {
    const calls = installFetch(() => jsonResponse({
      output: [{
        type: 'message',
        content: [
          { type: 'output_text', text: 'Hello ' },
          { type: 'refusal', text: 'hidden' },
          { type: 'output_text', text: 'from REST.' }
        ]
      }],
      usage: { input_tokens: 5, output_tokens: 3 }
    }))

    const response = await createOpenAIResponse(
      { apiKey: 'openai-key', baseURL: 'https://mock.openai.local/v1/' },
      { model: 'gpt-5.4', input: 'Hello', stream: false }
    )

    expect(extractOpenAIResponseText(response)).toBe('Hello from REST.')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: 'https://mock.openai.local/v1/responses',
      method: 'POST',
      bodyJson: { model: 'gpt-5.4', input: 'Hello', stream: false }
    })
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer openai-key')
    expect(calls[0]?.headers.get('content-type')).toBe('application/json')
  })

  test('REST errors preserve status, headers, body, and parsed OpenAI error fields', async () => {
    installFetch(() => jsonResponse({
      error: {
        message: 'try later',
        type: 'rate_limit_error',
        code: 'rate_limit_exceeded',
        param: 'model'
      }
    }, {
      status: 429,
      headers: { 'retry-after': '2' }
    }))

    await expect(createOpenAIResponse(
      { apiKey: 'openai-key', baseURL: 'https://mock.openai.local' },
      { model: 'gpt-5.4', input: 'retry?' }
    )).rejects.toThrow('OpenAI Responses request failed (429): try later')

    try {
      await createOpenAIResponse(
        { apiKey: 'openai-key', baseURL: 'https://mock.openai.local' },
        { model: 'gpt-5.4', input: 'retry?' }
      )
      throw new Error('expected request to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(OpenAIRestError)
      expect((error as OpenAIRestError).status).toBe(429)
      expect((error as OpenAIRestError).headers.get('retry-after')).toBe('2')
      expect((error as OpenAIRestError).body).toContain('rate_limit_exceeded')
      expect((error as OpenAIRestError).code).toBe('rate_limit_exceeded')
      expect((error as OpenAIRestError).param).toBe('model')
      expect((error as OpenAIRestError).type).toBe('rate_limit_error')
    }
  })

  test('OpenAI-compatible chat retries without response_format after structured fallback error', async () => {
    const calls = installFetch((call) => {
      if (calls.length === 1) {
        expect(call.bodyJson?.['response_format']).toMatchObject({
          type: 'json_schema'
        })
        return jsonResponse({
          error: {
            message: 'response_format is not supported',
            type: 'invalid_request_error',
            param: 'response_format'
          }
        }, { status: 400 })
      }

      expect(call.bodyJson?.['response_format']).toBeUndefined()
      return jsonResponse({
        choices: [{ message: { content: '{"summary":"fallback"}' } }],
        usage: { prompt_tokens: 4, completion_tokens: 2 }
      })
    })

    const result = await runOpenAICompatibleChatModel({
      prompt: 'Summarize this.',
      model: 'grok-test',
      structuredOpts,
      config: { apiKey: 'xai-key', baseURL: 'https://mock.xai.local/v1' },
      service: 'grok',
      providerLabel: 'Grok',
      operationName: 'grok-rest-test'
    })

    expect(result.result).toBe('{"summary":"fallback"}')
    expect(calls).toHaveLength(2)
    expect(calls.map((call) => call.url)).toEqual([
      'https://mock.xai.local/v1/chat/completions',
      'https://mock.xai.local/v1/chat/completions'
    ])
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer xai-key')
  })

  test('Speech, transcription, and voice consent helpers use binary and multipart REST bodies', async () => {
    const speechBytes = new Uint8Array([1, 2, 3])
    const calls = installFetch((call) => {
      if (call.url.endsWith('/audio/speech')) {
        expect(call.headers.get('content-type')).toBe('application/json')
        return new Response(speechBytes, { status: 200, headers: { 'content-type': 'audio/wav' } })
      }
      return jsonResponse({ text: 'hello', id: 'cons_123' })
    })

    const speech = await createOpenAISpeech(
      { apiKey: 'openai-key', baseURL: 'https://mock.openai.local/v1' },
      { model: 'gpt-4o-mini-tts', voice: 'alloy', input: 'hello', response_format: 'wav' }
    )
    const form = new FormData()
    form.append('model', 'gpt-4o-transcribe')
    form.append('file', new File(['audio'], 'audio.mp3', { type: 'audio/mpeg' }), 'audio.mp3')
    await createOpenAITranscription({ apiKey: 'openai-key', baseURL: 'https://mock.openai.local/v1' }, form)

    const consent = new FormData()
    consent.append('name', 'Consent')
    consent.append('language', 'en-US')
    consent.append('recording', new File(['audio'], 'consent.wav', { type: 'audio/wav' }), 'consent.wav')
    await createOpenAIVoiceConsent({ apiKey: 'openai-key', baseURL: 'https://mock.openai.local/v1' }, consent)

    expect(Array.from(speech)).toEqual([1, 2, 3])
    expect(calls).toHaveLength(3)
    expect(calls[1]).toMatchObject({
      url: 'https://mock.openai.local/v1/audio/transcriptions',
      method: 'POST'
    })
    expect(calls[1]?.headers.get('content-type')).toBeNull()
    expect(calls[1]?.form?.get('file')).toBeInstanceOf(File)
    expect(calls[2]).toMatchObject({
      url: 'https://mock.openai.local/v1/audio/voice_consents',
      method: 'POST'
    })
    expect(calls[2]?.headers.get('content-type')).toBeNull()
    expect(calls[2]?.form?.get('recording')).toBeInstanceOf(File)
  })

  test('OpenAI image generation decodes b64_json output and preserves image options', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    process.env['OPENAI_BASE_URL'] = 'https://mock.openai.local/v1'
    const imageBytes = new Uint8Array([9, 8, 7])
    const calls = installFetch(() => jsonResponse({
      data: [{ b64_json: Buffer.from(imageBytes).toString('base64') }]
    }))

    await withTempDir(async (dir) => {
      const result = await runOpenAIImageGen('A test image', dir, {
        model: 'gpt-image-2',
        size: '1024x1024',
        quality: 'high',
        outputFormat: 'webp',
        background: 'opaque'
      })

      expect(result.imagePaths).toHaveLength(1)
      expect(new Uint8Array(await Bun.file(result.imagePaths[0]!).arrayBuffer())).toEqual(imageBytes)
      expect(result.metadata).toMatchObject({
        imageService: 'openai',
        imageModel: 'gpt-image-2',
        imageFileNames: ['generated-image.webp'],
        imageSize: '1024x1024',
        imageQuality: 'high',
        imageFormat: 'webp'
      })
    })

    expect(calls[0]?.bodyJson).toMatchObject({
      model: 'gpt-image-2',
      prompt: 'A test image',
      n: 1,
      size: '1024x1024',
      quality: 'high',
      output_format: 'webp',
      background: 'opaque'
    })
  })

  test('OpenAI image generation writes multiple returned images', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    process.env['OPENAI_BASE_URL'] = 'https://mock.openai.local/v1'
    const firstImage = new Uint8Array([1, 2, 3])
    const secondImage = new Uint8Array([4, 5, 6])
    const calls = installFetch(() => jsonResponse({
      data: [
        { b64_json: Buffer.from(firstImage).toString('base64'), revised_prompt: 'A refined prompt' },
        { b64_json: Buffer.from(secondImage).toString('base64') }
      ],
      model: 'gpt-image-1.5-actual'
    }))

    await withTempDir(async (dir) => {
      const result = await runOpenAIImageGen('A test image', dir, {
        model: 'gpt-image-1.5',
        count: 2,
        outputFormat: 'png'
      })

      expect(result.imagePaths.map((imagePath) => imagePath.endsWith('.png'))).toEqual([true, true])
      expect(result.metadata).toMatchObject({
        imageService: 'openai',
        imageModel: 'gpt-image-1.5',
        imageCount: 2,
        imageFileNames: ['generated-image.png', 'generated-image-2.png'],
        revisedPrompt: 'A refined prompt',
        providerReturnedModel: 'gpt-image-1.5-actual',
        requestMode: 'generation'
      })
    })

    expect(calls[0]?.bodyJson).toMatchObject({
      n: 2
    })
  })

  test('OpenAI image edit routes through multipart edits endpoint', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    process.env['OPENAI_BASE_URL'] = 'https://mock.openai.local/v1'
    const imageBytes = new Uint8Array([7, 7, 7])
    const calls = installFetch(() => jsonResponse({
      data: [{ b64_json: Buffer.from(imageBytes).toString('base64') }]
    }))

    await withTempDir(async (dir) => {
      const refPath = join(dir, 'reference.png')
      await writeFile(refPath, new Uint8Array([1, 2, 3]))

      const result = await runOpenAIImageGen('Edit this image', dir, {
        model: 'gpt-image-1.5',
        mode: 'edit',
        inputs: [refPath],
        count: 1,
        outputFormat: 'webp',
        compression: 75
      })

      expect(result.metadata.requestMode).toBe('edit')
      expect(result.metadata.imageFileNames).toEqual(['generated-image.webp'])
    })

    expect(calls[0]).toMatchObject({
      url: 'https://mock.openai.local/v1/images/edits',
      method: 'POST'
    })
    expect(calls[0]?.form?.get('model')).toBe('gpt-image-1.5')
    expect(calls[0]?.form?.get('prompt')).toBe('Edit this image')
    expect(calls[0]?.form?.get('output_compression')).toBe('75')
    expect(calls[0]?.form?.getAll('image')).toHaveLength(1)
  })

  test('Grok image generation captures provider usage cost and returned model metadata', async () => {
    process.env['XAI_API_KEY'] = 'xai-key'
    const imageBytes = new Uint8Array([9, 9, 9])
    const calls = installFetch(() => jsonResponse({
      data: [{
        b64_json: Buffer.from(imageBytes).toString('base64'),
        mime_type: 'image/jpeg',
        revised_prompt: 'A sharper prompt',
        respect_moderation: true
      }],
      model: 'grok-imagine-image-quality-actual',
      usage: { cost_in_usd_ticks: 200_000_000 }
    }))

    await withTempDir(async (dir) => {
      const result = await runGrokImageGen('A test image', dir, {
        model: 'grok-imagine-image-quality',
        count: 2,
        aspectRatio: '16:9',
        imageSize: '2K'
      })

      expect(result.metadata).toMatchObject({
        imageService: 'grok',
        imageModel: 'grok-imagine-image-quality',
        imageCount: 1,
        imageFileNames: ['generated-image.jpg'],
        revisedPrompt: 'A sharper prompt',
        providerReturnedModel: 'grok-imagine-image-quality-actual',
        usageCostRaw: 200_000_000,
        providerCostCents: 2,
        providerCostSource: 'provider_usage',
        providerModeration: true,
        requestMode: 'generation'
      })
    })

    expect(calls[0]?.url).toBe('https://api.x.ai/v1/images/generations')
    expect(calls[0]?.bodyJson).toMatchObject({
      model: 'grok-imagine-image-quality',
      n: 2,
      aspect_ratio: '16:9',
      resolution: '2k'
    })
  })

  test('OpenAI comic image edits use multipart REST with repeated image files', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    process.env['OPENAI_BASE_URL'] = 'https://mock.openai.local/v1'
    const imageBytes = new Uint8Array([3, 4, 5])
    const calls = installFetch(() => jsonResponse({
      data: [{ b64_json: Buffer.from(imageBytes).toString('base64') }],
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      size: '1024x1024',
      quality: 'high'
    }))

    await withTempDir(async (dir) => {
      const firstRef = join(dir, 'front.png')
      const secondRef = join(dir, 'profile.png')
      await writeFile(firstRef, new Uint8Array([1, 2, 3]))
      await writeFile(secondRef, new Uint8Array([4, 5, 6]))

      const result = await createImageOpenAi(
        'Keep character design consistent.',
        [firstRef, secondRef],
        'gpt-image-1.5',
        '1024x1024',
        'high'
      )

      expect(result.mode).toBe('edit')
      expect(result.inputFidelity).toBe('high')
      expect(result.result.imageBase64).toBe(Buffer.from(imageBytes).toString('base64'))
      expect(result.result.providerSizeLabel).toBe('1024x1024')
      expect(result.result.providerQualityLabel).toBe('high')
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: 'https://mock.openai.local/v1/images/edits',
      method: 'POST'
    })
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer openai-key')
    expect(calls[0]?.headers.get('content-type')).toBeNull()
    expect(calls[0]?.form?.get('model')).toBe('gpt-image-1.5')
    expect(calls[0]?.form?.get('prompt')).toBe('Keep character design consistent.')
    expect(calls[0]?.form?.get('n')).toBe('1')
    expect(calls[0]?.form?.get('size')).toBe('1024x1024')
    expect(calls[0]?.form?.get('quality')).toBe('high')
    expect(calls[0]?.form?.get('output_format')).toBe('png')
    expect(calls[0]?.form?.get('input_fidelity')).toBe('high')
    const images = calls[0]?.form?.getAll('image[]') ?? []
    expect(images).toHaveLength(2)
    expect(images.every((image) => image instanceof File)).toBe(true)
  })

  test('OpenAI OCR sends data URLs and returns response usage token metadata', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    process.env['OPENAI_BASE_URL'] = 'https://mock.openai.local/v1'
    const calls = installFetch(() => jsonResponse({
      output_text: JSON.stringify({ pages: [{ pageNumber: 1, text: 'OCR text' }] }),
      usage: { input_tokens: 123, output_tokens: 45 }
    }))

    await withTempDir(async (dir) => {
      const imagePath = join(dir, 'page.png')
      await writeFile(imagePath, new Uint8Array([1, 2, 3]))
      const metadata: DocumentMetadata = {
        slug: 'page',
        pageCount: 1,
        format: 'png',
        fileSize: 3
      }

      const result = await runOpenAIOcr(imagePath, metadata, 'gpt-5.4')

      expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'OCR text' }])
      expect(result.promptTokens).toBe(123)
      expect(result.completionTokens).toBe(45)
      expect(calls).toHaveLength(1)
      const input = calls[0]?.bodyJson?.['input'] as Array<Record<string, unknown>>
      const content = input[0]?.['content'] as Array<Record<string, unknown>>
      expect(content[1]).toMatchObject({
        type: 'input_image',
        detail: 'high',
        image_url: `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`
      })
    })
  })

  test('OpenAI single-page PDF OCR requests plain text instead of a JSON envelope', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    process.env['OPENAI_BASE_URL'] = 'https://mock.openai.local/v1'
    const calls = installFetch(() => jsonResponse({
      output_text: 'Plain OCR text',
      usage: { input_tokens: 12, output_tokens: 3 }
    }))

    await withTempDir(async (dir) => {
      const pdfPath = join(dir, 'page.pdf')
      await writeFile(pdfPath, new Uint8Array([1, 2, 3]))
      const metadata: DocumentMetadata = {
        slug: 'page',
        pageCount: 1,
        format: 'pdf',
        fileSize: 3
      }

      const result = await runOpenAIOcr(pdfPath, metadata, 'gpt-5.4')

      expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'Plain OCR text' }])
      const body = calls[0]?.bodyJson
      expect(body?.['text']).toEqual({ verbosity: 'low' })
      const input = body?.['input'] as Array<Record<string, unknown>>
      const content = input[0]?.['content'] as Array<Record<string, unknown>>
      expect(content[0]?.['text']).toContain('Return only the visible text')
      expect(content[0]?.['text']).not.toContain('Return only JSON')
      expect(content[1]).toMatchObject({
        type: 'input_file',
        filename: 'document.pdf'
      })
    })
  })

  test('OpenAI single-page OCR accepts empty model output as a blank page', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    process.env['OPENAI_BASE_URL'] = 'https://mock.openai.local/v1'
    const calls = installFetch(() => jsonResponse({
      output_text: '',
      usage: { input_tokens: 9, output_tokens: 0 }
    }))

    await withTempDir(async (dir) => {
      const pdfPath = join(dir, 'blank.pdf')
      await writeFile(pdfPath, new Uint8Array([1, 2, 3]))
      const metadata: DocumentMetadata = {
        slug: 'blank',
        pageCount: 1,
        format: 'pdf',
        fileSize: 3
      }

      const result = await runOpenAIOcr(pdfPath, metadata, 'gpt-5.4')

      expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: '' }])
      expect(result.promptTokens).toBe(9)
      expect(result.completionTokens).toBe(0)
      expect(calls).toHaveLength(1)
    })
  })
})
