import { expect, test } from 'bun:test'
import {
  collectLinks,
  parseLinksArgv
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import { runCommand } from '../../test-utils/test-helpers'

const RUNWAY_GENERAL_LINKS = [
  'https://docs.dev.runwayml.com/guides/using-the-api/',
  'https://raw.githubusercontent.com/runwayml/skills/refs/heads/main/skills/use-runway-api/SKILL.md',
  'https://docs.dev.runwayml.com/guides/models/',
  'https://docs.dev.runwayml.com/guides/pricing/',
  'https://docs.dev.runwayml.com/api/',
  'https://raw.githubusercontent.com/runwayml/sdk-node/refs/heads/main/README.md',
  'https://raw.githubusercontent.com/runwayml/sdk-node/ba7f2813c2393198e2f8a637593ae86d3acaa379/api.md',
  'https://docs.dev.runwayml.com/assets/inputs/',
  'https://docs.dev.runwayml.com/assets/outputs/',
  'https://docs.dev.runwayml.com/errors/errors/'
]

test('metadata --markdown prints stable frontmatter instead of JSON', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'metadata',
    'https://example.com/audio.mp3',
    '--markdown'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain(`---
title: 'audio'
slug: 'audio'
duration: 'Unknown'
author: 'Unknown'
url: 'https://example.com/audio.mp3'
---`)
  expect(result.stdout).not.toContain('{\n  "title"')
})

test('links selector errors distinguish dashed global sections from valid providers', () => {
  expect(() => parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--stt',
    'tts'
  ])).toThrow('Unknown links selector "--stt". Known providers:')
})

test('links selector accepts runway provider and general section', () => {
  const runwaySelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--runway'
  ])

  expect(runwaySelection.serviceSelections.get('runway')).toEqual([])
  expect(collectLinks(
    runwaySelection.serviceSelections,
    runwaySelection.globalSections
  )).toEqual(RUNWAY_GENERAL_LINKS)

  const runwayGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--runway',
    'general'
  ])

  expect(collectLinks(
    runwayGeneralSelection.serviceSelections,
    runwayGeneralSelection.globalSections
  )).toEqual(RUNWAY_GENERAL_LINKS)
})

test('music lyric-video render mode rejects generation-only price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'music',
    '--audio',
    'input/examples/audio/0-audio-short.mp3',
    '--price'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Do not combine hosted music flags')
})
