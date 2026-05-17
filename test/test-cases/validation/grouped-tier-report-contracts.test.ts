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

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('grouped tier report contracts', () => {
  test('OCR comparison report tiers local and third-party providers independently', async () => {
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
      rankingSurfaces: Record<'local' | 'service', Record<'fastest' | 'cheapest' | 'highestQuality', unknown[]>>
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
    expectRankingSurfaces(report)
    expect(report.tiering.metric).toBe('balanced-overall')
    expect(report.tiering.method).toBe('equal-thirds-by-group-overall-rank')
    expect(report.tiering.groups.local.count).toBe(2)
    expect(report.tiering.groups.local.tiers.map((tier) => tier.count)).toEqual([1, 1, 0])
    expect(report.tiering.groups.thirdParty.count).toBe(2)
    expect(report.tiering.groups.thirdParty.tiers.map((tier) => tier.count)).toEqual([1, 1, 0])
    expect(report.providerGroups.local.providers.every((provider) => provider.tierGroup === 'local')).toBe(true)
    expect(report.providerGroups.service.providers.every((provider) => provider.tierGroup === 'thirdParty')).toBe(true)
    expect([...report.providerGroups.local.providers, ...report.providerGroups.service.providers].every((provider) => provider.groupOverallRank > 0 && [1, 2, 3].includes(provider.groupTier))).toBe(true)

    const markdown = await Bun.file(join(runDir, 'provider-comparison-report.md')).text()
    expect(markdown).toContain('## Local Providers')
    expect(markdown).toContain('## Service Providers')
    expect(markdown).toContain('### Top 3 Highest Quality')
    expect(markdown).not.toContain('## Overall Ranking')
  })

  test('STT comparison report splits service tiers by diarization support', async () => {
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
      rankingSurfaces: Record<'local' | 'service', Record<'fastest' | 'cheapest' | 'highestQuality', unknown[]>>
      providerGroups: {
        local: { count: number, providers: Array<{ supportsDiarization: boolean, tierGroup: string, groupOverallRank: number, groupTier: number }> }
        service: { count: number, providers: Array<{ supportsDiarization: boolean, tierGroup: string, groupOverallRank: number, groupTier: number }> }
      }
      tiering: {
        metric: string
        method: string
        groups: {
          local: { count: number, tiers: Array<{ count: number }> }
          thirdPartyDiarization: { count: number, tiers: Array<{ count: number }> }
          thirdPartyNonDiarization: { count: number, tiers: Array<{ count: number }> }
        }
      }
      overall?: unknown
      providers?: unknown
    }

    expect(hasOwnKeyDeep(report, deprecatedTierSplitKey)).toBe(false)
    expect(hasOwnKeyDeep(report, deprecatedOverallTierKey)).toBe(false)
    expect(report.overall).toBeUndefined()
    expect(report.providers).toBeUndefined()
    expectRankingSurfaces(report)
    expect(report.tiering.metric).toBe('balanced-overall')
    expect(report.tiering.method).toBe('equal-thirds-by-group-overall-rank')
    expect(report.tiering.groups.local.tiers.map((tier) => tier.count)).toEqual([1, 0, 0])
    expect(report.tiering.groups.thirdPartyDiarization.tiers.map((tier) => tier.count)).toEqual([1, 1, 0])
    expect(report.tiering.groups.thirdPartyNonDiarization.tiers.map((tier) => tier.count)).toEqual([1, 1, 0])
    expect(report.providerGroups.service.providers.filter((provider) => provider.supportsDiarization).every((provider) => provider.tierGroup === 'thirdPartyDiarization')).toBe(true)
    expect(report.providerGroups.service.providers.filter((provider) => !provider.supportsDiarization).every((provider) => provider.tierGroup === 'thirdPartyNonDiarization')).toBe(true)
    expect([...report.providerGroups.local.providers, ...report.providerGroups.service.providers].every((provider) => provider.groupOverallRank > 0 && [1, 2, 3].includes(provider.groupTier))).toBe(true)

    const markdown = await Bun.file(join(runDir, 'reference-comparison-report.md')).text()
    expect(markdown).toContain('## Local Providers')
    expect(markdown).toContain('## Service Providers')
    expect(markdown).toContain('### Top 3 Highest Quality')
    expect(markdown).not.toContain('## Overall Ranking')
  })

  test('TTS comparison report emits grouped tier JSON without provider APIs', async () => {
    const runDir = await makeTempRoot('autoshow-tts-tiering-')
    const inputTextPath = join(runDir, 'input.txt')
    await writeFile(inputTextPath, 'A short input text for synthetic speech comparison.\n')

    const ttsEntries = [
      { ttsService: 'kitten', ttsModel: 'kitten-tts-nano', speaker: 'A', processingTime: 1000, audioFileName: 'missing-local-a.wav', audioFileSize: 100, chunkCount: 1 },
      { ttsService: 'kitten', ttsModel: 'kitten-tts-mini', speaker: 'B', processingTime: 2000, audioFileName: 'missing-local-b.wav', audioFileSize: 110, chunkCount: 1 },
      { ttsService: 'openai', ttsModel: 'gpt-4o-mini-tts', speaker: 'alloy', processingTime: 1500, audioFileName: 'missing-openai.wav', audioFileSize: 120, chunkCount: 1 },
      { ttsService: 'elevenlabs', ttsModel: 'eleven_v3', speaker: 'Rachel', processingTime: 3000, audioFileName: 'missing-elevenlabs.wav', audioFileSize: 130, chunkCount: 1 }
    ]

    await writeJson(join(runDir, 'run.json'), {
      schemaVersion: 2,
      kind: 'tts',
      metadata: {
        tts: ttsEntries,
        cost: {
          actual: {
            steps: [
              { provider: 'openai', model: 'gpt-4o-mini-tts', cost: 0.2 },
              { provider: 'elevenlabs', model: 'eleven_v3', cost: 0.4 }
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
      rankingSurfaces: Record<'local' | 'service', Record<'fastest' | 'cheapest' | 'highestQuality', unknown[]>>
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
    expectRankingSurfaces(report)
    expect(report.tiering.metric).toBe('balanced-overall')
    expect(report.tiering.method).toBe('equal-thirds-by-group-overall-rank')
    expect(report.tiering.groups.local.tiers.map((tier) => tier.count)).toEqual([1, 1, 0])
    expect(report.tiering.groups.thirdParty.tiers.map((tier) => tier.count)).toEqual([1, 1, 0])
    expect(report.providerGroups.local.providers.every((provider) => provider.tierGroup === 'local')).toBe(true)
    expect(report.providerGroups.service.providers.every((provider) => provider.tierGroup === 'thirdParty')).toBe(true)
    expect([...report.providerGroups.local.providers, ...report.providerGroups.service.providers].every((provider) => provider.groupOverallRank > 0 && [1, 2, 3].includes(provider.groupTier))).toBe(true)

    const markdown = await Bun.file(join(runDir, 'provider-comparison-report.md')).text()
    expect(markdown).toContain('## Local Providers')
    expect(markdown).toContain('## Service Providers')
    expect(markdown).toContain('### Top 3 Highest Quality')
    expect(markdown).not.toContain('## Overall Ranking')
  })
})
