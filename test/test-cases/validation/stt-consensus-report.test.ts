import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import {
  analyzeAndWriteConsensusReports,
  analyzeSttRunDirectory,
  discoverAnalyzableRunDirectories
} from '~/cli/commands/setup-and-utilities/report/stt-consensus-report'
import { writeProviderResultFixture, writeRunManifestFixture } from '../../test-utils/manifest-helpers'

const toTranscriptText = (segments: Array<{ startSeconds: number, text: string, speaker?: string }>): string =>
  segments.map((segment) => {
    const hh = String(Math.floor(segment.startSeconds / 3600)).padStart(2, '0')
    const mm = String(Math.floor((segment.startSeconds % 3600) / 60)).padStart(2, '0')
    const ss = String(segment.startSeconds % 60).padStart(2, '0')
    const speakerPrefix = segment.speaker ? `[${segment.speaker}] ` : ''
    return `[${hh}:${mm}:${ss}] ${speakerPrefix}${segment.text}`
  }).join('\n')

const wordsFromSegment = (
  startSeconds: number,
  endSeconds: number,
  text: string,
  speaker?: string
) => {
  const tokens = text.split(/\s+/).filter(Boolean)
  const step = Math.max(0.2, (endSeconds - startSeconds) / Math.max(tokens.length, 1))
  return tokens.map((token, index) => ({
    startSeconds: startSeconds + (step * index),
    endSeconds: startSeconds + (step * (index + 1)),
    text: token,
    normalized: token.toLowerCase(),
    ...(speaker ? { speaker } : {}),
    timingSource: 'native'
  }))
}

const writeProviderArtifacts = async (
  runDir: string,
  providerDirName: string,
  service: string,
  model: string,
  segments: Array<{ startSeconds: number, endSeconds: number, text: string, speaker?: string }>,
  options: {
    writeResult?: boolean
    resultOverride?: Record<string, unknown>
  } = {}
): Promise<void> => {
  const providerDir = join(runDir, 'providers', providerDirName)
  await mkdir(providerDir, { recursive: true })

  const transcriptText = toTranscriptText(segments.map((segment) => ({
    startSeconds: segment.startSeconds,
    text: segment.text,
    ...(segment.speaker ? { speaker: segment.speaker } : {})
  })))

  const words = segments.flatMap((segment) => wordsFromSegment(
    segment.startSeconds,
    segment.endSeconds,
    segment.text,
    segment.speaker
  ))

  await writeFile(join(providerDir, 'transcription.txt'), `${transcriptText}\n`, 'utf8')
  if (options.writeResult !== false) {
    await writeProviderResultFixture(providerDir, service, model, {
      transcriptionService: service,
      transcriptionModel: model,
      tokenCount: words.length,
      processingTime: 1000
    }, options.resultOverride ?? {
      text: segments.map((segment) => segment.text).join(' '),
      segments: segments.map((segment) => ({
        start: `00:00:${String(segment.startSeconds).padStart(2, '0')}`,
        end: `00:00:${String(segment.endSeconds).padStart(2, '0')}`,
        text: segment.text,
        ...(segment.speaker ? { speaker: segment.speaker } : {})
      })),
      evidence: {
        segments,
        words,
        capabilities: {
          hasNativeWordTiming: true,
          hasConfidence: false,
          hasSpeakerLabels: segments.some((segment) => segment.speaker !== undefined)
        },
        timingQuality: 'native_word',
        rawResponse: {
          provider: service,
          words
        }
      }
    })
  }
}

