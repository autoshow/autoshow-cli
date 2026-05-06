import { test, expect, beforeAll, afterAll } from 'bun:test'
import { readdir, rm } from 'node:fs/promises'
import { cleanupTestOutput, runCommand, fileExists, findLatestDirectory, ensurePageImageFixture } from '../../../../test-utils/test-helpers'
import { readRunManifest, readRunMetadata } from '../../../../test-utils/manifest-helpers'

type EpubExportMetadata = {
  sourceFormat?: 'epub' | 'pdf'
  mode?: 'chapters' | 'chunks'
  chunkLimitChars?: number
  directories?: string[]
  chapterFilesWritten?: number
  chunkFilesWritten?: number
  logicalChapterCount?: number
  logicalChapterSource?: 'toc' | 'spine'
  tocStartSections?: number
  prefaceSectionsDropped?: number
}

type PdfChapterDetectionMetadata = {
  strategyUsed?: string
  tocPages?: number[]
  pageMapSpans?: Array<Record<string, unknown>>
  chapters?: Array<Record<string, unknown>>
  warnings?: string[]
}

type ExtractMetadata = {
  step1?: { format?: string }
  primaryProvider?: { service?: string; model?: string }
  resolvedStep2?: {
    route?: string
    sourceKind?: string
    backend?: string
    providers?: Array<{ service?: string; model?: string; origin?: string }>
  }
  requestedProviders?: Array<{ service?: string; model?: string }>
  providerStates?: Array<{ service?: string; model?: string; status?: string; artifactDir?: string; attempts?: number }>
  missingProviders?: Array<unknown>
  step2?: {
    extractionMethod?: string
    totalPages?: number
    epub?: Record<string, unknown>
    chapterExport?: EpubExportMetadata
    epubExport?: EpubExportMetadata
    pdfChapterDetection?: PdfChapterDetectionMetadata
    outputFidelity?: string
  }
}

const pdfInput = 'input/examples/document/1-document.pdf'
const multiPagePdfInput = 'input/examples/document/3-document.pdf'
const epubInput = 'input/examples/document/1-epub.epub'
const imageInput = 'input/examples/document/1-document.png'
const articleUrl = 'https://ajcwebdev.com'
const paddleOcrPython = 'runtime/bin/paddle-ocr/bin/python'
beforeAll(async () => {
  await ensurePageImageFixture(imageInput)
  await cleanupTestOutput('1-document')
  await cleanupTestOutput('3-document')
  await cleanupTestOutput('1-epub')
})

afterAll(async () => {
  await cleanupTestOutput('1-document')
  await cleanupTestOutput('3-document')
  await cleanupTestOutput('1-epub')
})

test('extract PDF with default options', async () => {
  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', pdfInput], { testName: 'extract PDF with default options' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-document')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(true)
  expect(await fileExists(`${outputDir}/result.json`)).toBe(false)
  expect(await fileExists(`${outputDir}/run.json`)).toBe(true)

  const manifest = await readRunManifest(outputDir)
  const metadata = manifest.metadata as ExtractMetadata
  expect(manifest.kind).toBe('extract')
  expect(manifest.metadata['extractRoute']).toBe('document')
  expect(metadata.resolvedStep2).toMatchObject({
    route: 'ocr',
    sourceKind: 'pdf',
    providers: [{ service: 'tesseract', model: 'tesseract', origin: 'default' }]
  })
  expect(metadata.requestedProviders).toEqual([{ service: 'tesseract', model: 'tesseract' }])
  expect(metadata.providerStates).toEqual([
    {
      service: 'tesseract',
      model: 'tesseract',
      artifactDir: '.',
      status: 'succeeded',
      attempts: 1
    }
  ])
  expect(metadata.missingProviders).toEqual([])
})

test('extract PDF with --out json', async () => {
  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', pdfInput, '--out', 'json'], { testName: 'extract PDF with --out json' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-document')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(false)
  expect(await fileExists(`${outputDir}/result.json`)).toBe(true)
})

test('extract PDF with --ocrmypdf', async () => {
  if (!Bun.which('ocrmypdf')) {
    return
  }

  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', pdfInput, '--ocrmypdf'], { testName: 'extract PDF with --ocrmypdf' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-document')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step2?.extractionMethod).toBe('ocrmypdf')
})

