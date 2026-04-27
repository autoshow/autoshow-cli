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

const RUNWAY_ALL_LINKS = [
  ...RUNWAY_GENERAL_LINKS,
  'https://help.runwayml.com/hc/en-us/articles/37053594806419-Creating-with-Gen-4-Image'
]

const AWS_STT_LINKS = [
  'https://docs.aws.amazon.com/transcribe/latest/dg/what-is.md',
  'https://docs.aws.amazon.com/transcribe/latest/dg/getting-started-cli.md',
  'https://docs.aws.amazon.com/transcribe/latest/dg/diarization.md',
  'https://docs.aws.amazon.com/transcribe/latest/dg/diarization-output-batch.md'
]

const AWS_OCR_LINKS = [
  'https://docs.aws.amazon.com/textract/latest/dg/what-is.md',
  'https://docs.aws.amazon.com/textract/latest/dg/setting-up.md',
  'https://docs.aws.amazon.com/textract/latest/dg/setup-awscli-sdk.md',
  'https://docs.aws.amazon.com/textract/latest/dg/program-access.md',
  'https://docs.aws.amazon.com/textract/latest/dg/get-started-exercise.md',
  'https://docs.aws.amazon.com/textract/latest/dg/how-it-works-detecting.md',
  'https://docs.aws.amazon.com/textract/latest/dg/how-it-works-analyzing.md',
  'https://docs.aws.amazon.com/textract/latest/dg/how-it-works-custom-queries.md',
  'https://docs.aws.amazon.com/textract/latest/dg/document-response.md',
  'https://docs.aws.amazon.com/textract/latest/dg/how-it-works-document-layout.md',
  'https://docs.aws.amazon.com/textract/latest/dg/how-it-works-pages.md',
  'https://docs.aws.amazon.com/textract/latest/dg/how-it-works-lines-words.md',
  'https://docs.aws.amazon.com/textract/latest/dg/async.md',
  'https://docs.aws.amazon.com/textract/latest/dg/textract-using-adapters.md',
  'https://docs.aws.amazon.com/textract/latest/dg/textract-best-practices.md'
]

const GCLOUD_STT_LINKS = [
  'https://docs.cloud.google.com/speech-to-text/docs/quickstarts/transcribe-api.md.txt',
  'https://docs.cloud.google.com/speech-to-text/docs/sync-recognize.md.txt',
  'https://docs.cloud.google.com/speech-to-text/docs/batch-recognize.md.txt',
  'https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3.md.txt'
]

const GCLOUD_OCR_LINKS = [
  'https://docs.cloud.google.com/document-ai/docs/overview.md.txt',
  'https://docs.cloud.google.com/document-ai/docs/setup.md.txt',
  'https://docs.cloud.google.com/document-ai/docs/enrichment.md.txt',
  'https://docs.cloud.google.com/document-ai/docs/normalization.md.txt',
  'https://docs.cloud.google.com/document-ai/docs/enterprise-document-ocr.md.txt#ocr-processing',
  'https://docs.cloud.google.com/document-ai/docs/layout-parse-chunk.md.txt',
  'https://docs.cloud.google.com/document-ai/docs/layout-parse-quickstart.md.txt',
  'https://docs.cloud.google.com/document-ai/docs/reference/rest.md.txt'
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
  )).toEqual(RUNWAY_ALL_LINKS)

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

test('links selector accepts aws provider with stt and ocr sections', () => {
  const awsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--aws'
  ])

  expect(awsSelection.serviceSelections.get('aws')).toEqual([])
  expect(collectLinks(
    awsSelection.serviceSelections,
    awsSelection.globalSections
  )).toEqual([...AWS_STT_LINKS, ...AWS_OCR_LINKS])

  const awsOcrSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--aws',
    'ocr'
  ])

  expect(collectLinks(
    awsOcrSelection.serviceSelections,
    awsOcrSelection.globalSections
  )).toEqual(AWS_OCR_LINKS)
})

test('links selector accepts gcloud provider with stt and ocr sections', () => {
  const gcloudSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--gcloud'
  ])

  expect(gcloudSelection.serviceSelections.get('gcloud')).toEqual([])
  expect(collectLinks(
    gcloudSelection.serviceSelections,
    gcloudSelection.globalSections
  )).toEqual([...GCLOUD_STT_LINKS, ...GCLOUD_OCR_LINKS])

  const gcloudSttSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--gcloud',
    'stt'
  ])

  expect(collectLinks(
    gcloudSttSelection.serviceSelections,
    gcloudSttSelection.globalSections
  )).toEqual(GCLOUD_STT_LINKS)

  const gcloudOcrSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--gcloud',
    'ocr'
  ])

  expect(collectLinks(
    gcloudOcrSelection.serviceSelections,
    gcloudOcrSelection.globalSections
  )).toEqual(GCLOUD_OCR_LINKS)
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
