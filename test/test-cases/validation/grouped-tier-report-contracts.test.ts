import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tempDirs: string[] = []

const makeTempRoot = async (prefix: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(root)
  return root
}

const readStreamText = async (
  stream: ReadableStream<Uint8Array> | number | undefined | null
): Promise<string> =>
  stream && typeof stream !== 'number' ? await new Response(stream).text() : ''

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

const deprecatedTierSplitKey = 'tier' + 'Split'
const deprecatedOverallTierKey = 'overall' + 'Tier'

const hasOwnKeyDeep = (value: unknown, key: string): boolean => {
  if (Array.isArray(value)) {
    return value.some((item) => hasOwnKeyDeep(item, key))
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.prototype.hasOwnProperty.call(record, key) ||
      Object.values(record).some((item) => hasOwnKeyDeep(item, key))
  }
  return false
}

const expectRankingSurfaces = (report: {
  rankingSurfaces: Record<'local' | 'service', Record<'fastest' | 'cheapest' | 'highestQuality', unknown[]>>
}): void => {
  for (const group of ['local', 'service'] as const) {
    for (const surface of ['fastest', 'cheapest', 'highestQuality'] as const) {
      expect(Array.isArray(report.rankingSurfaces[group][surface])).toBe(true)
    }
  }
}

type MetricName = 'price' | 'speed' | 'qualityScore'

interface MetricRankingEntry {
  rank: number
  providerKey: string
  metric: MetricName
  value: number | null
  label: string
  score: number | null
  wer: number | null
  cer: number | null
  speakerAwareWER: number | null
  textOnlyWER: number | null
  supportsDiarization: boolean | null
  diarizationSupport: string | null
}

const expectMetricRankings = <GroupName extends string>(
  rankings: Record<GroupName, Record<MetricName, MetricRankingEntry[]>>,
  groups: readonly GroupName[]
): void => {
  for (const group of groups) {
    for (const metric of ['price', 'speed', 'qualityScore'] as const) {
      expect(Array.isArray(rankings[group][metric])).toBe(true)
      expect(rankings[group][metric].every((entry, index) => entry.rank === index + 1 && entry.metric === metric)).toBe(true)
    }
  }
}

type RankingSurfaceName = 'fastest' | 'cheapest' | 'highestQuality' | 'price' | 'speed' | 'automatedQuality' | 'humanQuality'

interface TtsRankingEntry {
  providerKey: string
  metric: string
  value: number | null
  label: string
}