test('multi-provider OCR without --primary-ocr writes provider artifacts only', async () => {
  if (!Bun.which('ocrmypdf')) {
    return
  }

  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', pdfInput, '--tesseract-ocr', '--ocrmypdf'], {
    testName: 'multi-provider OCR without primary'
  })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-document')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(false)
  expect(await fileExists(`${outputDir}/result.json`)).toBe(false)
  expect(await fileExists(`${outputDir}/providers/tesseract-tesseract/extraction.txt`)).toBe(true)
  expect(await fileExists(`${outputDir}/providers/ocrmypdf-ocrmypdf/extraction.txt`)).toBe(true)

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.primaryProvider).toBeUndefined()
  expect(metadata.requestedProviders).toEqual([
    { service: 'tesseract', model: 'tesseract' },
    { service: 'ocrmypdf', model: 'ocrmypdf' }
  ])
})

test('multi-provider OCR with --primary-ocr writes selected root artifact', async () => {
  if (!Bun.which('ocrmypdf')) {
    return
  }

  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', pdfInput, '--tesseract-ocr', '--ocrmypdf', '--primary-ocr', 'tesseract'], {
    testName: 'multi-provider OCR with primary'
  })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-document')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(true)
  const rootText = await Bun.file(`${outputDir}/extraction.txt`).text()
  const providerText = await Bun.file(`${outputDir}/providers/tesseract-tesseract/extraction.txt`).text()
  expect(rootText).toBe(providerText)

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.primaryProvider).toEqual({ service: 'tesseract', model: 'tesseract' })
})

test('extract PDF with --paddle-ocr', async () => {
  if (!await fileExists(paddleOcrPython)) {
    return
  }

  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', pdfInput, '--paddle-ocr'], { testName: 'extract PDF with --paddle-ocr' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-document')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step2?.extractionMethod).toBe('mutool+paddle-ocr')
})

test('extract EPUB with --ocrmypdf', async () => {
  if (!Bun.which('ocrmypdf')) {
    return
  }

  await cleanupTestOutput('1-epub')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', epubInput, '--ocrmypdf'], { testName: 'extract EPUB with --ocrmypdf' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-epub')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step1?.format).toBe('epub')
  expect(metadata.step2?.extractionMethod).toBe('pdf+ocrmypdf')
})

test('extract EPUB with default options writes cleaned text without synthetic page labels', async () => {
  await cleanupTestOutput('1-epub')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', epubInput], { testName: 'extract EPUB with default options writes cleaned text without synthetic page labels' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-epub')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  const extractionText = await Bun.file(`${outputDir}/extraction.txt`).text()
  expect(extractionText.startsWith('Page 1\n')).toBe(false)
  expect(extractionText).toContain('Chapter 1: Introduction to AutoShow')

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step2?.extractionMethod).toBe('epub-text')
  expect(metadata.step2?.outputFidelity).toBe('cleaned-epub-text')
  expect(metadata.step2?.epubExport).toBeUndefined()
  expect(metadata.resolvedStep2).toMatchObject({
    route: 'native-document',
    sourceKind: 'epub'
  })
  expect(metadata.requestedProviders).toBeUndefined()
})

test('extract image with --ocrmypdf', async () => {
  if (!Bun.which('ocrmypdf')) {
    return
  }

  await ensurePageImageFixture(imageInput)
  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', imageInput, '--ocrmypdf'], { testName: 'extract image with --ocrmypdf' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-document')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step1?.format).toBe('png')
  expect(metadata.step2?.extractionMethod).toBe('image+ocrmypdf')
  expect(metadata.step2?.totalPages).toBe(1)
})

