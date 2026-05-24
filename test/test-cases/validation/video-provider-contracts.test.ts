import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runGeminiVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/gemini/run-gemini-video-gen'
import { runGrokVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/grok/run-grok-video-gen'
import { runGlmVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/glm/run-glm-video-gen'
import { runMinimaxVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/minimax/run-minimax-video-gen'
import { runRunwayVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/runway/run-runway-video-gen'
import { GLM_DEFAULT_BASE_URL, MINIMAX_DEFAULT_BASE_URL, XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'

type FetchCall = {
  url: string
  method: string
  headers: Headers
  bodyText: string
  bodyJson?: Record<string, unknown> | undefined
}

const originalFetch = globalThis.fetch
const previousEnv: Record<string, string | undefined> = {}
const envKeys = ['GEMINI_API_KEY', 'XAI_API_KEY', 'GLM_API_KEY', 'MINIMAX_API_KEY', 'RUNWAYML_API_SECRET']
const tempDirs: string[] = []
const videoBytes = new Uint8Array([9, 8, 7])
const inlineVideo = Buffer.from(videoBytes).toString('base64')

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init?.headers as Record<string, string> | undefined)
    }
  })

const videoResponse = (): Response =>
  new Response(videoBytes, { headers: { 'content-type': 'video/mp4' } })

const transientVideoReadFailureResponse = (): Response => {
  const response = new Response(videoBytes, { headers: { 'content-type': 'video/mp4' } })
  Object.defineProperty(response, 'arrayBuffer', {
    value: async () => {
      throw new TypeError('socket connection was closed unexpectedly')
    }
  })
  return response
}

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
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-video-provider-contracts-'))
  tempDirs.push(dir)
  return await fn(dir)
}

