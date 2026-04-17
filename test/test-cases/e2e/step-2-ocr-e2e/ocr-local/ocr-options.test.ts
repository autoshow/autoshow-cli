import { test, expect, beforeAll, afterAll } from 'bun:test'
import { readdir, rm } from 'node:fs/promises'
import { cleanupTestOutput, runCommand, fileExists, findLatestDirectory, ensurePageImageFixture } from '../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../test-utils/manifest-helpers'

type EpubExportMetadata = {
  mode?: 'chapters' | 'chunks'
  chunkLimitChars?: number
  directories?: string[]
  chapterFilesWritten?: number
  chunkFilesWritten?: number
}

type ExtractMetadata = {
  step1?: { format?: string }
  step2?: {
    extractionMethod?: string
    totalPages?: number
    epub?: Record<string, unknown>
    epubExport?: EpubExportMetadata
    outputFidelity?: string
  }
}

const pdfInput = 'input/examples/document/1-document.pdf'
const epubInput = 'input/examples/document/1-epub.epub'
const imageInput = 'input/examples/document/1-document.png'
const articleUrl = 'https://ajcwebdev.com'
const paddleOcrPython = 'runtime/bin/paddle-ocr/bin/python'

beforeAll(async () => {
  await ensurePageImageFixture(imageInput)
  await cleanupTestOutput('1-document')
  await cleanupTestOutput('1-epub')
})

afterAll(async () => {
  await cleanupTestOutput('1-document')
  await cleanupTestOutput('1-epub')
})

test('extract PDF with default options', async () => {
  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'ocr', pdfInput], { testName: 'extract PDF with default options' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-document')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(true)
  expect(await fileExists(`${outputDir}/result.json`)).toBe(false)
  expect(await fileExists(`${outputDir}/run.json`)).toBe(true)
})

test('extract PDF with --out json', async () => {
  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'ocr', pdfInput, '--out', 'json'], { testName: 'extract PDF with --out json' })
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

  const result = await runCommand(['src/cli/create-cli.ts', 'ocr', pdfInput, '--ocrmypdf'], { testName: 'extract PDF with --ocrmypdf' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-document')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step2?.extractionMethod).toBe('ocrmypdf')
})

test('extract PDF with --paddle-ocr', async () => {
  if (!await fileExists(paddleOcrPython)) {
    return
  }

  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'ocr', pdfInput, '--paddle-ocr'], { testName: 'extract PDF with --paddle-ocr' })
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

  const result = await runCommand(['src/cli/create-cli.ts', 'ocr', epubInput, '--ocrmypdf'], { testName: 'extract EPUB with --ocrmypdf' })
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

  const result = await runCommand(['src/cli/create-cli.ts', 'ocr', epubInput], { testName: 'extract EPUB with default options writes cleaned text without synthetic page labels' })
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
})

test('extract image with --ocrmypdf', async () => {
  if (!Bun.which('ocrmypdf')) {
    return
  }

  await ensurePageImageFixture(imageInput)
  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'ocr', imageInput, '--ocrmypdf'], { testName: 'extract image with --ocrmypdf' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-document')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step1?.format).toBe('png')
  expect(metadata.step2?.extractionMethod).toBe('image+ocrmypdf')
  expect(metadata.step2?.totalPages).toBe(1)
})

test('bun as ocr https://ajcwebdev.com --url-backend defuddle', async () => {
  let outputDir: string | null = null

  try {
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'ocr', articleUrl, '--url-backend', 'defuddle'],
      { testName: 'bun as ocr https://ajcwebdev.com --url-backend defuddle' }
    )
    expect(result.exitCode).toBe(0)

    outputDir = result.outputDir
    expect(outputDir).not.toBeNull()
    if (!outputDir) return

    expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as ExtractMetadata
    expect(metadata.step1?.format).toBe('html')
    expect(metadata.step2?.extractionMethod).toBe('html+defuddle')
  } finally {
    if (outputDir && process.env['AUTOSHOW_TEST_PRESERVE_ARTIFACTS'] === '0') {
      await rm(outputDir, { recursive: true, force: true }).catch(() => {})
    }
  }
})

test('bun as ocr https://ajcwebdev.com --url-backend glm-reader --price', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'ocr', articleUrl, '--url-backend', 'glm-reader', '--price'],
    { testName: 'bun as ocr https://ajcwebdev.com --url-backend glm-reader --price' }
  )

  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('GLM Reader cost is not estimated locally during preflight.')
})

