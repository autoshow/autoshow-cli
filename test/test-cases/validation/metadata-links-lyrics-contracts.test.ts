import { expect, test } from 'bun:test'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  collectLinks,
  getDefaultLinksInputOutputFileName,
  parseLinksArgv,
  readLinksInputFile,
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

const GLM_OCR_LINKS = [
  'https://docs.z.ai/guides/vlm/glm-ocr.md',
  'https://docs.z.ai/api-reference/tools/layout-parsing.md'
]

const GLM_URL_LINKS = [
  'https://docs.z.ai/api-reference/tools/web-reader.md'
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

const X_GENERAL_LINKS = [
  'https://docs.x.com/x-api/introduction.md',
  'https://docs.x.com/make-your-first-request.md',
  'https://docs.x.com/x-api/getting-started/pricing.md',
  'https://docs.x.com/x-api/getting-started/getting-access.md'
]

const X_URL_LINKS = [
  'https://docs.x.com/x-api/spaces/introduction.md',
  'https://docs.x.com/x-api/spaces/lookup/introduction.md',
  'https://docs.x.com/x-api/spaces/lookup/quickstart.md',
  'https://docs.x.com/x-api/spaces/get-spaces-by-ids.md',
  'https://docs.x.com/x-api/spaces/get-spaces-by-creator-ids.md',
  'https://docs.x.com/x-api/spaces/get-space-by-id.md',
  'https://docs.x.com/x-api/spaces/get-space-posts.md',
  'https://docs.x.com/x-api/spaces/get-space-ticket-buyers.md',
  'https://docs.x.com/x-api/spaces/search/introduction.md',
  'https://docs.x.com/x-api/spaces/search/quickstart.md',
  'https://docs.x.com/x-api/spaces/search-spaces.md',
  'https://docs.x.com/x-api/users/lookup/introduction.md',
  'https://docs.x.com/x-api/users/lookup/quickstart/user-lookup.md',
  'https://docs.x.com/x-api/users/lookup/quickstart/authenticated-lookup.md',
  'https://docs.x.com/x-api/users/lookup/integrate.md',
  'https://docs.x.com/x-api/users/get-user-by-id.md',
  'https://docs.x.com/x-api/users/get-users-by-ids.md',
  'https://docs.x.com/x-api/users/get-users-by-usernames.md',
  'https://docs.x.com/x-api/users/get-user-by-username.md',
  'https://docs.x.com/x-api/users/get-my-user.md',
  'https://docs.x.com/x-api/posts/lookup/introduction.md',
  'https://docs.x.com/x-api/posts/lookup/quickstart.md',
  'https://docs.x.com/x-api/posts/lookup/integrate.md',
  'https://docs.x.com/x-api/posts/get-posts-by-ids.md',
  'https://docs.x.com/x-api/posts/get-post-by-id.md'
]

const SCRAPECREATORS_STT_LINK = 'blob:https://docs.scrapecreators.com/de495975-7e82-4fd9-953a-2fe2c257845e'
const SCRAPECREATORS_FETCH_STT_LINK = 'https://docs.scrapecreators.com/de495975-7e82-4fd9-953a-2fe2c257845e'
const SCRAPECREATORS_GENERAL_LINKS = [
  'blob:https://docs.scrapecreators.com/087703a1-b172-471d-a400-6bad935f510d'
]

const SCRAPECREATORS_STT_LINKS = [
  SCRAPECREATORS_STT_LINK
]

const SCRAPECREATORS_URL_LINKS = [
  'blob:https://docs.scrapecreators.com/ff1a7d46-8bbb-4538-bc30-492e94f9c773',
  'blob:https://docs.scrapecreators.com/1abff375-a55d-4913-ba54-46955737340a',
  'blob:https://docs.scrapecreators.com/7b29bf5a-59ad-4626-a633-ca43104366c7',
  'blob:https://docs.scrapecreators.com/c4c8f88d-ed85-40d0-a9fc-b33f0fb72a1e',
  'blob:https://docs.scrapecreators.com/ddec819d-87c4-45e1-b602-e552c5de4fd8',
  'blob:https://docs.scrapecreators.com/bdc7fb25-6ba7-4992-8d07-dd5edf4a3d6c'
]

const ZYTE_GENERAL_LINKS = [
  'https://docs.zyte.com/zyte-api/get-started.md',
  'https://docs.zyte.com/zyte-api/usage/http.md',
  'https://docs.zyte.com/zyte-api/usage/features.md',
  'https://docs.zyte.com/zyte-api/usage/rate-limit.md',
  'https://docs.zyte.com/zyte-api/usage/optimize.md',
  'https://docs.zyte.com/zyte-api/usage/errors.md',
  'https://docs.zyte.com/zyte-api/usage/reference.md',
  'https://docs.zyte.com/zyte-api/usage/stats.md',
  'https://docs.zyte.com/zyte-api/usage/examples.md'
]

const ZYTE_URL_LINKS = [
  'https://docs.zyte.com/zyte-api/usage/extract/index.md',
  'https://docs.zyte.com/zyte-api/usage/extract/custom-attributes.md',
  'https://docs.zyte.com/web-scraping/get-started.md',
  'https://docs.zyte.com/web-scraping/tutorials/main/index.md',
  'https://docs.zyte.com/web-scraping/guides/export/index.md'
]

const FIRECRAWL_GENERAL_LINKS = [
  'https://docs.firecrawl.dev/api-reference/introduction.md',
  'https://docs.firecrawl.dev/introduction.md',
  'https://docs.firecrawl.dev/sdks/cli.md',
  'https://docs.firecrawl.dev/ai-onboarding.md',
  'https://docs.firecrawl.dev/mcp-server.md',
  'https://docs.firecrawl.dev/advanced-scraping-guide.md',
  'https://docs.firecrawl.dev/billing.md',
  'https://docs.firecrawl.dev/rate-limits.md',
  'https://docs.firecrawl.dev/partner-credits.md'
]

const FIRECRAWL_URL_LINKS = [
  'https://docs.firecrawl.dev/features/scrape.md',
  'https://docs.firecrawl.dev/features/fast-scraping.md',
  'https://docs.firecrawl.dev/features/batch-scrape.md',
  'https://docs.firecrawl.dev/features/llm-extract.md',
  'https://docs.firecrawl.dev/features/change-tracking.md',
  'https://docs.firecrawl.dev/features/enhanced-mode.md',
  'https://docs.firecrawl.dev/features/lockdown.md',
  'https://docs.firecrawl.dev/features/proxies.md',
  'https://docs.firecrawl.dev/features/document-parsing.md',
  'https://docs.firecrawl.dev/api-reference/endpoint/scrape.md',
  'https://docs.firecrawl.dev/api-reference/endpoint/batch-scrape.md',
  'https://docs.firecrawl.dev/api-reference/endpoint/batch-scrape-get.md',
  'https://docs.firecrawl.dev/api-reference/endpoint/batch-scrape-delete.md',
  'https://docs.firecrawl.dev/api-reference/endpoint/batch-scrape-get-errors.md'
]

const SPIDER_GENERAL_LINKS = [
  'https://spider.cloud/docs/overview',
  'https://spider.cloud/api-keys',
  'https://spider.cloud/docs/api',
  'https://spider.cloud/docs/quickstart',
  'https://spider.cloud/docs/concepts',
  'https://spider.cloud/docs/core/authentication',
  'https://spider.cloud/docs/core/rate-limits',
  'https://spider.cloud/docs/core/error-codes',
  'https://spider.cloud/docs/core/reliability'
]

const SPIDER_URL_LINKS = [
  'https://spider.cloud/docs/core/scraping-crawling',
  'https://spider.cloud/docs/core/efficient-scraping',
  'https://spider.cloud/docs/core/spider-browser',
  'https://spider.cloud/docs/advanced/json-scraping',
  'https://spider.cloud/docs/guides/recipes'
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
  'https://docs.sws.speechify.com/tts/text-to-speech/get-started/overview.md',
  'https://docs.sws.speechify.com/tts/text-to-speech/get-started/quickstart.md',
  'https://docs.sws.speechify.com/tts/text-to-speech/get-started/authentication.md',
  'https://docs.sws.speechify.com/tts/text-to-speech/get-started/models.md',
  'https://docs.sws.speechify.com/tts/text-to-speech/get-started/api-limits.md',
  'https://docs.sws.speechify.com/tts/text-to-speech/get-started/official-sdks.md',
  'https://docs.sws.speechify.com/tts/text-to-speech/features/voice-cloning.md',
  'https://docs.sws.speechify.com/tts/api-reference/api-reference/introduction.md',
  'https://docs.sws.speechify.com/tts/api-reference/api-reference/authentication.md',
  'https://docs.sws.speechify.com/tts/api-reference/api-reference/text-to-speech/audio/speech.md',
  'https://docs.sws.speechify.com/tts/api-reference/api-reference/text-to-speech/voices/list.md',
  'https://docs.sws.speechify.com/tts/api-reference/api-reference/text-to-speech/voices/create.md',
  'https://docs.sws.speechify.com/tts/api-reference/api-reference/text-to-speech/voices/delete.md',
  'https://docs.sws.speechify.com/tts/api-reference/api-reference/text-to-speech/voices/download-sample.md'
]

const LINKS_RETRY_TEST_URL = 'https://elevenlabs.io/docs/overview/models.md'
const linksTestOutputPath = (name: string): string =>
  `/tmp/autoshow-links-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.md`
const linksTestInputPath = (name: string, extension = 'md'): string =>
  `/tmp/autoshow-links-input-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`

const writeLinksFakeDefuddleBin = async (): Promise<{ dir: string, bin: string }> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-links-fake-defuddle-'))
  const bin = join(dir, 'defuddle')
  await writeFile(bin, [
    '#!/usr/bin/env bun',
    "import { readFileSync } from 'node:fs'",
    'const args = process.argv.slice(2)',
    "if (args[0] === '--version') { console.log('0.17.0'); process.exit(0) }",
    "if (process.env.AUTOSHOW_FAKE_DEFUDDLE_STDERR) console.error(process.env.AUTOSHOW_FAKE_DEFUDDLE_STDERR)",
    "const html = readFileSync(args[1], 'utf8')",
    "const text = html.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim()",
    "console.log(JSON.stringify({ contentMarkdown: text, title: 'Links Defuddle Fixture', wordCount: text.split(/\\s+/).filter(Boolean).length }))"
  ].join('\n'))
  await chmod(bin, 0o755)
  return { dir, bin }
}

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

