import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseDeapiTimestampedTranscript, stripDeapiTimestampMarkers } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/deapi/deapi-transcript-parser'
import { parseWhisperJson, extractWhisperWords } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/parse-whisper-output'
import {
  detectCompressedTimingCoverage,
  repairZeroDurationMonotonicSegments
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-timing-quality'

const tempDirs: string[] = []

const makeTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-stt-normalization-'))
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

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('STT normalization contracts', () => {
  test('parses deAPI timestamp blocks, repairs malformed ranges, and strips markers', () => {
    const input = [
      '[0:00 - 0:03] Hello there.',
      '[0:03 - 0:02] Reversed range.',
      '[0:07 - 0:07] Zero duration final.'
    ].join('\n')

    const parsed = parseDeapiTimestampedTranscript(input, { audioDurationSeconds: 10 })

    expect(stripDeapiTimestampMarkers(input)).toBe('Hello there. Reversed range. Zero duration final.')
    expect(parsed.text).toBe('Hello there. Reversed range. Zero duration final.')
    expect(parsed.repairedRangeCount).toBe(2)
    expect(parsed.segments).toEqual([
      { start: '00:00:00', end: '00:00:03', text: 'Hello there.' },
      { start: '00:00:03', end: '00:00:07', text: 'Reversed range.' },
      { start: '00:00:07', end: '00:00:10', text: 'Zero duration final.' }
    ])
  })

  test('repairs monotonic all-zero GLM/OpenAI-compatible segment durations', () => {
    const repaired = repairZeroDurationMonotonicSegments([
      { start: '00:00:00', end: '00:00:00', text: 'first' },
      { start: '00:00:04', end: '00:00:04', text: 'second' },
      { start: '00:00:08', end: '00:00:08', text: 'third' }
    ], { knownEndSeconds: 12 })

    expect(repaired.repaired).toBe(true)
    expect(repaired.segments.map((segment) => segment.end)).toEqual(['00:00:04', '00:00:08', '00:00:12'])
  })

  test('detects compressed Gemini timing coverage with known duration', () => {
    const assessment = detectCompressedTimingCoverage([
      { start: '00:00:00', end: '00:00:02', text: 'one' },
      { start: '00:00:02', end: '00:00:04', text: 'two' },
      { start: '00:00:04', end: '00:00:06', text: 'three' }
    ], { knownEndSeconds: 60 })

    expect(assessment?.compressed).toBe(true)
    expect(assessment?.coverageRatio).toBeLessThan(0.75)
  })

  test('clamps Whisper segment and word end times to known duration', () => {
    const whisperJson = JSON.stringify({
      transcription: [
        {
          timestamps: { from: '00:00:00.000', to: '00:00:02.000' },
          offsets: { from: 0, to: 2 },
          text: 'hello'
        },
        {
          timestamps: { from: '00:00:02.000', to: '00:00:12.500' },
          offsets: { from: 2, to: 12.5 },
          text: ' world.'
        }
      ]
    })

    const words = extractWhisperWords(whisperJson, { maxEndSeconds: 10 })
    const parsed = parseWhisperJson(whisperJson, { maxEndSeconds: 10 })

    expect(words.at(-1)?.end).toBe(10)
    expect(parsed.segments.at(-1)?.end).toBe('00:00:10')
  })

  test('reference report includes quality warnings, segment stats, and duplicate groups', async () => {
    const runDir = await makeTempRoot()
    const providersDir = join(runDir, 'providers')
    await mkdir(providersDir, { recursive: true })
    await writeJson(join(runDir, 'run.json'), {
      schemaVersion: 2,
      kind: 'extract',
      metadata: {
        step1: { durationSeconds: 10, duration: '00:00:10' },
        providerStates: [
          { artifactDir: 'providers/deapi-WhisperLargeV3' },
          { artifactDir: 'providers/openai-stt-gpt-4o-transcribe' },
          { artifactDir: 'providers/supadata-auto' },
          { artifactDir: 'providers/supadata-native' }
        ],
        cost: { actual: { steps: [] } },
        timing: { actual: { steps: [] } }
      }
    })
    await writeFile(join(runDir, 'consensus-transcription.txt'), '[00:00:00] [speaker-1] Hello world.\n')

    const providerArtifacts = [
      {
        dir: 'deapi-WhisperLargeV3',
        provider: 'deapi',
        model: 'WhisperLargeV3',
        result: {
          text: 'Hello world.',
          segments: [{ start: '00:00:00', end: '00:00:05', text: 'Hello world.' }],
          evidence: {
            timingQuality: 'segment_interpolated',
            capabilities: { hasSpeakerLabels: false },
            rawResponse: { data: { result: '[0:00 - 0:05] Hello world.' } }
          }
        }
      },
      {
        dir: 'openai-stt-gpt-4o-transcribe',
        provider: 'openai-stt',
        model: 'gpt-4o-transcribe',
        result: {
          text: 'Hello world.',
          segments: [{ start: '00:00:00', end: '00:00:00', text: 'Hello world.' }],
          evidence: { timingQuality: 'coarse', capabilities: { hasSpeakerLabels: false } }
        }
      },
      {
        dir: 'supadata-auto',
        provider: 'supadata',
        model: 'auto',
        result: {
          text: 'Hello world.',
          segments: [{ start: '00:00:00', end: '00:00:05', text: 'Hello world.' }],
          evidence: { timingQuality: 'coarse', capabilities: { hasSpeakerLabels: false } }
        }
      },
      {
        dir: 'supadata-native',
        provider: 'supadata',
        model: 'native',
        result: {
          text: 'Hello world.',
          segments: [{ start: '00:00:00', end: '00:00:05', text: 'Hello world.' }],
          evidence: { timingQuality: 'coarse', capabilities: { hasSpeakerLabels: false } }
        }
      }
    ]

    for (const artifact of providerArtifacts) {
      const providerDir = join(providersDir, artifact.dir)
      await mkdir(providerDir, { recursive: true })
      await writeJson(join(providerDir, 'result.json'), {
        schemaVersion: 2,
        kind: 'provider-result',
        provider: artifact.provider,
        model: artifact.model,
        metadata: { processingTime: 1, tokenCount: 2 },
        result: artifact.result
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
      rankingSurfaces: Record<'local' | 'service', Record<'fastest' | 'cheapest' | 'highestQuality', unknown[]>>
      duplicateGroups: Array<{ providers: string[] }>
      tiering: {
        metric: string
        method: string
        remainderPolicy: string
        groups: {
          local: { count: number, tiers: Array<{ tier: number, count: number, providers: Array<{ provider: string, groupTier: number }> }> }
          thirdPartyDiarization: { count: number, tiers: Array<{ tier: number, count: number, providers: Array<{ provider: string, groupTier: number }> }> }
          thirdPartyNonDiarization: { count: number, tiers: Array<{ tier: number, count: number, providers: Array<{ provider: string, groupTier: number }> }> }
        }
      }
      providerGroups: {
        local: { count: number, providers: Array<unknown> }
        service: {
          count: number
          providers: Array<{
            provider: string
            supportsDiarization: boolean
            diarizationSupport: string
            tierGroup: string
            groupOverallRank: number
            groupTier: number
            qualityWarnings: string[]
            segmentStats: { segmentCount: number }
            duplicateGroupId?: string
          }>
        }
      }
      overall: { count: number, providers: Array<{ overallRank: number, overallScore: number }> }
      providers: Array<{ rank: number, provider: string, overallRank: number, overallScore: number }>
    }
    const serviceProviders = report.providerGroups.service.providers
    expect(report.duplicateGroups).toHaveLength(1)
    expect(report.overall.count).toBe(4)
    expect(report.overall.providers.map((provider) => provider.overallRank)).toEqual([1, 2, 3, 4])
    expect(report.providers.map((provider) => provider.rank)).toEqual([1, 2, 3, 4])
    expect(report.providers.every((provider) => provider.overallRank > 0 && provider.overallScore >= 0)).toBe(true)
    expect(Array.isArray(report.rankingSurfaces.local.fastest)).toBe(true)
    expect(Array.isArray(report.rankingSurfaces.service.highestQuality)).toBe(true)
    expect(serviceProviders.find((provider) => provider.provider === 'deapi-WhisperLargeV3')?.qualityWarnings.join(' ')).toContain('deAPI raw response')
    expect(serviceProviders.find((provider) => provider.provider === 'openai-stt-gpt-4o-transcribe')?.qualityWarnings.join(' ')).toContain('coarse')
    expect(serviceProviders.find((provider) => provider.provider === 'supadata-auto')?.duplicateGroupId).toBeDefined()
    expect(serviceProviders[0]?.segmentStats.segmentCount).toBeGreaterThan(0)
    expect(deprecatedTierSplitKey in report).toBe(false)
    expect('tiers' in report).toBe(false)
    expect(report.tiering.metric).toBe('balanced-overall')
    expect(report.tiering.method).toBe('equal-thirds-by-group-overall-rank')
    expect(report.tiering.groups.local.tiers).toHaveLength(3)
    expect(report.tiering.groups.local.tiers.map((tier) => tier.count)).toEqual([0, 0, 0])
    expect(report.tiering.groups.thirdPartyDiarization.tiers.map((tier) => tier.count)).toEqual([0, 0, 0])
    expect(report.tiering.groups.thirdPartyNonDiarization.tiers.map((tier) => tier.count)).toEqual([1, 1, 2])
    expect(report.tiering.groups.thirdPartyNonDiarization.tiers.flatMap((tier) => tier.providers).map((provider) => provider.groupTier)).toEqual([1, 2, 3, 3])
    expect(serviceProviders.every((provider) => provider.tierGroup === 'thirdPartyNonDiarization')).toBe(true)
    expect(serviceProviders.every((provider) => provider.supportsDiarization === false && provider.diarizationSupport === 'not-supported')).toBe(true)
    expect(serviceProviders.every((provider) => provider.groupOverallRank > 0 && [1, 2, 3].includes(provider.groupTier))).toBe(true)
    expect(serviceProviders.every((provider) => !(deprecatedOverallTierKey in provider))).toBe(true)

    const markdown = await Bun.file(join(runDir, 'reference-comparison-report.md')).text()
    expect(markdown).toContain('## Overall Ranking')
    expect(markdown).toContain('## Tier Breakdown')
    expect(markdown).toContain('## Ranking')
    expect(markdown).toContain('| Rank | Provider | Tier Group | Group Rank | Group Tier | Diarization | Overall / 100 | Accuracy | Speed | Cost |')
  })
})