test('extract image with explicit --tesseract-ocr matches the default local OCR path', async () => {
  await ensurePageImageFixture(imageInput)
  await cleanupTestOutput('1-document')

  const defaultResult = await runCommand(['src/cli/create-cli.ts', 'extract', imageInput], {
    testName: 'extract image with default local OCR path'
  })
  expect(defaultResult.exitCode).toBe(0)

  const defaultOutputDir = defaultResult.outputDir ?? await findLatestDirectory('1-document')
  expect(defaultOutputDir).not.toBeNull()
  if (!defaultOutputDir) return

  const defaultMetadata = await readRunMetadata(defaultOutputDir) as ExtractMetadata

  await cleanupTestOutput('1-document')

  const explicitResult = await runCommand(['src/cli/create-cli.ts', 'extract', imageInput, '--tesseract-ocr'], {
    testName: 'extract image with explicit --tesseract-ocr'
  })
  expect(explicitResult.exitCode).toBe(0)

  const explicitOutputDir = explicitResult.outputDir ?? await findLatestDirectory('1-document')
  expect(explicitOutputDir).not.toBeNull()
  if (!explicitOutputDir) return

  const explicitMetadata = await readRunMetadata(explicitOutputDir) as ExtractMetadata
  expect(defaultMetadata.step2?.extractionMethod).toBe('image+tesseract')
  expect(defaultMetadata.resolvedStep2).toMatchObject({
    route: 'ocr',
    sourceKind: 'image',
    providers: [{ service: 'tesseract', model: 'tesseract', origin: 'default' }]
  })
  expect(explicitMetadata.step2?.extractionMethod).toBe(defaultMetadata.step2?.extractionMethod)
  expect(explicitMetadata.step2?.totalPages).toBe(defaultMetadata.step2?.totalPages)
  expect(explicitMetadata.resolvedStep2).toMatchObject({
    route: 'ocr',
    sourceKind: 'image',
    providers: [{ service: 'tesseract', model: 'tesseract', origin: 'explicit' }]
  })
  expect(explicitMetadata.requestedProviders).toEqual([{ service: 'tesseract', model: 'tesseract' }])
  expect(explicitMetadata.providerStates).toEqual([
    {
      service: 'tesseract',
      model: 'tesseract',
      artifactDir: '.',
      status: 'succeeded',
      attempts: 1
    }
  ])
  expect(explicitMetadata.missingProviders).toEqual([])
})

test('bun as extract https://ajcwebdev.com --url-backend defuddle', async () => {
  let outputDir: string | null = null

  try {
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'extract', articleUrl, '--url-backend', 'defuddle'],
      { testName: 'bun as extract https://ajcwebdev.com --url-backend defuddle' }
    )
    expect(result.exitCode).toBe(0)

    outputDir = result.outputDir
    expect(outputDir).not.toBeNull()
    if (!outputDir) return

    expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as ExtractMetadata
    expect(metadata.step1?.format).toBe('html')
    expect(metadata.step2?.extractionMethod).toBe('html+defuddle')
    expect(metadata.resolvedStep2).toMatchObject({
      route: 'article',
      sourceKind: 'article',
      backend: 'defuddle'
    })
    expect(metadata.requestedProviders).toBeUndefined()
  } finally {
    if (outputDir && process.env['AUTOSHOW_TEST_PRESERVE_ARTIFACTS'] === '0') {
      await rm(outputDir, { recursive: true, force: true }).catch(() => {})
    }
  }
})

test('extract EPUB with --epub-bun writes structured data into run.json only', async () => {
  await cleanupTestOutput('1-epub')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', epubInput, '--epub-bun'], { testName: 'extract EPUB with --epub-bun writes structured data into run.json only' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-epub')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  expect(await fileExists(`${outputDir}/run.json`)).toBe(true)
  expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(false)
  expect(await fileExists(`${outputDir}/result.json`)).toBe(false)

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step2?.extractionMethod).toBe('epub-bun')
  expect(typeof metadata.step2?.epub).toBe('object')
})

test('extract EPUB with --epub-calibre', async () => {
  if (!Bun.which('calibre-debug') || !Bun.which('ebook-meta') || !Bun.which('ebook-convert')) {
    return
  }

  await cleanupTestOutput('1-epub')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', epubInput, '--epub-calibre'], { testName: 'extract EPUB with --epub-calibre' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-epub')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step2?.extractionMethod).toBe('epub-calibre')
  expect(typeof metadata.step2?.epub).toBe('object')
})

test('extract EPUB with --chapters writes chapter files and metadata summary', async () => {
  await cleanupTestOutput('1-epub')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', epubInput, '--chapters', '--length', '5'], { testName: 'extract EPUB with --chapters writes chapter files and metadata summary' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-epub')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  const chapterFiles = (await readdir(`${outputDir}/chapters`)).filter((name) => name.endsWith('.txt')).sort()
  expect(chapterFiles.length).toBeGreaterThan(0)
  expect(await fileExists(`${outputDir}/chunks`)).toBe(false)

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step2?.chapterExport?.sourceFormat).toBe('epub')
  expect(metadata.step2?.epubExport?.mode).toBe('chapters')
  expect(metadata.step2?.epubExport?.chunkLimitChars).toBe(5000)
  expect(metadata.step2?.epubExport?.directories).toEqual(['chapters'])
  expect(metadata.step2?.epubExport?.logicalChapterCount).toBeGreaterThan(0)
  expect(metadata.step2?.epubExport?.logicalChapterSource).toMatch(/^(toc|spine)$/)

  const firstChapter = await Bun.file(`${outputDir}/chapters/${chapterFiles[0]}`).text()
  expect(firstChapter.startsWith('Chapter 1:')).toBe(true)
})