test('links parses a local markdown input file as standalone file mode', () => {
  const selection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    'urls.md'
  ])

  expect(selection.inputFilePath).toBe('urls.md')
  expect(selection.serviceSelections.size).toBe(0)
  expect(selection.globalSections).toEqual([])
  expect(getDefaultLinksInputOutputFileName('urls.md')).toBe('urls-links.md')
  expect(getDefaultLinksInputOutputFileName('/tmp/my docs!.txt')).toBe('my-docs-links.md')
})

test('links reads remote URLs from input files and dedupes in first-seen order', async () => {
  const inputPath = linksTestInputPath('extract')
  await Bun.write(inputPath, [
    '# Documentation links',
    '<!-- https://ignored.example.com/comment -->',
    '',
    '- https://example.com/docs',
    '- [API docs](https://example.com/api)',
    '- [duplicate docs](https://example.com/docs)',
    '- blob:https://docs.scrapecreators.com/de495975-7e82-4fd9-953a-2fe2c257845e',
    'plain prose without a URL',
    '// https://ignored.example.com/line-comment'
  ].join('\n'))

  await expect(readLinksInputFile(inputPath)).resolves.toEqual([
    'https://example.com/docs',
    'https://example.com/api',
    'blob:https://docs.scrapecreators.com/de495975-7e82-4fd9-953a-2fe2c257845e'
  ])
})

