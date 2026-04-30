import { expect, test } from 'bun:test'
import {
  collectLinks,
  parseLinksArgv,
  runLinksWithArgv
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
  ...RUNWAY_GENERAL_LINKS
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

const GCLOUD_TTS_LINKS = [
  'https://docs.cloud.google.com/text-to-speech/docs/chirp3-instant-custom-voice.md.txt',
  'https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd.md.txt',
  'https://docs.cloud.google.com/text-to-speech/docs/create-audio.md.txt',
  'https://docs.cloud.google.com/text-to-speech/docs/basics.md.txt',
  'https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types.md.txt'
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

const GROK_GENERAL_LINKS = [
  'https://docs.x.ai/developers/rate-limits.md',
  'https://docs.x.ai/developers/models.md'
]

const GROK_TTS_LINKS = [
  'https://docs.x.ai/developers/model-capabilities/audio/text-to-speech.md',
  'https://docs.x.ai/developers/rest-api-reference/inference/voice.md'
]

const GROK_STT_LINKS = [
  'https://docs.x.ai/developers/model-capabilities/audio/speech-to-text.md',
  'https://docs.x.ai/developers/rest-api-reference/inference/voice.md'
]

const KIMI_GENERAL_LINKS = [
  'https://platform.kimi.ai/docs/overview.md',
  'https://platform.kimi.ai/docs/api/models-overview.md',
  'https://platform.kimi.ai/docs/models.md',
  'https://platform.kimi.ai/docs/api/overview.md',
  'https://platform.kimi.ai/docs/api/errors.md',
  'https://platform.kimi.ai/docs/guide/faq.md',
  'https://platform.kimi.ai/docs/api/estimate.md',
  'https://platform.kimi.ai/docs/introduction.md',
  'https://platform.kimi.ai/docs/guide/start-using-kimi-api.md'
]

const KIMI_TEXT_LINKS = [
  'https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart.md',
  'https://platform.kimi.ai/docs/pricing/chat-k26.md',
  'https://platform.kimi.ai/docs/api/chat.md',
  'https://platform.kimi.ai/docs/guide/use-json-mode-feature-of-kimi-api.md',
  'https://platform.kimi.ai/docs/guide/prompt-best-practice.md'
]

const KIMI_OCR_LINKS = [
  'https://platform.kimi.ai/docs/api/files-upload.md',
  'https://platform.kimi.ai/docs/guide/use-kimi-vision-model.md'
]

const MISTRAL_GENERAL_LINKS = [
  'https://docs.mistral.ai/resources/sdks',
  'https://raw.githubusercontent.com/mistralai/client-ts/refs/heads/main/README.md',
  'https://raw.githubusercontent.com/mistralai/client-ts/refs/heads/main/docs/lib/utils/retryconfig.md',
  'https://raw.githubusercontent.com/mistralai/client-ts/refs/heads/main/docs/sdks/files/README.md'
]

const MISTRAL_STT_LINKS = [
  'https://docs.mistral.ai/studio-api/audio/speech_to_text',
  'https://docs.mistral.ai/studio-api/audio/speech_to_text/offline_transcription',
  'https://docs.mistral.ai/api/endpoint/audio/transcriptions',
  'https://raw.githubusercontent.com/mistralai/client-ts/refs/heads/main/docs/sdks/transcriptions/README.md'
]

const MISTRAL_OCR_LINKS = [
  'https://docs.mistral.ai/studio-api/document-processing/basic_ocr',
  'https://docs.mistral.ai/api/endpoint/ocr',
  'https://raw.githubusercontent.com/mistralai/client-ts/refs/heads/main/docs/sdks/ocr/README.md',
  'https://raw.githubusercontent.com/mistralai/client-ts/refs/heads/main/docs/sdks/documents/README.md'
]

const MISTRAL_TTS_LINKS = [
  'https://docs.mistral.ai/models/model-cards/voxtral-tts-26-03',
  'https://mistral.ai/news/voxtral-tts',
  'https://docs.mistral.ai/studio-api/audio/text_to_speech',
  'https://docs.mistral.ai/api/endpoint/audio/speech',
  'https://docs.mistral.ai/api/endpoint/audio/voices',
  'https://docs.mistral.ai/studio-api/audio/text_to_speech/voices',
  'https://docs.mistral.ai/studio-api/audio/text_to_speech/speech',
  'https://raw.githubusercontent.com/mistralai/client-ts/refs/heads/main/docs/sdks/speech/README.md',
  'https://raw.githubusercontent.com/mistralai/client-ts/refs/heads/main/docs/sdks/voices/README.md'
]

const BFL_IMAGE_LINKS = [
  'https://docs.bfl.ml/quick_start/introduction.md',
  'https://docs.bfl.ml/quick_start/get_started.md',
  'https://docs.bfl.ml/quick_start/generating_images.md',
  'https://docs.bfl.ml/quick_start/pricing.md',
  'https://docs.bfl.ml/account_management/credits_billing.md',
  'https://docs.bfl.ml/flux_2/flux2_overview.md',
  'https://docs.bfl.ml/flux_2/flux2_image_editing.md',
  'https://docs.bfl.ml/flux_2/flux2_text_to_image.md',
  'https://docs.bfl.ml/api_integration/integration_guidelines.md',
  'https://docs.bfl.ml/api-reference/models/generate-or-edit-an-image-with-flux2-[max]-highest-quality.md',
  'https://docs.bfl.ml/api-reference/models/generate-or-edit-an-image-with-flux2-[klein-9b]-fast-editing.md',
  'https://docs.bfl.ml/api-reference/models/generate-or-edit-an-image-with-flux2-[klein-4b]-fastest-editing.md',
  'https://docs.bfl.ml/api-reference/models/generate-or-edit-an-image-with-flux2-[klein-9b-kv]-fast-editing-with-caching.md',
  'https://docs.bfl.ml/api-reference/models/generate-or-edit-an-image-with-flux2-[pro]-preview-recommended-for-editing.md',
  'https://docs.bfl.ml/api-reference/models/generate-or-edit-an-image-with-flux2-[pro]-recommended-for-editing.md',
  'https://docs.bfl.ml/api-reference/models/generate-or-edit-an-image-with-flux2-[flex]-recommended-for-editing.md'
]

const DRIVE_GENERAL_LINKS = [
  'https://developers.google.com/workspace/drive/api/guides/about-sdk.md.txt',
  'https://developers.google.com/workspace/drive/api/guides/api-specific-auth.md.txt',
  'https://developers.google.com/workspace/drive/api/quickstart/js.md.txt',
  'https://developers.google.com/workspace/drive/api/guides/about-files.md.txt',
  'https://developers.google.com/workspace/drive/api/guides/create-file.md.txt',
  'https://developers.google.com/workspace/drive/api/guides/manage-uploads.md.txt',
  'https://developers.google.com/workspace/drive/api/guides/manage-downloads.md.txt',
  'https://developers.google.com/workspace/drive/api/guides/manage-revisions.md.txt',
  'https://developers.google.com/workspace/drive/api/guides/long-running-operations.md.txt',
  'https://developers.google.com/workspace/drive/api/guides/folder.md.txt',
  'https://developers.google.com/workspace/drive/api/guides/delete.md.txt',
  'https://developers.google.com/workspace/drive/api/guides/search-files.md.txt',
  'https://developers.google.com/workspace/drive/api/guides/file-metadata.md.txt',
  'https://developers.google.com/workspace/drive/api/guides/performance.md.txt'
]

const SPEECHIFY_TTS_LINKS = [
  'https://docs.sws.speechify.com/text-to-speech/get-started/overview.md',
  'https://docs.sws.speechify.com/text-to-speech/get-started/quickstart.md',
  'https://docs.sws.speechify.com/text-to-speech/get-started/authentication.md',
  'https://docs.sws.speechify.com/text-to-speech/get-started/models.md',
  'https://docs.sws.speechify.com/text-to-speech/get-started/api-limits.md',
  'https://docs.sws.speechify.com/text-to-speech/get-started/official-sdks.md',
  'https://docs.sws.speechify.com/text-to-speech/features/voice-cloning.md'
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
channel: 'Unknown'
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

test('links selector accepts runway provider and general section', async () => {
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

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--runway',
    'tts'
  ])).rejects.toThrow('Unknown links section(s) for --runway: tts')
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

test('links selector accepts bfl provider with image section', async () => {
  const bflSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--bfl'
  ])

  expect(bflSelection.serviceSelections.get('bfl')).toEqual([])
  expect(collectLinks(
    bflSelection.serviceSelections,
    bflSelection.globalSections
  )).toEqual(BFL_IMAGE_LINKS)

  const bflImageSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--bfl',
    'image'
  ])

  expect(collectLinks(
    bflImageSelection.serviceSelections,
    bflImageSelection.globalSections
  )).toEqual(BFL_IMAGE_LINKS)

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--bfl',
    'general'
  ])).rejects.toThrow('Unknown links section(s) for --bfl: general')
})

