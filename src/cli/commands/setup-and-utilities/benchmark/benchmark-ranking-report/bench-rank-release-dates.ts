import type { ReleaseDateMap, ReleaseDateMetadata } from './bench-rank-types'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const release = (date: string, sourceUrl: string, note?: string): ReleaseDateMetadata =>
  note === undefined ? { date, sourceUrl } : { date, sourceUrl, note }

const sameRelease = (
  keys: readonly string[],
  metadata: ReleaseDateMetadata
): ReleaseDateMap => Object.fromEntries(keys.map((key) => [key, metadata])) as ReleaseDateMap

export const MODEL_RELEASE_DATES = {
  ...sameRelease(
    ['openai/gpt-5.4', 'openai/gpt-5.4-pro'],
    release('2026-03-05', 'https://openai.com/index/introducing-gpt-5-4/')
  ),
  ...sameRelease(
    ['openai/gpt-5.4-mini', 'openai/gpt-5.4-nano'],
    release('2026-03-17', 'https://openai.com/index/introducing-gpt-5-4-mini-and-nano/')
  ),
  ...sameRelease(
    ['openai-stt/gpt-4o-transcribe', 'openai-stt/gpt-4o-mini-transcribe', 'openai/gpt-4o-mini-tts'],
    release('2025-03-20', 'https://openai.com/index/introducing-our-next-generation-audio-models/')
  ),
  ...sameRelease(
    ['openai/gpt-image-1', 'openai/gpt-image-1-mini'],
    release('2025-04-23', 'https://openai.com/index/image-generation-api/', 'GPT Image 1 API family release date.')
  ),
  'openai/gpt-image-1.5': release('2025-12-16', 'https://openai.com/index/new-chatgpt-images-is-here/'),
  'openai/gpt-image-2': release('2026-04-21', 'https://openai.com/index/introducing-chatgpt-images-2-0/'),
  'groq/openai/gpt-oss-20b': release('2025-08-05', 'https://openai.com/index/introducing-gpt-oss'),

  'anthropic/claude-haiku-4-5': release('2025-10-15', 'https://www.anthropic.com/news/claude-haiku-4-5'),
  'anthropic/claude-opus-4-6': release('2026-02-05', 'https://www.anthropic.com/claude/opus'),
  'anthropic/claude-sonnet-4-6': release('2026-02-17', 'https://www.anthropic.com/news/claude-sonnet-4-6'),
  'anthropic/claude-opus-4-7': release('2026-04-16', 'https://www.anthropic.com/news/claude-opus-4-7'),

  ...sameRelease(
    ['gemini/gemini-3.1-pro-preview', 'gemini/gemini-3-pro-image-preview'],
    release('2026-02-19', 'https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-pro', 'Gemini 3.1 Pro public preview release date; image-preview rows use the matching Gemini 3 Pro/3.1 image-capable family date.')
  ),
  'gemini/gemini-3.1-flash-lite-preview': release('2026-03-03', 'https://ai.google.dev/gemini-api/docs/models/gemini'),
  'gemini/gemini-3.1-flash-tts-preview': release('2026-04-15', 'https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-tts/'),
  ...sameRelease(
    ['gemini/gemini-2.5-flash-preview-tts', 'gemini/gemini-2.5-pro-preview-tts'],
    release('2025-05-20', 'https://ai.google.dev/gemini-api/docs/speech-generation', 'Gemini 2.5 TTS preview model-family release date.')
  ),
  ...sameRelease(
    ['gemini/imagen-4.0-fast-generate-001', 'gemini/imagen-4.0-generate-001', 'gemini/imagen-4.0-ultra-generate-001'],
    release('2025-05-20', 'https://ai.google.dev/gemini-api/docs/imagen')
  ),
  'gemini/lyria-3-clip-preview': release('2026-02-23', 'https://ai.google.dev/gemini-api/docs/music-generation'),
  'gemini/lyria-3-pro-preview': release('2026-03-25', 'https://blog.google/innovation-and-ai/technology/ai/lyria-3-pro'),
  ...sameRelease(
    ['gemini/veo-3.1-generate-preview', 'gemini/veo-3.1-fast-generate-preview'],
    release('2026-01-14', 'https://ai.google.dev/gemini-api/docs/video', 'Veo 3.1 public preview/model-family date; Google model docs list January 2026 as latest update.')
  ),
  'gemini/veo-3.1-lite-generate-preview': release('2026-03-01', 'https://ai.google.dev/gemini-api/docs/models/veo-3.1-lite-generate-preview', 'Google model docs list March 2026 as latest update for Lite; day normalized to first of month.'),
  'gemini-stt/gemini-3-flash-preview': release('2025-12-11', 'https://ai.google.dev/gemini-api/docs/models/gemini', 'Gemini 3 Flash preview model-family release date.'),

  'mistral/mistral-ocr-2512': release('2025-12-18', 'https://docs.mistral.ai/resources/changelogs', 'Mistral OCR 3 / 2512 release date.'),
  'mistral/voxtral-mini-2602': release('2026-02-01', 'https://docs.mistral.ai/capabilities/audio/', 'Model suffix 2602 identifies the February 2026 Voxtral Mini release; day normalized to first of month.'),
  'mistral/voxtral-mini-tts-2603': release('2026-03-01', 'https://docs.mistral.ai/capabilities/audio/', 'Model suffix 2603 identifies the March 2026 Voxtral Mini TTS release; day normalized to first of month.'),

  ...sameRelease(
    ['deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct'],
    release('2025-09-23', 'https://huggingface.co/Qwen/Qwen3-VL-235B-A22B-Instruct')
  ),
  ...sameRelease(
    ['deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct'],
    release('2025-10-04', 'https://huggingface.co/Qwen/Qwen3-VL-30B-A3B-Instruct')
  ),
  'glm/glm-ocr': release('2026-03-11', 'https://arxiv.org/abs/2603.10910'),
  'glm/glm-5.1': release('2026-04-07', 'https://docs.z.ai/release-notes/new-released'),
  'glm-stt/glm-asr-2512': release('2025-12-01', 'https://docs.z.ai/', 'Model suffix 2512 identifies the December 2025 GLM ASR release; day normalized to first of month.'),
  'glm-reader/glm-reader': release('2025-11-04', 'https://docs.z.ai/', 'Public GLM Reader service/API date used for the non-model service row.'),
  'kimi/kimi-k2.6': release('2026-04-21', 'https://platform.moonshot.ai/docs/guide/use-kimi-k2.6'),

  ...sameRelease(
    ['minimax/MiniMax-M2.5', 'minimax/MiniMax-M2.5-highspeed'],
    release('2026-02-12', 'https://www.minimax.io/news/minimax-m25')
  ),
  'minimax/image-01': release('2025-02-28', 'https://www.minimax.io/news/image-01'),
  'minimax/MiniMax-Hailuo-02': release('2025-06-18', 'https://www.minimax.io/news/minimax-hailuo-02'),
  'minimax/MiniMax-Hailuo-2.3': release('2025-10-28', 'https://www.minimax.io/news/minimax-hailuo-23'),
  ...sameRelease(
    ['minimax/T2V-01', 'minimax/T2V-01-Director'],
    release('2024-09-02', 'https://www.minimax.io/news/video-01', 'MiniMax Video-01 public release date used for T2V-01 service variants.')
  ),
  'minimax/music-2.5': release('2026-02-18', 'https://www.minimax.io/news/minimax-music-25'),
  ...sameRelease(
    ['minimax/speech-2.8-hd', 'minimax/speech-2.8-turbo'],
    release('2026-01-20', 'https://platform.minimax.io/docs/guides/text-to-speech', 'MiniMax Speech 2.8 model-family API release date.')
  ),

  'assemblyai/universal-3-pro': release('2026-02-03', 'https://www.assemblyai.com/blog/introducing-universal-3-pro'),
  'deepgram/nova-3': release('2025-02-12', 'https://deepgram.com/changelog/introducing-nova-3'),
  'deepgram/aura-2-thalia-en': release('2025-04-15', 'https://www.businesswire.com/news/home/20250415446781/en/Deepgram-Unveils-Aura-2-The-Worlds-Most-Professional-Cost-Effective-and-Enterprise-Grade-Text-to-Speech-Model'),
  'elevenlabs/scribe_v2': release('2026-01-09', 'https://elevenlabs.io/blog/introducing-scribe-v2/'),
  ...sameRelease(
    ['elevenlabs/eleven_flash_v2_5', 'elevenlabs/eleven_turbo_v2_5'],
    release('2024-07-19', 'https://elevenlabs.io/blog/introducing-turbo-v25', 'ElevenLabs v2.5 low-latency TTS family release date.')
  ),
  'elevenlabs/eleven_v3': release('2026-02-02', 'https://elevenlabs.io/blog', 'Eleven v3 GA date from ElevenLabs blog index.'),
  'elevenlabs/music_v1': release('2026-04-29', 'https://elevenlabs.io/blog', 'ElevenMusic public launch date from ElevenLabs blog index.'),
  'groq/canopylabs/orpheus-v1-english': release('2025-03-12', 'https://huggingface.co/canopylabs/orpheus-3b-0.1-ft'),
  ...sameRelease(
    ['grok/grok-tts', 'grok/speech-to-text'],
    release('2026-03-16', 'https://docs.x.ai/docs/guides/audio', 'xAI Grok audio API launch date used for TTS and STT rows.')
  ),
  'grok/grok-imagine-image': release('2025-07-28', 'https://docs.x.ai/docs/models/grok-imagine-image'),

  ...sameRelease(
    ['deepinfra/openai/whisper-large-v3', 'groq/whisper-large-v3', 'together/openai/whisper-large-v3', 'deapi/WhisperLargeV3'],
    release('2023-11-06', 'https://github.com/openai/whisper', 'OpenAI Whisper large-v3 upstream model release date used for hosted provider variants.')
  ),
  ...sameRelease(
    ['deepinfra/openai/whisper-large-v3-turbo', 'groq/whisper-large-v3-turbo'],
    release('2024-10-09', 'https://groq.com/whisper-large-v3-turbo-now-available-on-groq-combining-speed-quality-for-speech-recognition')
  ),

  'aws/standard': release('2018-04-04', 'https://aws.amazon.com/blogs/aws/amazon-transcribe-now-generally-available/', 'Amazon Transcribe GA date used for standard service row.'),
  'aws-textract/detect-text': release('2019-05-29', 'https://aws.amazon.com/blogs/aws/amazon-textract-now-generally-available/', 'Amazon Textract GA date used for detect-text service row.'),
  'gcloud-docai/ocr': release('2020-11-18', 'https://cloud.google.com/blog/products/ai-machine-learning/google-cloud-announces-document-ai-platform', 'Google Document AI Platform public release date used for OCR processor row.'),
  'gcloud/chirp_3': release('2025-03-17', 'https://cloud.google.com/speech-to-text/docs/models/chirp-3'),
  'gcloud/chirp3-hd': release('2025-03-17', 'https://cloud.google.com/text-to-speech/docs/chirp3-hd'),
  'gcloud/studio': release('2024-02-26', 'https://cloud.google.com/text-to-speech/docs/release-notes', 'Google Cloud Studio voices GA date.'),
  'gladia/default': release('2023-04-25', 'https://docs.gladia.io/', 'Gladia API public launch date used for default service row.'),
  'happyscribe/auto': release('2020-05-01', 'https://www.happyscribe.com/api', 'Happy Scribe API public service date used for auto service row.'),
  'rev/machine': release('2018-02-28', 'https://www.rev.com/api', 'Rev AI API public service date used for machine transcription row.'),
  'rev/low_cost': release('2018-02-28', 'https://www.rev.com/api', 'Rev AI API public service date used for low-cost transcription row.'),
  'soniox/stt-async-v4': release('2025-11-15', 'https://soniox.com/docs/', 'Soniox asynchronous STT v4 public API date.'),
  'speechmatics/standard': release('2020-09-15', 'https://docs.speechmatics.com/', 'Speechmatics SaaS/API public service date used for standard tier row.'),
  'speechmatics/enhanced': release('2020-09-15', 'https://docs.speechmatics.com/', 'Speechmatics SaaS/API public service date used for enhanced tier row.'),
  'supadata/auto': release('2024-11-01', 'https://supadata.ai/', 'Supadata API public service date used for auto service row.'),
  'supadata/generate': release('2024-11-01', 'https://supadata.ai/', 'Supadata API public service date used for generate service row.'),
  'supadata/native': release('2024-11-01', 'https://supadata.ai/', 'Supadata API public service date used for native service row.'),

  'firecrawl/firecrawl': release('2024-04-17', 'https://www.firecrawl.dev/', 'Firecrawl public API/service release date used for URL extraction service row.'),
  'spider/spider': release('2024-09-10', 'https://spider.cloud/', 'Spider API public service date used for URL extraction service row.'),
  'zyte/zyte': release('2021-10-05', 'https://www.zyte.com/zyte-api/', 'Zyte API public release date used for URL extraction service row.'),
  'unstructured/hi_res_and_enrichment': release('2023-07-01', 'https://docs.unstructured.io/api-reference/workflow/models', 'Unstructured hi-res/enrichment workflow public API date used for service row.'),

  'bfl/flux-2-pro-preview': release('2025-11-25', 'https://docs.bfl.ml/release-notes'),
  'deapi/Flux1schnell': release('2024-08-01', 'https://bfl.ai/announcing-black-forest-labs', 'FLUX.1 schnell upstream model release date used for deAPI-hosted row.'),
  'deapi/Flux_2_Klein_4B_BF16': release('2025-11-25', 'https://docs.bfl.ml/release-notes', 'FLUX.2 Klein upstream model release date used for deAPI-hosted row.'),
  'deapi/ZImageTurbo_INT8': release('2025-12-01', 'https://huggingface.co/collections/Z-Image/z-image-69278f79d4e04b4f51374444', 'Z-Image-Turbo upstream model release month normalized to first of month.'),
  'deapi/Chatterbox': release('2025-06-17', 'https://github.com/resemble-ai/chatterbox', 'Chatterbox upstream TTS model release date used for deAPI-hosted row.'),
  'deapi/Kokoro': release('2024-12-14', 'https://huggingface.co/hexgrad/Kokoro-82M', 'Kokoro upstream TTS model release date used for deAPI-hosted row.'),
  ...sameRelease(
    ['deapi/Qwen3_TTS_12Hz_1_7B_Base', 'deapi/Qwen3_TTS_12Hz_1_7B_CustomVoice'],
    release('2025-06-05', 'https://huggingface.co/Qwen', 'Qwen3 TTS upstream model-family release date used for deAPI-hosted rows.')
  ),
  'deapi/Ltxv_13B_0_9_8_Distilled_FP8': release('2025-07-15', 'https://github.com/Lightricks/LTX-Video', 'LTX Video 13B 0.9.8 distilled upstream model release date used for deAPI-hosted row.'),

  'runway/gen4_image': release('2025-05-16', 'https://runwayml.com/news/introducing-runway-api-for-gen-4-images'),
  'runway/eleven_multilingual_v2': release('2023-08-22', 'https://elevenlabs.io/docs/models/', 'Eleven Multilingual v2 model release date used for Runway-hosted TTS row.')
} satisfies ReleaseDateMap

export const assertValidReleaseDate = (key: string, metadata: ReleaseDateMetadata | undefined): ReleaseDateMetadata => {
  if (!metadata) {
    throw new Error(`Missing benchmark release-date metadata for provider/model: ${key}`)
  }
  if (!ISO_DATE_PATTERN.test(metadata.date)) {
    throw new Error(`Invalid benchmark release date for provider/model ${key}: ${metadata.date}`)
  }
  if (metadata.sourceUrl.length === 0) {
    throw new Error(`Missing benchmark release-date source URL for provider/model: ${key}`)
  }
  return metadata
}
