import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runImageBenchmark } from '~/cli/commands/setup-and-utilities/benchmark/run-image-benchmark'
import { runVideoBenchmark } from '~/cli/commands/setup-and-utilities/benchmark/run-video-benchmark'
import {
  createStats,
  processRawReport
} from '~/cli/commands/setup-and-utilities/benchmark/benchmark-ranking-report/bench-rank-sources'
import { exec } from '~/utils/cli-utils'
import type { BenchmarkFlags } from '~/cli/commands/setup-and-utilities/benchmark/benchmark-types'
import type {
  ProviderAggregate,
  StepKey
} from '~/cli/commands/setup-and-utilities/benchmark/benchmark-ranking-report/bench-rank-types'

type FetchCall = {
  url: string
  method: string
  headers: Headers
  bodyText: string
  bodyJson?: Record<string, unknown>
}

type RequestBody = {
  model?: string
  input?: Array<{
    role?: string
    content?: Array<Record<string, unknown>>
  }>
  text?: {
    format?: Record<string, unknown>
  }
}

const originalFetch = globalThis.fetch
const tempDirs: string[] = []
const previousEnv: Record<string, string | undefined> = {}
const envKeys = ['OPENAI_API_KEY', 'OPENAI_BASE_URL']
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
)

const makeTempRoot = async (prefix: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(root)
  return root
}

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

const readBody = async (body: RequestInit['body'] | null | undefined): Promise<string> =>
  typeof body === 'string' ? body : ''

const installFetch = (
  handler: (call: FetchCall) => Promise<Response> | Response
): FetchCall[] => {
  const calls: FetchCall[] = []
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
    const bodyText = await readBody(init?.body)
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

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })

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

const imageJudgeOutput = (score: number, summary: string): Record<string, unknown> => ({
  output_text: JSON.stringify({
    promptAdherence: score,
    visualQuality: score,
    artifactControl: score,
    composition: score,
    detailTextHandling: score,
    summary,
    strengths: [`score ${score} strength`],
    issues: score >= 8 ? [] : ['visible weakness']
  }),
  usage: {
    input_tokens: 12,
    output_tokens: 8
  }
})

const writeImageRun = async (runDir: string): Promise<void> => {
  await mkdir(runDir, { recursive: true })
  await writeFile(join(runDir, 'openai.png'), onePixelPng)
  await writeFile(join(runDir, 'bfl.png'), onePixelPng)
  await writeJson(join(runDir, 'run.json'), {
    schemaVersion: 2,
    kind: 'image',
    metadata: {
      input: 'A crisp technical infographic with readable labels.',
      image: [
        {
          imageService: 'openai',
          imageModel: 'gpt-image-2',
          processingTime: 1250,
          providerCostCents: 5.3,
          imageFileNames: ['openai.png']
        },
        {
          imageService: 'bfl',
          imageModel: 'flux-2-pro',
          processingTime: 950,
          providerCostCents: 0.5,
          imageFileNames: ['bfl.png']
        }
      ]
    }
  })
}

const imageBenchmarkFlags: BenchmarkFlags = {
  image: true,
  bitrates: '',
  speeds: '',
  'reference-stt': '',
  'skip-compression': false,
  'skip-speed': false,
  'image-judge-model': 'gpt-5.5'
}

