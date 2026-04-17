import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import type { StructuredRunResult } from '~/types'
import { collectTextInputFiles, writeRenderedTextArtifacts } from '~/cli/commands/process-steps/step-3-write/text-input-utils'

const tempDirs: string[] = []

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-write-text-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

describe('collectTextInputFiles', () => {
  test('filters to markdown and text files and sorts by basename numerically', async () => {
    const dir = await createTempDir()
    await mkdir(join(dir, 'nested'))

    await writeFile(join(dir, '10-outro.txt'), 'outro')
    await writeFile(join(dir, '2-chorus.md'), 'chorus')
    await writeFile(join(dir, 'ignore.json'), '{}')
    await writeFile(join(dir, 'nested', '01-intro.md'), 'intro')
    await writeFile(join(dir, 'nested', '03-verse.txt'), 'verse')

    const files = await collectTextInputFiles(dir)

    expect(files.map((file) => basename(file))).toEqual([
      '01-intro.md',
      '2-chorus.md',
      '03-verse.txt',
      '10-outro.txt'
    ])
  })
})

describe('writeRenderedTextArtifacts', () => {
  test('writes provider-specific markdown artifacts and prepends track headers', async () => {
    const dir = await createTempDir()
    const outputDir = join(dir, 'output')
    const externalDir = join(dir, 'lyrics')
    const trackListPath = join(dir, 'tracks.md')

    await mkdir(outputDir)
    await writeFile(trackListPath, '01. Opening Song\n02. Finale\n')

    const results: StructuredRunResult[] = [
      {
        metadata: {
          llmService: 'openai',
          llmModel: 'gpt-5.4',
          processingTime: 100,
          inputTokenCount: 50,
          outputTokenCount: 60,
          outputFileName: 'text-openai.json',
          outputFormat: 'json',
          structuredMode: 'native',
          structuredPresetNames: ['freeformEnvelope']
        },
        renderedText: 'First verse',
        parsedJson: { content: 'First verse' }
      },
      {
        metadata: {
          llmService: 'gemini',
          llmModel: 'gemini-2.5-pro',
          processingTime: 90,
          inputTokenCount: 45,
          outputTokenCount: 55,
          outputFileName: 'text-gemini.json',
          outputFormat: 'json',
          structuredMode: 'native',
          structuredPresetNames: ['freeformEnvelope']
        },
        renderedText: 'Second verse',
        parsedJson: { content: 'Second verse' }
      }
    ]

    const artifactResult = await writeRenderedTextArtifacts({
      outputDir,
      results,
      writeInternal: true,
      sourcePath: join(dir, '01-intro.md'),
      trackListPath,
      externalDir,
      externalBaseName: '01-intro'
    })

    expect(artifactResult.internalArtifacts).toEqual({
      'rendered-chatgpt': 'text-chatgpt.md',
      'rendered-gemini': 'text-gemini.md'
    })
    expect(artifactResult.externalFiles.map((file) => basename(file))).toEqual([
      '01-intro-chatgpt.md',
      '01-intro-gemini.md'
    ])

    expect(await readFile(join(outputDir, 'text-chatgpt.md'), 'utf8')).toBe(
      '01. Opening Song (ChatGPT)\n\nFirst verse\n'
    )
    expect(await readFile(join(outputDir, 'text-gemini.md'), 'utf8')).toBe(
      '01. Opening Song (Gemini)\n\nSecond verse\n'
    )
    expect(await readFile(join(externalDir, '01-intro-chatgpt.md'), 'utf8')).toBe(
      '01. Opening Song (ChatGPT)\n\nFirst verse\n'
    )
  })
})