test('links fetches URL input files through the existing combined markdown writer', async () => {
  const inputPath = linksTestInputPath('run')
  const outputPath = linksTestOutputPath('input-file-run')
  const fetchedUrls: string[] = []

  await Bun.write(inputPath, [
    'https://example.com/a.md',
    '[Page](https://example.com/page)',
    'https://example.com/a.md'
  ].join('\n'))

  const result = await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    inputPath
  ], {
    outputPath,
    fetchImpl: async (input: string | URL | Request): Promise<Response> => {
      const url = String(input)
      fetchedUrls.push(url)

      return new Response(`# docs for ${url}\n`, {
        headers: { 'content-type': 'text/markdown' }
      })
    }
  })

  const output = await Bun.file(outputPath).text()
  expect(result.urlCount).toBe(2)
  expect(fetchedUrls).toEqual([
    'https://example.com/a.md',
    'https://example.com/page'
  ])
  expect(output).toContain('<!-- Source: https://example.com/a.md -->')
  expect(output).toContain('<!-- Source: https://example.com/page -->')
  expect(output).toContain('# docs for https://example.com/a.md')
})

test('links input file mode reports missing empty and no-url files as usage errors', async () => {
  const missingPath = linksTestInputPath('missing')
  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    missingPath
  ])).rejects.toThrow('Links input file not found')

  const emptyPath = linksTestInputPath('empty')
  await Bun.write(emptyPath, ' \n\t\n')
  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    emptyPath
  ])).rejects.toThrow('Links input file is empty')

  const noUrlPath = linksTestInputPath('no-url')
  await Bun.write(noUrlPath, '# Heading\n- local-file.md\nplain prose\n')
  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    noUrlPath
  ])).rejects.toThrow('No valid remote URLs found in links input file')
})

