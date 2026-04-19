import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import {
  ExtractionMetadataSchema,
  ExtractionResultSchema,
  type ExtractionMetadata,
  type ExtractionResult
} from '~/types'
import {
  analyzeAndWriteOcrConsensusReports,
  analyzeOcrRunDirectory
} from '~/cli/commands/setup-and-utilities/report/ocr-consensus-report'
import { validateData } from '~/utils/validate/validation'
import { runCommand } from '../../test-utils/test-helpers'
import { writeProviderResultFixture, writeRunManifestFixture } from '../../test-utils/manifest-helpers'

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

const createMetadata = (
  overrides: Partial<ExtractionMetadata>
): ExtractionMetadata =>
  validateData(ExtractionMetadataSchema, {
    extractionMethod: 'mistral-ocr',
    totalPages: 2,
    ocrPages: 2,
    textPages: 0,
    processingTime: 1200,
    dpi: 300,
    languages: 'eng',
    tokenEstimate: 42,
    ...overrides
  }, 'test OCR metadata')

const createResult = (
  overrides: Partial<ExtractionResult>
): ExtractionResult =>
  validateData(ExtractionResultSchema, {
    text: 'Page 1\nPlaceholder\n\nPage 2\nPlaceholder',
    pages: [
      { pageNumber: 1, method: 'ocr', text: 'Placeholder' },
      { pageNumber: 2, method: 'ocr', text: 'Placeholder' }
    ],
    totalPages: 2,
    ocrPages: 2,
    textPages: 0,
    ...overrides
  }, 'test OCR result')

const writeOcrProviderArtifacts = async (
  runDir: string,
  providerDirName: string,
  metadata: ExtractionMetadata,
  result: ExtractionResult,
  artifactMode: 'result' | 'legacy-text' = 'result'
): Promise<void> => {
  const providerDir = join(runDir, 'providers', providerDirName)
  await mkdir(providerDir, { recursive: true })
  await writeProviderResultFixture(providerDir, metadata.ocrService ?? providerDirName, metadata.ocrModel, metadata as unknown as Record<string, unknown>, result as unknown as Record<string, unknown>)

  if (artifactMode === 'result') {
    return
  }

  await writeFile(join(providerDir, 'extraction.txt'), `${result.text}\n`, 'utf8')
}

const writeMinimalSttClassificationArtifacts = async (
  runDir: string
): Promise<void> => {
  const providerDir = join(runDir, 'providers', 'assemblyai-universal-3-pro')
  await mkdir(providerDir, { recursive: true })
  await writeFile(join(providerDir, 'transcription.txt'), '[00:00:00] hello world\n', 'utf8')
  await writeJson(join(providerDir, 'transcription.evidence.json'), {
    service: 'assemblyai',
    model: 'universal-3-pro',
    label: 'assemblyai/universal-3-pro',
    transcriptText: 'hello world',
    segments: [{ startSeconds: 0, endSeconds: 1, text: 'hello world' }],
    words: [{
      startSeconds: 0,
      endSeconds: 1,
      text: 'hello',
      normalized: 'hello',
      timingSource: 'native'
    }],
    capabilities: {
      hasNativeWordTiming: true,
      hasConfidence: false,
      hasSpeakerLabels: false
    },
    timingQuality: 'native_word',
    speakerInventory: []
  })
  await writeProviderResultFixture(providerDir, 'assemblyai', 'universal-3-pro', {
    transcriptionService: 'assemblyai',
    transcriptionModel: 'universal-3-pro',
    tokenCount: 2,
    processingTime: 1000
  }, {})
  await writeRunManifestFixture(runDir, 'stt', {
    step1: { title: 'stt', duration: '00:01' }
  })
}

