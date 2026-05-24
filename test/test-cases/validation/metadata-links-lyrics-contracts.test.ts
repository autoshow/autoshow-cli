import { expect, test } from 'bun:test'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  collectLinks,
  getDefaultLinksOutputFileName,
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

const BETTER_AUTH_GENERAL_LINKS = [
  'https://www.better-auth.com/llms.txt',
  'https://www.better-auth.com/llms.txt/docs/introduction.md',
  'https://www.better-auth.com/llms.txt/docs/installation.md',
  'https://www.better-auth.com/llms.txt/docs/basic-usage.md',
  'https://www.better-auth.com/llms.txt/docs/concepts/api.md',
  'https://www.better-auth.com/llms.txt/docs/concepts/client.md',
  'https://www.better-auth.com/llms.txt/docs/concepts/database.md',
  'https://www.better-auth.com/llms.txt/docs/concepts/session-management.md',
  'https://www.better-auth.com/llms.txt/docs/concepts/users-accounts.md',
  'https://www.better-auth.com/llms.txt/docs/concepts/email.md',
  'https://www.better-auth.com/llms.txt/docs/concepts/cookies.md',
  'https://www.better-auth.com/llms.txt/docs/concepts/rate-limit.md',
  'https://www.better-auth.com/llms.txt/docs/concepts/typescript.md',
  'https://www.better-auth.com/llms.txt/docs/concepts/cli.md',
  'https://www.better-auth.com/llms.txt/docs/reference/options.md',
  'https://www.better-auth.com/llms.txt/docs/reference/security.md',
  'https://www.better-auth.com/llms.txt/docs/reference/errors.md',
  'https://www.better-auth.com/llms.txt/docs/reference/faq.md'
]