test('links input file mode cannot be combined with provider or section selectors', () => {
  expect(() => parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    'urls.md',
    'stt'
  ])).toThrow('links input file mode cannot be combined with provider or section selectors')

  expect(() => parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    'urls.md',
    '--openai'
  ])).toThrow('links input file mode cannot be combined with provider or section selectors')

  expect(() => parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--openai',
    'urls.md'
  ])).toThrow('links input file mode cannot be combined with provider or section selectors')
})

test('links retries transient network failures before writing output', async () => {
  const outputPath = linksTestOutputPath('socket-retry')
  const attempts = new Map<string, number>()

  const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input)
    const attempt = (attempts.get(url) ?? 0) + 1
    attempts.set(url, attempt)

    if (url === LINKS_RETRY_TEST_URL && attempt === 1) {
      throw new Error('The socket connection was closed unexpectedly')
    }

    return new Response(`# docs for ${url}\n`, {
      headers: { 'content-type': 'text/markdown' }
    })
  }

  await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--elevenlabs',
    'general'
  ], { outputPath, fetchImpl })

  const output = await Bun.file(outputPath).text()
  expect(attempts.get(LINKS_RETRY_TEST_URL)).toBe(2)
  expect(output).toContain(`<!-- Source: ${LINKS_RETRY_TEST_URL} -->`)
  expect(output).not.toContain(`<!-- Failed to fetch ${LINKS_RETRY_TEST_URL} -->`)
})

test('links retries retryable HTTP status failures before writing output', async () => {
  const outputPath = linksTestOutputPath('status-retry')
  const attempts = new Map<string, number>()

  const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input)
    const attempt = (attempts.get(url) ?? 0) + 1
    attempts.set(url, attempt)

    if (url === LINKS_RETRY_TEST_URL && attempt === 1) {
      return new Response('temporary outage', { status: 503, statusText: 'Service Unavailable' })
    }

    return new Response(`# docs for ${url}\n`, {
      headers: { 'content-type': 'text/markdown' }
    })
  }

  await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--elevenlabs',
    'general'
  ], { outputPath, fetchImpl })

  const output = await Bun.file(outputPath).text()
  expect(attempts.get(LINKS_RETRY_TEST_URL)).toBe(2)
  expect(output).toContain(`<!-- Source: ${LINKS_RETRY_TEST_URL} -->`)
  expect(output).not.toContain(`<!-- Failed to fetch ${LINKS_RETRY_TEST_URL} -->`)
})

test('links does not retry non-retryable HTTP status failures', async () => {
  const outputPath = linksTestOutputPath('non-retryable-status')
  const attempts = new Map<string, number>()

  const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input)
    attempts.set(url, (attempts.get(url) ?? 0) + 1)

    if (url === LINKS_RETRY_TEST_URL) {
      return new Response('missing', { status: 404, statusText: 'Not Found' })
    }

    return new Response(`# docs for ${url}\n`, {
      headers: { 'content-type': 'text/markdown' }
    })
  }

  await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--elevenlabs',
    'general'
  ], { outputPath, fetchImpl })

  const output = await Bun.file(outputPath).text()
  expect(attempts.get(LINKS_RETRY_TEST_URL)).toBe(1)
  expect(output).toContain(`<!-- Failed to fetch ${LINKS_RETRY_TEST_URL} -->`)
  expect(output).not.toContain(`<!-- Source: ${LINKS_RETRY_TEST_URL} -->`)
})

test('links strips blob prefix when fetching scrapecreators documentation', async () => {
  const outputPath = linksTestOutputPath('scrapecreators-blob')
  const fetchedUrls: string[] = []

  const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input)
    fetchedUrls.push(url)

    return new Response(`# docs for ${url}\n`, {
      headers: { 'content-type': 'text/markdown' }
    })
  }

  const result = await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--scrapecreators',
    'stt'
  ], { outputPath, fetchImpl })

  const output = await Bun.file(outputPath).text()
  expect(result.urlCount).toBe(1)
  expect(fetchedUrls).toEqual([SCRAPECREATORS_FETCH_STT_LINK])
  expect(output).toContain(`<!-- Source: ${SCRAPECREATORS_STT_LINK} -->`)
  expect(output).toContain(`# docs for ${SCRAPECREATORS_FETCH_STT_LINK}`)
  expect(output).not.toContain(`<!-- Source: ${SCRAPECREATORS_FETCH_STT_LINK} -->`)
})