describe('image benchmark contracts', () => {
  test('benchmark --image sends Responses API vision judge requests and writes quality reports', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    process.env['OPENAI_BASE_URL'] = 'https://mock.openai.local/v1'

    const calls = installFetch((call) =>
      jsonResponse(
        call.bodyText.includes('openai/gpt-image-2')
          ? imageJudgeOutput(9, 'Strong prompt match with clean labels.')
          : imageJudgeOutput(6, 'Partially matches the infographic prompt.')
      )
    )

    const runDir = await makeTempRoot('autoshow-image-benchmark-')
    await writeImageRun(runDir)

    await runImageBenchmark(runDir, imageBenchmarkFlags)

    expect(calls).toHaveLength(2)
    const firstCall = calls[0]
    expect(firstCall).toBeDefined()
    if (!firstCall) throw new Error('expected first fetch call')

    const firstBody = firstCall.bodyJson as RequestBody | undefined
    expect(firstCall.url).toBe('https://mock.openai.local/v1/responses')
    expect(firstCall.method).toBe('POST')
    expect(firstCall.headers.get('authorization')).toBe('Bearer openai-key')
    expect(firstBody?.model).toBe('gpt-5.5')
    expect(firstBody?.text?.format).toMatchObject({
      type: 'json_schema',
      name: 'image_quality_evaluation',
      strict: true
    })

    const imagePart = firstBody?.input?.[0]?.content?.find((part) => part['type'] === 'input_image')
    expect(imagePart?.['detail']).toBe('auto')
    expect(String(imagePart?.['image_url']).startsWith('data:image/png;base64,')).toBe(true)

    const qualityReport = await Bun.file(join(runDir, 'image-quality-report.json')).json() as {
      providers: Array<{
        providerKey: string
        qualityScore: number
        images: Array<{ criterionScores: { promptAdherence: number } }>
      }>
    }
    expect(qualityReport.providers.map((provider) => provider.providerKey)).toEqual([
      'openai/gpt-image-2',
      'bfl/flux-2-pro'
    ])
    expect(qualityReport.providers[0]?.qualityScore).toBe(90)
    expect(qualityReport.providers[0]?.images[0]?.criterionScores.promptAdherence).toBe(9)

    const comparison = await Bun.file(join(runDir, 'provider-comparison-report.json')).json() as {
      providerGroups: {
        service: {
          providers: Array<{
            providerKey: string
            qualityScore: number
            metrics: { qualityScore: number }
            imageQuality: { evidence: { summary: string } }
          }>
        }
      }
      rankingSurfaces: {
        service: {
          automatedQuality: Array<{ providerKey: string, value: number | null }>
          highestQuality: Array<{ providerKey: string, value: number | null }>
          humanQuality: Array<{ providerKey: string, value: number | null }>
          humanQualityUnavailableReason: string | null
        }
      }
    }
    const openaiProvider = comparison.providerGroups.service.providers.find((provider) => provider.providerKey === 'openai/gpt-image-2')
    expect(openaiProvider?.qualityScore).toBe(90)
    expect(openaiProvider?.metrics.qualityScore).toBe(90)
    expect(openaiProvider?.imageQuality.evidence.summary).toContain('Strong prompt match')
    expect(comparison.rankingSurfaces.service.automatedQuality[0]).toMatchObject({
      providerKey: 'openai/gpt-image-2',
      value: 90
    })
    expect(comparison.rankingSurfaces.service.highestQuality).toEqual(comparison.rankingSurfaces.service.automatedQuality)
    expect(comparison.rankingSurfaces.service.humanQuality).toEqual([])
    expect(comparison.rankingSurfaces.service.humanQualityUnavailableReason).toContain('humanQualityScore')

    const qualityMarkdown = await Bun.file(join(runDir, 'image-quality-report.md')).text()
    const comparisonMarkdown = await Bun.file(join(runDir, 'provider-comparison-report.md')).text()
    expect(qualityMarkdown).toContain('# Image Quality Report')
    expect(comparisonMarkdown).toContain('### Automated Quality')
    expect(comparisonMarkdown).not.toContain('Top 3')
    expect(comparisonMarkdown).toContain('90.00/100')
  })

  test('benchmark ranking consumes image raw reports with explicit quality scores', async () => {
    const runDir = await makeTempRoot('autoshow-image-ranking-')
    const reportPath = join(runDir, 'provider-comparison-report.json')
    await writeJson(reportPath, {
      schemaVersion: 2,
      kind: 'image-provider-comparison',
      category: 'image',
      providers: [
        {
          providerKey: 'openai/gpt-image-2',
          provider: 'openai/gpt-image-2',
          group: 'service',
          qualityScore: 88,
          qualityMetric: 'image quality score',
          costCents: 5.3,
          processingTimeMs: 1200
        }
      ]
    })

    const aggregates = new Map<StepKey, Map<string, ProviderAggregate>>()
    const stats = createStats()
    await processRawReport({
      absPath: reportPath,
      relPath: 'docs/benchmarks/image/test/provider-comparison-report.json',
      rawType: 'image',
      runId: 'test'
    }, aggregates, stats)

    const aggregate = aggregates.get('image')?.get('openai/gpt-image-2')
    expect(aggregate?.qualityValues).toEqual([88])
    expect([...aggregate?.qualityMetrics ?? []]).toEqual(['image quality score'])
    expect(aggregate?.priceValues).toEqual([0.053])
    expect(aggregate?.speedValues).toEqual([1200])
  })
})

