import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Step3Metadata } from '~/types'
import {
  formatRenderedLlmLabel,
  resolveTextInputSongTitle,
  writeRenderedTextArtifacts
} from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { renderToPlainText } from '~/cli/commands/process-steps/step-3-write/structured-output/renderers'

const buildStep3Metadata = (overrides: Partial<Step3Metadata> = {}): Step3Metadata => ({
  llmService: 'gemini',
  llmModel: 'gemini-3.1-pro-preview',
  processingTime: 1,
  inputTokenCount: 1,
  outputTokenCount: 1,
  outputFileName: 'text.json',
  outputFormat: 'json',
  structuredMode: 'native',
  structuredPresetNames: ['standardSongLyrics'],
  ...overrides
})

test('rendered text track headers use model display names', () => {
  expect(formatRenderedLlmLabel({
    llmService: 'gemini',
    llmModel: 'gemini-3.1-pro-preview'
  })).toBe('Gemini 3.1 Pro')

  expect(formatRenderedLlmLabel({
    llmService: 'llama.cpp',
    llmModel: 'ggml-org/gemma-3-270m-it-GGUF'
  })).toBe('Gemma 3 270M Instruct')

  expect(formatRenderedLlmLabel({
    llmService: 'grok',
    llmModel: 'grok-4.20-reasoning'
  })).toBe('Grok 4.2 Reasoning')
})

test('text input song titles use tracks.md before falling back to the filename stem', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-title-'))
  try {
    const tracksPath = join(tempDir, 'tracks.md')
    await writeFile(tracksPath, '1. Track One\n2. Track Two\n')

    expect(await resolveTextInputSongTitle(join(tempDir, '01-track-one.md'), tracksPath)).toBe('Track One')
    expect(await resolveTextInputSongTitle(join(tempDir, '03-bonus-track.md'), tracksPath)).toBe('03-bonus-track')
    expect(await resolveTextInputSongTitle(join(tempDir, '04-fallback.md'), undefined)).toBe('04-fallback')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('song lyric renderer assembles sections with headers', () => {
  const rendered = renderToPlainText({
    title: 'Track One',
    verse1: 'Line one',
    chorus: 'Hook line',
    verse2: 'Line two',
    bridge: 'Bridge line',
    finalChorus: 'Final hook'
  }, ['rockSong'])

  expect(rendered).toBe(
    '# Track One\n\n' +
    'Verse 1\n\nLine one\n\n' +
    'Chorus\n\nHook line\n\n' +
    'Verse 2\n\nLine two\n\n' +
    'Bridge\n\nBridge line\n\n' +
    'Chorus\n\nFinal hook'
  )
})

test('rendered text track headers replace duplicate song title headings', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-render-'))
  try {
    const outputDir = join(tempDir, 'out')
    const tracksPath = join(tempDir, 'tracks.md')
    const sourcePath = join(tempDir, '01-track-one.md')
    await mkdir(outputDir, { recursive: true })
    await writeFile(tracksPath, '1. Track One\n')
    await writeFile(sourcePath, 'source text\n')

    const songData = {
      title: 'Track One',
      verse1: 'Line one',
      chorus: 'Hook line',
      verse2: 'Line two',
      bridge: 'Bridge line',
      finalChorus: 'Final hook'
    }
    const renderedText = renderToPlainText(songData, ['rockSong'])
    const artifacts = await writeRenderedTextArtifacts({
      outputDir,
      results: [{
        metadata: buildStep3Metadata(),
        renderedText,
        parsedJson: songData
      }],
      writeInternal: true,
      sourcePath,
      trackListPath: tracksPath
    })

    const renderedFileName = artifacts.internalArtifacts['rendered']
    expect(renderedFileName).toBe('text.md')
    if (renderedFileName) {
      const rendered = await Bun.file(join(outputDir, renderedFileName)).text()
      expect(rendered).toContain('01. Track One (Gemini 3.1 Pro)')
      expect(rendered).toContain('Verse 1\n\nLine one')
      expect(rendered).toContain('Chorus\n\nHook line')
      expect(rendered).not.toContain('# Track One')
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('external rendered text filenames use provider aliases only for single-target writes', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-render-names-'))
  try {
    const outputDir = join(tempDir, 'out')
    const externalDir = join(tempDir, 'lyrics')
    await mkdir(outputDir, { recursive: true })

    const llamaMetadata = buildStep3Metadata({
      llmService: 'llama.cpp',
      llmModel: 'ggml-org/gemma-3-270m-it-GGUF'
    })
    const qwenMetadata = buildStep3Metadata({
      llmService: 'llama.cpp',
      llmModel: 'ggml-org/Qwen3-0.6B-GGUF'
    })

    const singleArtifacts = await writeRenderedTextArtifacts({
      outputDir,
      results: [{
        metadata: llamaMetadata,
        renderedText: 'single',
        parsedJson: {}
      }],
      writeInternal: false,
      externalDir,
      externalBaseName: '01-track-one'
    })

    expect(singleArtifacts.externalFiles.map((file) => file.split('/').pop())).toEqual([
      '01-track-one-llama.md'
    ])

    const multiArtifacts = await writeRenderedTextArtifacts({
      outputDir,
      results: [
        {
          metadata: llamaMetadata,
          renderedText: 'gemma',
          parsedJson: {}
        },
        {
          metadata: qwenMetadata,
          renderedText: 'qwen',
          parsedJson: {}
        }
      ],
      writeInternal: false,
      externalDir,
      externalBaseName: '01-track-one'
    })

    expect(multiArtifacts.externalFiles.map((file) => file.split('/').pop()).sort()).toEqual([
      '01-track-one-ggml-org-Qwen3-0.6B-GGUF.md',
      '01-track-one-ggml-org-gemma-3-270m-it-GGUF.md'
    ])
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