test('links captures defuddle CLI diagnostics for scrapecreators html', async () => {
  const outputPath = linksTestOutputPath('scrapecreators-defuddle-diagnostic')
  const words = Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ')
  const html = `<!doctype html><html><body><div class="hidden bad[">${words}</div></body></html>`
  const consoleErrors: string[] = []
  const originalConsoleError = console.error
  const previousDefuddleBin = process.env['AUTOSHOW_DEFUDDLE_BIN']
  const previousDefuddleStderr = process.env['AUTOSHOW_FAKE_DEFUDDLE_STDERR']
  const fakeDefuddle = await writeLinksFakeDefuddleBin()
  console.error = (...args: Parameters<typeof console.error>): void => {
    consoleErrors.push(args.map(String).join(' '))
  }
  process.env['AUTOSHOW_DEFUDDLE_BIN'] = fakeDefuddle.bin
  process.env['AUTOSHOW_FAKE_DEFUDDLE_STDERR'] = 'Defuddle Error processing document: captured by wrapper'

  try {
    await runLinksWithArgv([
      'bun',
      'src/cli/create-cli.ts',
      'links',
      '--scrapecreators',
      'stt'
    ], {
      outputPath,
      fetchImpl: async (): Promise<Response> => new Response(html, {
        headers: { 'content-type': 'text/html' }
      })
    })
  } finally {
    console.error = originalConsoleError
    if (previousDefuddleBin === undefined) {
      delete process.env['AUTOSHOW_DEFUDDLE_BIN']
    } else {
      process.env['AUTOSHOW_DEFUDDLE_BIN'] = previousDefuddleBin
    }
    if (previousDefuddleStderr === undefined) {
      delete process.env['AUTOSHOW_FAKE_DEFUDDLE_STDERR']
    } else {
      process.env['AUTOSHOW_FAKE_DEFUDDLE_STDERR'] = previousDefuddleStderr
    }
    await rm(fakeDefuddle.dir, { recursive: true, force: true })
  }

  const output = await Bun.file(outputPath).text()
  expect(output).toContain(`<!-- Source: ${SCRAPECREATORS_STT_LINK} -->`)
  expect(output).toContain('word0 word1 word2')
  expect(consoleErrors.join('\n')).not.toContain('Defuddle Error processing document')
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

test('links selector accepts glm provider with separate ocr and url sections', () => {
  const glmOcrSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--glm',
    'ocr'
  ])

  expect(collectLinks(
    glmOcrSelection.serviceSelections,
    glmOcrSelection.globalSections
  )).toEqual(GLM_OCR_LINKS)

  const glmUrlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--glm',
    'url'
  ])

  expect(collectLinks(
    glmUrlSelection.serviceSelections,
    glmUrlSelection.globalSections
  )).toEqual(GLM_URL_LINKS)

  const globalUrlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    'url'
  ])

  expect(collectLinks(
    globalUrlSelection.serviceSelections,
    globalUrlSelection.globalSections
  )).toEqual([...GLM_URL_LINKS, ...X_URL_LINKS, ...SCRAPECREATORS_URL_LINKS, ...ZYTE_URL_LINKS, ...FIRECRAWL_URL_LINKS, ...SPIDER_URL_LINKS])
})

test('links selector accepts x provider with general and url sections', () => {
  const xSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--x'
  ])

  expect(xSelection.serviceSelections.get('x')).toEqual([])
  expect(collectLinks(
    xSelection.serviceSelections,
    xSelection.globalSections
  )).toEqual([...X_GENERAL_LINKS, ...X_URL_LINKS])

  const xGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--x',
    'general'
  ])

  expect(collectLinks(
    xGeneralSelection.serviceSelections,
    xGeneralSelection.globalSections
  )).toEqual(X_GENERAL_LINKS)

  const xUrlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--x',
    'url'
  ])

  expect(collectLinks(
    xUrlSelection.serviceSelections,
    xUrlSelection.globalSections
  )).toEqual(X_URL_LINKS)
})

