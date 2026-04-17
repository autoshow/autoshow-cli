import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readOcrBatchManifestEntries, readOcrRunManifestEntry, writeOcrBatchManifest, writeOcrRunManifest } from '~/cli/commands/process-steps/step-2-ocr/manifest'
import { readSttBatchManifestEntries, readSttProviderCheckpoint, readSttRunManifestEntry, writeSttBatchManifest, writeSttProviderCheckpoint, writeSttRunManifest } from '~/cli/commands/process-steps/step-2-stt/manifest'
import { readPersistedAsyncSttRuntime } from '~/cli/commands/process-steps/step-2-stt/async-lifecycle'

const createTempDir = async (prefix: string): Promise<string> =>
  await mkdtemp(join(tmpdir(), prefix))

test('STT run and batch manifests round-trip through compatibility readers', async () => {
  const runDir = await createTempDir('autoshow-stt-run-manifest-')
  const batchDir = await createTempDir('autoshow-stt-batch-manifest-')

  try {
    const runMetadata = {
      step1: { slug: 'episode-1' },
      step2: {
        transcriptionService: 'whisper',
        transcriptionModel: 'tiny',
        processingTime: 123,
        tokenCount: 4
      }
    }
    const batchEntries = [
      { outputDir: runDir, title: 'Episode 1' }
    ]

    await writeSttRunManifest(runDir, runMetadata)
    await writeSttBatchManifest(batchDir, batchEntries, { sourceKind: 'directory' })

    await expect(readSttRunManifestEntry(runDir)).resolves.toEqual(runMetadata)
    await expect(readSttBatchManifestEntries(batchDir)).resolves.toEqual({
      manifestPath: join(batchDir, 'batch.json'),
      entries: batchEntries
    })
  } finally {
    await rm(runDir, { recursive: true, force: true })
    await rm(batchDir, { recursive: true, force: true })
  }
})

test('STT async runtime falls back to checkpoint.json when metadata.json is absent', async () => {
  const providerDir = await createTempDir('autoshow-stt-checkpoint-')

  try {
    const metadata = {
      transcriptionService: 'assemblyai',
      transcriptionModel: 'universal-2',
      processingTime: 50,
      tokenCount: 0,
      runtime: {
        mode: 'resumed',
        stage: 'polling',
        remoteJobId: 'job-123',
        lastPollAt: '2026-04-16T00:00:00.000Z'
      }
    }

    await writeSttProviderCheckpoint(providerDir, 'assemblyai', 'universal-2', metadata)

    await expect(readSttProviderCheckpoint(providerDir)).resolves.toEqual(metadata)
    await expect(readPersistedAsyncSttRuntime(providerDir, {
      transcriptionService: 'assemblyai',
      transcriptionModel: 'universal-2'
    })).resolves.toEqual({
      mode: 'resumed',
      stage: 'polling',
      remoteJobId: 'job-123',
      lastPollAt: '2026-04-16T00:00:00.000Z'
    })
  } finally {
    await rm(providerDir, { recursive: true, force: true })
  }
})

test('OCR run and batch manifests round-trip through compatibility readers', async () => {
  const runDir = await createTempDir('autoshow-ocr-run-manifest-')
  const batchDir = await createTempDir('autoshow-ocr-batch-manifest-')

  try {
    const runMetadata = {
      step1: { slug: 'document-1' },
      step2: {
        extractionMethod: 'pdf+tesseract',
        totalPages: 1,
        ocrPages: 1,
        textPages: 0,
        processingTime: 100,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 10
      }
    }
    const batchEntries = [
      { outputDir: runDir, title: 'Document 1' }
    ]

    await writeOcrRunManifest(runDir, runMetadata)
    await writeOcrBatchManifest(batchDir, batchEntries, { sourceKind: 'directory' })

    await expect(readOcrRunManifestEntry(runDir)).resolves.toEqual(runMetadata)
    await expect(readOcrBatchManifestEntries(batchDir)).resolves.toEqual({
      manifestPath: join(batchDir, 'batch.json'),
      entries: batchEntries
    })
  } finally {
    await rm(runDir, { recursive: true, force: true })
    await rm(batchDir, { recursive: true, force: true })
  }
})
