import { afterEach, expect, test } from 'bun:test'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import {
  collectInputFiles,
  planBatchInputsForCommand,
  processBatch
} from '~/cli/commands/process-steps/step-1-download/targets/target-utils'
import { resolveInputListBatch } from '~/cli/commands/process-steps/step-1-download/targets/url-list-target'
import { readBatchItems, readSttBatchSummary, writeRunManifestFixture } from '../../test-utils/manifest-helpers'
import { runCommand, STABLE_LOCAL_AUDIO_PATH } from '../../test-utils/test-helpers'

const createdPaths: string[] = []
const pdfFixture = resolve('input/examples/document/1-document.pdf')
const audioFixture = resolve(STABLE_LOCAL_AUDIO_PATH)

afterEach(async () => {
  await Promise.all(createdPaths.splice(0).map(async (path) => {
    await rm(path, { recursive: true, force: true }).catch(() => {})
  }))
})

const createMixedInputDir = async (): Promise<{ dir: string, audioPath: string, pdfPath: string }> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-step2-family-'))
  const audioPath = join(dir, '1-audio.mp3')
  const pdfPath = join(dir, '2-document.pdf')
  await copyFile(audioFixture, audioPath)
  await copyFile(pdfFixture, pdfPath)
  createdPaths.push(dir)
  return { dir, audioPath, pdfPath }
}

test('mixed directory planning skips wrong-family items consistently for stt and ocr', async () => {
  const { dir, audioPath, pdfPath } = await createMixedInputDir()
  const items = (await collectInputFiles(dir)).sort()
  const sttOpts = buildOptsFromFlags(false, { 'assemblyai-stt': 'universal-3-pro' })
  const ocrOpts = buildOptsFromFlags(false, { 'tesseract-ocr': true })

  const sttPlan = await planBatchInputsForCommand('stt', items, sttOpts)
  expect(sttPlan.items).toEqual([audioPath])
  expect(sttPlan.plannedInputs).toMatchObject([
    {
      input: audioPath,
      inputFamily: 'media',
      resolvedStep2: {
        route: 'stt',
        sourceKind: 'media',
        providers: [{ service: 'assemblyai', model: 'universal-3-pro' }]
      }
    },
    {
      input: pdfPath,
      inputFamily: 'document',
      resolvedStep2: {
        route: 'ocr',
        sourceKind: 'pdf',
        providers: [{ service: 'tesseract', model: 'tesseract' }]
      }
    }
  ])
  expect(sttPlan.initialEntries).toMatchObject([
    {
      url: `file://${audioPath}`,
      inputFamily: 'media',
      step2Route: 'stt'
    },
    {
      url: `file://${pdfPath}`,
      completionStatus: 'skipped',
      inputFamily: 'document',
      step2Route: 'ocr',
      skipReason: 'stt only processes media inputs; use ocr or write for documents and articles'
    }
  ])

  const ocrPlan = await planBatchInputsForCommand('ocr', items, ocrOpts)
  expect(ocrPlan.items).toEqual([pdfPath])
  expect(ocrPlan.plannedInputs).toMatchObject([
    {
      input: audioPath,
      inputFamily: 'media',
      resolvedStep2: {
        route: 'stt',
        sourceKind: 'media',
        providers: [{ service: 'whisper', model: 'tiny' }]
      }
    },
    {
      input: pdfPath,
      inputFamily: 'document',
      resolvedStep2: {
        route: 'ocr',
        sourceKind: 'pdf',
        providers: [{ service: 'tesseract', model: 'tesseract' }]
      }
    }
  ])
  expect(ocrPlan.initialEntries).toMatchObject([
    {
      url: `file://${audioPath}`,
      completionStatus: 'skipped',
      inputFamily: 'media',
      step2Route: 'stt',
      skipReason: 'ocr only processes documents, images, and HTML articles; use stt or write for media'
    },
    {
      url: `file://${pdfPath}`,
      inputFamily: 'document',
      step2Route: 'ocr'
    }
  ])
})

test('mixed input-list planning keeps selectedItems aligned after skip filtering', async () => {
  const { audioPath, pdfPath } = await createMixedInputDir()
  const inputListDir = await mkdtemp(join(tmpdir(), 'autoshow-step2-family-list-'))
  const inputListPath = join(inputListDir, 'inputs.md')
  createdPaths.push(inputListDir)
  await writeFile(inputListPath, `${audioPath}\n${pdfPath}\n`)

  const sttOpts = buildOptsFromFlags(false, { 'assemblyai-stt': 'universal-3-pro' })
  const ocrOpts = buildOptsFromFlags(false, { 'tesseract-ocr': true })
  const resolved = await resolveInputListBatch(inputListPath, 'stt', sttOpts)

  const sttPlan = await planBatchInputsForCommand('stt', resolved.selectedUrls, sttOpts, resolved.selectedItems)
  expect(sttPlan.items).toEqual([audioPath])
  expect(sttPlan.selectedItems?.map((item) => item?.url)).toEqual([audioPath])
  expect(sttPlan.initialEntries[1]).toMatchObject({
    url: pdfPath,
    completionStatus: 'skipped',
    inputFamily: 'document'
  })

  const ocrPlan = await planBatchInputsForCommand('ocr', resolved.selectedUrls, ocrOpts, resolved.selectedItems)
  expect(ocrPlan.items).toEqual([pdfPath])
  expect(ocrPlan.selectedItems?.map((item) => item?.url)).toEqual([pdfPath])
  expect(ocrPlan.initialEntries[0]).toMatchObject({
    url: audioPath,
    completionStatus: 'skipped',
    inputFamily: 'media'
  })
})

