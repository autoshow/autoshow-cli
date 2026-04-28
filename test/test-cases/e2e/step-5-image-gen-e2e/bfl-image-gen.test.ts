import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineImageServiceTest } from '../../../test-utils/define-image-service-test'
import { runCommand } from '../../../test-utils/test-helpers'
import { runBflImageGen } from '~/cli/commands/process-steps/step-5-image/image-services/bfl/run-bfl-image-gen'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

defineImageServiceTest({
  imageService: 'bfl',
  cliFlag: '--bfl-image',
  envVarKey: 'BFL_API_KEY',
  imageExtension: 'jpg',
  models: [
    {
      model: 'flux-2-pro-preview',
      prompt: 'A clean product photo of a red enamel camping mug',
      extraArgs: ['--image-size', '1024x1024']
    }
  ]
})

test('rejects unsupported BFL shared image flags', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'image',
    'a sunset',
    '--bfl-image',
    'flux-2-pro-preview',
    '--image-aspect-ratio',
    '1:1'
  ])
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).not.toBe(0)
  expect(output).toContain('not supported by BFL image generation')
})

test('rejects invalid BFL image size values', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'image',
    'a sunset',
    '--bfl-image',
    'flux-2-pro-preview',
    '--image-size',
    '1024'
  ])
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).not.toBe(0)
  expect(output).toContain('Invalid --image-size value "1024" for BFL')
})

test('BFL runner downloads result.sample and records provider quote metadata', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-bfl-runner-'))
  tempDirs.push(outputDir)

  const previousFetch = globalThis.fetch
  const previousApiKey = process.env['BFL_API_KEY']
  const previousBaseUrl = process.env['BFL_BASE_URL']
  process.env['BFL_API_KEY'] = 'test-bfl-key'
  process.env['BFL_BASE_URL'] = 'https://example.bfl.test'

  const calls: string[] = []
  const mockFetch = Object.assign(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    calls.push(`${init?.method ?? 'GET'} ${url}`)

    if (url === 'https://example.bfl.test/v1/flux-2-pro-preview') {
      return Response.json({ id: 'req-1', polling_url: 'https://poll.bfl.test/req-1', cost: 3 })
    }

    if (url === 'https://poll.bfl.test/req-1') {
      return Response.json({ status: 'Ready', result: { sample: 'https://delivery.bfl.test/image.webp' }, cost: 2.5 })
    }

    if (url === 'https://delivery.bfl.test/image.webp') {
      return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/webp' } })
    }

    return new Response('not found', { status: 404 })
  }, { preconnect: previousFetch.preconnect }) as typeof fetch
  globalThis.fetch = mockFetch

  try {
    const result = await runBflImageGen('a sunset', outputDir, {
      model: 'flux-2-pro-preview',
      imageSize: '1024x1024',
      outputFormat: 'webp'
    })

    expect(result.imagePaths[0]).toBe(`${outputDir}/generated-image.webp`)
    expect(result.metadata.imageService).toBe('bfl')
    expect(result.metadata.imageModel).toBe('flux-2-pro-preview')
    expect(result.metadata.imageFileNames).toEqual(['generated-image.webp'])
    expect(result.metadata.imageWidth).toBe(1024)
    expect(result.metadata.imageHeight).toBe(1024)
    expect(result.metadata.providerCostCents).toBe(2.5)
    expect(result.metadata.providerCostSource).toBe('provider_quote')
    expect(calls).toEqual([
      'POST https://example.bfl.test/v1/flux-2-pro-preview',
      'GET https://poll.bfl.test/req-1',
      'GET https://delivery.bfl.test/image.webp'
    ])
  } finally {
    globalThis.fetch = previousFetch
    if (previousApiKey === undefined) delete process.env['BFL_API_KEY']
    else process.env['BFL_API_KEY'] = previousApiKey
    if (previousBaseUrl === undefined) delete process.env['BFL_BASE_URL']
    else process.env['BFL_BASE_URL'] = previousBaseUrl
  }
})
