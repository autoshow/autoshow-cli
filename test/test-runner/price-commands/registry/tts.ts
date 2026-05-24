import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const ttsRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/openai-gpt-4o-mini-tts.test.ts', [
    command('tts-openai-gpt-4o-mini-tts', 'tts-openai-gpt-4o-mini-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'openai=gpt-4o-mini-tts', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/openai-gpt-4o-mini-tts-custom-voice.test.ts', [
    command('tts-openai-gpt-4o-mini-tts-clone', 'tts-openai-gpt-4o-mini-tts-clone', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'openai=gpt-4o-mini-tts', '--tts-ref-audio', 'input/examples/audio/anthony-voice.mp3', '--openai-tts-consent-id', 'cons_123', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/gemini-3.1-flash-tts-preview.test.ts', [
    command('tts-gemini-gemini-3.1-flash-tts-preview', 'tts-gemini-gemini-3.1-flash-tts-preview', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'gemini=gemini-3.1-flash-tts-preview', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/gemini-3.1-flash-tts-preview-multispeaker.test.ts', [
    command('tts-gemini-gemini-3.1-flash-tts-preview', 'tts-gemini-gemini-3.1-flash-tts-preview', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'gemini=gemini-3.1-flash-tts-preview', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/deepgram-aura-2-thalia-en.test.ts', [
    command('tts-deepgram-aura-2-thalia-en', 'tts-deepgram-aura-2-thalia-en', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'deepgram=aura-2-thalia-en', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/groq-canopylabs-orpheus-v1-english.test.ts', [
    command('tts-groq-canopylabs/orpheus-v1-english', 'tts-groq-canopylabs/orpheus-v1-english', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'groq=canopylabs/orpheus-v1-english', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/groq-canopylabs-orpheus-v1-english-hannah.test.ts', [
    command('tts-groq-canopylabs/orpheus-v1-english', 'tts-groq-canopylabs/orpheus-v1-english', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'groq=canopylabs/orpheus-v1-english', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/grok-tts.test.ts', [
    command('tts-grok-grok-tts', 'tts-grok-grok-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'grok=grok-tts', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/mistral-validation.test.ts', [
    command('tts-mistral-voxtral-mini-tts-2603', 'tts-mistral-voxtral-mini-tts-2603', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'mistral=voxtral-mini-tts-2603', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/mistral-voxtral-mini-tts-2603-voice.test.ts', [
    command('tts-mistral-voxtral-mini-tts-2603-voice', 'tts-mistral-voxtral-mini-tts-2603-voice', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'mistral=voxtral-mini-tts-2603', '--tts-voice', 'voice_abc123', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/mistral-voxtral-mini-tts-2603-ref-audio.test.ts', [
    command('tts-mistral-voxtral-mini-tts-2603-ref-audio', 'tts-mistral-voxtral-mini-tts-2603-ref-audio', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'mistral=voxtral-mini-tts-2603', '--tts-ref-audio', 'input/examples/audio/anthony-voice.mp3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/mistral-dialogue-ref-audio.test.ts', [
    command('tts-mistral-dialogue-ref-audio', 'tts-mistral-dialogue-ref-audio', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/tts-dialogue.txt', '--provider', 'mistral=voxtral-mini-tts-2603', '--tts-dialogue-format', 'labeled', '--tts-speaker-ref-audio', 'Host=input/examples/audio/anthony-voice.mp3', '--tts-speaker-ref-audio', 'Guest=https://ajc.pics/autoshow/examples/1-audio.mp3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/speechify-simba-english.test.ts', [
    command('tts-speechify-simba-english', 'tts-speechify-simba-english', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'speechify=simba-english', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/speechify-simba-multilingual.test.ts', [
    command('tts-speechify-simba-multilingual', 'tts-speechify-simba-multilingual', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'speechify=simba-multilingual', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/hume-octave-2.test.ts', [
    command('tts-hume-octave-2', 'tts-hume-octave-2', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'hume=octave-2', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/cartesia-sonic-3.test.ts', [
    command('tts-cartesia-sonic-3', 'tts-cartesia-sonic-3', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'cartesia=sonic-3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/cartesia-sonic-3.5.test.ts', [
    command('tts-cartesia-sonic-3.5', 'tts-cartesia-sonic-3.5', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'cartesia=sonic-3.5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/minimax-speech-2.8-turbo.test.ts', [
    command('tts-minimax-speech-2.8-turbo', 'tts-minimax-speech-2.8-turbo', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'minimax=speech-2.8-turbo', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/minimax-speech-2.8-hd.test.ts', [
    command('tts-minimax-speech-2.8-hd', 'tts-minimax-speech-2.8-hd', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'minimax=speech-2.8-hd', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/elevenlabs-eleven-v3.test.ts', [
    command('tts-elevenlabs-eleven_v3', 'tts-elevenlabs-eleven_v3', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'elevenlabs=eleven_v3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/local/step-4-tts-e2e/tts-local/kitten-tts.test.ts', [
    command('tts-kitten-micro', 'tts-kitten-micro', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'kitten=kitten-tts-micro', '--price']),
    command('tts-kitten-mini', 'tts-kitten-mini', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'kitten=kitten-tts-mini', '--price']),
    command('tts-kitten-nano', 'tts-kitten-nano', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'kitten=kitten-tts-nano', '--price']),
    command('tts-kitten-nano-0.8-int8', 'tts-kitten-nano-0.8-int8', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'kitten=kitten-tts-nano-0.8-int8', '--price']),
    command('tts-openai-gpt-4o-mini-tts', 'tts-openai-gpt-4o-mini-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'openai=gpt-4o-mini-tts', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-4-tts-e2e/tts-services/kitten-tts-pipeline.test.ts', [
    command('tts-kitten-mini', 'tts-kitten-mini', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'kitten=kitten-tts-mini', '--price']),
    command('tts-openai-gpt-4o-mini-tts', 'tts-openai-gpt-4o-mini-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'openai=gpt-4o-mini-tts', '--price']),
  ]),
]