const expectTtsRankingSurfaces = (report: {
  rankingSurfaces: Record<'local' | 'service', Record<RankingSurfaceName, TtsRankingEntry[]>>
}): void => {
  expectRankingSurfaces(report)
  for (const group of ['local', 'service'] as const) {
    for (const surface of ['price', 'speed', 'automatedQuality', 'humanQuality'] as const) {
      expect(Array.isArray(report.rankingSurfaces[group][surface])).toBe(true)
    }
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('grouped report contracts', () => {
  test('OCR comparison report emits full metric rankings by provider group', async () => {
    const runDir = await makeTempRoot('autoshow-ocr-tiering-')
    const providersDir = join(runDir, 'providers')
    await mkdir(providersDir, { recursive: true })
    await writeFile(join(runDir, 'consensus-extraction.txt'), 'alpha beta gamma\n')

    const providerArtifacts = [
      { dir: 'tesseract-tesseract', provider: 'tesseract', model: 'tesseract', text: 'alpha beta gamma', processingTime: 1000 },
      { dir: 'ocrmypdf-ocrmypdf', provider: 'ocrmypdf', model: 'ocrmypdf', text: 'alpha beta', processingTime: 2000 },
      { dir: 'mistral-mistral-ocr', provider: 'mistral', model: 'mistral-ocr', text: 'alpha beta gamma', processingTime: 1500, cost: 0.25 },
      { dir: 'openai-gpt-4o-mini', provider: 'openai', model: 'gpt-4o-mini', text: 'alpha gamma', processingTime: 3000, cost: 0.5 }
    ]

    await writeJson(join(runDir, 'run.json'), {
      schemaVersion: 2,
      kind: 'extract',
      metadata: {
        step2: [{ extractionMethod: 'ocr', totalPages: 1, ocrPages: 1, textPages: 0 }],
        providerStates: providerArtifacts.map((artifact) => ({ artifactDir: `providers/${artifact.dir}` })),
        cost: {
          actual: {
            steps: providerArtifacts
              .filter((artifact) => artifact.cost !== undefined)
              .map((artifact) => ({ provider: artifact.provider, model: artifact.model, cost: artifact.cost }))
          }
        },
        timing: {
          actual: {
            steps: providerArtifacts.map((artifact) => ({
              provider: artifact.provider,
              model: artifact.model,
              processingTimeMs: artifact.processingTime
            }))
          }
        }
      }
    })

    for (const artifact of providerArtifacts) {
      const providerDir = join(providersDir, artifact.dir)
      await mkdir(providerDir, { recursive: true })
      await writeJson(join(providerDir, 'result.json'), {
        schemaVersion: 2,
        kind: 'provider-result',
        provider: artifact.provider,
        model: artifact.model,
        metadata: { processingTime: artifact.processingTime, tokenEstimate: 3 },
        result: {
          text: artifact.text,
          pages: [{ pageNumber: 0, method: 'ocr', text: artifact.text }],
          totalPages: 1
        }
      })
    }

    const proc = Bun.spawn([
      process.execPath,
      '.codex/skills/consensus/scripts/run.ts',
      'ocr',
      'build-report',
      runDir
    ], {
      stdout: 'pipe',
      stderr: 'pipe'
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      readStreamText(proc.stdout),
      readStreamText(proc.stderr),
      proc.exited
    ])
    expect(stdout).toContain('Rewrote')
    expect(stderr).toBe('')
    expect(exitCode).toBe(0)

	    const report = await Bun.file(join(runDir, 'provider-comparison-report.json')).json() as {
	      rankingSurfaces?: unknown
	      overall?: unknown
	      overallMetric?: unknown
	      overallWeights?: unknown
	      tiering?: unknown
	      providers?: unknown
	      metricRankings: Record<'local' | 'thirdPartyService', Record<MetricName, MetricRankingEntry[]>>
	      providerGroups: {
	        local: { count: number, providers: Array<{ group: string, metrics: { score: number, wer: number, cer: number } }> }
	        thirdPartyService: { count: number, providers: Array<{ group: string, metrics: { score: number, wer: number, cer: number } }> }
	      }
	    }

	    expect(hasOwnKeyDeep(report, deprecatedTierSplitKey)).toBe(false)
	    expect(hasOwnKeyDeep(report, deprecatedOverallTierKey)).toBe(false)
	    expect(report.rankingSurfaces).toBeUndefined()
	    expect(report.overall).toBeUndefined()
	    expect(report.overallMetric).toBeUndefined()
	    expect(report.overallWeights).toBeUndefined()
	    expect(report.tiering).toBeUndefined()
	    expect(report.providers).toBeUndefined()
	    expectMetricRankings(report.metricRankings, ['local', 'thirdPartyService'] as const)
	    expect(report.providerGroups.local.count).toBe(2)
	    expect(report.providerGroups.thirdPartyService.count).toBe(2)
	    expect(report.metricRankings.local.price).toHaveLength(2)
	    expect(report.metricRankings.local.speed).toHaveLength(2)
	    expect(report.metricRankings.local.qualityScore).toHaveLength(2)
	    expect(report.metricRankings.thirdPartyService.price).toHaveLength(2)
	    expect(report.metricRankings.thirdPartyService.speed).toHaveLength(2)
	    expect(report.metricRankings.thirdPartyService.qualityScore).toHaveLength(2)
	    expect(report.metricRankings.local.price.every((entry) => entry.value === 0 && entry.label === '$0.00 local monetary cost')).toBe(true)
	    expect(report.metricRankings.local.speed.map((entry) => entry.providerKey)).toEqual(['tesseract/tesseract', 'ocrmypdf/ocrmypdf'])
	    expect(report.metricRankings.local.qualityScore.map((entry) => entry.providerKey)).toEqual(['tesseract/tesseract', 'ocrmypdf/ocrmypdf'])
	    expect(report.metricRankings.thirdPartyService.price.map((entry) => entry.providerKey)).toEqual(['mistral/mistral-ocr', 'openai/gpt-4o-mini'])
	    expect(report.metricRankings.thirdPartyService.speed.map((entry) => entry.providerKey)).toEqual(['mistral/mistral-ocr', 'openai/gpt-4o-mini'])
	    expect(report.metricRankings.thirdPartyService.qualityScore.map((entry) => entry.providerKey)).toEqual(['mistral/mistral-ocr', 'openai/gpt-4o-mini'])
	    expect(report.metricRankings.local.qualityScore.every((entry) => entry.score !== null && entry.wer !== null && entry.cer !== null)).toBe(true)
	    expect(report.metricRankings.thirdPartyService.qualityScore.every((entry) => entry.score !== null && entry.wer !== null && entry.cer !== null)).toBe(true)

	    const markdown = await Bun.file(join(runDir, 'provider-comparison-report.md')).text()
	    expect(markdown).toContain('## Metric Rankings')
	    expect(markdown).toContain('### Local')
	    expect(markdown).toContain('### Third-Party Service')
	    expect(markdown).toContain('#### Price')
	    expect(markdown).toContain('#### Speed')
	    expect(markdown).toContain('#### Quality Score')
	    expect(markdown).not.toContain('## Overall Ranking')
	    expect(markdown).not.toContain('## Tier Breakdown')
	    expect(markdown).not.toContain('## Ranking')
	    expect(markdown).not.toContain('Top 3')
	  })

  test('STT comparison report emits full metric rankings split by diarization support', async () => {
    const runDir = await makeTempRoot('autoshow-stt-diarization-tiering-')
    const providersDir = join(runDir, 'providers')
    await mkdir(providersDir, { recursive: true })
    await writeFile(join(runDir, 'consensus-transcription.txt'), [
      '[00:00:00] [speaker-1] Alpha beta.',
      '[00:00:04] [speaker-2] Gamma delta.'
    ].join('\n') + '\n')

    const providerArtifacts = [
      {
        dir: 'assemblyai-universal-3-pro',
        provider: 'assemblyai',
        model: 'universal-3-pro',
        processingTime: 1000,
        cost: 0.4,
        hasSpeakerLabels: true,
        segments: [
          { start: '00:00:00', end: '00:00:04', speaker: 'speaker-A', text: 'Alpha beta.' },
          { start: '00:00:04', end: '00:00:08', speaker: 'speaker-B', text: 'Gamma delta.' }
        ]
      },
      {
        dir: 'gladia-default',
        provider: 'gladia',
        model: 'default',
        processingTime: 2000,
        cost: 0.5,
        hasSpeakerLabels: true,
        segments: [
          { start: '00:00:00', end: '00:00:04', speaker: 'speaker-0', text: 'Alpha beta.' },
          { start: '00:00:04', end: '00:00:08', speaker: 'speaker-1', text: 'Gamma delta.' }
        ]
      },
      {
        dir: 'openai-stt-gpt-4o-transcribe',
        provider: 'openai-stt',
        model: 'gpt-4o-transcribe',
        processingTime: 1500,
        cost: 0.3,
        hasSpeakerLabels: false,
        segments: [{ start: '00:00:00', end: '00:00:08', text: 'Alpha beta. Gamma delta.' }]
      },
      {
        dir: 'deepinfra-openai_whisper-large-v3',
        provider: 'deepinfra',
        model: 'openai/whisper-large-v3',
        processingTime: 2500,
        cost: 0.2,
        hasSpeakerLabels: false,
        segments: [{ start: '00:00:00', end: '00:00:08', text: 'Alpha beta. Gamma delta.' }]
      },
      {
        dir: 'whisper-base',
        provider: 'whisper',
        model: 'base',
        processingTime: 3000,
        hasSpeakerLabels: false,
        segments: [{ start: '00:00:00', end: '00:00:08', text: 'Alpha beta. Gamma delta.' }]
      }
    ]

    await writeJson(join(runDir, 'run.json'), {
      schemaVersion: 2,
      kind: 'extract',
      metadata: {
        step1: { durationSeconds: 8, duration: '00:00:08' },
        providerStates: providerArtifacts.map((artifact) => ({ artifactDir: `providers/${artifact.dir}` })),
        cost: {
          actual: {
            steps: providerArtifacts
              .filter((artifact) => artifact.cost !== undefined)
              .map((artifact) => ({ provider: artifact.provider, model: artifact.model, cost: artifact.cost }))
          }
        },
        timing: {
          actual: {
            steps: providerArtifacts.map((artifact) => ({
              provider: artifact.provider,
              model: artifact.model,
              processingTimeMs: artifact.processingTime
            }))
          }
        }
      }
    })

    for (const artifact of providerArtifacts) {
      const providerDir = join(providersDir, artifact.dir)
      await mkdir(providerDir, { recursive: true })
      await writeJson(join(providerDir, 'result.json'), {
        schemaVersion: 2,
        kind: 'provider-result',
        provider: artifact.provider,
        model: artifact.model,
        metadata: { processingTime: artifact.processingTime, tokenCount: 4 },
        result: {
          text: 'Alpha beta. Gamma delta.',
          segments: artifact.segments,
          evidence: {
            timingQuality: artifact.hasSpeakerLabels ? 'native_word' : 'segment_interpolated',
            capabilities: { hasSpeakerLabels: artifact.hasSpeakerLabels }
          }
        }
      })
    }

    const proc = Bun.spawn([
      process.execPath,
      '.codex/skills/consensus/scripts/run.ts',
      'stt',
      'build-report',
      runDir
    ], {
      stdout: 'pipe',
      stderr: 'pipe'
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      readStreamText(proc.stdout),
      readStreamText(proc.stderr),
      proc.exited
    ])
    expect(stdout).toContain('Rewrote')
    expect(stderr).toBe('')
    expect(exitCode).toBe(0)

	    const report = await Bun.file(join(runDir, 'reference-comparison-report.json')).json() as {
	      rankingSurfaces?: unknown
	      overall?: unknown
	      overallMetric?: unknown
	      overallWeights?: unknown
	      tiering?: unknown
	      providers?: unknown
	      metricRankings: Record<'local' | 'thirdPartyServiceNonDiarization' | 'thirdPartyServiceDiarization', Record<MetricName, MetricRankingEntry[]>>
	      providerGroups: {
	        local: { count: number, providers: Array<{ supportsDiarization: boolean, diarizationSupport: string }> }
	        thirdPartyServiceNonDiarization: { count: number, providers: Array<{ supportsDiarization: boolean, diarizationSupport: string }> }
	        thirdPartyServiceDiarization: { count: number, providers: Array<{ supportsDiarization: boolean, diarizationSupport: string }> }
	      }
	    }

	    expect(hasOwnKeyDeep(report, deprecatedTierSplitKey)).toBe(false)
	    expect(hasOwnKeyDeep(report, deprecatedOverallTierKey)).toBe(false)
	    expect(report.rankingSurfaces).toBeUndefined()
	    expect(report.overall).toBeUndefined()
	    expect(report.overallMetric).toBeUndefined()
	    expect(report.overallWeights).toBeUndefined()
	    expect(report.tiering).toBeUndefined()
	    expect(report.providers).toBeUndefined()
	    expectMetricRankings(report.metricRankings, ['local', 'thirdPartyServiceNonDiarization', 'thirdPartyServiceDiarization'] as const)
	    expect(report.providerGroups.local.count).toBe(1)
	    expect(report.providerGroups.thirdPartyServiceDiarization.count).toBe(2)
	    expect(report.providerGroups.thirdPartyServiceNonDiarization.count).toBe(2)
	    expect(report.providerGroups.thirdPartyServiceDiarization.providers.every((provider) => provider.supportsDiarization === true && provider.diarizationSupport === 'supported')).toBe(true)
	    expect(report.providerGroups.thirdPartyServiceNonDiarization.providers.every((provider) => provider.supportsDiarization === false && provider.diarizationSupport === 'not-supported')).toBe(true)
	    expect(report.metricRankings.local.price).toHaveLength(1)
	    expect(report.metricRankings.local.speed).toHaveLength(1)
	    expect(report.metricRankings.local.qualityScore).toHaveLength(1)
	    expect(report.metricRankings.thirdPartyServiceDiarization.price).toHaveLength(2)
	    expect(report.metricRankings.thirdPartyServiceDiarization.speed).toHaveLength(2)
	    expect(report.metricRankings.thirdPartyServiceDiarization.qualityScore).toHaveLength(2)
	    expect(report.metricRankings.thirdPartyServiceNonDiarization.price).toHaveLength(2)
	    expect(report.metricRankings.thirdPartyServiceNonDiarization.speed).toHaveLength(2)
	    expect(report.metricRankings.thirdPartyServiceNonDiarization.qualityScore).toHaveLength(2)
	    expect(report.metricRankings.local.price[0]?.value).toBe(0)
	    expect(report.metricRankings.thirdPartyServiceDiarization.price.map((entry) => entry.providerKey)).toEqual(['assemblyai/universal-3-pro', 'gladia/default'])
	    expect(report.metricRankings.thirdPartyServiceNonDiarization.price.map((entry) => entry.providerKey)).toEqual(['deepinfra/openai/whisper-large-v3', 'openai-stt/gpt-4o-transcribe'])
	    expect(report.metricRankings.thirdPartyServiceNonDiarization.speed.map((entry) => entry.providerKey)).toEqual(['openai-stt/gpt-4o-transcribe', 'deepinfra/openai/whisper-large-v3'])
	    expect(report.metricRankings.thirdPartyServiceDiarization.qualityScore.every((entry) => entry.score !== null && entry.speakerAwareWER !== null && entry.textOnlyWER !== null && entry.diarizationSupport === 'supported')).toBe(true)
	    expect(report.metricRankings.thirdPartyServiceNonDiarization.qualityScore.every((entry) => entry.score !== null && entry.speakerAwareWER !== null && entry.textOnlyWER !== null && entry.diarizationSupport === 'not-supported')).toBe(true)

	    const markdown = await Bun.file(join(runDir, 'reference-comparison-report.md')).text()
	    expect(markdown).toContain('## Metric Rankings')
	    expect(markdown).toContain('### Local')
	    expect(markdown).toContain('### Third-Party Service Non-Diarization')
	    expect(markdown).toContain('### Third-Party Service Diarization')
	    expect(markdown).toContain('#### Price')
	    expect(markdown).toContain('#### Speed')
	    expect(markdown).toContain('#### Quality Score')
	    expect(markdown).not.toContain('## Overall Ranking')
	    expect(markdown).not.toContain('## Tier Breakdown')
	    expect(markdown).not.toContain('## Ranking')
	    expect(markdown).not.toContain('Top 3')
	  })

  test('URL comparison report emits full ranking surfaces without tier output', async () => {
    const runDir = await makeTempRoot('autoshow-url-full-surfaces-')
    const providersDir = join(runDir, 'providers')
    await mkdir(providersDir, { recursive: true })
    await writeFile(join(runDir, 'consensus-extraction.txt'), 'alpha beta gamma delta epsilon zeta eta theta\n')

    const providerArtifacts = [
      { dir: 'defuddle', provider: 'defuddle', model: 'defuddle', text: 'alpha beta gamma delta epsilon zeta eta theta', processingTime: 500 },
      { dir: 'firecrawl', provider: 'firecrawl', model: 'firecrawl', text: 'alpha beta gamma delta epsilon zeta eta theta', processingTime: 1200, cost: 0.08 },
      { dir: 'spider', provider: 'spider', model: 'spider', text: 'alpha beta gamma delta epsilon zeta eta', processingTime: 900, cost: 0.12 },
      { dir: 'zyte', provider: 'zyte', model: 'zyte', text: 'alpha beta gamma delta', processingTime: 1800, cost: 0.16 },
      { dir: 'glm-reader', provider: 'glm-reader', model: 'glm-reader', text: 'alpha beta gamma delta epsilon zeta eta theta extra' }
    ]

    await writeJson(join(runDir, 'run.json'), {
      schemaVersion: 2,
      kind: 'url',
      metadata: {
        providerStates: providerArtifacts.map((artifact) => ({
          service: artifact.provider,
          model: artifact.model,
          artifactDir: `providers/${artifact.dir}`,
          status: 'succeeded'
        })),
        cost: {
          actual: {
            steps: providerArtifacts
              .filter((artifact) => artifact.cost !== undefined)
              .map((artifact) => ({ provider: artifact.provider, model: artifact.model, cost: artifact.cost }))
          }
        },
        timing: {
          actual: {
            steps: providerArtifacts
              .filter((artifact) => artifact.processingTime !== undefined)
              .map((artifact) => ({
                provider: artifact.provider,
                model: artifact.model,
                processingTimeMs: artifact.processingTime
              }))
          }
        }
      }
    })

    for (const artifact of providerArtifacts) {
      const providerDir = join(providersDir, artifact.dir)
      await mkdir(providerDir, { recursive: true })
      await writeJson(join(providerDir, 'result.json'), {
        schemaVersion: 2,
        kind: 'provider-result',
        provider: artifact.provider,
        model: artifact.model,
        metadata: artifact.processingTime === undefined ? {} : { processingTime: artifact.processingTime },
        result: { text: artifact.text }
      })
    }

    const proc = Bun.spawn([
      process.execPath,
      '.codex/skills/consensus/scripts/run.ts',
      'url',
      'build-report',
      runDir
    ], {
      stdout: 'pipe',
      stderr: 'pipe'
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      readStreamText(proc.stdout),
      readStreamText(proc.stderr),
      proc.exited
    ])
    expect(stdout).toContain('Rewrote')
    expect(stderr).toBe('')
    expect(exitCode).toBe(0)

    const report = await Bun.file(join(runDir, 'provider-comparison-report.json')).json() as {
      overall?: unknown
      overallMetric?: unknown
      overallWeights?: unknown
      tiering?: unknown
      rankingSurfaces: Record<'local' | 'service', Record<RankingSurfaceName, TtsRankingEntry[]> & {
        humanQualityUnavailableReason: string | null
      }>
    }

    expect(report.overall).toBeUndefined()
    expect(report.overallMetric).toBeUndefined()
    expect(report.overallWeights).toBeUndefined()
    expect(report.tiering).toBeUndefined()
    expectRankingSurfaces(report)
    expect(report.rankingSurfaces.service.price).toHaveLength(4)
    expect(report.rankingSurfaces.service.speed).toHaveLength(4)
    expect(report.rankingSurfaces.service.automatedQuality).toHaveLength(4)
    expect(report.rankingSurfaces.service.humanQuality).toHaveLength(0)
    expect(report.rankingSurfaces.service.humanQualityUnavailableReason).toContain('humanQualityScore')
    expect(report.rankingSurfaces.service.price.at(-1)).toMatchObject({
      providerKey: 'glm-reader',
      value: null,
      label: 'n/a'
    })
    expect(report.rankingSurfaces.service.speed.at(-1)).toMatchObject({
      providerKey: 'glm-reader',
      value: null,
      label: 'n/a'
    })
    expect(report.rankingSurfaces.service.automatedQuality[0]).toMatchObject({
      providerKey: 'firecrawl',
      metric: 'WER/CER/coverage accuracy'
    })
    expect(report.rankingSurfaces.service.automatedQuality[0]?.label).toContain('WER')
    expect(report.rankingSurfaces.service.automatedQuality[0]?.label).toContain('CER')
    expect(report.rankingSurfaces.service.automatedQuality[0]?.label).toContain('coverage')
    expect(report.rankingSurfaces.service.fastest.map((entry) => entry.providerKey)).toEqual(
      report.rankingSurfaces.service.speed.map((entry) => entry.providerKey)
    )
    expect(report.rankingSurfaces.service.cheapest.map((entry) => entry.providerKey)).toEqual(
      report.rankingSurfaces.service.price.map((entry) => entry.providerKey)
    )
    expect(report.rankingSurfaces.service.highestQuality.map((entry) => entry.providerKey)).toEqual(
      report.rankingSurfaces.service.automatedQuality.map((entry) => entry.providerKey)
    )

    const markdown = await Bun.file(join(runDir, 'provider-comparison-report.md')).text()
    expect(markdown).toContain('## Local Providers')
    expect(markdown).toContain('## Service Providers')
    expect(markdown).toContain('### Price')
    expect(markdown).toContain('### Speed')
    expect(markdown).toContain('### Automated Quality')
    expect(markdown).toContain('### Human Quality')
    expect(markdown).not.toContain('Top 3')
    expect(markdown).not.toContain('## Overall Ranking')
    expect(markdown).not.toContain('## Tier Breakdown')
    expect(markdown).not.toContain('## Ranking')
  })

  test('TTS comparison report emits grouped tier JSON without provider APIs', async () => {
    const runDir = await makeTempRoot('autoshow-tts-tiering-')
    const inputTextPath = join(runDir, 'input.txt')
    await writeFile(inputTextPath, 'A short input text for synthetic speech comparison.\n')

    const ttsEntries = [
      { ttsService: 'kitten', ttsModel: 'kitten-tts-a', speaker: 'A', processingTime: 4000, audioFileName: 'missing-local-a.wav', audioFileSize: 100, chunkCount: 1 },
      { ttsService: 'kitten', ttsModel: 'kitten-tts-b', speaker: 'B', processingTime: 1000, audioFileName: 'missing-local-b.wav', audioFileSize: 110, chunkCount: 1 },
      { ttsService: 'kitten', ttsModel: 'kitten-tts-c', speaker: 'C', processingTime: 3000, audioFileName: 'missing-local-c.wav', audioFileSize: 115, chunkCount: 1 },
      { ttsService: 'kitten', ttsModel: 'kitten-tts-d', speaker: 'D', processingTime: 2000, audioFileName: 'missing-local-d.wav', audioFileSize: 118, chunkCount: 1 },
      { ttsService: 'openai', ttsModel: 'gpt-4o-mini-tts', speaker: 'alloy', processingTime: 2500, audioFileName: 'missing-openai.wav', audioFileSize: 120, chunkCount: 1 },
      { ttsService: 'elevenlabs', ttsModel: 'eleven_v3', speaker: 'Rachel', processingTime: 900, audioFileName: 'missing-elevenlabs.wav', audioFileSize: 130, chunkCount: 1 },
      { ttsService: 'minimax', ttsModel: 'speech-02-hd', speaker: 'Wise_Woman', processingTime: 1800, audioFileName: 'missing-minimax.wav', audioFileSize: 140, chunkCount: 1 },
      { ttsService: 'cartesia', ttsModel: 'sonic-3', speaker: 'Narrator', processingTime: 3200, audioFileName: 'missing-cartesia.wav', audioFileSize: 150, chunkCount: 1 }
    ]

    const qualityByProvider: Record<string, { humanSpeechScore: number, medianWer: number }> = {
      'kitten/kitten-tts-a': { humanSpeechScore: 80, medianWer: 0.05 },
      'kitten/kitten-tts-b': { humanSpeechScore: 93, medianWer: 0.15 },
      'kitten/kitten-tts-c': { humanSpeechScore: 75, medianWer: 0.02 },
      'kitten/kitten-tts-d': { humanSpeechScore: 87, medianWer: 0.1 },
      'openai/gpt-4o-mini-tts': { humanSpeechScore: 91, medianWer: 0.04 },
      'elevenlabs/eleven_v3': { humanSpeechScore: 85, medianWer: 0.12 },
      'minimax/speech-02-hd': { humanSpeechScore: 70, medianWer: 0.01 },
      'cartesia/sonic-3': { humanSpeechScore: 94, medianWer: 0.08 }
    }

    await writeJson(join(runDir, 'run.json'), {
      schemaVersion: 2,
      kind: 'tts',
      metadata: {
        tts: ttsEntries,
        cost: {
          actual: {
            steps: [
              { provider: 'openai', model: 'gpt-4o-mini-tts', cost: 6 },
              { provider: 'elevenlabs', model: 'eleven_v3', cost: 9 },
              { provider: 'minimax', model: 'speech-02-hd', cost: 3 },
              { provider: 'cartesia', model: 'sonic-3', cost: 12 }
            ]
          }
        },
        timing: {
          actual: {
            steps: ttsEntries.map((entry) => ({
              provider: entry.ttsService,
              model: entry.ttsModel,
              processingTimeMs: entry.processingTime
            }))
          }
        }
      }
    })

    await writeJson(join(runDir, 'voice-quality-report.json'), {
      providers: ttsEntries.map((entry) => {
        const providerKey = `${entry.ttsService}/${entry.ttsModel}`
        const quality = qualityByProvider[providerKey]!
        return {
          providerKey,
          ttsService: entry.ttsService,
          ttsModel: entry.ttsModel,
          group: entry.ttsService === 'kitten' ? 'local' : 'cloud',
          humanSpeechScore: quality.humanSpeechScore,
          metricDetails: {
            roundtripStt: {
              medianWer: quality.medianWer,
              engines: []
            }
          }
        }
      })
    })

    const proc = Bun.spawn([
      process.execPath,
      '.codex/skills/consensus/scripts/run.ts',
      'tts',
      'build-report',
      runDir,
      '--input-text',
      inputTextPath
    ], {
      stdout: 'pipe',
      stderr: 'pipe'
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      readStreamText(proc.stdout),
      readStreamText(proc.stderr),
      proc.exited
    ])
    expect(stdout).toContain('Rewrote')
    expect(stderr).toContain('Missing audio files')
    expect(exitCode).toBe(0)

    const report = await Bun.file(join(runDir, 'provider-comparison-report.json')).json() as {
      rankingSurfaces: Record<'local' | 'service', Record<RankingSurfaceName, TtsRankingEntry[]>>
      providerGroups: {
        local: { count: number, providers: Array<{ tierGroup: string, groupOverallRank: number, groupTier: number }> }
        service: { count: number, providers: Array<{ tierGroup: string, groupOverallRank: number, groupTier: number }> }
      }
      tiering: {
        metric: string
        method: string
        groups: {
          local: { count: number, tiers: Array<{ count: number }> }
          thirdParty: { count: number, tiers: Array<{ count: number }> }
        }
      }
      overall?: unknown
      providers?: unknown
    }

    expect(hasOwnKeyDeep(report, deprecatedTierSplitKey)).toBe(false)
    expect(hasOwnKeyDeep(report, deprecatedOverallTierKey)).toBe(false)
    expect(report.overall).toBeUndefined()
    expect(report.providers).toBeUndefined()
    expectTtsRankingSurfaces(report)
    expect(report.tiering.metric).toBe('balanced-overall')
    expect(report.tiering.method).toBe('equal-thirds-by-group-overall-rank')
    expect(report.tiering.groups.local.tiers.map((tier) => tier.count)).toEqual([1, 1, 2])
    expect(report.tiering.groups.thirdParty.tiers.map((tier) => tier.count)).toEqual([1, 1, 2])
    expect(report.providerGroups.local.providers.every((provider) => provider.tierGroup === 'local')).toBe(true)
    expect(report.providerGroups.service.providers.every((provider) => provider.tierGroup === 'thirdParty')).toBe(true)
    expect([...report.providerGroups.local.providers, ...report.providerGroups.service.providers].every((provider) => provider.groupOverallRank > 0 && [1, 2, 3].includes(provider.groupTier))).toBe(true)
    expect(report.rankingSurfaces.local.price).toHaveLength(4)
    expect(report.rankingSurfaces.service.price).toHaveLength(4)
    expect(report.rankingSurfaces.local.speed).toHaveLength(4)
    expect(report.rankingSurfaces.service.speed).toHaveLength(4)
    expect(report.rankingSurfaces.local.automatedQuality).toHaveLength(4)
    expect(report.rankingSurfaces.service.automatedQuality).toHaveLength(4)
    expect(report.rankingSurfaces.local.humanQuality).toHaveLength(4)
    expect(report.rankingSurfaces.service.humanQuality).toHaveLength(4)
    expect(report.rankingSurfaces.local.price.every((entry) => entry.value === 0 && entry.label === '$0.00 local monetary cost')).toBe(true)
    expect(report.rankingSurfaces.service.price.map((entry) => entry.providerKey)).toEqual([
      'minimax/speech-02-hd',
      'openai/gpt-4o-mini-tts',
      'elevenlabs/eleven_v3',
      'cartesia/sonic-3'
    ])
    expect(report.rankingSurfaces.local.speed.map((entry) => entry.providerKey)).toEqual([
      'kitten/kitten-tts-b',
      'kitten/kitten-tts-d',
      'kitten/kitten-tts-c',
      'kitten/kitten-tts-a'
    ])
    expect(report.rankingSurfaces.service.speed.map((entry) => entry.providerKey)).toEqual([
      'elevenlabs/eleven_v3',
      'minimax/speech-02-hd',
      'openai/gpt-4o-mini-tts',
      'cartesia/sonic-3'
    ])
    expect(report.rankingSurfaces.local.automatedQuality.map((entry) => entry.providerKey)).toEqual([
      'kitten/kitten-tts-c',
      'kitten/kitten-tts-a',
      'kitten/kitten-tts-d',
      'kitten/kitten-tts-b'
    ])
    expect(report.rankingSurfaces.service.automatedQuality.map((entry) => entry.providerKey)).toEqual([
      'minimax/speech-02-hd',
      'openai/gpt-4o-mini-tts',
      'cartesia/sonic-3',
      'elevenlabs/eleven_v3'
    ])
    expect(report.rankingSurfaces.local.automatedQuality.every((entry) => entry.metric === 'roundtrip WER accuracy' && entry.label.includes('roundtrip WER'))).toBe(true)
    expect(report.rankingSurfaces.service.automatedQuality.every((entry) => entry.metric === 'roundtrip WER accuracy' && entry.label.includes('roundtrip WER'))).toBe(true)
    expect(report.rankingSurfaces.local.humanQuality.map((entry) => entry.providerKey)).toEqual([
      'kitten/kitten-tts-b',
      'kitten/kitten-tts-d',
      'kitten/kitten-tts-a',
      'kitten/kitten-tts-c'
    ])
    expect(report.rankingSurfaces.service.humanQuality.map((entry) => entry.providerKey)).toEqual([
      'cartesia/sonic-3',
      'openai/gpt-4o-mini-tts',
      'elevenlabs/eleven_v3',
      'minimax/speech-02-hd'
    ])
    expect(report.rankingSurfaces.local.highestQuality.map((entry) => entry.providerKey)).toEqual(
      report.rankingSurfaces.local.humanQuality.map((entry) => entry.providerKey)
    )
    expect(report.rankingSurfaces.service.highestQuality.map((entry) => entry.providerKey)).toEqual(
      report.rankingSurfaces.service.humanQuality.map((entry) => entry.providerKey)
    )
    expect(report.rankingSurfaces.local.fastest.map((entry) => entry.providerKey)).toEqual(
      report.rankingSurfaces.local.speed.map((entry) => entry.providerKey)
    )
    expect(report.rankingSurfaces.service.cheapest.map((entry) => entry.providerKey)).toEqual(
      report.rankingSurfaces.service.price.map((entry) => entry.providerKey)
    )

    const markdown = await Bun.file(join(runDir, 'provider-comparison-report.md')).text()
    expect(markdown).toContain('## Local Models')
    expect(markdown).toContain('## Third-Party Service Models')
    expect(markdown).toContain('### Price')
    expect(markdown).toContain('### Speed')
    expect(markdown).toContain('### Automated Quality')
    expect(markdown).toContain('### Human Quality')
    expect(markdown).not.toContain('Top 3')
    expect(markdown).not.toContain('## Overall Ranking')
  })
})