const videoJudgeOutput = (score: number, summary: string): Record<string, unknown> => ({
  output_text: JSON.stringify({
    promptAdherence: score,
    visualQuality: score,
    artifactControl: score,
    temporalConsistency: score,
    compositionCamera: score,
    summary,
    strengths: [`score ${score} strength`],
    issues: score >= 8 ? [] : ['visible weakness']
  }),
  usage: {
    input_tokens: 120,
    output_tokens: 40
  }
})

const writeTinyVideo = async (path: string): Promise<void> => {
  if (!Bun.which('ffmpeg') || !Bun.which('ffprobe')) {
    throw new Error('ffmpeg and ffprobe are required for video benchmark contract coverage')
  }

  const result = await exec('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'error',
    '-f', 'lavfi',
    '-i', 'testsrc2=size=32x32:rate=10',
    '-t', '1',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-y',
    path
  ])
  if (result.exitCode !== 0) {
    throw new Error(`failed to create tiny video fixture: ${result.stderr}`)
  }
}

const writeVideoRun = async (runDir: string): Promise<void> => {
  await mkdir(runDir, { recursive: true })
  await writeTinyVideo(join(runDir, 'grok.mp4'))
  await writeJson(join(runDir, 'run.json'), {
    schemaVersion: 2,
    kind: 'video',
    metadata: {
      input: 'A cinematic mountain sunrise with a slow forward camera move.',
      video: [
        {
          videoGenService: 'grok',
          videoGenModel: 'grok-imagine-video',
          processingTime: 1250,
          videoFileName: 'grok.mp4',
          videoFileSize: 1024,
          videoDuration: 1
        }
      ],
      cost: {
        actual: {
          totalCost: 20,
          steps: [
            {
              step: 'video',
              provider: 'grok',
              model: 'grok-imagine-video',
              cost: 20
            }
          ]
        }
      }
    }
  })
}

const videoBenchmarkFlags: BenchmarkFlags = {
  video: true,
  bitrates: '',
  speeds: '',
  'reference-stt': '',
  'skip-compression': false,
  'skip-speed': false,
  'video-judge-model': 'gpt-5.5'
}

