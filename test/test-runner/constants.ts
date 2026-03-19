import type { Tier } from '../../src/types/tests-dir-types'

export const ALL_TIERS: Tier[] = ['smoke', 'local', 'api', 'slow-local', 'slow-api']

export const TIER_RULES: [string, Tier][] = [
  ['test/test-cases/validation/model-options', 'api'],
  ['test/test-cases/validation/', 'smoke'],
  ['test/test-cases/price/', 'smoke'],
  ['test/test-cases/cli/', 'smoke'],
  ['test/test-cases/smoke/', 'smoke'],
  ['test/test-cases/local/', 'local'],

  ['test/test-cases/e2e/api-cheap', 'api'],
  ['test/test-cases/e2e/cli-integration', 'api'],
  ['test/test-cases/e2e/step-2-extract-e2e/extract-paddle-ocr-image', 'slow-local'],
  ['test/test-cases/e2e/step-2-extract-e2e/extract-mistral-ocr', 'api'],
  ['test/test-cases/e2e/step-2-extract-e2e/extract-engine-flags', 'api'],
  ['test/test-cases/e2e/step-2-extract-e2e/input-1-document-mistral-ocr', 'api'],
  ['test/test-cases/e2e/step-2-extract-e2e/input-page-mistral-ocr', 'api'],
  ['test/test-cases/e2e/step-2-extract-e2e/url-', 'api'],
  ['test/test-cases/e2e/step-1-download-e2e/download-input-types-streaming', 'slow-api'],
  ['test/test-cases/e2e/step-1-download-e2e/download-input-types-feed-or-channel', 'slow-api'],
  ['test/test-cases/e2e/step-1-download-e2e/batch-commands', 'api'],
  ['test/test-cases/e2e/step-1-download-e2e/twitch', 'slow-api'],
  ['test/test-cases/e2e/step-1-download-e2e/input-2-urls', 'slow-api'],
  ['test/test-cases/e2e/step-1-download-e2e/download-local-audio', 'local'],
  ['test/test-cases/e2e/step-1-download-e2e/download-local-document', 'smoke'],
  ['test/test-cases/e2e/step-1-download-e2e/download-youtube', 'api'],
  ['test/test-cases/e2e/step-1-download-e2e/youtube', 'api'],
  ['test/test-cases/e2e/step-1-download-e2e/download-rss-', 'api'],
  ['test/test-cases/e2e/step-1-download-e2e/rss-', 'api'],
  ['test/test-cases/e2e/step-1-download-e2e/input-1-audio', 'local'],
  ['test/test-cases/e2e/step-1-download-e2e/input-3-video', 'local'],
  ['test/test-cases/e2e/step-1-download-e2e/url-', 'api'],

  ['test/test-cases/e2e/step-2-transcribe-e2e/reverb/', 'slow-local'],
  ['test/test-cases/e2e/step-2-transcribe-e2e/assemblyai/', 'api'],
  ['test/test-cases/e2e/step-2-transcribe-e2e/elevenlabs/', 'api'],
  ['test/test-cases/e2e/step-2-transcribe-e2e/groq/', 'api'],
  ['test/test-cases/e2e/step-2-transcribe-e2e/openai/', 'api'],
  ['test/test-cases/e2e/step-2-transcribe-e2e/mistral/', 'api'],
  ['test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-large-v3-turbo', 'slow-local'],
  ['test/test-cases/e2e/step-2-transcribe-e2e/whisper/', 'local'],

  ['test/test-cases/e2e/step-3-write-e2e/llama/llama-qwen', 'slow-local'],
  ['test/test-cases/e2e/step-3-write-e2e/llama/', 'local'],
  ['test/test-cases/e2e/step-3-write-e2e/', 'api'],

  ['test/test-cases/e2e/step-4-tts-e2e/openai-tts', 'api'],
  ['test/test-cases/e2e/step-4-tts-e2e/gemini-tts', 'api'],
  ['test/test-cases/e2e/step-4-tts-e2e/groq-tts', 'api'],
  ['test/test-cases/e2e/step-4-tts-e2e/minimax-tts', 'api'],
  ['test/test-cases/e2e/step-4-tts-e2e/elevenlabs-tts', 'api'],
  ['test/test-cases/e2e/step-4-tts-e2e/kitten-tts-pipeline', 'api'],
  ['test/test-cases/e2e/step-4-tts-e2e/', 'local'],
  ['test/test-cases/e2e/step-5-image-gen-e2e/', 'api'],
  ['test/test-cases/e2e/step-7-music-gen-e2e/', 'api'],
  ['test/test-cases/e2e/step-6-video-gen-e2e/', 'api'],

  ['test/test-cases/e2e/step-0-setup-e2e/', 'slow-api'],

  ['test/test-cases/e2e/', 'smoke'],

]

export const REVERB_FILE = 'test/test-cases/e2e/step-2-transcribe-e2e/reverb/reverb.test.ts'
export const TWITCH_FILE = 'test/test-cases/e2e/step-1-download-e2e/twitch.test.ts'
export const BATCH_FILE = 'test/test-cases/e2e/step-1-download-e2e/input-2-urls.test.ts'

export const GPT52_FILES = [
  'test/test-cases/e2e/step-3-write-e2e/openai/openai-models.test.ts',
]

export const LLAMA_DIR = 'test/test-cases/e2e/step-3-write-e2e/llama'
export const LLAMA_SMOKE_FILE = 'test/test-cases/e2e/step-3-write-e2e/llama/llama-smoke.test.ts'
export const LLAMA_MODELS_DIR = 'test/test-cases/e2e/step-0-setup-e2e/llama-models'
export const WHISPER3_FILE = 'test/test-cases/e2e/step-2-transcribe-e2e/whisper/whisper-large-v3-turbo.test.ts'
export const TTS_DIR = 'test/test-cases/e2e/step-4-tts-e2e'
export const TTS_SETUP_DIR = 'test/test-cases/e2e/step-0-setup-e2e/tts-models'
export const ANTHROPIC_DIR = 'test/test-cases/e2e/step-3-write-e2e/anthropic'
export const VIDEO_DIR = 'test/test-cases/e2e/step-6-video-gen-e2e'