const BETTER_AUTH_ALL_LINKS = [
  ...BETTER_AUTH_GENERAL_LINKS
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
  'https://docs.x.ai/developers/rest-api-reference/inference/voice.md',
  'https://docs.x.ai/developers/model-capabilities/audio/voice.md',
  'https://docs.x.ai/developers/model-capabilities/audio/custom-voices.md'
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

const SUPADATA_GENERAL_LINKS = [
  'https://docs.supadata.ai/.md',
  'https://docs.supadata.ai/api-reference/endpoint/account/me.md',
  'https://docs.supadata.ai/errors/list.md',
  'https://docs.supadata.ai/errors/invalid-request.md',
  'https://docs.supadata.ai/errors/unauthorized.md',
  'https://docs.supadata.ai/errors/not-found.md',
  'https://docs.supadata.ai/errors/limit-exceeded.md',
  'https://docs.supadata.ai/errors/upgrade-required.md',
  'https://docs.supadata.ai/errors/transcript-unavailable.md',
  'https://docs.supadata.ai/errors/internal-error.md'
]

const SUPADATA_STT_LINKS = [
  'https://docs.supadata.ai/get-transcript.md',
  'https://docs.supadata.ai/get-metadata.md',
  'https://docs.supadata.ai/get-extract.md',
  'https://docs.supadata.ai/youtube/search.md',
  'https://docs.supadata.ai/youtube/get-transcript-translation.md',
  'https://docs.supadata.ai/youtube/channel.md',
  'https://docs.supadata.ai/youtube/playlist.md',
  'https://docs.supadata.ai/youtube/channel-videos.md',
  'https://docs.supadata.ai/youtube/playlist-videos.md',
  'https://docs.supadata.ai/youtube/batch.md',
  'https://docs.supadata.ai/youtube/supported-url-formats.md',
  'https://docs.supadata.ai/youtube/supported-language-codes.md',
  'https://docs.supadata.ai/api-reference/introduction.md',
  'https://docs.supadata.ai/api-reference/endpoint/metadata/metadata.md',
  'https://docs.supadata.ai/api-reference/endpoint/extract/extract.md',
  'https://docs.supadata.ai/api-reference/endpoint/extract/extract-get.md',
  'https://docs.supadata.ai/api-reference/endpoint/youtube/search.md',
  'https://docs.supadata.ai/api-reference/endpoint/youtube/video-get.md',
  'https://docs.supadata.ai/api-reference/endpoint/youtube/video-batch.md',
  'https://docs.supadata.ai/api-reference/endpoint/transcript/transcript.md',
  'https://docs.supadata.ai/api-reference/endpoint/transcript/transcript-get.md',
  'https://docs.supadata.ai/api-reference/endpoint/youtube/transcript.md',
  'https://docs.supadata.ai/api-reference/endpoint/youtube/transcript-batch.md',
  'https://docs.supadata.ai/api-reference/endpoint/youtube/translation.md',
  'https://docs.supadata.ai/api-reference/endpoint/youtube/channel.md',
  'https://docs.supadata.ai/api-reference/endpoint/youtube/playlist.md',
  'https://docs.supadata.ai/api-reference/endpoint/youtube/channel-videos.md',
  'https://docs.supadata.ai/api-reference/endpoint/youtube/playlist-videos.md',
  'https://docs.supadata.ai/api-reference/endpoint/youtube/batch-get.md'
]

const SUPADATA_URL_LINKS = [
  'https://docs.supadata.ai/web/scrape.md',
  'https://docs.supadata.ai/web/map.md',
  'https://docs.supadata.ai/web/crawl.md',
  'https://docs.supadata.ai/api-reference/endpoint/web/scrape.md',
  'https://docs.supadata.ai/api-reference/endpoint/web/map.md',
  'https://docs.supadata.ai/api-reference/endpoint/web/crawl.md',
  'https://docs.supadata.ai/api-reference/endpoint/web/crawl-get.md'
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

const UNSTRUCTURED_OCR_LINKS = [
  'https://docs.unstructured.io/api-reference/supported-file-types.md',
  'https://docs.unstructured.io/api-reference/quickstart.md',
  'https://docs.unstructured.io/api-reference/workflow/overview.md',
  'https://docs.unstructured.io/api-reference/workflow/workflows.md',
  'https://docs.unstructured.io/api-reference/workflow/jobs.md',
  'https://docs.unstructured.io/api-reference/workflow/models.md',
  'https://docs.unstructured.io/concepts/overview.md',
  'https://docs.unstructured.io/concepts/document-elements.md',
  'https://docs.unstructured.io/api-reference/api/job/job-apis.md',
  'https://docs.unstructured.io/concepts/structured-data-extractor/data-extractor.md',
  'https://docs.unstructured.io/concepts/structured-data-extractor/llm-options.md',
  'https://docs.unstructured.io/concepts/chunking.md',
  'https://docs.unstructured.io/api-reference/api/job/list-jobs.md',
  'https://docs.unstructured.io/api-reference/api/job/get-job.md',
  'https://docs.unstructured.io/api-reference/api/job/create-job.md',
  'https://docs.unstructured.io/api-reference/api/job/download-job-output.md',
  'https://docs.unstructured.io/api-reference/api/job/get-job-failed-files.md',
  'https://docs.unstructured.io/api-reference/api/job/get-job-details.md',
  'https://docs.unstructured.io/api-reference/api/workflow/workflow-apis.md',
  'https://docs.unstructured.io/api-reference/api/workflow/get-workflow.md',
  'https://docs.unstructured.io/api-reference/api/workflow/create-workflow.md',
  'https://docs.unstructured.io/api-reference/api/workflow/run-workflow.md'
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

const CARTESIA_GENERAL_LINKS = [
  'https://docs.cartesia.ai/get-started/overview.md',
  'https://docs.cartesia.ai/get-started/authenticate-your-client-applications.md',
  'https://docs.cartesia.ai/tools/client-libraries.md',
  'https://docs.cartesia.ai/use-the-api/api-conventions.md',
  'https://docs.cartesia.ai/use-the-api/api-errors.md',
  'https://docs.cartesia.ai/use-the-api/concurrency-limits-and-timeouts.md'
]

const CARTESIA_TTS_LINKS = [
  'https://docs.cartesia.ai/get-started/realtime-text-to-speech-quickstart.md',
  'https://docs.cartesia.ai/api-reference/tts/bytes.md',
  'https://docs.cartesia.ai/api-reference/tts/sse.md',
  'https://docs.cartesia.ai/api-reference/tts/websocket.md',
  'https://docs.cartesia.ai/use-the-api/compare-tts-endpoints.md',
  'https://docs.cartesia.ai/build-with-cartesia/tts-models/sonic-3-5.md',
  'https://docs.cartesia.ai/build-with-cartesia/tts-models/voice-ids.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/choosing-a-voice.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/choosing-tts-parameters.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/clone-voices.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/clone-voices-pro/api.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/custom-pronunciations.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/localize-voices.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/prompting-tips.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/ssml-tags.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/stream-inputs-using-continuations.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/volume-speed-emotion.md',
  'https://docs.cartesia.ai/use-the-api/tts-websocket/buffering.md',
  'https://docs.cartesia.ai/use-the-api/tts-websocket/context-flushing-and-flush-i-ds.md',
  'https://docs.cartesia.ai/use-the-api/tts-websocket/contexts.md',
  'https://docs.cartesia.ai/api-reference/voices/list.md',
  'https://docs.cartesia.ai/api-reference/voices/clone.md',
  'https://docs.cartesia.ai/api-reference/voices/localize.md',
  'https://docs.cartesia.ai/api-reference/voices/get.md',
  'https://docs.cartesia.ai/api-reference/voices/update.md',
  'https://docs.cartesia.ai/api-reference/voices/delete.md'
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

const HUME_GENERAL_LINKS = [
  'https://dev.hume.ai/intro.md',
  'https://dev.hume.ai/docs/introduction/api-key.md',
  'https://dev.hume.ai/docs/resources/use-case-guidelines.md',
  'https://dev.hume.ai/docs/resources/billing.md',
  'https://dev.hume.ai/docs/resources/errors.md',
  'https://dev.hume.ai/docs/resources/privacy.md'
]

const HUME_TTS_LINKS = [
  'https://dev.hume.ai/docs/text-to-speech-tts/overview.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/quickstart/typescript.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/quickstart/python.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/quickstart/dotnet.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/quickstart/cli.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/voice.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/acting-instructions.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/voice-conversion.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/continuation.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/timestamps.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/faq.md',
  'https://dev.hume.ai/docs/voice/overview.md',
  'https://dev.hume.ai/docs/voice/voice-design.md',
  'https://dev.hume.ai/docs/voice/voice-cloning.md',
  'https://dev.hume.ai/docs/voice/management.md',
  'https://dev.hume.ai/reference/voices/create.md',
  'https://dev.hume.ai/reference/voices/list.md',
  'https://dev.hume.ai/reference/voices/delete.md',
  'https://dev.hume.ai/reference/text-to-speech-tts/stream-input.md',
  'https://dev.hume.ai/reference/text-to-speech-tts/synthesize-json-streaming.md',
  'https://dev.hume.ai/reference/text-to-speech-tts/synthesize-file-streaming.md',
  'https://dev.hume.ai/reference/text-to-speech-tts/synthesize-json.md',
  'https://dev.hume.ai/reference/text-to-speech-tts/synthesize-file.md',
  'https://dev.hume.ai/reference/text-to-speech-tts/convert-voice-file.md',
  'https://dev.hume.ai/reference/text-to-speech-tts/convert-voice-json.md'
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

test('links selector accepts better-auth provider with general section', async () => {
  const betterAuthSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--better-auth'
  ])

  expect(betterAuthSelection.serviceSelections.get('better-auth')).toEqual([])
  expect(collectLinks(
    betterAuthSelection.serviceSelections,
    betterAuthSelection.globalSections
  )).toEqual(BETTER_AUTH_ALL_LINKS)
  expect(getDefaultLinksOutputFileName(
    betterAuthSelection.serviceSelections,
    betterAuthSelection.globalSections
  )).toBe('better-auth-all-links.md')

  const betterAuthGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--better-auth',
    'general'
  ])

  expect(collectLinks(
    betterAuthGeneralSelection.serviceSelections,
    betterAuthGeneralSelection.globalSections
  )).toEqual(BETTER_AUTH_GENERAL_LINKS)
  expect(getDefaultLinksOutputFileName(
    betterAuthGeneralSelection.serviceSelections,
    betterAuthGeneralSelection.globalSections
  )).toBe('better-auth-general-links.md')

  const globalGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    'general'
  ])

  expect(collectLinks(
    globalGeneralSelection.serviceSelections,
    globalGeneralSelection.globalSections
  )).toEqual(expect.arrayContaining(BETTER_AUTH_GENERAL_LINKS))
  expect(collectLinks(new Map(), [])).toEqual(expect.arrayContaining(BETTER_AUTH_GENERAL_LINKS))

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--better-auth',
    'tts'
  ])).rejects.toThrow('Unknown links section(s) for --better-auth: tts')
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

