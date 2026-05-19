import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  Step3Metadata,
  Step4Metadata,
  Step5Metadata,
  Step6VideoMetadata,
  Step7MusicMetadata,
  StructuredRunResult
} from '~/types'
import { writeShowNoteArtifacts } from '~/cli/commands/process-steps/step-3-write/show-note-artifacts'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { buildExpectedFilesList } from '~/cli/commands/process-steps/step-1-download/targets/expected-output'

const buildStep3Metadata = (overrides: Partial<Step3Metadata> = {}): Step3Metadata => ({
  llmService: 'openai',
  llmModel: 'gpt-5.4',
  processingTime: 1,
  inputTokenCount: 1,
  outputTokenCount: 1,
  outputFileName: 'text.json',
  outputFormat: 'json',
  structuredMode: 'native',
  structuredPresetNames: ['shortSummary'],
  ...overrides
})

const buildResult = (overrides: Partial<Step3Metadata> = {}, renderedText = '## Summary\n\nRendered JSON markdown'): StructuredRunResult => ({
  metadata: buildStep3Metadata(overrides),
  renderedText,
  parsedJson: {}
})

const writePrompt = async (outputDir: string): Promise<void> => {
  await writeFile(join(outputDir, 'prompt.md'), [
    '---',
    'title: "Show Note Source"',
    'slug: "show-note-source"',
    '---',
    '',
    'Prompt instructions must not leak into show notes.',
    '',
    'Transcript:',
    '[00:00:00] Prompt transcript copy'
  ].join('\n'))
}

