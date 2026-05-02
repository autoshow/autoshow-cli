import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const ttsRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-services/service-models.test.ts', [
    command('tts-openai-gpt-4o-mini-tts', 'tts-openai-gpt-4o-mini-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--openai-tts', 'gpt-4o-mini-tts', '--price']),
    command('tts-openai-gpt-4o-mini-tts-clone', 'tts-openai-gpt-4o-mini-tts-clone', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--openai-tts', 'gpt-4o-mini-tts', '--openai-tts-ref-audio', 'input/examples/audio/anthony-voice.mp3', '--openai-tts-consent-id', 'cons_123', '--price']),
    command('tts-gemini-gemini-3.1-flash-tts-preview', 'tts-gemini-gemini-3.1-flash-tts-preview', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--gemini-tts', 'gemini-3.1-flash-tts-preview', '--price']),
    command('tts-gemini-gemini-2.5-flash-preview-tts', 'tts-gemini-gemini-2.5-flash-preview-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--gemini-tts', 'gemini-2.5-flash-preview-tts', '--price']),
    command('tts-gemini-gemini-2.5-pro-preview-tts', 'tts-gemini-gemini-2.5-pro-preview-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--gemini-tts', 'gemini-2.5-pro-preview-tts', '--price']),
    command('tts-deepgram-aura-2-thalia-en', 'tts-deepgram-aura-2-thalia-en', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--deepgram-tts', 'aura-2-thalia-en', '--price']),
    command('tts-groq-canopylabs/orpheus-v1-english', 'tts-groq-canopylabs/orpheus-v1-english', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--groq-tts', 'canopylabs/orpheus-v1-english', '--price']),
    command('tts-grok-grok-tts', 'tts-grok-grok-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--grok-tts', 'grok-tts', '--price']),
    command('tts-mistral-voxtral-mini-tts-2603', 'tts-mistral-voxtral-mini-tts-2603', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--mistral-tts', 'voxtral-mini-tts-2603', '--price']),
    command('tts-mistral-voxtral-mini-tts-2603-voice', 'tts-mistral-voxtral-mini-tts-2603-voice', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--mistral-tts', 'voxtral-mini-tts-2603', '--mistral-tts-voice', 'voice_abc123', '--price']),
    command('tts-mistral-voxtral-mini-tts-2603-ref-audio', 'tts-mistral-voxtral-mini-tts-2603-ref-audio', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--mistral-tts', 'voxtral-mini-tts-2603', '--mistral-tts-ref-audio', 'input/examples/audio/anthony-voice.mp3', '--price']),
    command('tts-runway-eleven_multilingual_v2', 'tts-runway-eleven_multilingual_v2', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--runway-tts', 'eleven_multilingual_v2', '--price']),
    command('tts-speechify-simba-english', 'tts-speechify-simba-english', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--speechify-tts', 'simba-english', '--price']),
    command('tts-speechify-simba-multilingual', 'tts-speechify-simba-multilingual', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--speechify-tts', 'simba-multilingual', '--price']),
    command('tts-gcloud-standard', 'tts-gcloud-standard', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--gcloud-tts', 'standard', '--price']),
    command('tts-minimax-speech-2.8-turbo', 'tts-minimax-speech-2.8-turbo', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--minimax-tts', 'speech-2.8-turbo', '--price']),
    command('tts-minimax-speech-2.8-hd', 'tts-minimax-speech-2.8-hd', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--minimax-tts', 'speech-2.8-hd', '--price']),
    command('tts-minimax-speech-2.8-turbo-clone', 'tts-minimax-speech-2.8-turbo-clone', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--minimax-tts', 'speech-2.8-turbo', '--minimax-tts-ref-audio', 'input/examples/audio/anthony-voice.mp3', '--price']),
    command('tts-elevenlabs-eleven_v3', 'tts-elevenlabs-eleven_v3', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--elevenlabs-tts', 'eleven_v3', '--price']),
    command('tts-elevenlabs-eleven_flash_v2_5', 'tts-elevenlabs-eleven_flash_v2_5', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--elevenlabs-tts', 'eleven_flash_v2_5', '--price']),
    command('tts-elevenlabs-eleven_turbo_v2_5', 'tts-elevenlabs-eleven_turbo_v2_5', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--elevenlabs-tts', 'eleven_turbo_v2_5', '--price']),
    command('tts-deapi-qwen3-voice-clone', 'tts-deapi-qwen3-voice-clone', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--deapi-tts', 'Qwen3_TTS_12Hz_1_7B_Base', '--deapi-tts-ref-audio', 'input/examples/audio/0-audio-short.mp3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts', [
    command('tts-kitten-micro', 'tts-kitten-micro', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--kitten-tts', 'kitten-tts-micro', '--price']),
    command('tts-kitten-mini', 'tts-kitten-mini', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--kitten-tts', 'kitten-tts-mini', '--price']),
    command('tts-kitten-nano', 'tts-kitten-nano', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--kitten-tts', 'kitten-tts-nano', '--price']),
    command('tts-kitten-nano-0.8-int8', 'tts-kitten-nano-0.8-int8', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--kitten-tts', 'kitten-tts-nano-0.8-int8', '--price']),
    command('tts-openai-gpt-4o-mini-tts', 'tts-openai-gpt-4o-mini-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--openai-tts', 'gpt-4o-mini-tts', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-services/kitten-tts-pipeline.test.ts', [
    command('tts-kitten-mini', 'tts-kitten-mini', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--kitten-tts', 'kitten-tts-mini', '--price']),
    command('tts-openai-gpt-4o-mini-tts', 'tts-openai-gpt-4o-mini-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--openai-tts', 'gpt-4o-mini-tts', '--price']),
  ]),
]