describe('stt consensus report utilities', () => {
  test('builds evidence-backed comparison rows and a non-provider-anchored consensus transcript', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-stt-consensus-v2-'))
    const runDir = join(rootDir, '2026-04-15_sample')
    const providersDir = join(runDir, 'providers')

    try {
      await mkdir(providersDir, { recursive: true })

      await Promise.all([
        writeProviderArtifacts(runDir, 'assemblyai-universal-3-pro', 'assemblyai', 'universal-3-pro', [
          { startSeconds: 0, endSeconds: 4, text: 'JavaScript Jan starts now', speaker: 'speaker-A' },
          { startSeconds: 5, endSeconds: 7, text: 'Yeah', speaker: 'speaker-B' }
        ]),
        writeProviderArtifacts(runDir, 'deepgram-nova-3', 'deepgram', 'nova-3', [
          { startSeconds: 0, endSeconds: 4, text: 'JavaScript Jam start now', speaker: 'speaker-0' },
          { startSeconds: 5, endSeconds: 7, text: 'No', speaker: 'speaker-1' }
        ]),
        writeProviderArtifacts(runDir, 'soniox-stt-async-v4', 'soniox', 'stt-async-v4', [
          { startSeconds: 0, endSeconds: 4, text: 'Javascript Jam starts now', speaker: '1' },
          { startSeconds: 5, endSeconds: 7, text: 'Yeah', speaker: '2' }
        ])
      ])

      await writeRunManifestFixture(runDir, 'stt', {
        step1: {
          title: 'Sample episode',
          duration: '00:07',
          audioFileName: 'sample.mp3'
        },
        step2: [
          { transcriptionService: 'assemblyai', transcriptionModel: 'universal-3-pro', processingTime: 1000, tokenCount: 5 },
          { transcriptionService: 'deepgram', transcriptionModel: 'nova-3', processingTime: 1000, tokenCount: 5 },
          { transcriptionService: 'soniox', transcriptionModel: 'stt-async-v4', processingTime: 1000, tokenCount: 5 }
        ],
        requestedProviders: [
          { service: 'assemblyai', model: 'universal-3-pro' },
          { service: 'deepgram', model: 'nova-3' },
          { service: 'soniox', model: 'stt-async-v4' }
        ],
        completionStatus: 'complete',
        cost: {
          actual: {
            totalCost: 12,
            steps: [
              { provider: 'assemblyai', model: 'universal-3-pro', cost: 4 },
              { provider: 'deepgram', model: 'nova-3', cost: 5 },
              { provider: 'soniox', model: 'stt-async-v4', cost: 3 }
            ]
          }
        },
        timing: {
          actual: {
            totalProcessingTimeMs: 3000,
            steps: [
              { provider: 'assemblyai', model: 'universal-3-pro', processingTimeMs: 1000 },
              { provider: 'deepgram', model: 'nova-3', processingTimeMs: 1000 },
              { provider: 'soniox', model: 'stt-async-v4', processingTimeMs: 1000 }
            ]
          },
          aggregate: {
            wallTimeMs: 1500
          }
        }
      })

      const analysis = await analyzeSttRunDirectory(runDir)

      expect(analysis.rows).toHaveLength(2)
      expect(analysis.rows[0]?.consensusText).toBe('JavaScript Jam starts now.')
      expect(analysis.rows[0]?.variants.every((variant) => variant.text !== analysis.rows[0]?.consensusText)).toBe(true)
      expect(analysis.reviewWindows.length).toBeGreaterThanOrEqual(1)
      expect(analysis.reviewWindows.some((window) => window.consensusText === 'Yeah')).toBe(true)
      expect(analysis.providerSummary[0]?.label).toBe('soniox/stt-async-v4')
      expect(analysis.metadata.actualTotalCostCents).toBe(12)
      expect(analysis.metadata.wallTimeMs).toBe(1500)

      const written = await analyzeAndWriteConsensusReports(runDir)
      expect(written.runArtifacts).toHaveLength(1)
      expect(await readFile(join(runDir, 'consensus-transcription.txt'), 'utf8')).toContain('JavaScript Jam starts now.')
      expect(await readFile(join(runDir, 'consensus-review.md'), 'utf8')).toContain('Low consensus confidence')
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  test('supports root-output single-provider STT runs', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-stt-consensus-root-'))
    const runDir = join(rootDir, '2026-04-15_root')

    try {
      await mkdir(runDir, { recursive: true })
      await writeFile(join(runDir, 'transcription.txt'), '[00:00:00] Root transcript\n', 'utf8')
      await writeProviderResultFixture(runDir, 'assemblyai', 'universal-3-pro', {
        transcriptionService: 'assemblyai',
        transcriptionModel: 'universal-3-pro',
        tokenCount: 2,
        processingTime: 1000
      }, {
        text: 'Root transcript',
        segments: [
          { start: '00:00:00', end: '00:00:01', text: 'Root transcript' }
        ],
        evidence: {
          words: [
            {
              startSeconds: 0,
              endSeconds: 0.4,
              text: 'Root',
              normalized: 'root',
              timingSource: 'native'
            },
            {
              startSeconds: 0.4,
              endSeconds: 1,
              text: 'transcript',
              normalized: 'transcript',
              timingSource: 'native'
            }
          ],
          capabilities: {
            hasNativeWordTiming: true,
            hasConfidence: false,
            hasSpeakerLabels: false
          },
          timingQuality: 'native_word'
        }
      })
      await writeRunManifestFixture(runDir, 'write', {
        step1: { title: 'Root run', duration: '00:01' },
        step2: {
          transcriptionService: 'assemblyai',
          transcriptionModel: 'universal-3-pro',
          processingTime: 1000,
          tokenCount: 2
        }
      })

      const analysis = await analyzeSttRunDirectory(runDir)
      expect(analysis.providers).toHaveLength(1)
      expect(analysis.providers[0]?.label).toBe('assemblyai/universal-3-pro')
      expect(analysis.consensusText).toContain('Root transcript')
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  test('fails when result.json is unusable', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-stt-consensus-invalid-'))
    const runDir = join(rootDir, '2026-04-15_invalid')

    try {
      await mkdir(join(runDir, 'providers'), { recursive: true })
      await writeProviderArtifacts(
        runDir,
        'assemblyai-universal-3-pro',
        'assemblyai',
        'universal-3-pro',
        [{ startSeconds: 0, endSeconds: 1, text: 'Broken transcript' }],
        {
          resultOverride: { ok: true }
        }
      )
      await writeRunManifestFixture(runDir, 'stt', {
        step1: { title: 'Broken run', duration: '00:01' },
        step2: [{ transcriptionService: 'assemblyai', transcriptionModel: 'universal-3-pro', processingTime: 1000, tokenCount: 2 }]
      })

      await expect(analyzeSttRunDirectory(runDir)).rejects.toThrow('not a parseable STT provider result')
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  test('discovers nested run directories from a parent output directory', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-stt-consensus-discovery-'))

    try {
      const batchDir = join(rootDir, 'batch')
      const runA = join(batchDir, 'run-a')
      const runB = join(batchDir, 'run-b')
      await mkdir(join(runA, 'providers'), { recursive: true })
      await mkdir(join(runB, 'providers'), { recursive: true })
      await writeRunManifestFixture(runA, 'stt', { step1: { title: 'A', duration: '00:01' } })
      await writeRunManifestFixture(runB, 'stt', { step1: { title: 'B', duration: '00:01' } })

      const discovered = await discoverAnalyzableRunDirectories(batchDir)
      expect(discovered).toEqual([runA, runB])
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})