test('extract EPUB with --length writes chunk files and metadata summary', async () => {
  await cleanupTestOutput('1-epub')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', epubInput, '--length', '1'], { testName: 'extract EPUB with --length writes chunk files and metadata summary' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-epub')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  const chunkFiles = (await readdir(`${outputDir}/chunks`)).filter((name) => name.endsWith('.txt')).sort()
  expect(chunkFiles.length).toBeGreaterThan(1)
  expect(await fileExists(`${outputDir}/chapters`)).toBe(false)

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step2?.chapterExport?.sourceFormat).toBe('epub')
  expect(metadata.step2?.epubExport?.mode).toBe('chunks')
  expect(metadata.step2?.epubExport?.chunkLimitChars).toBe(1000)
  expect(metadata.step2?.epubExport?.directories).toEqual(['chunks'])
})

test('extract PDF with --chapters writes chapter files and diagnostics', async () => {
  await cleanupTestOutput('3-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', multiPagePdfInput, '--chapters', '--out', 'json'], { testName: 'extract PDF with --chapters writes chapter files and diagnostics' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('3-document')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  const chapterFiles = (await readdir(`${outputDir}/chapters`)).filter((name) => name.endsWith('.txt')).sort()
  expect(chapterFiles.length).toBeGreaterThan(0)

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step2?.chapterExport?.sourceFormat).toBe('pdf')
  expect(metadata.step2?.chapterExport?.mode).toBe('chapters')
  expect(metadata.step2?.chapterExport?.directories).toEqual(['chapters'])
  expect(Array.isArray(metadata.step2?.pdfChapterDetection?.chapters)).toBe(true)
  expect((metadata.step2?.pdfChapterDetection?.chapters ?? []).length).toBeGreaterThan(0)
})

test('extract EPUB inspect mode ignores chapter export flags', async () => {
  await cleanupTestOutput('1-epub')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', epubInput, '--epub-bun', '--chapters'], { testName: 'extract EPUB inspect mode ignores chapter export flags' })
  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('EPUB export flags (--chapters, --length) are ignored when using EPUB inspect mode.')

  const outputDir = result.outputDir ?? await findLatestDirectory('1-epub')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  expect(await fileExists(`${outputDir}/chapters`)).toBe(false)

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step2?.extractionMethod).toBe('epub-bun')
  expect(metadata.step2?.epubExport).toBeUndefined()
})

test('extract non-EPUB-non-PDF ignores chapter export flags', async () => {
  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', imageInput, '--chapters', '--out', 'json'], { testName: 'extract non-EPUB-non-PDF ignores chapter export flags' })
  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Chapter export flags (--chapters, --length) are ignored for inputs other than EPUB and PDF.')

  const outputDir = result.outputDir ?? await findLatestDirectory('1-document')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  expect(await fileExists(`${outputDir}/chapters`)).toBe(false)
  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step2?.chapterExport).toBeUndefined()
  expect(metadata.step2?.epubExport).toBeUndefined()
})

for (const args of [
  ['--epub-bun', '--epub-calibre'],
  ['--epub-calibre', '--epub-bun']
]) {
  test(`extract rejects conflicting EPUB inspect flags: ${args.join(' ')}`, async () => {
    const result = await runCommand(['src/cli/create-cli.ts', 'extract', epubInput, ...args])
    expect(result.exitCode).not.toBe(0)
  })
}

test('extract rejects non-json --out with EPUB inspect mode', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'extract', epubInput, '--epub-bun', '--out', 'text'])
  expect(result.exitCode).not.toBe(0)
})

test('extract non-EPUB with --epub-bun falls back to normal extraction flow', async () => {
  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'extract', pdfInput, '--epub-bun'], { testName: 'extract non-EPUB with --epub-bun falls back to normal extraction flow' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-document')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(true)
  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step2?.extractionMethod).not.toBe('epub-bun')
})