test('links selector accepts drive provider with general section', () => {
  const driveSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--drive'
  ])

  expect(driveSelection.serviceSelections.get('drive')).toEqual([])
  expect(collectLinks(
    driveSelection.serviceSelections,
    driveSelection.globalSections
  )).toEqual(DRIVE_GENERAL_LINKS)

  const driveGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--drive',
    'general'
  ])

  expect(collectLinks(
    driveGeneralSelection.serviceSelections,
    driveGeneralSelection.globalSections
  )).toEqual(DRIVE_GENERAL_LINKS)
})

test('links selector accepts speechify provider with only tts section', async () => {
  const speechifySelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--speechify'
  ])

  expect(speechifySelection.serviceSelections.get('speechify')).toEqual([])
  expect(collectLinks(
    speechifySelection.serviceSelections,
    speechifySelection.globalSections
  )).toEqual(SPEECHIFY_TTS_LINKS)

  const speechifyTtsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--speechify',
    'tts'
  ])

  expect(collectLinks(
    speechifyTtsSelection.serviceSelections,
    speechifyTtsSelection.globalSections
  )).toEqual(SPEECHIFY_TTS_LINKS)

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--speechify',
    'general'
  ])).rejects.toThrow('Unknown links section(s) for --speechify: general')
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
  )).toEqual([...GCLOUD_STT_LINKS, ...GCLOUD_TTS_LINKS, ...GCLOUD_OCR_LINKS])

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

  const gcloudTtsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--gcloud',
    'tts'
  ])

  expect(collectLinks(
    gcloudTtsSelection.serviceSelections,
    gcloudTtsSelection.globalSections
  )).toEqual(GCLOUD_TTS_LINKS)
})

