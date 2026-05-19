import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { resumeGenerationTarget, hasResumableGenerationWork } from '~/cli/commands/process-steps/generation-resume-utils'
import { readRunManifest, writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import {
  resolveAdditiveResumeProviderSelection
} from '~/cli/commands/process-steps/resume/resume-provider-selection'
import { hasResumableOcrTargetWork } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/resume'
import { writeOcrRunManifest } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/manifest'
import { hasResumableSttTargetWork } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/resume'
import { writeSttRunManifest } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/manifest'
import type { OcrTarget, ResumeTarget, RuntimeOptions, SttTarget } from '~/types'

type FakeTarget = { service: string, model: string }
type FakeMetadata = { service: string, model: string, processingTime: number }

const withTempDir = async <T>(
  prefix: string,
  fn: (dir: string) => Promise<T>
): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const fakeResumeConfig = (
  selectedTargets: FakeTarget[],
  ranTargets: FakeTarget[]
) => ({
  kind: 'image' as const,
  metadataKey: 'image',
  stepLabel: 'Fake image',
  providerFlags: ['fake-provider'],
  getSuccessKey: (entry: FakeMetadata) =>
    getGenerationTargetKey(entry.service, entry.model),
  collectTargets: () => selectedTargets,
  collectTargetsForProviders: (providers: FakeTarget[]) =>
    providers.map((provider) => ({ ...provider })),
  runMissingTargets: async (targets: FakeTarget[]) => {
    ranTargets.push(...targets)
    return targets.map((target) => ({
      ...target,
      processingTime: 1
    }))
  },
  rebuildRunMetadata: (metadata: FakeMetadata[]) => ({
    cost: {
      actual: {
        totalCost: 0,
        steps: metadata.map((entry) => ({
          step: 'image',
          provider: entry.service,
          model: entry.model,
          cost: 0
        }))
      }
    },
    timing: {
      actual: {
        totalProcessingTimeMs: metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
        steps: []
      }
    }
  })
})

const writeFakeImageRun = async (
  dir: string,
  requestedProviders: FakeTarget[],
  metadata: FakeMetadata[]
): Promise<void> => {
  await writeRunManifest(dir, 'image', {
    input: 'prompt',
    requestedProviders,
    image: metadata
  })
}

const fakeTarget = (dir: string): ResumeTarget => ({
  kind: 'image',
  scope: 'single',
  dir,
  manifestPath: join(dir, 'run.json')
})

describe('additive resume provider selection', () => {
  test('shared resolver preserves stored order and appends new selected providers', () => {
    const openai = { service: 'openai', model: 'gpt-image-1.5' }
    const gemini = { service: 'gemini', model: 'imagen-4.0-fast-generate-001' }
    const runway = { service: 'runway', model: 'gen4.5' }

    const resolved = resolveAdditiveResumeProviderSelection({
      storedProviders: [openai, gemini],
      runnableStoredProviders: [gemini],
      selectedProviders: [runway, openai, gemini],
      successfulProviderKeys: new Set([getGenerationTargetKey(openai.service, openai.model)])
    })

    expect(resolved.requestedProviders).toEqual([openai, gemini, runway])
    expect(resolved.providersToRun).toEqual([runway, gemini])
    expect(resolved.skippedSuccessfulProviders).toEqual([openai])
  })

  test('generation resume without provider flags retries stored missing providers', async () => {
    await withTempDir('autoshow-generation-additive-missing-', async (dir) => {
      const openai = { service: 'openai', model: 'gpt-image-1.5' }
      const gemini = { service: 'gemini', model: 'imagen-4.0-fast-generate-001' }
      const ranTargets: FakeTarget[] = []
      await writeFakeImageRun(dir, [openai, gemini], [{ ...openai, processingTime: 10 }])

      await expect(hasResumableGenerationWork(
        fakeTarget(dir),
        fakeResumeConfig([], ranTargets),
        {} as RuntimeOptions,
        new Set()
      )).resolves.toBe(true)

      await resumeGenerationTarget(
        fakeTarget(dir),
        fakeResumeConfig([], ranTargets),
        {} as RuntimeOptions,
        new Set()
      )

      const manifest = await readRunManifest(dir, 'image')
      expect(ranTargets).toEqual([gemini])
      expect(manifest?.metadata['requestedProviders']).toEqual([openai, gemini])
      expect(manifest?.metadata['image']).toEqual([
        { ...openai, processingTime: 10 },
        { ...gemini, processingTime: 1 }
      ])
    })
  })

  test('generation resume appends explicit new providers to a full run', async () => {
    await withTempDir('autoshow-generation-additive-new-', async (dir) => {
      const openai = { service: 'openai', model: 'gpt-image-1.5' }
      const gemini = { service: 'gemini', model: 'imagen-4.0-fast-generate-001' }
      const ranTargets: FakeTarget[] = []
      await writeFakeImageRun(dir, [openai], [{ ...openai, processingTime: 10 }])

      await resumeGenerationTarget(
        fakeTarget(dir),
        fakeResumeConfig([gemini], ranTargets),
        {} as RuntimeOptions,
        new Set(['fake-provider'])
      )

      const manifest = await readRunManifest(dir, 'image')
      expect(ranTargets).toEqual([gemini])
      expect(manifest?.metadata['requestedProviders']).toEqual([openai, gemini])
    })
  })

  test('generation resume skips already successful explicit providers', async () => {
    await withTempDir('autoshow-generation-additive-skip-', async (dir) => {
      const openai = { service: 'openai', model: 'gpt-image-1.5' }
      const ranTargets: FakeTarget[] = []
      await writeFakeImageRun(dir, [openai], [{ ...openai, processingTime: 10 }])

      await expect(hasResumableGenerationWork(
        fakeTarget(dir),
        fakeResumeConfig([openai], ranTargets),
        {} as RuntimeOptions,
        new Set(['fake-provider'])
      )).resolves.toBe(false)

      await resumeGenerationTarget(
        fakeTarget(dir),
        fakeResumeConfig([openai], ranTargets),
        {} as RuntimeOptions,
        new Set(['fake-provider'])
      )

      expect(ranTargets).toEqual([])
    })
  })

  test('STT and OCR resume target checks include explicit new providers', async () => {
    await withTempDir('autoshow-extract-additive-targets-', async (dir) => {
      const sttDir = join(dir, 'stt')
      const ocrDir = join(dir, 'ocr')
      await Promise.all([
        mkdir(sttDir, { recursive: true }),
        mkdir(ocrDir, { recursive: true })
      ])

      const whisper: SttTarget = { service: 'whisper', model: 'tiny', local: true }
      const deepgram: SttTarget = { service: 'deepgram', model: 'nova-3', local: false }
      await writeSttRunManifest(sttDir, {
        step1: { url: 'file:///tmp/audio.mp3' },
        completionStatus: 'full',
        requestedProviders: [whisper],
        providerStates: [{
          service: 'whisper',
          model: 'tiny',
          local: true,
          artifactDir: '.',
          status: 'succeeded',
          attempts: 1
        }]
      })

      const tesseract: OcrTarget = { service: 'tesseract', model: 'tesseract' }
      const openaiOcr: OcrTarget = { service: 'openai', model: 'gpt-5.4-mini' }
      await writeOcrRunManifest(ocrDir, {
        source: { filePath: '/tmp/document.pdf' },
        completionStatus: 'full',
        requestedProviders: [tesseract],
        providerStates: [{
          service: 'tesseract',
          model: 'tesseract',
          artifactDir: '.',
          status: 'succeeded',
          attempts: 1
        }]
      })

      await expect(hasResumableSttTargetWork(
        {
          kind: 'extract',
          extractRoute: 'media',
          scope: 'single',
          dir: sttDir,
          manifestPath: join(sttDir, 'run.json')
        },
        [deepgram],
        { youtubeCaptions: false, currentTargets: [deepgram] }
      )).resolves.toBe(true)
      await expect(hasResumableSttTargetWork(
        {
          kind: 'extract',
          extractRoute: 'media',
          scope: 'single',
          dir: sttDir,
          manifestPath: join(sttDir, 'run.json')
        },
        [whisper],
        { youtubeCaptions: false, currentTargets: [whisper] }
      )).resolves.toBe(false)

      await expect(hasResumableOcrTargetWork(
        {
          kind: 'extract',
          extractRoute: 'document',
          scope: 'single',
          dir: ocrDir,
          manifestPath: join(ocrDir, 'run.json')
        },
        [openaiOcr]
      )).resolves.toBe(true)
      await expect(hasResumableOcrTargetWork(
        {
          kind: 'extract',
          extractRoute: 'document',
          scope: 'single',
          dir: ocrDir,
          manifestPath: join(ocrDir, 'run.json')
        },
        [tesseract]
      )).resolves.toBe(false)
    })
  })
})