describe('ocr consensus report utilities', () => {
  test('builds OCR consensus artifacts and flags disagreements', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-consensus-'))
    const runDir = join(rootDir, '2026-04-15_doc')

    try {
      await mkdir(join(runDir, 'providers'), { recursive: true })

      const mistralMetadata = createMetadata({
        extractionMethod: 'mistral-ocr',
        ocrService: 'mistral',
        ocrModel: 'mistral-ocr-2512',
        promptTokens: 200,
        completionTokens: 120
      })
      const glmMetadata = createMetadata({
        extractionMethod: 'glm-ocr',
        ocrService: 'glm',
        ocrModel: 'glm-4.5v',
        processingTime: 1400,
        promptTokens: 220,
        completionTokens: 80
      })

      await Promise.all([
        writeOcrProviderArtifacts(
          runDir,
          'mistral-mistral-ocr-2512',
          mistralMetadata,
          createResult({
            text: 'Page 1\nAlpha beta gamma delta.\n\nPage 2\nSecond page clean text.',
            pages: [
              { pageNumber: 1, method: 'ocr', text: 'Alpha beta gamma delta.', confidence: 88 },
              { pageNumber: 2, method: 'ocr', text: 'Second page clean text.', confidence: 92 }
            ]
          })
        ),
        writeOcrProviderArtifacts(
          runDir,
          'glm-glm-4.5v',
          glmMetadata,
          createResult({
            text: 'Page 1\nAlpha theta gamma zeta.\n\nPage 2\nSecond page clean text.',
            pages: [
              { pageNumber: 1, method: 'ocr', text: 'Alpha theta gamma zeta.', confidence: 74 },
              { pageNumber: 2, method: 'ocr', text: 'Second page clean text.', confidence: 91 }
            ]
          })
        )
      ])

      await writeRunManifestFixture(runDir, 'ocr', {
        step1: {
          title: 'Quarterly scan',
          author: 'Ops',
          pageCount: 2,
          format: 'pdf'
        },
        step2: [
          { ocrService: 'mistral', ocrModel: 'mistral-ocr-2512', processingTime: 1200, promptTokens: 200, completionTokens: 120 },
          { ocrService: 'glm', ocrModel: 'glm-4.5v', processingTime: 1400, promptTokens: 220, completionTokens: 80 }
        ],
        requestedProviders: [
          { service: 'mistral', model: 'mistral-ocr-2512' },
          { service: 'glm', model: 'glm-4.5v' }
        ],
        completionStatus: 'full',
        cost: {
          actual: {
            totalCost: 31,
            steps: [
              { provider: 'mistral', model: 'mistral-ocr-2512', cost: 15 },
              { provider: 'glm', model: 'glm-4.5v', cost: 16 }
            ]
          }
        },
        timing: {
          actual: {
            totalProcessingTimeMs: 2600,
            steps: [
              { provider: 'mistral', model: 'mistral-ocr-2512', processingTimeMs: 1200 },
              { provider: 'glm', model: 'glm-4.5v', processingTimeMs: 1400 }
            ]
          },
          aggregate: {
            wallTimeMs: 1800
          }
        }
      })

      const analysis = await analyzeOcrRunDirectory(runDir)
      expect(analysis.providers).toHaveLength(2)
      expect(analysis.rows.some((row) => row.pageNumber === 1)).toBe(true)
      expect(analysis.reviewRows.length).toBeGreaterThanOrEqual(1)
      expect(analysis.metadata.actualTotalCostCents).toBe(31)

      const written = await analyzeAndWriteOcrConsensusReports(runDir)
      expect(written.runArtifacts).toHaveLength(1)
      expect(await readFile(join(runDir, 'consensus-extraction.txt'), 'utf8')).toContain('Second page clean text')
      expect(await readFile(join(runDir, 'consensus-review.md'), 'utf8')).toContain('Low provider agreement')
      expect(await readFile(join(runDir, 'consensus-report.md'), 'utf8')).toContain('OCR Consensus Report')
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  test('supports incomplete OCR runs with result.json provider artifacts', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-consensus-legacy-'))
    const runDir = join(rootDir, '2026-04-15_legacy')

    try {
      await mkdir(join(runDir, 'providers'), { recursive: true })

      const ocrmypdfMetadata = createMetadata({
        extractionMethod: 'pdf+ocrmypdf',
        ocrService: 'ocrmypdf',
        ocrModel: 'ocrmypdf',
        totalPages: 1,
        ocrPages: 1,
        textPages: 0
      })

      await writeOcrProviderArtifacts(
        runDir,
        'ocrmypdf-ocrmypdf',
        ocrmypdfMetadata,
        createResult({
          text: 'Page 1\nLegacy fallback text only.',
          pages: [
            { pageNumber: 1, method: 'ocr', text: 'Legacy fallback text only.', confidence: 83 }
          ],
          totalPages: 1,
          ocrPages: 1,
          textPages: 0
        })
      )

      await writeRunManifestFixture(runDir, 'ocr', {
        step1: {
          title: 'Legacy OCR run',
          author: 'Archive',
          pageCount: 1,
          format: 'pdf'
        },
        requestedProviders: [
          { service: 'ocrmypdf', model: 'ocrmypdf' },
          { service: 'paddle-ocr', model: 'paddle-ocr' }
        ],
        providerStates: [
          {
            service: 'ocrmypdf',
            model: 'ocrmypdf',
            artifactDir: 'providers/ocrmypdf-ocrmypdf',
            status: 'succeeded',
            attempts: 1
          },
          {
            service: 'paddle-ocr',
            model: 'paddle-ocr',
            artifactDir: 'providers/paddle-ocr-paddle-ocr',
            status: 'missing',
            attempts: 0
          }
        ],
        missingProviders: [
          { service: 'paddle-ocr', model: 'paddle-ocr' }
        ],
        completionStatus: 'incomplete'
      })

      const analysis = await analyzeOcrRunDirectory(runDir)
      expect(analysis.providers).toHaveLength(1)
      expect(analysis.missingProviders.map((provider) => provider.label)).toContain('paddle-ocr/paddle-ocr')

      await analyzeAndWriteOcrConsensusReports(runDir)
      expect(await readFile(join(runDir, 'consensus-extraction.txt'), 'utf8')).toContain('Legacy fallback text only')
      expect(await readFile(join(runDir, 'consensus-review.md'), 'utf8')).toContain('Only one provider contributed this page window')
      expect(await readFile(join(runDir, 'consensus-report.md'), 'utf8')).toContain('paddle-ocr/paddle-ocr')
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  test('writes a batch aggregate OCR report for multiple runs', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-consensus-batch-'))
    const batchDir = join(rootDir, 'batch')
    const runA = join(batchDir, 'run-a')
    const runB = join(batchDir, 'run-b')

    try {
      await mkdir(join(runA, 'providers'), { recursive: true })
      await mkdir(join(runB, 'providers'), { recursive: true })

      await Promise.all([
        writeOcrProviderArtifacts(
          runA,
          'ocrmypdf-ocrmypdf',
          createMetadata({
            extractionMethod: 'pdf+ocrmypdf',
            ocrService: 'ocrmypdf',
            ocrModel: 'ocrmypdf',
            totalPages: 1,
            ocrPages: 1,
            textPages: 0
          }),
          createResult({
            text: 'Page 1\nRun A text.',
            pages: [{ pageNumber: 1, method: 'ocr', text: 'Run A text.', confidence: 88 }],
            totalPages: 1,
            ocrPages: 1,
            textPages: 0
          })
        ),
        writeOcrProviderArtifacts(
          runB,
          'paddle-ocr-paddle-ocr',
          createMetadata({
            extractionMethod: 'pdf+paddle-ocr',
            ocrService: 'paddle-ocr',
            ocrModel: 'paddle-ocr',
            totalPages: 1,
            ocrPages: 1,
            textPages: 0
          }),
          createResult({
            text: 'Page 1\nRun B text.',
            pages: [{ pageNumber: 1, method: 'ocr', text: 'Run B text.', confidence: 77 }],
            totalPages: 1,
            ocrPages: 1,
            textPages: 0
          })
        )
      ])

      await Promise.all([
        writeRunManifestFixture(runA, 'ocr', {
          step1: { title: 'Run A', author: 'Batch', pageCount: 1, format: 'pdf' },
          requestedProviders: [{ service: 'ocrmypdf', model: 'ocrmypdf' }],
          completionStatus: 'full'
        }),
        writeRunManifestFixture(runB, 'ocr', {
          step1: { title: 'Run B', author: 'Batch', pageCount: 1, format: 'pdf' },
          requestedProviders: [{ service: 'paddle-ocr', model: 'paddle-ocr' }],
          completionStatus: 'full'
        })
      ])

      const written = await analyzeAndWriteOcrConsensusReports(batchDir)
      expect(written.runArtifacts).toHaveLength(2)
      expect(written.aggregateReportPath).not.toBeNull()

      const aggregateReport = await readFile(join(batchDir, 'consensus-report.md'), 'utf8')
      expect(aggregateReport).toContain('OCR Consensus Batch Report')
      expect(aggregateReport).toContain('run-a')
      expect(aggregateReport).toContain('run-b')
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  test('report command fails with an actionable error for mixed OCR and STT roots', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-report-mixed-'))
    const batchDir = join(rootDir, 'batch')
    const ocrRun = join(batchDir, 'ocr-run')
    const sttRun = join(batchDir, 'stt-run')

    try {
      await mkdir(join(ocrRun, 'providers'), { recursive: true })
      await writeOcrProviderArtifacts(
        ocrRun,
        'ocrmypdf-ocrmypdf',
        createMetadata({
          extractionMethod: 'pdf+ocrmypdf',
          ocrService: 'ocrmypdf',
          ocrModel: 'ocrmypdf',
          totalPages: 1,
          ocrPages: 1,
          textPages: 0
        }),
        createResult({
          text: 'Page 1\nOnly OCR text.',
          pages: [{ pageNumber: 1, method: 'ocr', text: 'Only OCR text.' }],
          totalPages: 1,
          ocrPages: 1,
          textPages: 0
        })
      )
      await writeRunManifestFixture(ocrRun, 'ocr', {
        step1: { title: 'OCR', author: 'Mixed', pageCount: 1, format: 'pdf' },
        requestedProviders: [{ service: 'ocrmypdf', model: 'ocrmypdf' }]
      })

      await mkdir(join(sttRun, 'providers'), { recursive: true })
      await writeMinimalSttClassificationArtifacts(sttRun)

      const result = await runCommand([
        'src/cli/create-cli.ts',
        'report',
        batchDir
      ])

      expect(result.exitCode).toBeGreaterThan(0)
      expect(result.stderr).toContain('Mixed report kinds are not supported')
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})
