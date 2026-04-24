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

const buildStep3Metadata = (): Step3Metadata => ({
  llmService: 'gemini',
  llmModel: 'gemini-3.1-pro-preview',
  processingTime: 1,
  inputTokenCount: 1,
  outputTokenCount: 1,
  outputFileName: 'text.json',
  outputFormat: 'json',
  structuredMode: 'native',
  structuredPresetNames: ['songLyrics']
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

test('song lyric renderer includes deterministic title without duplicating lyric headings', () => {
  const rendered = renderToPlainText({
    title: 'Track One',
    lyrics: '# Track One\n\nVerse 1\n\nLine one'
  }, ['rockSong'])

  expect(rendered).toBe('# Track One\n\nVerse 1\n\nLine one')
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

    const renderedText = renderToPlainText({
      title: 'Track One',
      lyrics: 'Verse 1\n\nLine one'
    }, ['rockSong'])
    const artifacts = await writeRenderedTextArtifacts({
      outputDir,
      results: [{
        metadata: buildStep3Metadata(),
        renderedText,
        parsedJson: {
          title: 'Track One',
          lyrics: 'Verse 1\n\nLine one'
        }
      }],
      writeInternal: true,
      sourcePath,
      trackListPath: tracksPath
    })

    const renderedFileName = artifacts.internalArtifacts['rendered']
    expect(renderedFileName).toBe('text.md')
    if (renderedFileName) {
      const rendered = await Bun.file(join(outputDir, renderedFileName)).text()
      expect(rendered).toBe('01. Track One (Gemini 3.1 Pro)\n\nVerse 1\n\nLine one\n')
      expect(rendered).not.toContain('# Track One')
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
