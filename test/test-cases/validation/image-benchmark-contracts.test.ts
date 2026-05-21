import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runImageBenchmark } from '~/cli/commands/setup-and-utilities/benchmark/run-image-benchmark'
import {
  createStats,
  processRawReport
} from '~/cli/commands/setup-and-utilities/benchmark/benchmark-ranking-report/bench-rank-sources'
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

const benchmarkFlags: BenchmarkFlags = {
  image: true,
  bitrates: '',
  speeds: '',
  'reference-stt': '',
  'skip-compression': false,
  'skip-speed': false,
  'image-judge-model': 'gpt-5.5'
}

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

const judgeOutput = (score: number, summary: string): Record<string, unknown> => ({
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

describe('image benchmark contracts', () => {
  test('benchmark --image sends Responses API vision judge requests and writes quality reports', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    process.env['OPENAI_BASE_URL'] = 'https://mock.openai.local/v1'

    const calls = installFetch((call) =>
      jsonResponse(
        call.bodyText.includes('openai/gpt-image-2')
          ? judgeOutput(9, 'Strong prompt match with clean labels.')
          : judgeOutput(6, 'Partially matches the infographic prompt.')
      )
    )

    const runDir = await makeTempRoot('autoshow-image-benchmark-')
    await writeImageRun(runDir)

    await runImageBenchmark(runDir, benchmarkFlags)

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
