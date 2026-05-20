import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runBflImageGen } from '~/cli/commands/process-steps/step-5-image/image-services/bfl/run-bfl-image-gen'
import { runMinimaxImageGen } from '~/cli/commands/process-steps/step-5-image/image-services/minimax/run-minimax-image-gen'
import { runReveImageGen } from '~/cli/commands/process-steps/step-5-image/image-services/reve/run-reve-image-gen'

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
  'MINIMAX_BASE_URL',
  'REVE_API_KEY',
  'REVE_BASE_URL'
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
  test('Reve create sends JSON body, image accept header, and records returned version and credit cost', async () => {
    process.env['REVE_API_KEY'] = 'reve-key'
    process.env['REVE_BASE_URL'] = 'https://mock.reve.local'
    const calls = installFetch(() =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: {
          'content-type': 'image/webp',
          'x-reve-version': 'reve-create@20250915',
          'x-reve-credits-used': '15'
        }
      })
    )

    await withTempDir(async (dir) => {
      const result = await runReveImageGen('A precise product photo', dir, {
        model: 'latest',
        aspectRatio: '3:2',
        imageSize: '1024x768',
        outputFormat: 'webp'
      })

      expect(result.imagePaths[0]?.endsWith('generated-image.webp')).toBe(true)
      expect(result.metadata).toMatchObject({
        imageService: 'reve',
        imageModel: 'latest',
        imageFileNames: ['generated-image.webp'],
        imageFormat: 'webp',
        imageSize: '1024x768',
        providerReturnedModel: 'reve-create@20250915',
        providerCostCents: 2,
        providerCostSource: 'provider_usage',
        usageCostRaw: 15,
        requestMode: 'generation'
      })
    })

    expect(calls[0]).toMatchObject({
      url: 'https://mock.reve.local/v1/image/create',
      method: 'POST'
    })
    expect(calls[0]?.headers.get('accept')).toBe('image/webp')
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer reve-key')
    expect(calls[0]?.bodyJson).toEqual({
      prompt: 'A precise product photo',
      aspect_ratio: '3:2',
      postprocessing: [{
        process: 'fit_image',
        max_width: 1024,
        max_height: 768
      }]
    })
  })

  test('Reve edit sends one bare base64 reference image', async () => {
    process.env['REVE_API_KEY'] = 'reve-key'
    process.env['REVE_BASE_URL'] = 'https://mock.reve.local'
    const calls = installFetch(() => imageResponse(new Uint8Array([9, 8, 7]), 'image/png'))

    await withTempDir(async (dir) => {
      const refPath = join(dir, 'reference.png')
      const refBytes = new Uint8Array([4, 5, 6])
      await writeFile(refPath, refBytes)

      const result = await runReveImageGen('Make the object matte black', dir, {
        model: 'latest',
        inputs: [refPath]
      })

      expect(result.metadata.requestMode).toBe('edit')
      expect(calls[0]?.bodyJson).toEqual({
        edit_instruction: 'Make the object matte black',
        reference_image: Buffer.from(refBytes).toString('base64')
      })
    })

    expect(calls[0]?.url).toBe('https://mock.reve.local/v1/image/edit')
    expect(calls[0]?.headers.get('accept')).toBe('image/png')
  })

  test('Reve remix sends multiple bare base64 reference images', async () => {
    process.env['REVE_API_KEY'] = 'reve-key'
    process.env['REVE_BASE_URL'] = 'https://mock.reve.local'
    const calls = installFetch(() => imageResponse(new Uint8Array([3, 2, 1]), 'image/jpeg'))

    await withTempDir(async (dir) => {
      const firstRef = join(dir, 'first.png')
      const secondRef = join(dir, 'second.webp')
      const firstBytes = new Uint8Array([1, 1, 1])
      const secondBytes = new Uint8Array([2, 2, 2])
      await writeFile(firstRef, firstBytes)
      await writeFile(secondRef, secondBytes)

      const result = await runReveImageGen('Combine these references', dir, {
        model: 'latest',
        inputs: [firstRef, secondRef],
        outputFormat: 'jpeg'
      })

      expect(result.imagePaths[0]?.endsWith('generated-image.jpg')).toBe(true)
      expect(calls[0]?.bodyJson).toEqual({
        prompt: 'Combine these references',
        reference_images: [
          Buffer.from(firstBytes).toString('base64'),
          Buffer.from(secondBytes).toString('base64')
        ]
      })
    })

    expect(calls[0]?.url).toBe('https://mock.reve.local/v1/image/remix')
    expect(calls[0]?.headers.get('accept')).toBe('image/jpeg')
  })

  test('Reve treats moderation and error headers as failed image runs', async () => {
    process.env['REVE_API_KEY'] = 'reve-key'
    process.env['REVE_BASE_URL'] = 'https://mock.reve.local'

    await withTempDir(async (dir) => {
      installFetch(() =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: {
            'content-type': 'image/png',
            'x-reve-content-violation': 'true'
          }
        })
      )
      await expect(runReveImageGen('Unsafe prompt', dir, {
        model: 'latest'
      })).rejects.toThrow('content violation')
    })

    await withTempDir(async (dir) => {
      installFetch(() =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: {
            'content-type': 'image/png',
            'x-reve-error-code': 'policy_blocked'
          }
        })
      )
      await expect(runReveImageGen('Another blocked prompt', dir, {
        model: 'latest'
      })).rejects.toThrow('error code policy_blocked')
    })
  })

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

  test('BFL image result download retries transient 504 responses', async () => {
    process.env['BFL_API_KEY'] = 'bfl-key'
    process.env['BFL_BASE_URL'] = 'https://mock.bfl.local'
    let resultDownloadAttempts = 0
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
      if (call.url === 'https://mock.bfl.local/result.jpeg') {
        resultDownloadAttempts += 1
        if (resultDownloadAttempts === 1) {
          return new Response('gateway timeout', {
            status: 504,
            headers: { 'retry-after': '0.001' }
          })
        }
        return imageResponse(new Uint8Array([9, 8, 7]), 'image/jpeg')
      }
      throw new Error(`Unexpected BFL image fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const result = await runBflImageGen('Generate a stable image', dir, {
        model: 'flux-2-flex',
        outputFormat: 'jpeg'
      })

      expect(result.imagePaths[0]?.endsWith('generated-image.jpg')).toBe(true)
      expect(await Bun.file(result.imagePaths[0] as string).exists()).toBe(true)
    })

    const downloadCalls = calls.filter((call) => call.url === 'https://mock.bfl.local/result.jpeg')
    expect(downloadCalls).toHaveLength(2)
    expect(downloadCalls[0]?.headers.get('accept')).toBe('image/jpeg,image/*;q=0.9,*/*;q=0.8')
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
