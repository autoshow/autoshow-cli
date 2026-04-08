import { test, expect } from 'bun:test'
import { fileExists, runCommand } from '../../test-utils/test-helpers'

const DIRECT_MEDIA_URL = 'https://example.com/audio.mp3'
const EXPECTED_FRONTMATTER = `---
title: 'audio'
duration: 'Unknown'
author: 'Unknown'
url: 'https://example.com/audio.mp3'
---
`

test('metadata --markdown prints frontmatter yaml instead of json', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'metadata',
    DIRECT_MEDIA_URL,
    '--markdown'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain(EXPECTED_FRONTMATTER)
  expect(result.stdout).not.toContain('{\n  "title"')
})

test('metadata --markdown --save writes metadata.json and metadata.md', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'metadata',
    DIRECT_MEDIA_URL,
    '--markdown',
    '--save'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.outputDir).not.toBeNull()

  const outputDir = result.outputDir as string
  const jsonPath = `${outputDir}/metadata.json`
  const markdownPath = `${outputDir}/metadata.md`

  expect(await fileExists(jsonPath)).toBe(true)
  expect(await fileExists(markdownPath)).toBe(true)

  const savedJson = await Bun.file(jsonPath).json() as { step1?: Record<string, unknown> }
  const savedMarkdown = await Bun.file(markdownPath).text()

  expect(savedJson.step1?.['title']).toBe('audio')
  expect(savedJson.step1?.['url']).toBe(DIRECT_MEDIA_URL)
  expect(savedMarkdown).toBe(EXPECTED_FRONTMATTER)
  expect(result.stdout.startsWith(EXPECTED_FRONTMATTER)).toBe(true)
})