test('links selector accepts grok provider with stt and tts sections', () => {
  const grokSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--grok'
  ])

  expect(grokSelection.serviceSelections.get('grok')).toEqual([])
  expect(collectLinks(
    grokSelection.serviceSelections,
    grokSelection.globalSections
  )).toEqual(expect.arrayContaining([...GROK_GENERAL_LINKS, ...GROK_TTS_LINKS, ...GROK_STT_LINKS]))

  const grokSttSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--grok',
    'stt'
  ])

  expect(collectLinks(
    grokSttSelection.serviceSelections,
    grokSttSelection.globalSections
  )).toEqual(GROK_STT_LINKS)

  const grokTtsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--grok',
    'tts'
  ])

  expect(collectLinks(
    grokTtsSelection.serviceSelections,
    grokTtsSelection.globalSections
  )).toEqual(GROK_TTS_LINKS)
})

test('links selector accepts kimi provider with general text and ocr sections', async () => {
  const kimiSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--kimi'
  ])

  expect(kimiSelection.serviceSelections.get('kimi')).toEqual([])
  expect(collectLinks(
    kimiSelection.serviceSelections,
    kimiSelection.globalSections
  )).toEqual([...KIMI_GENERAL_LINKS, ...KIMI_TEXT_LINKS, ...KIMI_OCR_LINKS])

  const kimiTextSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--kimi',
    'text'
  ])

  expect(collectLinks(
    kimiTextSelection.serviceSelections,
    kimiTextSelection.globalSections
  )).toEqual(KIMI_TEXT_LINKS)

  const kimiOcrSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--kimi',
    'ocr'
  ])

  expect(collectLinks(
    kimiOcrSelection.serviceSelections,
    kimiOcrSelection.globalSections
  )).toEqual(KIMI_OCR_LINKS)

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--kimi',
    'tts'
  ])).rejects.toThrow('Unknown links section(s) for --kimi: tts')
})

test('links selector accepts mistral provider with general stt ocr and tts sections', () => {
  const mistralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--mistral'
  ])

  expect(mistralSelection.serviceSelections.get('mistral')).toEqual([])
  expect(collectLinks(
    mistralSelection.serviceSelections,
    mistralSelection.globalSections
  )).toEqual([...MISTRAL_GENERAL_LINKS, ...MISTRAL_STT_LINKS, ...MISTRAL_OCR_LINKS, ...MISTRAL_TTS_LINKS])

  const mistralSttOcrTtsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--mistral',
    'stt',
    'ocr',
    'tts'
  ])

  expect(collectLinks(
    mistralSttOcrTtsSelection.serviceSelections,
    mistralSttOcrTtsSelection.globalSections
  )).toEqual([...MISTRAL_STT_LINKS, ...MISTRAL_OCR_LINKS, ...MISTRAL_TTS_LINKS])
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