test('extract mixed-family planning preserves original order and routed child kinds', async () => {
  const { dir, audioPath, pdfPath } = await createMixedInputDir()
  const items = (await collectInputFiles(dir)).sort()
  const extractOpts = buildOptsFromFlags(false, {
    'assemblyai-stt': 'universal-3-pro',
    'tesseract-ocr': true
  })

  const extractPlan = await planBatchInputsForCommand('extract', items, extractOpts)
  expect(extractPlan.items).toEqual([audioPath, pdfPath])
  expect(extractPlan.plannedInputs).toMatchObject([
    {
      input: audioPath,
      inputFamily: 'media',
      routedChildKind: 'stt',
      resolvedStep2: {
        route: 'stt',
        sourceKind: 'media',
        providers: [{ service: 'assemblyai', model: 'universal-3-pro' }]
      }
    },
    {
      input: pdfPath,
      inputFamily: 'document',
      routedChildKind: 'ocr',
      resolvedStep2: {
        route: 'ocr',
        sourceKind: 'pdf',
        providers: [{ service: 'tesseract', model: 'tesseract' }]
      }
    }
  ])
  expect(extractPlan.initialEntries).toMatchObject([
    {
      url: `file://${audioPath}`,
      inputFamily: 'media',
      step2Route: 'stt'
    },
    {
      url: `file://${pdfPath}`,
      inputFamily: 'document',
      step2Route: 'ocr'
    }
  ])
  expect(extractPlan.resultEntryIndexes).toEqual([0, 1])
})

test('processBatch preserves skipped STT manifest entries and summary totals', async () => {
  const { audioPath, pdfPath } = await createMixedInputDir()
  const opts = buildOptsFromFlags(false, { 'assemblyai-stt': 'universal-3-pro' })
  const batchPlan = await planBatchInputsForCommand('stt', [audioPath, pdfPath], opts)

  const result = await processBatch(
    batchPlan.items,
    `stt-family-skip-${Date.now()}`,
    'stt',
    opts,
    async (_command, item, batchDir) => {
      const outputDir = join(batchDir, 'item-1')
      await mkdir(outputDir, { recursive: true })
      await writeRunManifestFixture(outputDir, 'stt', {
        step1: {
          title: 'audio-item',
          slug: 'audio-item',
          url: `file://${item}`
        },
        step2: [
          {
            transcriptionService: 'assemblyai',
            transcriptionModel: 'universal-3-pro'
          }
        ],
        completionStatus: 'full'
      })
      return { outputDir }
    },
    {
      initialEntries: batchPlan.initialEntries,
      resultEntryIndexes: batchPlan.resultEntryIndexes
    }
  )

  expect(result.ok).toBe(1)
  expect(result.incomplete).toBe(0)
  expect(result.fail).toBe(0)
  expect(result.batchDir).toBeDefined()
  if (!result.batchDir) {
    return
  }
  createdPaths.push(result.batchDir)

  const items = await readBatchItems(result.batchDir)
  expect(items).toMatchObject([
    {
      completionStatus: 'full',
      outputDir: join(result.batchDir, 'item-1')
    },
    {
      url: `file://${pdfPath}`,
      completionStatus: 'skipped',
      inputFamily: 'document'
    }
  ])

  const summary = await readSttBatchSummary(result.batchDir)
  expect(summary.totals).toEqual({
    items: 2,
    captionBacked: 0,
    sttFallback: 1,
    skipped: 1,
    incomplete: 0,
    failed: 0
  })
  expect(summary.items[1]).toMatchObject({
    completionStatus: 'skipped',
    outputDir: ''
  })
})

test('deprecated stt and ocr commands fail with the extract migration error', async () => {
  const sttResult = await runCommand([
    'src/cli/create-cli.ts',
    'stt',
    'input/examples/document/1-document.pdf'
  ])
  expect(sttResult.exitCode).toBe(2)
  expect(`${sttResult.stdout}\n${sttResult.stderr}`).toContain('The "stt" command has been replaced by "extract"')

  const ocrResult = await runCommand([
    'src/cli/create-cli.ts',
    'ocr',
    STABLE_LOCAL_AUDIO_PATH
  ])
  expect(ocrResult.exitCode).toBe(2)
  expect(`${ocrResult.stdout}\n${ocrResult.stderr}`).toContain('The "ocr" command has been replaced by "extract"')
})

test('extract names unrecognized local inputs in the usage error', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-step2-family-unknown-'))
  createdPaths.push(tempDir)
  const unknownPath = join(tempDir, 'input.unknown')
  await writeFile(unknownPath, 'not a supported file type')

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    unknownPath
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain(`Could not classify extract input "${unknownPath}"`)
})