describe('video benchmark contracts', () => {
  test('benchmark --video sends one Responses vision judge request per video and writes quality reports', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    process.env['OPENAI_BASE_URL'] = 'https://mock.openai.local/v1'

    const calls = installFetch(() => jsonResponse(videoJudgeOutput(8, 'Strong prompt match with coherent camera motion.')))

    const runDir = await makeTempRoot('autoshow-video-benchmark-')
    await writeVideoRun(runDir)

    await runVideoBenchmark(runDir, videoBenchmarkFlags)

    expect(calls).toHaveLength(1)
    const firstCall = calls[0]
    expect(firstCall).toBeDefined()
    if (!firstCall) throw new Error('expected first fetch call')

    const firstBody = firstCall.bodyJson as RequestBody | undefined
    expect(firstCall.url).toBe('https://mock.openai.local/v1/responses')
    expect(firstCall.method).toBe('POST')
    expect(firstCall.headers.get('authorization')).toBe('Bearer openai-key')
    expect(firstBody?.model).toBe('gpt-5.5')
    expect(firstBody?.text?.format).toMatchObject({
      type: 'json_schema',
      name: 'video_quality_evaluation',
      strict: true
    })

    const content = firstBody?.input?.[0]?.content ?? []
    const imageParts = content.filter((part) => part['type'] === 'input_image')
    expect(imageParts).toHaveLength(10)
    expect(imageParts.every((part) => part['detail'] === 'auto')).toBe(true)
    expect(imageParts.every((part) => String(part['image_url']).startsWith('data:image/png;base64,'))).toBe(true)

    const qualityReport = await Bun.file(join(runDir, 'video-quality-report.json')).json() as {
      frameCount: number
      providers: Array<{
        providerKey: string
        qualityScore: number
        videos: Array<{
          frameCount: number
          frames: Array<{ timestampSeconds: number, fileName: string }>
          criterionScores: { temporalConsistency: number }
        }>
      }>
    }
    expect(qualityReport.frameCount).toBe(10)
    expect(qualityReport.providers.map((provider) => provider.providerKey)).toEqual(['grok/grok-imagine-video'])
    expect(qualityReport.providers[0]?.qualityScore).toBe(80)
    expect(qualityReport.providers[0]?.videos[0]?.frameCount).toBe(10)
    expect(qualityReport.providers[0]?.videos[0]?.criterionScores.temporalConsistency).toBe(8)
    expect(qualityReport.providers[0]?.videos[0]?.frames[0]?.timestampSeconds).toBeCloseTo(0.05, 2)
    expect(qualityReport.providers[0]?.videos[0]?.frames[9]?.timestampSeconds).toBeCloseTo(0.95, 2)

    const firstFrame = qualityReport.providers[0]?.videos[0]?.frames[0]?.fileName
    expect(firstFrame).toBeDefined()
    if (!firstFrame) throw new Error('expected first extracted frame')
    expect(await Bun.file(join(runDir, firstFrame)).exists()).toBe(true)

    const comparison = await Bun.file(join(runDir, 'provider-comparison-report.json')).json() as {
      providerGroups: {
        service: {
          providers: Array<{
            providerKey: string
            costCents: number
            qualityScore: number
            qualityMetric: string
            metrics: { qualityScore: number }
            videoQuality: {
              evidence: {
                judgeModel: string
                frameCount: number
                summary: string
                criterionScores: { promptAdherence: number }
              }
            }
          }>
        }
      }
      rankingSurfaces: {
        service: {
          automatedQuality: Array<{ providerKey: string, value: number | null }>
          highestQuality: Array<{ providerKey: string, value: number | null }>
        }
      }
    }
    const grokProvider = comparison.providerGroups.service.providers.find((provider) => provider.providerKey === 'grok/grok-imagine-video')
    expect(grokProvider?.costCents).toBe(20)
    expect(grokProvider?.qualityScore).toBe(80)
    expect(grokProvider?.qualityMetric).toBe('video quality score')
    expect(grokProvider?.metrics.qualityScore).toBe(80)
    expect(grokProvider?.videoQuality.evidence.judgeModel).toBe('gpt-5.5')
    expect(grokProvider?.videoQuality.evidence.frameCount).toBe(10)
    expect(grokProvider?.videoQuality.evidence.criterionScores.promptAdherence).toBe(8)
    expect(grokProvider?.videoQuality.evidence.summary).toContain('Strong prompt match')
    expect(comparison.rankingSurfaces.service.automatedQuality[0]).toMatchObject({
      providerKey: 'grok/grok-imagine-video',
      value: 80
    })
    expect(comparison.rankingSurfaces.service.highestQuality).toEqual(comparison.rankingSurfaces.service.automatedQuality)

    const qualityMarkdown = await Bun.file(join(runDir, 'video-quality-report.md')).text()
    const comparisonMarkdown = await Bun.file(join(runDir, 'provider-comparison-report.md')).text()
    expect(qualityMarkdown).toContain('# Video Quality Report')
    expect(comparisonMarkdown).toContain('### Automated Quality')
    expect(comparisonMarkdown).toContain('80.00/100')
  })

  test('benchmark ranking consumes video raw reports with explicit quality scores', async () => {
    const runDir = await makeTempRoot('autoshow-video-ranking-')
    const reportPath = join(runDir, 'provider-comparison-report.json')
    await writeJson(reportPath, {
      schemaVersion: 2,
      kind: 'video-provider-comparison',
      category: 'video',
      providers: [
        {
          providerKey: 'grok/grok-imagine-video',
          provider: 'grok/grok-imagine-video',
          group: 'service',
          qualityScore: 91,
          qualityMetric: 'video quality score',
          costCents: 20,
          processingTimeMs: 1200,
          metrics: {
            qualityScore: 91
          }
        }
      ]
    })

    const aggregates = new Map<StepKey, Map<string, ProviderAggregate>>()
    const stats = createStats()
    await processRawReport({
      absPath: reportPath,
      relPath: 'docs/benchmarks/video/test/provider-comparison-report.json',
      rawType: 'video',
      runId: 'test'
    }, aggregates, stats)

    const aggregate = aggregates.get('video')?.get('grok/grok-imagine-video')
    expect(aggregate?.qualityValues).toEqual([91])
    expect([...aggregate?.qualityMetrics ?? []]).toEqual(['video quality score'])
    expect(aggregate?.priceValues).toEqual([0.2])
    expect(aggregate?.speedValues).toEqual([1200])
  })
})
