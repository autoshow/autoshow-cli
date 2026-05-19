import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runBflImageGen } from '~/cli/commands/process-steps/step-5-image/image-services/bfl/run-bfl-image-gen'
import { runMinimaxImageGen } from '~/cli/commands/process-steps/step-5-image/image-services/minimax/run-minimax-image-gen'

type FetchCall = {
  url: string
  method: string
  headers: Headers
  bodyText: string
  bodyJson?: Record<string, unknown> | undefined
}

const originalFetch = globalThis.fetch
const previousEnv: Record<string, string | undefined> = {}
const envKeys = [
  'BFL_API_KEY',
  'BFL_BASE_URL',
  'MINIMAX_API_KEY',
  'MINIMAX_BASE_URL'
]
const tempDirs: string[] = []

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init?.headers as Record<string, string> | undefined)
    }
  })

const imageResponse = (bytes: Uint8Array, contentType: string): Response =>
  new Response(bytes, { headers: { 'content-type': contentType } })

const installFetch = (
  handler: (call: FetchCall) => Promise<Response> | Response
): FetchCall[] => {
  const calls: FetchCall[] = []
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
    const bodyText = typeof init?.body === 'string' ? init.body : ''
    const call: FetchCall = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      bodyText,
      ...(bodyText.trim().startsWith('{') ? { bodyJson: JSON.parse(bodyText) as Record<string, unknown> } : {})
    }
    calls.push(call)
    return await handler(call)
  }) as typeof fetch
  return calls
}

const withTempDir = async <T,>(fn: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-image-provider-rest-'))
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

describe('image provider REST contracts', () => {
  test('BFL image generation sends numbered reference image fields', async () => {
    process.env['BFL_API_KEY'] = 'bfl-key'
    process.env['BFL_BASE_URL'] = 'https://mock.bfl.local'
    const calls = installFetch((call) => {
      if (call.method === 'POST') {
        return jsonResponse({
          id: 'bfl-request',
          polling_url: 'https://mock.bfl.local/poll',
          cost: 0.5
        })
      }
      if (call.url === 'https://mock.bfl.local/poll') {
        return jsonResponse({
          status: 'Ready',
          result: { sample: 'https://mock.bfl.local/result.jpeg' },
          cost: 0.5
        })
      }
      return imageResponse(new Uint8Array([9, 8, 7]), 'image/jpeg')
    })

    await withTempDir(async (dir) => {
      const refPath = join(dir, 'reference.png')
      await writeFile(refPath, new Uint8Array([1, 2, 3]))

      const result = await runBflImageGen('Edit with references', dir, {
        model: 'flux-2-pro-preview',
        outputFormat: 'png',
        inputs: [refPath, 'https://cdn.example.com/reference.webp']
      })

      expect(result.metadata.requestMode).toBe('edit')
      expect(result.metadata.imageFileNames).toEqual(['generated-image.png'])
    })

    expect(calls[0]).toMatchObject({
      url: 'https://mock.bfl.local/v1/flux-2-pro-preview',
      method: 'POST'
    })
    expect(calls[0]?.bodyJson).toMatchObject({
      prompt: 'Edit with references',
      output_format: 'png',
      input_image_2: 'https://cdn.example.com/reference.webp'
    })
    expect(String(calls[0]?.bodyJson?.['input_image'])).toBe(`data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`)
  })

  test('MiniMax image generation sends references, count, and dimensions', async () => {
    process.env['MINIMAX_API_KEY'] = 'minimax-key'
    process.env['MINIMAX_BASE_URL'] = 'https://mock.minimax.local'
    const firstImage = new Uint8Array([1, 2, 3])
    const secondImage = new Uint8Array([4, 5, 6])
    const calls = installFetch(() => jsonResponse({
      data: {
        image_base64: [
          Buffer.from(firstImage).toString('base64'),
          Buffer.from(secondImage).toString('base64')
        ]
      },
      base_resp: { status_code: 0, status_msg: 'success' }
    }))

    await withTempDir(async (dir) => {
      const refPath = join(dir, 'subject.png')
      await writeFile(refPath, new Uint8Array([7, 8, 9]))

      const result = await runMinimaxImageGen('Keep the subject consistent', dir, {
        model: 'image-01',
        count: 2,
        imageSize: '1024x768',
        inputs: [refPath, 'https://cdn.example.com/subject.jpg']
      })

      expect(result.imagePaths).toHaveLength(2)
      expect(result.metadata).toMatchObject({
        imageService: 'minimax',
        imageModel: 'image-01',
        imageCount: 2,
        imageFileNames: ['generated-image.jpeg', 'generated-image-2.jpeg'],
        imageWidth: 1024,
        imageHeight: 768,
        imageSize: '1024x768',
        requestMode: 'edit'
      })
    })

    expect(calls[0]?.url).toBe('https://mock.minimax.local/v1/image_generation')
    expect(calls[0]?.bodyJson).toMatchObject({
      model: 'image-01',
      prompt: 'Keep the subject consistent',
      response_format: 'base64',
      n: 2,
      width: 1024,
      height: 768
    })
    const references = calls[0]?.bodyJson?.['subject_reference'] as Array<Record<string, string>>
    expect(references).toHaveLength(2)
    expect(references[0]?.['type']).toBe('character')
    expect(references[0]?.['image_file']).toBe(`data:image/png;base64,${Buffer.from(new Uint8Array([7, 8, 9])).toString('base64')}`)
    expect(references[1]).toEqual({
      type: 'character',
      image_file: 'https://cdn.example.com/subject.jpg'
    })
  })
})
