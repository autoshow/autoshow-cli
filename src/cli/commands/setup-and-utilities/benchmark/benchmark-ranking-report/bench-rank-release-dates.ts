import type { ReleaseDateMap, ReleaseDateMetadata } from './bench-rank-types'
import { SUPPORTED_DEEPGRAM_TTS_MODELS } from '../../models/tts-models'

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
  'openai/gpt-5.5': release('2026-04-24', 'https://openai.com/index/introducing-gpt-5-5/', 'GPT-5.5 API availability date used for benchmark API row.'),
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
  'anthropic/claude-sonnet-4-6': release('2026-02-17', 'https://www.anthropic.com/news/claude-sonnet-4-6'),
  'anthropic/claude-opus-4-7': release('2026-04-16', 'https://www.anthropic.com/news/claude-opus-4-7'),

  ...sameRelease(
    ['gemini/gemini-3.1-pro-preview', 'gemini/gemini-3-pro-image-preview'],
    release('2026-02-19', 'https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-pro', 'Gemini 3.1 Pro public preview release date; image-preview rows use the matching Gemini 3 Pro/3.1 image-capable family date.')
  ),
  ...sameRelease(
    ['gemini/gemini-3.1-flash-lite', 'gemini/gemini-3.1-flash-lite-preview'],
    release('2026-03-03', 'https://ai.google.dev/gemini-api/docs/models/gemini')
  ),
  'gemini/gemini-3.1-flash-tts-preview': release('2026-04-15', 'https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-tts/'),
  ...sameRelease(
    ['gemini/gemini-2.5-flash-preview-tts', 'gemini/gemini-2.5-pro-preview-tts'],
    release('2025-05-20', 'https://ai.google.dev/gemini-api/docs/speech-generation', 'Gemini 2.5 TTS preview model-family release date.')
  ),
  'gemini/lyria-3-clip-preview': release('2026-02-23', 'https://ai.google.dev/gemini-api/docs/music-generation'),
  'gemini/lyria-3-pro-preview': release('2026-03-25', 'https://blog.google/innovation-and-ai/technology/ai/lyria-3-pro'),
  ...sameRelease(
    ['gemini/veo-3.1-generate-preview', 'gemini/veo-3.1-fast-generate-preview'],
    release('2025-10-15', 'https://developers.googleblog.com/en/introducing-veo-3-1-and-new-creative-capabilities-in-the-gemini-api/', 'Veo 3.1 public preview availability in the Gemini API.')
  ),
  'gemini/veo-3.1-lite-generate-preview': release('2026-03-31', 'https://blog.google/innovation-and-ai/technology/ai/veo-3-1-lite/', 'Veo 3.1 Lite paid-tier Gemini API rollout date.'),
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
    ['minimax/MiniMax-M2.7', 'minimax/MiniMax-M2.7-highspeed'],
    release('2026-03-18', 'https://www.minimax.io/news/minimax-m27-en')
  ),
  ...sameRelease(
    ['minimax/MiniMax-Hailuo-2.3', 'minimax/MiniMax-Hailuo-2.3-Fast'],
    release('2025-10-28', 'https://www.minimax.io/news/minimax-hailuo-23')
  ),
  ...sameRelease(
    ['minimax/T2V-01'],
    release('2024-08-31', 'https://www.minimax.io/news/video-01', 'MiniMax Video-01 public release date used for the T2V-01 service row.')
  ),
  ...sameRelease(
    ['minimax/T2V-01-Director'],
    release('2025-03-03', 'https://www.minimax.io/news/01-director', 'MiniMax Director model launch date used for the T2V-01-Director service row.')
  ),
  ...sameRelease(
    ['minimax/music-2.6', 'minimax/music-2.6-free'],
    release('2026-04-10', 'https://www.minimax.io/news/music-26')
  ),
  ...sameRelease(
    ['minimax/speech-2.8-hd', 'minimax/speech-2.8-turbo'],
    release('2026-01-20', 'https://platform.minimax.io/docs/guides/text-to-speech', 'MiniMax Speech 2.8 model-family API release date.')
  ),

  'assemblyai/universal-3-pro': release('2026-02-03', 'https://www.assemblyai.com/blog/introducing-universal-3-pro'),
  'deepgram/nova-3': release('2025-02-12', 'https://deepgram.com/changelog/introducing-nova-3'),
  ...sameRelease(
    SUPPORTED_DEEPGRAM_TTS_MODELS.map((model) => `deepgram/${model}`),
    release('2025-04-15', 'https://www.businesswire.com/news/home/20250415446781/en/Deepgram-Unveils-Aura-2-The-Worlds-Most-Professional-Cost-Effective-and-Enterprise-Grade-Text-to-Speech-Model', 'Deepgram Aura 2 public model-family launch date used for individual Aura 2 voice rows.')
  ),
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
  'grok/grok-imagine-image-quality': release('2025-07-28', 'https://docs.x.ai/docs/models/grok-imagine-image', 'xAI Grok Imagine image model-family release date used for the quality variant.'),
  'grok/grok-imagine-video': release('2026-01-28', 'https://x.ai/news/grok-imagine-api', 'Grok Imagine API launch date used for the video row.'),

  ...sameRelease(
    ['deepinfra/openai/whisper-large-v3', 'groq/whisper-large-v3', 'together/openai/whisper-large-v3'],
    release('2023-11-06', 'https://github.com/openai/whisper', 'OpenAI Whisper large-v3 upstream model release date used for hosted provider variants.')
  ),
  ...sameRelease(
    ['deepinfra/openai/whisper-large-v3-turbo', 'groq/whisper-large-v3-turbo'],
    release('2024-10-09', 'https://groq.com/whisper-large-v3-turbo-now-available-on-groq-combining-speed-quality-for-speech-recognition')
  ),

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
  'scrapecreators/youtube-transcript': release('2025-08-19', 'https://scrapecreators.com/blog/unofficial-youtube-api', 'ScrapeCreators YouTube API announcement date used for the transcript endpoint row.'),

  'firecrawl/firecrawl': release('2024-04-17', 'https://www.firecrawl.dev/', 'Firecrawl public API/service release date used for URL extraction service row.'),
  'spider/spider': release('2024-09-10', 'https://spider.cloud/', 'Spider API public service date used for URL extraction service row.'),
  'zyte/zyte': release('2021-10-05', 'https://www.zyte.com/zyte-api/', 'Zyte API public release date used for URL extraction service row.'),
  'grok/grok-4.3': release('2026-05-01', 'https://venturebeat.com/technology/xai-launches-grok-4-3-at-an-aggressively-low-price-and-a-new-fast-powerful-voice-cloning-suite/', 'Grok 4.3 API availability report date used for OCR benchmark row.'),
  'unstructured/hi_res_and_enrichment': release('2023-07-01', 'https://docs.unstructured.io/api-reference/workflow/models', 'Unstructured hi-res/enrichment workflow public API date used for service row.'),

  ...sameRelease(
    ['cartesia/sonic-3'],
    release('2025-10-27', 'https://docs.cartesia.ai/build-with-cartesia/models', 'Cartesia Sonic 3 stable snapshot release date used for the base model row.')
  ),
  ...sameRelease(
    ['cartesia/sonic-3.5'],
    release('2026-04-01', 'https://docs.cartesia.ai/changelog/february-2026', 'Cartesia changelog lists Sonic 3.5 availability in April 2026; day normalized to first of month.')
  ),
  'hume/octave-2': release('2025-10-01', 'https://www.hume.ai/blog/octave-2-launch', 'Hume Octave 2 launch month normalized to first of month.'),
  ...sameRelease(
    ['speechify/simba-english', 'speechify/simba-multilingual'],
    release('2026-02-13', 'https://speechify.com/news/speechify-voice-ai-research-lab-simba-3-voice-model-launch/', 'Speechify SIMBA 3 early rollout date used for Simba API model rows.')
  ),

  'gemini/gemini-3.1-flash-image-preview': release('2026-03-03', 'https://ai.google.dev/gemini-api/docs/models/gemini', 'Gemini 3.1 Flash model-family docs date used for the image-preview row.'),
  ...sameRelease(
    ['bfl/flux-2-pro', 'bfl/flux-2-max', 'bfl/flux-2-flex'],
    release('2025-11-25', 'https://docs.bfl.ai/release-notes', 'FLUX.2 public model-family release date used for fixed Pro, Max, and Flex rows.')
  ),
  'glm/cogvideox-3': release('2026-01-01', 'https://docs.z.ai/release-notes/new-released', 'Z.AI release notes list CogVideoX-3 as newly launched; day normalized to first of year until an exact dated release note is available.'),
  'glm/viduq1-text': release('2025-04-21', 'https://www.prnewswire.com/news-releases/vidu-q1-model-launches-globally-offering-unmatched-realistic-vfx-capabilities-from-generating-cinematic-transitions-to-high-fidelity-sound-effects-with-just-a-few-simple-inputs-302433278.html', 'Vidu Q1 global launch date used for Z.AI viduq1-text row.'),
  'runway/gen4.5': release('2026-02-10', 'https://docs.dev.runwayml.com/api-details/api_changelog/', 'Runway API availability date for Gen-4.5.'),

  ...sameRelease(
    ['reve/latest', 'reve/reve-create@20250915'],
    release('2025-09-15', 'https://apiframe.ai/docs/images/reve/reve-create', 'Reve Create versioned model identifier reve-create@20250915 is used as the release date; latest points at the same create family in the benchmark run.')
  ),
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