test('show notes preserve prompt frontmatter and include rendered output plus source text', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-show-note-'))
  try {
    const outputDir = join(tempDir, 'out')
    await mkdir(outputDir, { recursive: true })
    await writePrompt(outputDir)

    const artifacts = await writeShowNoteArtifacts({
      outputDir,
      results: [buildResult()],
      sourceText: 'Full source text\nwith all details.'
    })

    expect(artifacts.internalArtifacts).toEqual({ showNote: 'show-note.md' })
    const showNote = await Bun.file(join(outputDir, 'show-note.md')).text()

    expect(showNote.startsWith('---\ntitle: "Show Note Source"\nslug: "show-note-source"\n---\n\n')).toBe(true)
    expect(showNote).toContain('## Summary\n\nRendered JSON markdown')
    expect(showNote).toContain('## Source\n\n```text\nFull source text\nwith all details.\n```')
    expect(showNote).not.toContain('Prompt instructions must not leak into show notes.')
    expect(showNote).not.toContain('[00:00:00] Prompt transcript copy')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('show notes flatten default summary JSON into publication markdown', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-show-note-default-'))
  try {
    const outputDir = join(tempDir, 'out')
    await mkdir(outputDir, { recursive: true })
    await writePrompt(outputDir)

    await writeShowNoteArtifacts({
      outputDir,
      results: [{
        metadata: buildStep3Metadata(),
        renderedText: '## Short Summary\n\n## Episode Description\n\nBad wrapper',
        parsedJson: {
          shortSummary: {
            episodeDescription: 'A concise episode description.'
          },
          longSummary: {
            episodeSummary: 'A focused summary paragraph.'
          },
          longChapters: {
            chapters: [{
              timestamp: '00:00:00',
              title: 'Introduction and Overview',
              description: 'A first paragraph.\n\nA second paragraph.'
            }]
          }
        }
      }],
      sourceText: 'source'
    })

    const showNote = await Bun.file(join(outputDir, 'show-note.md')).text()
    expect(showNote).toContain([
      '## Episode Description',
      '',
      'A concise episode description.',
      '',
      '## Episode Summary',
      '',
      'A focused summary paragraph.',
      '',
      '## Chapters',
      '',
      '### 00:00:00 - Introduction and Overview',
      '',
      'A first paragraph.',
      '',
      'A second paragraph.'
    ].join('\n'))
    expect(showNote).not.toContain('## Short Summary')
    expect(showNote).not.toContain('## Long Summary')
    expect(showNote).not.toContain('#### Item 1')
    expect(showNote).not.toContain('### Timestamp')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('show notes mirror single and multi-output JSON naming', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-show-note-names-'))
  try {
    const outputDir = join(tempDir, 'out')
    await mkdir(outputDir, { recursive: true })
    await writePrompt(outputDir)

    const single = await writeShowNoteArtifacts({
      outputDir,
      results: [buildResult({ outputFileName: 'text.json' })],
      sourceText: 'source'
    })
    expect(single.internalArtifacts).toEqual({ showNote: 'show-note.md' })

    const partialMulti = await writeShowNoteArtifacts({
      outputDir,
      results: [buildResult({ outputFileName: 'text-gpt-5.4.json' })],
      sourceText: 'source'
    })
    expect(partialMulti.internalArtifacts).toEqual({ 'showNote-gpt-5.4': 'show-note-gpt-5.4.md' })

    const multi = await writeShowNoteArtifacts({
      outputDir,
      results: [
        buildResult({ llmModel: 'gpt-5.4', outputFileName: 'text-gpt-5.4.json' }, 'first'),
        buildResult({ llmModel: 'ggml-org/Qwen3-0.6B-GGUF', outputFileName: 'text-ggml-org-Qwen3-0.6B-GGUF.json' }, 'second')
      ],
      sourceText: 'source'
    })

    expect(Object.values(multi.internalArtifacts).sort()).toEqual([
      'show-note-ggml-org-Qwen3-0.6B-GGUF.md',
      'show-note-gpt-5.4.md'
    ])
    expect(await Bun.file(join(outputDir, 'show-note-gpt-5.4.md')).text()).toContain('first')
    expect(await Bun.file(join(outputDir, 'show-note-ggml-org-Qwen3-0.6B-GGUF.md')).text()).toContain('second')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('show notes render generated media assets with relative embeds and links', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-show-note-assets-'))
  try {
    const outputDir = join(tempDir, 'out')
    await mkdir(outputDir, { recursive: true })
    await writePrompt(outputDir)

    const step4Metadata: Step4Metadata[] = [{
      ttsService: 'openai',
      ttsModel: 'gpt-4o-mini-tts',
      processingTime: 1,
      audioFileName: 'speech.wav',
      audioFileSize: 100,
      chunkCount: 1
    }]
    const step5Metadata: Step5Metadata[] = [{
      imageService: 'openai',
      imageModel: 'gpt-image-2',
      processingTime: 1,
      imageFileNames: ['generated-image.png'],
      imageCount: 1,
      imageFileSize: 100,
      imageWidth: 1024,
      imageHeight: 1024,
      requestMode: 'generation'
    }]
    const step6Metadata: Step6VideoMetadata[] = [{
      videoGenService: 'gemini',
      videoGenModel: 'veo-3.1-generate-preview',
      processingTime: 1,
      videoFileName: 'generated-video.mp4',
      videoFileSize: 100,
      videoDuration: 8
    }]
    const step7Metadata: Step7MusicMetadata[] = [{
      musicService: 'elevenlabs',
      musicModel: 'music_v1',
      processingTime: 1,
      musicFileName: 'generated-music.mp3',
      musicFileSize: 100,
      musicDurationMs: 30_000,
      lyricsSource: 'generated'
    }]

    await writeShowNoteArtifacts({
      outputDir,
      results: [buildResult()],
      sourceText: 'source',
      step4Metadata,
      step5Metadata,
      step6Metadata,
      step7Metadata
    })

    const showNote = await Bun.file(join(outputDir, 'show-note.md')).text()
    expect(showNote).toContain('## Assets')
    expect(showNote).toContain('<audio controls src="speech.wav"></audio>')
    expect(showNote).toContain('[Download speech.wav](speech.wav)')
    expect(showNote).toContain('![generated-image.png](generated-image.png)')
    expect(showNote).toContain('[Download generated-image.png](generated-image.png)')
    expect(showNote).toContain('<video controls src="generated-video.mp4"></video>')
    expect(showNote).toContain('[Download generated-video.mp4](generated-video.mp4)')
    expect(showNote).toContain('<audio controls src="generated-music.mp3"></audio>')
    expect(showNote).toContain('[Download generated-music.mp3](generated-music.mp3)')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('expected output planning reports show-note artifacts only when LLM output is expected', async () => {
  const singleTextInput = await buildExpectedFilesList(
    'write',
    buildOptsFromFlags(false, { 'text-input': true, openai: 'gpt-5.4-mini' })
  )
  expect(singleTextInput).toContain('text.json')
  expect(singleTextInput).toContain('show-note.md')

  const multiTextInput = await buildExpectedFilesList(
    'write',
    buildOptsFromFlags(false, { 'text-input': true, 'all-llm': true })
  )
  expect(multiTextInput).toContain('text-<model>.json')
  expect(multiTextInput).toContain('show-note-<model>.md')
  expect(multiTextInput).not.toContain('show-note.md')

  const skipLlmMediaWrite = await buildExpectedFilesList(
    'write',
    buildOptsFromFlags(true, {})
  )
  expect(skipLlmMediaWrite).not.toContain('text.json')
  expect(skipLlmMediaWrite).not.toContain('show-note.md')
})