test('links selector accepts cartesia provider with general and tts sections', async () => {
  const cartesiaSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--cartesia'
  ])

  expect(cartesiaSelection.serviceSelections.get('cartesia')).toEqual([])
  expect(collectLinks(
    cartesiaSelection.serviceSelections,
    cartesiaSelection.globalSections
  )).toEqual([...CARTESIA_GENERAL_LINKS, ...CARTESIA_TTS_LINKS])
  expect(getDefaultLinksOutputFileName(
    cartesiaSelection.serviceSelections,
    cartesiaSelection.globalSections
  )).toBe('cartesia-all-links.md')

  const cartesiaTtsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--cartesia',
    'tts'
  ])

  expect(collectLinks(
    cartesiaTtsSelection.serviceSelections,
    cartesiaTtsSelection.globalSections
  )).toEqual(CARTESIA_TTS_LINKS)
  expect(getDefaultLinksOutputFileName(
    cartesiaTtsSelection.serviceSelections,
    cartesiaTtsSelection.globalSections
  )).toBe('cartesia-tts-links.md')

  const cartesiaGeneralTtsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--cartesia',
    'general',
    'tts'
  ])

  expect(collectLinks(
    cartesiaGeneralTtsSelection.serviceSelections,
    cartesiaGeneralTtsSelection.globalSections
  )).toEqual([...CARTESIA_GENERAL_LINKS, ...CARTESIA_TTS_LINKS])
  expect(getDefaultLinksOutputFileName(
    cartesiaGeneralTtsSelection.serviceSelections,
    cartesiaGeneralTtsSelection.globalSections
  )).toBe('cartesia-general-tts-links.md')

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--cartesia',
    'stt'
  ])).rejects.toThrow('Unknown links section(s) for --cartesia: stt')
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