test('links selector accepts scrapecreators provider with general stt and url sections', async () => {
  const scrapecreatorsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--scrapecreators'
  ])

  expect(scrapecreatorsSelection.serviceSelections.get('scrapecreators')).toEqual([])
  expect(collectLinks(
    scrapecreatorsSelection.serviceSelections,
    scrapecreatorsSelection.globalSections
  )).toEqual([...SCRAPECREATORS_GENERAL_LINKS, ...SCRAPECREATORS_STT_LINKS, ...SCRAPECREATORS_URL_LINKS])

  const scrapecreatorsGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--scrapecreators',
    'general'
  ])

  expect(collectLinks(
    scrapecreatorsGeneralSelection.serviceSelections,
    scrapecreatorsGeneralSelection.globalSections
  )).toEqual(SCRAPECREATORS_GENERAL_LINKS)

  const scrapecreatorsSttSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--scrapecreators',
    'stt'
  ])

  expect(collectLinks(
    scrapecreatorsSttSelection.serviceSelections,
    scrapecreatorsSttSelection.globalSections
  )).toEqual(SCRAPECREATORS_STT_LINKS)

  const scrapecreatorsUrlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--scrapecreators',
    'url'
  ])

  expect(collectLinks(
    scrapecreatorsUrlSelection.serviceSelections,
    scrapecreatorsUrlSelection.globalSections
  )).toEqual(SCRAPECREATORS_URL_LINKS)

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--scrapecreators',
    'tts'
  ])).rejects.toThrow('Unknown links section(s) for --scrapecreators: tts')
})

test('links selector accepts zyte provider with general and url sections', async () => {
  const zyteSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--zyte'
  ])

  expect(zyteSelection.serviceSelections.get('zyte')).toEqual([])
  expect(collectLinks(
    zyteSelection.serviceSelections,
    zyteSelection.globalSections
  )).toEqual([...ZYTE_GENERAL_LINKS, ...ZYTE_URL_LINKS])

  const zyteGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--zyte',
    'general'
  ])

  expect(collectLinks(
    zyteGeneralSelection.serviceSelections,
    zyteGeneralSelection.globalSections
  )).toEqual(ZYTE_GENERAL_LINKS)

  const zyteUrlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--zyte',
    'url'
  ])

  expect(collectLinks(
    zyteUrlSelection.serviceSelections,
    zyteUrlSelection.globalSections
  )).toEqual(ZYTE_URL_LINKS)

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--zyte',
    'tts'
  ])).rejects.toThrow('Unknown links section(s) for --zyte: tts')
})

test('links selector accepts firecrawl provider with general and url sections', async () => {
  const firecrawlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--firecrawl'
  ])

  expect(firecrawlSelection.serviceSelections.get('firecrawl')).toEqual([])
  expect(collectLinks(
    firecrawlSelection.serviceSelections,
    firecrawlSelection.globalSections
  )).toEqual([...FIRECRAWL_GENERAL_LINKS, ...FIRECRAWL_URL_LINKS])

  const firecrawlGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--firecrawl',
    'general'
  ])

  expect(collectLinks(
    firecrawlGeneralSelection.serviceSelections,
    firecrawlGeneralSelection.globalSections
  )).toEqual(FIRECRAWL_GENERAL_LINKS)

  const firecrawlUrlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--firecrawl',
    'url'
  ])

  expect(collectLinks(
    firecrawlUrlSelection.serviceSelections,
    firecrawlUrlSelection.globalSections
  )).toEqual(FIRECRAWL_URL_LINKS)

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--firecrawl',
    'tts'
  ])).rejects.toThrow('Unknown links section(s) for --firecrawl: tts')
})

test('links selector accepts spider provider with general and url sections', async () => {
  const spiderSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--spider'
  ])

  expect(spiderSelection.serviceSelections.get('spider')).toEqual([])
  expect(collectLinks(
    spiderSelection.serviceSelections,
    spiderSelection.globalSections
  )).toEqual([...SPIDER_GENERAL_LINKS, ...SPIDER_URL_LINKS])

  const spiderGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--spider',
    'general'
  ])

  expect(collectLinks(
    spiderGeneralSelection.serviceSelections,
    spiderGeneralSelection.globalSections
  )).toEqual(SPIDER_GENERAL_LINKS)

  const spiderUrlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--spider',
    'url'
  ])

  expect(collectLinks(
    spiderUrlSelection.serviceSelections,
    spiderUrlSelection.globalSections
  )).toEqual(SPIDER_URL_LINKS)

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--spider',
    'tts'
  ])).rejects.toThrow('Unknown links section(s) for --spider: tts')
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
