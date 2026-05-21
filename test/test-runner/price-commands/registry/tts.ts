import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

const SHORT_TTS_INPUT_PATH = 'input/examples/tts/0-tts-short.txt'

export const ttsRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-services/service-models.test.ts', [
    command('tts-openai-gpt-4o-mini-tts', 'tts-openai-gpt-4o-mini-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--openai', 'gpt-4o-mini-tts', '--price']),
    command('tts-openai-gpt-4o-mini-tts-clone', 'tts-openai-gpt-4o-mini-tts-clone', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--openai', 'gpt-4o-mini-tts', '--openai-tts-ref-audio', 'input/examples/audio/anthony-voice.mp3', '--openai-tts-consent-id', 'cons_123', '--price']),
    command('tts-gemini-gemini-3.1-flash-tts-preview', 'tts-gemini-gemini-3.1-flash-tts-preview', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--gemini', 'gemini-3.1-flash-tts-preview', '--price']),
    command('tts-deepgram-aura-2-thalia-en', 'tts-deepgram-aura-2-thalia-en', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--deepgram', 'aura-2-thalia-en', '--price']),
    command('tts-groq-canopylabs/orpheus-v1-english', 'tts-groq-canopylabs/orpheus-v1-english', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--groq', 'canopylabs/orpheus-v1-english', '--price']),
    command('tts-grok-grok-tts', 'tts-grok-grok-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--grok', 'grok-tts', '--price']),
    command('tts-mistral-voxtral-mini-tts-2603', 'tts-mistral-voxtral-mini-tts-2603', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--mistral', 'voxtral-mini-tts-2603', '--price']),
    command('tts-mistral-voxtral-mini-tts-2603-voice', 'tts-mistral-voxtral-mini-tts-2603-voice', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--mistral', 'voxtral-mini-tts-2603', '--mistral-tts-voice', 'voice_abc123', '--price']),
    command('tts-mistral-voxtral-mini-tts-2603-ref-audio', 'tts-mistral-voxtral-mini-tts-2603-ref-audio', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--mistral', 'voxtral-mini-tts-2603', '--mistral-tts-ref-audio', 'input/examples/audio/anthony-voice.mp3', '--price']),
    command('tts-mistral-dialogue-ref-audio', 'tts-mistral-dialogue-ref-audio', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/tts-dialogue.txt', '--mistral', 'voxtral-mini-tts-2603', '--tts-dialogue-format', 'labeled', '--tts-speaker-ref-audio', 'Host=input/examples/audio/anthony-voice.mp3', '--tts-speaker-ref-audio', 'Guest=https://ajc.pics/autoshow/examples/1-audio.mp3', '--price']),
    command('tts-speechify-simba-english', 'tts-speechify-simba-english', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--speechify', 'simba-english', '--price']),
    command('tts-speechify-simba-multilingual', 'tts-speechify-simba-multilingual', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--speechify', 'simba-multilingual', '--price']),
    command('tts-hume-octave-2', 'tts-hume-octave-2', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--hume', 'octave-2', '--price']),
    command('tts-cartesia-sonic-3', 'tts-cartesia-sonic-3', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--cartesia', 'sonic-3', '--price']),
    command('tts-cartesia-sonic-3.5', 'tts-cartesia-sonic-3.5', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--cartesia', 'sonic-3.5', '--price']),
    command('tts-gcloud-chirp3-hd', 'tts-gcloud-chirp3-hd', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--gcloud', 'chirp3-hd', '--price']),
    command('tts-gcloud-studio', 'tts-gcloud-studio', ['src/cli/create-cli.ts', 'tts', SHORT_TTS_INPUT_PATH, '--gcloud', 'studio', '--price']),
    command('tts-minimax-speech-2.8-turbo', 'tts-minimax-speech-2.8-turbo', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--minimax', 'speech-2.8-turbo', '--price']),
    command('tts-minimax-speech-2.8-hd', 'tts-minimax-speech-2.8-hd', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--minimax', 'speech-2.8-hd', '--price']),
    command('tts-elevenlabs-eleven_v3', 'tts-elevenlabs-eleven_v3', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--elevenlabs', 'eleven_v3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts', [
    command('tts-kitten-micro', 'tts-kitten-micro', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--kitten', 'kitten-tts-micro', '--price']),
    command('tts-kitten-mini', 'tts-kitten-mini', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--kitten', 'kitten-tts-mini', '--price']),
    command('tts-kitten-nano', 'tts-kitten-nano', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--kitten', 'kitten-tts-nano', '--price']),
    command('tts-kitten-nano-0.8-int8', 'tts-kitten-nano-0.8-int8', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--kitten', 'kitten-tts-nano-0.8-int8', '--price']),
    command('tts-openai-gpt-4o-mini-tts', 'tts-openai-gpt-4o-mini-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--openai', 'gpt-4o-mini-tts', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-services/kitten-tts-pipeline.test.ts', [
    command('tts-kitten-mini', 'tts-kitten-mini', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--kitten', 'kitten-tts-mini', '--price']),
    command('tts-openai-gpt-4o-mini-tts', 'tts-openai-gpt-4o-mini-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--openai', 'gpt-4o-mini-tts', '--price']),
  ]),
]
