import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import {
  readBatchManifest,
  readExtractBatchManifest,
  readRunManifest,
  writeBatchManifest,
  writeExtractBatchManifest
} from '~/cli/commands/process-steps/manifest-utils'
import { dispatchResume } from '~/cli/commands/process-steps/resume/resume-dispatch'
import { getResumeHandler } from '~/cli/commands/process-steps/resume/resume-registry'
import { readOcrRunManifestEntry, writeOcrBatchManifest, writeOcrRunManifest } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/manifest'
import { readSttRunManifestEntry, writeSttBatchManifest, writeSttRunManifest } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/manifest'

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

const writeJson = async (
  path: string,
  value: unknown
): Promise<void> => {
  await Bun.write(path, `${JSON.stringify(value, null, 2)}\n`)
}

describe('manifest schema contracts', () => {
  test('legacy STT/OCR run manifests are rejected by manifest readers and resume', async () => {
    for (const kind of ['stt', 'ocr'] as const) {
      await withTempDir(`autoshow-legacy-${kind}-run-`, async (dir) => {
        await writeJson(join(dir, 'run.json'), {
          schemaVersion: 2,
          kind,
          metadata: {
            outputDir: dir
          }
        })

        await expect(readRunManifest(dir)).rejects.toThrow(`legacy "${kind}" manifests are no longer supported`)
        await expect(dispatchResume(dir, {})).rejects.toThrow(`legacy "${kind}" manifests are no longer supported`)
      })
    }
  })

  test('legacy STT/OCR batch manifests are rejected by manifest readers and resume', async () => {
    for (const kind of ['stt', 'ocr'] as const) {
      await withTempDir(`autoshow-legacy-${kind}-batch-`, async (dir) => {
        await writeJson(join(dir, 'batch.json'), {
          schemaVersion: 2,
          kind,
          items: []
        })

        await expect(readBatchManifest(dir)).rejects.toThrow(`legacy "${kind}" manifests are no longer supported`)
        await expect(dispatchResume(dir, {})).rejects.toThrow(`legacy "${kind}" manifests are no longer supported`)
      })
    }
  })

  test('extract batch schema v1 is rejected by manifest readers and resume', async () => {
    await withTempDir('autoshow-legacy-extract-batch-', async (dir) => {
      await writeJson(join(dir, 'extract-batch.json'), {
        schemaVersion: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        items: [{
          input: 'input/examples/audio/1-audio.mp3',
          inputFamily: 'media',
          routedChildKind: 'stt',
          childBatchEntry: {
            kind: 'stt',
            index: 0
          },
          completionStatus: 'full'
        }],
        childBatches: {
          stt: 'stt',
          ocr: 'ocr'
        }
      })

      await expect(readExtractBatchManifest(dir)).rejects.toThrow('extract batch schema v1 is no longer supported')
      await expect(dispatchResume(dir, {})).rejects.toThrow('extract batch schema v1 is no longer supported')
    })
  })

  test('STT and OCR manifest writers serialize extract kind with extractRoute metadata', async () => {
    await withTempDir('autoshow-extract-run-manifests-', async (dir) => {
      const mediaRunDir = join(dir, 'media-run')
      const documentRunDir = join(dir, 'document-run')
      const mediaBatchDir = join(dir, 'media-batch')
      const documentBatchDir = join(dir, 'document-batch')
      await Promise.all([
        mkdir(mediaRunDir, { recursive: true }),
        mkdir(documentRunDir, { recursive: true }),
        mkdir(mediaBatchDir, { recursive: true }),
        mkdir(documentBatchDir, { recursive: true })
      ])

      await writeSttRunManifest(mediaRunDir, { extractRoute: 'document', marker: 'media' })
      await writeOcrRunManifest(documentRunDir, { extractRoute: 'media', marker: 'document' })
      await writeSttBatchManifest(mediaBatchDir, [{ input: 'audio.mp3', completionStatus: 'full' }])
      await writeOcrBatchManifest(documentBatchDir, [{ input: 'document.pdf', completionStatus: 'full' }])

      const mediaRun = await readRunManifest(mediaRunDir)
      const documentRun = await readRunManifest(documentRunDir)
      const mediaBatch = await readBatchManifest(mediaBatchDir, 'extract')
      const documentBatch = await readBatchManifest(documentBatchDir, 'extract')

      expect(mediaRun?.kind).toBe('extract')
      expect(mediaRun?.metadata['extractRoute']).toBe('media')
      expect(documentRun?.kind).toBe('extract')
      expect(documentRun?.metadata['extractRoute']).toBe('document')
      expect(await readSttRunManifestEntry(mediaRunDir)).toMatchObject({ extractRoute: 'media', marker: 'media' })
      expect(await readOcrRunManifestEntry(mediaRunDir)).toBeUndefined()
      expect(await readOcrRunManifestEntry(documentRunDir)).toMatchObject({ extractRoute: 'document', marker: 'document' })
      expect(await readSttRunManifestEntry(documentRunDir)).toBeUndefined()
      expect(mediaBatch?.manifest.kind).toBe('extract')
      expect(mediaBatch?.manifest.items[0]?.['extractRoute']).toBe('media')
      expect(documentBatch?.manifest.kind).toBe('extract')
      expect(documentBatch?.manifest.items[0]?.['extractRoute']).toBe('document')
      expect(await Bun.file(join(mediaBatchDir, 'stt-summary.json')).exists()).toBe(true)
    })
  })

  test('route-based extract batch manifests are accepted by resume handlers', async () => {
    await withTempDir('autoshow-extract-route-resume-', async (dir) => {
      const mediaDir = join(dir, 'media')
      const documentDir = join(dir, 'document')
      const mediaOutputDir = join(dir, 'media-output')
      const documentOutputDir = join(dir, 'document-output')
      await Promise.all([
        mkdir(mediaDir, { recursive: true }),
        mkdir(documentDir, { recursive: true }),
        mkdir(mediaOutputDir, { recursive: true }),
        mkdir(documentOutputDir, { recursive: true })
      ])

      await writeBatchManifest(mediaDir, 'extract', [{
        input: 'input/examples/audio/1-audio.mp3',
        extractRoute: 'media',
        outputDir: mediaOutputDir,
        completionStatus: 'full',
        step1: { url: 'file:///tmp/autoshow-audio.mp3' },
        step2: { transcriptionService: 'whisper', transcriptionModel: 'tiny' },
        requestedProviders: [{ service: 'whisper', model: 'tiny', local: true }],
        providerStates: [{
          service: 'whisper',
          model: 'tiny',
          local: true,
          status: 'succeeded',
          artifactDir: 'providers/whisper-tiny',
          attempts: 1
        }]
      }])
      await writeBatchManifest(documentDir, 'extract', [{
        input: 'input/examples/document/1-document.pdf',
        extractRoute: 'document',
        outputDir: documentOutputDir,
        completionStatus: 'full',
        source: { filePath: '/tmp/autoshow-document.pdf' },
        requestedProviders: [{ service: 'tesseract', model: 'tesseract' }],
        providerStates: [{
          service: 'tesseract',
          model: 'tesseract',
          status: 'succeeded',
          artifactDir: 'providers/tesseract',
          attempts: 1
        }]
      }])
      await writeExtractBatchManifest(dir, {
        schemaVersion: 2,
        createdAt: '2026-01-01T00:00:00.000Z',
        childBatches: {
          media: 'media',
          document: 'document'
        },
        items: [
          {
            input: 'input/examples/audio/1-audio.mp3',
            inputFamily: 'media',
            extractRoute: 'media',
            childBatchEntry: { route: 'media', index: 0 },
            completionStatus: 'full',
            outputDir: 'media-output'
          },
          {
            input: 'input/examples/document/1-document.pdf',
            inputFamily: 'document',
            extractRoute: 'document',
            childBatchEntry: { route: 'document', index: 0 },
            completionStatus: 'full',
            outputDir: 'document-output'
          }
        ]
      })

      const handler = getResumeHandler('extract')
      expect(handler).toBeDefined()
      if (!handler) {
        return
      }

      const opts = buildOptsFromFlags(false, {})
      await expect(handler.hasResumableWork({
        kind: 'extract',
        scope: 'batch',
        dir,
        manifestPath: join(dir, 'extract-batch.json')
      }, opts, new Set())).resolves.toBe(false)
      await expect(handler.hasResumableWork({
        kind: 'extract',
        extractRoute: 'media',
        scope: 'batch',
        dir: mediaDir,
        manifestPath: join(mediaDir, 'batch.json')
      }, opts, new Set())).resolves.toBe(false)
      await expect(handler.hasResumableWork({
        kind: 'extract',
        extractRoute: 'document',
        scope: 'batch',
        dir: documentDir,
        manifestPath: join(documentDir, 'batch.json')
      }, opts, new Set())).resolves.toBe(false)
    })
  })
})