const writeMediaFixtures = async (dir: string): Promise<{ imagePath: string, lastFramePath: string, videoPath: string }> => {
  const imagePath = join(dir, 'input.png')
  const lastFramePath = join(dir, 'last.webp')
  const videoPath = join(dir, 'input.mp4')
  await writeFile(imagePath, new Uint8Array([1, 2, 3]))
  await writeFile(lastFramePath, new Uint8Array([4, 5, 6]))
  await writeFile(videoPath, new Uint8Array([7, 8, 9]))
  return { imagePath, lastFramePath, videoPath }
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

describe('video provider REST contracts', () => {
  test('Gemini Veo sends media inputs for image, reference, interpolation, extension, and 4k modes', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installFetch((call) => {
      if (call.method === 'POST') {
        return jsonResponse({ name: 'operations/veo-test', done: false })
      }
      if (call.url === 'https://generativelanguage.googleapis.com/v1beta/operations/veo-test') {
        return jsonResponse({
          name: 'operations/veo-test',
          done: true,
          response: {
            generateVideoResponse: {
              generatedSamples: [{
                video: {
                  encodedVideo: inlineVideo,
                  mimeType: 'video/mp4'
                }
              }]
            }
          }
        })
      }
      throw new Error(`Unexpected Gemini fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath, lastFramePath, videoPath } = await writeMediaFixtures(dir)

      await runGeminiVideoGen('animate image', dir, {
        model: 'veo-3.1-fast-generate-preview',
        mode: 'image-to-video',
        inputImage: imagePath
      })
      await runGeminiVideoGen('keep references', dir, {
        model: 'veo-3.1-generate-preview',
        mode: 'reference-to-video',
        referenceImages: [imagePath, lastFramePath],
        durationSeconds: 4
      })
      await runGeminiVideoGen('transition', dir, {
        model: 'veo-3.1-generate-preview',
        mode: 'interpolate',
        inputImage: imagePath,
        lastFrameImage: lastFramePath
      })
      await runGeminiVideoGen('continue video', dir, {
        model: 'veo-3.1-fast-generate-preview',
        mode: 'extend',
        inputVideo: videoPath,
        resolution: '1080p'
      })
      await runGeminiVideoGen('grand canyon', dir, {
        model: 'veo-3.1-generate-preview',
        resolution: '4k',
        durationSeconds: 4
      })
    })

    const postBodies = calls.filter((call) => call.method === 'POST').map((call) => call.bodyJson!)
    expect(postBodies[0]?.['instances']).toMatchObject([{
      prompt: 'animate image',
      image: { inlineData: { mimeType: 'image/png' } }
    }])
    expect(postBodies[1]?.['instances']).toMatchObject([{
      prompt: 'keep references',
      referenceImages: [
        { image: { inlineData: { mimeType: 'image/png' } }, referenceType: 'asset' },
        { image: { inlineData: { mimeType: 'image/webp' } }, referenceType: 'asset' }
      ]
    }])
    expect(postBodies[1]?.['parameters']).toMatchObject({ durationSeconds: 8 })
    expect(postBodies[2]?.['instances']).toMatchObject([{
      prompt: 'transition',
      image: { inlineData: { mimeType: 'image/png' } },
      lastFrame: { inlineData: { mimeType: 'image/webp' } }
    }])
    expect(postBodies[3]?.['instances']).toMatchObject([{
      prompt: 'continue video',
      video: { inlineData: { mimeType: 'video/mp4' } }
    }])
    expect(postBodies[3]?.['parameters']).toMatchObject({ durationSeconds: 8, resolution: '720p' })
    expect(postBodies[4]?.['parameters']).toMatchObject({ durationSeconds: 8, resolution: '4k' })
  })

  test('GLM sends text, image, interpolation, and reference request bodies', async () => {
    process.env['GLM_API_KEY'] = 'glm-key'
    let requestIndex = 0
    const calls = installFetch((call) => {
      if (call.method === 'POST') {
        requestIndex += 1
        return jsonResponse({ id: `glm-${requestIndex}`, task_status: 'PROCESSING' })
      }
      if (call.url.startsWith(`${GLM_DEFAULT_BASE_URL}/async-result/glm-`)) {
        return jsonResponse({
          id: 'glm-result',
          task_status: 'SUCCESS',
          video_result: [{ url: 'https://cdn.example.com/glm.mp4' }]
        })
      }
      if (call.url === 'https://cdn.example.com/glm.mp4') return videoResponse()
      throw new Error(`Unexpected GLM fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath, lastFramePath } = await writeMediaFixtures(dir)
      await runGlmVideoGen('plain prompt', dir, {
        model: 'cogvideox-3'
      })
      await runGlmVideoGen('animate image', dir, {
        model: 'cogvideox-3',
        mode: 'image-to-video',
        inputImage: imagePath
      })
      await runGlmVideoGen('transition frames', dir, {
        model: 'cogvideox-3',
        mode: 'interpolate',
        inputImage: imagePath,
        lastFrameImage: lastFramePath
      })
      await runGlmVideoGen('keep references', dir, {
        model: 'vidu2-reference',
        mode: 'reference-to-video',
        referenceImages: [imagePath, lastFramePath]
      })
    })

    const postBodies = calls.filter((call) => call.method === 'POST').map((call) => call.bodyJson!)
    expect(postBodies[0]).toEqual({
      model: 'cogvideox-3',
      prompt: 'plain prompt',
      quality: 'speed',
      with_audio: false,
      size: '1920x1080',
      fps: 30,
      duration: 5
    })
    expect(postBodies[1]).toMatchObject({
      model: 'cogvideox-3',
      prompt: 'animate image',
      image_url: `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`
    })
    expect(postBodies[2]?.['image_url']).toEqual([
      `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`,
      `data:image/webp;base64,${Buffer.from(new Uint8Array([4, 5, 6])).toString('base64')}`
    ])
    expect(postBodies[3]).toMatchObject({
      model: 'vidu2-reference',
      prompt: 'keep references',
      duration: 4,
      aspect_ratio: '16:9',
      size: '1280x720',
      movement_amplitude: 'auto',
      with_audio: false,
      image_url: [
        `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`,
        `data:image/webp;base64,${Buffer.from(new Uint8Array([4, 5, 6])).toString('base64')}`
      ]
    })
  })

  test('MiniMax sends text, image, and subject-reference request bodies', async () => {
    process.env['MINIMAX_API_KEY'] = 'minimax-key'
    let requestIndex = 0
    const calls = installFetch((call) => {
      if (call.method === 'POST') {
        requestIndex += 1
        return jsonResponse({ task_id: `minimax-${requestIndex}`, base_resp: { status_code: 0, status_msg: 'success' } })
      }
      if (call.url.startsWith(`${MINIMAX_DEFAULT_BASE_URL}/v1/query/video_generation?task_id=minimax-`)) {
        return jsonResponse({
          data: { status: 'success', file_id: 'file-123' },
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      }
      if (call.url === `${MINIMAX_DEFAULT_BASE_URL}/v1/files/retrieve?file_id=file-123`) {
        return jsonResponse({
          file: { download_url: 'https://cdn.example.com/minimax.mp4' },
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      }
      if (call.url === 'https://cdn.example.com/minimax.mp4') return videoResponse()
      throw new Error(`Unexpected MiniMax fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath } = await writeMediaFixtures(dir)
      await runMinimaxVideoGen('plain prompt', dir, {
        model: 'MiniMax-Hailuo-2.3'
      })
      await runMinimaxVideoGen('animate image', dir, {
        model: 'I2V-01',
        mode: 'image-to-video',
        inputImage: imagePath
      })
      await runMinimaxVideoGen('keep character', dir, {
        model: 'S2V-01',
        mode: 'reference-to-video',
        referenceImages: [imagePath]
      })
    })

    const postBodies = calls.filter((call) => call.method === 'POST').map((call) => call.bodyJson!)
    expect(postBodies[0]).toEqual({
      model: 'MiniMax-Hailuo-2.3',
      prompt: 'plain prompt',
      duration: 6,
      resolution: '768P'
    })
    expect(postBodies[1]).toEqual({
      model: 'I2V-01',
      prompt: 'animate image',
      duration: 6,
      resolution: '720P',
      first_frame_image: `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`
    })
    expect(postBodies[2]).toEqual({
      model: 'S2V-01',
      prompt: 'keep character',
      subject_reference: [{
        type: 'character',
        image: [`data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`]
      }]
    })
  })

  test('MiniMax retries transient video download body read failures after task success', async () => {
    process.env['MINIMAX_API_KEY'] = 'minimax-key'
    let downloadAttempts = 0
    const calls = installFetch((call) => {
      if (call.method === 'POST') {
        return jsonResponse({ task_id: 'minimax-retry', base_resp: { status_code: 0, status_msg: 'success' } })
      }
      if (call.url === `${MINIMAX_DEFAULT_BASE_URL}/v1/query/video_generation?task_id=minimax-retry`) {
        return jsonResponse({
          data: { status: 'success', file_id: 'file-retry' },
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      }
      if (call.url === `${MINIMAX_DEFAULT_BASE_URL}/v1/files/retrieve?file_id=file-retry`) {
        return jsonResponse({
          file: { download_url: 'https://cdn.example.com/minimax-retry.mp4' },
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      }
      if (call.url === 'https://cdn.example.com/minimax-retry.mp4') {
        downloadAttempts += 1
        return downloadAttempts === 1 ? transientVideoReadFailureResponse() : videoResponse()
      }
      throw new Error(`Unexpected MiniMax fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath } = await writeMediaFixtures(dir)
      const result = await runMinimaxVideoGen('animate after retry', dir, {
        model: 'MiniMax-Hailuo-2.3-Fast',
        mode: 'image-to-video',
        inputImage: imagePath,
        durationSeconds: 6
      })

      expect(Array.from(new Uint8Array(await Bun.file(result.videoPath).arrayBuffer()))).toEqual(Array.from(videoBytes))
    })

    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1)
    expect(calls.filter((call) => call.url === 'https://cdn.example.com/minimax-retry.mp4')).toHaveLength(2)
  })

  test('Grok sends generation media, storage options, and extracts poll metadata cost', async () => {
    process.env['XAI_API_KEY'] = 'xai-key'
    const calls = installFetch((call) => {
      if (call.method === 'POST') return jsonResponse({ request_id: 'grok-123' })
      if (call.url === `${XAI_DEFAULT_BASE_URL}/videos/grok-123`) {
        return jsonResponse({
          status: 'done',
          model: 'grok-imagine-video',
          progress: 100,
          usage: { cost_in_usd_ticks: 250_000_000 },
          video: {
            url: 'https://cdn.example.com/grok.mp4',
            duration: 6,
            respect_moderation: true,
            file_output: { file_id: 'file-123', filename: 'clip.mp4' }
          }
        })
      }
      if (call.url === 'https://cdn.example.com/grok.mp4') return videoResponse()
      throw new Error(`Unexpected Grok fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath } = await writeMediaFixtures(dir)
      const result = await runGrokVideoGen('animate subject', dir, {
        model: 'grok-imagine-video',
        mode: 'image-to-video',
        inputImage: imagePath,
        durationSeconds: 6,
        aspectRatio: '9:16',
        resolution: '720p',
        storageFilename: 'clip.mp4',
        storageExpiresAfter: 3600
      })

      expect(result.metadata).toMatchObject({
        requestMode: 'image-to-video',
        providerRequestId: 'grok-123',
        providerReturnedModel: 'grok-imagine-video',
        providerVideoUrl: 'https://cdn.example.com/grok.mp4',
        providerProgress: 100,
        providerModeration: true,
        providerCostCents: 2.5,
        providerCostSource: 'provider_usage',
        videoDuration: 6
      })
      expect(computeActualCosts({ step6: result.metadata }).totalCost).toBe(2.5)
    })

    expect(calls[0]).toMatchObject({
      url: `${XAI_DEFAULT_BASE_URL}/videos/generations`,
      method: 'POST'
    })
    expect(calls[0]?.bodyJson).toMatchObject({
      model: 'grok-imagine-video',
      prompt: 'animate subject',
      duration: 6,
      aspect_ratio: '9:16',
      resolution: '720p',
      storage_options: {
        filename: 'clip.mp4',
        expires_after: 3600
      },
      image: {
        url: `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`
      }
    })
  })

  test('Grok sends reference, edit, and extension endpoint shapes', async () => {
    process.env['XAI_API_KEY'] = 'xai-key'
    let requestIndex = 0
    const calls = installFetch((call) => {
      if (call.method === 'POST') {
        requestIndex += 1
        return jsonResponse({ request_id: `grok-${requestIndex}` })
      }
      if (call.url.startsWith(`${XAI_DEFAULT_BASE_URL}/videos/grok-`)) {
        return jsonResponse({
          status: 'done',
          video: {
            url: 'https://cdn.example.com/grok.mp4',
            duration: 5,
            respect_moderation: true
          }
        })
      }
      if (call.url === 'https://cdn.example.com/grok.mp4') return videoResponse()
      throw new Error(`Unexpected Grok fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath, lastFramePath, videoPath } = await writeMediaFixtures(dir)
      await runGrokVideoGen('reference scene', dir, {
        model: 'grok-imagine-video',
        mode: 'reference-to-video',
        referenceImages: [imagePath, lastFramePath]
      })
      await runGrokVideoGen('make it dusk', dir, {
        model: 'grok-imagine-video',
        mode: 'edit',
        inputVideo: videoPath
      })
      await runGrokVideoGen('continue forward', dir, {
        model: 'grok-imagine-video',
        mode: 'extend',
        inputVideo: videoPath,
        durationSeconds: 12
      })
    })

    const postCalls = calls.filter((call) => call.method === 'POST')
    expect(postCalls.map((call) => call.url)).toEqual([
      `${XAI_DEFAULT_BASE_URL}/videos/generations`,
      `${XAI_DEFAULT_BASE_URL}/videos/edits`,
      `${XAI_DEFAULT_BASE_URL}/videos/extensions`
    ])
    expect(postCalls[0]?.bodyJson).toMatchObject({
      reference_images: [
        { url: `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}` },
        { url: `data:image/webp;base64,${Buffer.from(new Uint8Array([4, 5, 6])).toString('base64')}` }
      ]
    })
    expect(postCalls[1]?.bodyJson).toEqual({
      model: 'grok-imagine-video',
      prompt: 'make it dusk',
      video: { url: `data:video/mp4;base64,${Buffer.from(new Uint8Array([7, 8, 9])).toString('base64')}` }
    })
    expect(postCalls[2]?.bodyJson).toEqual({
      model: 'grok-imagine-video',
      prompt: 'continue forward',
      duration: 10,
      video: { url: `data:video/mp4;base64,${Buffer.from(new Uint8Array([7, 8, 9])).toString('base64')}` }
    })
  })

  test('Grok fails clearly when moderation blocks video output', async () => {
    process.env['XAI_API_KEY'] = 'xai-key'
    installFetch((call) => {
      if (call.method === 'POST') return jsonResponse({ request_id: 'grok-blocked' })
      if (call.url === `${XAI_DEFAULT_BASE_URL}/videos/grok-blocked`) {
        return jsonResponse({
          status: 'done',
          video: {
            url: null,
            respect_moderation: false
          }
        })
      }
      throw new Error(`Unexpected Grok fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      await expect(runGrokVideoGen('blocked prompt', dir, {
        model: 'grok-imagine-video'
      })).rejects.toThrow('blocked by moderation')
    })
  })

  test('Runway Gen-4.5 uses text_to_video request shape and downloads output', async () => {
    process.env['RUNWAYML_API_SECRET'] = 'runway-key'
    const calls = installFetch((call) => {
      if (call.url === 'https://api.dev.runwayml.com/v1/text_to_video' && call.method === 'POST') {
        return jsonResponse({ id: 'runway-task-123' })
      }
      if (call.url === 'https://api.dev.runwayml.com/v1/tasks/runway-task-123' && call.method === 'GET') {
        return jsonResponse({
          id: 'runway-task-123',
          status: 'SUCCEEDED',
          output: ['https://cdn.example.com/runway.mp4'],
          createdAt: '2026-05-20T12:00:00.000Z'
        })
      }
      if (call.url === 'https://cdn.example.com/runway.mp4' && call.method === 'GET') return videoResponse()
      throw new Error(`Unexpected Runway fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const result = await runRunwayVideoGen(
        'A serene mountain landscape at sunrise with mist rolling through the valleys',
        dir,
        { model: 'gen4.5', durationSeconds: 5, aspectRatio: '16:9' }
      )

      expect(result.videoPath).toBe(`${dir}/generated-video.mp4`)
      expect(Array.from(new Uint8Array(await Bun.file(result.videoPath).arrayBuffer()))).toEqual(Array.from(videoBytes))
      expect(result.metadata).toMatchObject({
        videoGenService: 'runway',
        videoGenModel: 'gen4.5',
        videoFileName: 'generated-video.mp4',
        videoFileSize: videoBytes.byteLength,
        videoDuration: 5
      })
    })

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST https://api.dev.runwayml.com/v1/text_to_video',
      'GET https://api.dev.runwayml.com/v1/tasks/runway-task-123',
      'GET https://cdn.example.com/runway.mp4'
    ])

    const createCall = calls[0]!
    expect(createCall.headers.get('Authorization')).toBe('Bearer runway-key')
    expect(createCall.headers.get('X-Runway-Version')).toBe('2024-11-06')
    expect(createCall.headers.get('Content-Type')).toBe('application/json')
    expect(createCall.bodyJson).toEqual({
      model: 'gen4.5',
      promptText: 'A serene mountain landscape at sunrise with mist rolling through the valleys',
      ratio: '1280:720',
      duration: 5
    })
    expect(createCall.bodyJson).not.toHaveProperty('promptImage')
  })
})