test('links selector accepts hume provider with general and tts sections', async () => {
  const humeSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--hume'
  ])

  expect(humeSelection.serviceSelections.get('hume')).toEqual([])
  expect(collectLinks(
    humeSelection.serviceSelections,
    humeSelection.globalSections
  )).toEqual([...HUME_GENERAL_LINKS, ...HUME_TTS_LINKS])
  expect(getDefaultLinksOutputFileName(
    humeSelection.serviceSelections,
    humeSelection.globalSections
  )).toBe('hume-all-links.md')

  const humeTtsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--hume',
    'tts'
  ])

  expect(collectLinks(
    humeTtsSelection.serviceSelections,
    humeTtsSelection.globalSections
  )).toEqual(HUME_TTS_LINKS)
  expect(getDefaultLinksOutputFileName(
    humeTtsSelection.serviceSelections,
    humeTtsSelection.globalSections
  )).toBe('hume-tts-links.md')

  const humeGeneralTtsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--hume',
    'general',
    'tts'
  ])

  expect(collectLinks(
    humeGeneralTtsSelection.serviceSelections,
    humeGeneralTtsSelection.globalSections
  )).toEqual([...HUME_GENERAL_LINKS, ...HUME_TTS_LINKS])
  expect(getDefaultLinksOutputFileName(
    humeGeneralTtsSelection.serviceSelections,
    humeGeneralTtsSelection.globalSections
  )).toBe('hume-general-tts-links.md')

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--hume',
    'stt'
  ])).rejects.toThrow('Unknown links section(s) for --hume: stt')
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
  )).toEqual([
    ...GLM_URL_LINKS,
    ...X_URL_LINKS,
    ...SUPADATA_URL_LINKS,
    ...SCRAPECREATORS_URL_LINKS,
    ...ZYTE_URL_LINKS,
    ...FIRECRAWL_URL_LINKS,
    ...SPIDER_URL_LINKS
  ])
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

test('links selector accepts supadata provider with general stt and url sections', async () => {
  const supadataSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--supadata'
  ])

  expect(supadataSelection.serviceSelections.get('supadata')).toEqual([])
  expect(collectLinks(
    supadataSelection.serviceSelections,
    supadataSelection.globalSections
  )).toEqual([
    ...SUPADATA_GENERAL_LINKS,
    ...SUPADATA_STT_LINKS,
    ...SUPADATA_URL_LINKS
  ])

  const supadataGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--supadata',
    'general'
  ])

  expect(collectLinks(
    supadataGeneralSelection.serviceSelections,
    supadataGeneralSelection.globalSections
  )).toEqual(SUPADATA_GENERAL_LINKS)

  const supadataSttSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--supadata',
    'stt'
  ])

  expect(collectLinks(
    supadataSttSelection.serviceSelections,
    supadataSttSelection.globalSections
  )).toEqual(SUPADATA_STT_LINKS)

  const supadataUrlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--supadata',
    'url'
  ])

  expect(collectLinks(
    supadataUrlSelection.serviceSelections,
    supadataUrlSelection.globalSections
  )).toEqual(SUPADATA_URL_LINKS)

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--supadata',
    'tts'
  ])).rejects.toThrow('Unknown links section(s) for --supadata: tts')
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

test('links selector accepts unstructured provider with only ocr section', async () => {
  const unstructuredSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--unstructured'
  ])

  expect(unstructuredSelection.serviceSelections.get('unstructured')).toEqual([])
  expect(collectLinks(
    unstructuredSelection.serviceSelections,
    unstructuredSelection.globalSections
  )).toEqual(UNSTRUCTURED_OCR_LINKS)
  expect(getDefaultLinksOutputFileName(
    unstructuredSelection.serviceSelections,
    unstructuredSelection.globalSections
  )).toBe('unstructured-all-links.md')

  const unstructuredOcrSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--unstructured',
    'ocr'
  ])

  expect(collectLinks(
    unstructuredOcrSelection.serviceSelections,
    unstructuredOcrSelection.globalSections
  )).toEqual(UNSTRUCTURED_OCR_LINKS)
  expect(getDefaultLinksOutputFileName(
    unstructuredOcrSelection.serviceSelections,
    unstructuredOcrSelection.globalSections
  )).toBe('unstructured-ocr-links.md')

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--unstructured',
    'general'
  ])).rejects.toThrow('Unknown links section(s) for --unstructured: general')
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
    'https://ajc.pics/autoshow/examples/0-audio-short.mp3',
    '--price'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Do not combine hosted music flags')
})
