import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { writeProviderResultFixture } from '../../test-utils/manifest-helpers'

import {
  classifyReportRunDirectory,
  detectReportTarget,
  discoverReportRunDirectories
} from '~/cli/commands/setup-and-utilities/report/report-target-detection'

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

const writeBaseRun = async (runDir: string): Promise<void> => {
  await mkdir(runDir, { recursive: true })
  await writeJson(join(runDir, 'run.json'), { metadata: {} })
}

const writeSttArtifacts = async (
  artifactDir: string,
  service = 'assemblyai',
  model = 'universal-3-pro'
): Promise<void> => {
  await mkdir(artifactDir, { recursive: true })
  await writeFile(join(artifactDir, 'transcription.txt'), '[00:00:00] hello world\n', 'utf8')
  await writeProviderResultFixture(artifactDir, service, model, {
    transcriptionService: service,
    transcriptionModel: model,
    processingTime: 1000,
    tokenCount: 2
  }, {
    text: 'hello world',
    segments: [
      { start: '00:00:00', end: '00:00:00', text: 'hello world' }
    ]
  })
}

const writeOcrArtifacts = async (
  runDir: string,
  providerDirName = 'ocrmypdf-ocrmypdf'
): Promise<void> => {
  const providerDir = join(runDir, 'providers', providerDirName)
  await mkdir(providerDir, { recursive: true })
  await writeProviderResultFixture(providerDir, 'ocrmypdf', 'ocrmypdf', {
    ocrService: 'ocrmypdf',
    ocrModel: 'ocrmypdf'
  }, {
    pages: [],
    text: 'Only OCR text.'
  })
  await writeFile(join(providerDir, 'extraction.txt'), 'Only OCR text.\n', 'utf8')
}

describe('report target detection', () => {
  test('detects a single STT run', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-report-detect-stt-'))
    const runDir = join(rootDir, 'run')

    try {
      await writeBaseRun(runDir)
      await writeSttArtifacts(join(runDir, 'providers', 'assemblyai-universal-3-pro'))

      expect(await classifyReportRunDirectory(runDir)).toBe('stt')

      const detected = await detectReportTarget(runDir)
      expect(detected.kind).toBe('stt')
      expect(detected.runDirectories).toEqual([runDir])
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  test('detects a root-output single-provider STT run', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-report-detect-root-stt-'))
    const runDir = join(rootDir, 'run')

    try {
      await writeBaseRun(runDir)
      await writeSttArtifacts(runDir)

      expect(await classifyReportRunDirectory(runDir)).toBe('stt')

      const detected = await detectReportTarget(runDir)
      expect(detected.kind).toBe('stt')
      expect(detected.runDirectories).toEqual([runDir])
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  test('detects a single OCR run', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-report-detect-ocr-'))
    const runDir = join(rootDir, 'run')

    try {
      await writeBaseRun(runDir)
      await mkdir(join(runDir, 'providers'), { recursive: true })
      await writeOcrArtifacts(runDir)

      expect(await classifyReportRunDirectory(runDir)).toBe('ocr')

      const detected = await detectReportTarget(runDir)
      expect(detected.kind).toBe('ocr')
      expect(detected.runDirectories).toEqual([runDir])
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  test('discovers batch child run directories', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-report-detect-batch-'))
    const batchDir = join(rootDir, 'batch')
    const runA = join(batchDir, 'run-a')
    const runB = join(batchDir, 'run-b')

    try {
      await writeBaseRun(runA)
      await writeBaseRun(runB)
      await mkdir(join(runA, 'providers'), { recursive: true })
      await mkdir(join(runB, 'providers'), { recursive: true })

      const discovered = await discoverReportRunDirectories(batchDir)
      expect(discovered).toEqual([runA, runB])
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  test('rejects mixed STT and OCR batches', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-report-detect-mixed-batch-'))
    const batchDir = join(rootDir, 'batch')
    const sttRun = join(batchDir, 'stt-run')
    const ocrRun = join(batchDir, 'ocr-run')

    try {
      await writeBaseRun(sttRun)
      await writeSttArtifacts(join(sttRun, 'providers', 'assemblyai-universal-3-pro'))
      await writeBaseRun(ocrRun)
      await mkdir(join(ocrRun, 'providers'), { recursive: true })
      await writeOcrArtifacts(ocrRun)

      await expect(detectReportTarget(batchDir)).rejects.toThrow('Mixed report kinds are not supported')
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  test('rejects runs that contain both STT and OCR artifacts', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-report-detect-mixed-run-'))
    const runDir = join(rootDir, 'run')
    const providerDir = join(runDir, 'providers', 'mixed-provider')

    try {
      await writeBaseRun(runDir)
      await writeSttArtifacts(providerDir)
      await writeFile(join(providerDir, 'extraction.txt'), 'Only OCR text.\n', 'utf8')

      expect(await classifyReportRunDirectory(runDir)).toBe('mixed')
      await expect(detectReportTarget(runDir)).rejects.toThrow('mixed STT and OCR artifacts')
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  test('rejects runs whose artifacts do not identify a report kind', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-report-detect-unknown-'))
    const runDir = join(rootDir, 'run')

    try {
      await writeBaseRun(runDir)
      await mkdir(join(runDir, 'providers', 'empty-provider'), { recursive: true })

      expect(await classifyReportRunDirectory(runDir)).toBeNull()
      await expect(detectReportTarget(runDir)).rejects.toThrow('Could not infer report type')
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})