test('extract EPUB with --epub-bun writes structured data into run.json only', async () => {
  await cleanupTestOutput('1-epub')

  const result = await runCommand(['src/cli/create-cli.ts', 'ocr', epubInput, '--epub-bun'], { testName: 'extract EPUB with --epub-bun writes structured data into run.json only' })
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

  const result = await runCommand(['src/cli/create-cli.ts', 'ocr', epubInput, '--epub-calibre'], { testName: 'extract EPUB with --epub-calibre' })
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

  const result = await runCommand(['src/cli/create-cli.ts', 'ocr', epubInput, '--chapters', '--length', '5'], { testName: 'extract EPUB with --chapters writes chapter files and metadata summary' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-epub')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  const chapterFiles = (await readdir(`${outputDir}/chapters`)).filter((name) => name.endsWith('.txt')).sort()
  expect(chapterFiles.length).toBeGreaterThan(0)
  expect(await fileExists(`${outputDir}/chunks`)).toBe(false)

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step2?.epubExport?.mode).toBe('chapters')
  expect(metadata.step2?.epubExport?.chunkLimitChars).toBe(5000)
  expect(metadata.step2?.epubExport?.directories).toEqual(['chapters'])

  const firstChapter = await Bun.file(`${outputDir}/chapters/${chapterFiles[0]}`).text()
  expect(firstChapter.startsWith('Chapter 1:')).toBe(true)
})

test('extract EPUB with --length writes chunk files and metadata summary', async () => {
  await cleanupTestOutput('1-epub')

  const result = await runCommand(['src/cli/create-cli.ts', 'ocr', epubInput, '--length', '1'], { testName: 'extract EPUB with --length writes chunk files and metadata summary' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-epub')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  const chunkFiles = (await readdir(`${outputDir}/chunks`)).filter((name) => name.endsWith('.txt')).sort()
  expect(chunkFiles.length).toBeGreaterThan(1)
  expect(await fileExists(`${outputDir}/chapters`)).toBe(false)

  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step2?.epubExport?.mode).toBe('chunks')
  expect(metadata.step2?.epubExport?.chunkLimitChars).toBe(1000)
  expect(metadata.step2?.epubExport?.directories).toEqual(['chunks'])
})

test('extract EPUB inspect mode ignores chapter export flags', async () => {
  await cleanupTestOutput('1-epub')

  const result = await runCommand(['src/cli/create-cli.ts', 'ocr', epubInput, '--epub-bun', '--chapters'], { testName: 'extract EPUB inspect mode ignores chapter export flags' })
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

test('extract non-EPUB ignores chapter export flags', async () => {
  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'ocr', pdfInput, '--chapters', '--out', 'json'], { testName: 'extract non-EPUB ignores chapter export flags' })
  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('EPUB export flags (--chapters, --length) are ignored for non-EPUB inputs.')

  const outputDir = result.outputDir ?? await findLatestDirectory('1-document')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  expect(await fileExists(`${outputDir}/chapters`)).toBe(false)
  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step2?.epubExport).toBeUndefined()
})

for (const args of [
  ['--epub-bun', '--epub-calibre'],
  ['--epub-calibre', '--epub-bun']
]) {
  test(`extract rejects conflicting EPUB inspect flags: ${args.join(' ')}`, async () => {
    const result = await runCommand(['src/cli/create-cli.ts', 'ocr', epubInput, ...args])
    expect(result.exitCode).not.toBe(0)
  })
}

test('extract rejects non-json --out with EPUB inspect mode', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'ocr', epubInput, '--epub-bun', '--out', 'text'])
  expect(result.exitCode).not.toBe(0)
})

test('extract non-EPUB with --epub-bun falls back to normal extraction flow', async () => {
  await cleanupTestOutput('1-document')

  const result = await runCommand(['src/cli/create-cli.ts', 'ocr', pdfInput, '--epub-bun'], { testName: 'extract non-EPUB with --epub-bun falls back to normal extraction flow' })
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory('1-document')
  expect(outputDir).not.toBeNull()
  if (!outputDir) return

  expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(true)
  const metadata = await readRunMetadata(outputDir) as ExtractMetadata
  expect(metadata.step2?.extractionMethod).not.toBe('epub-bun')
})
