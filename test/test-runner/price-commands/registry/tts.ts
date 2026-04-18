import type { PriceSelectionEntry } from '../../../../src/types/tests-dir-types'
import { command, exact } from '../helpers'

export const ttsRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-services/openai-tts.test.ts', [
    command('tts-openai-gpt-4o-mini-tts', 'tts-openai-gpt-4o-mini-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/document/1-tts.md', '--openai-tts', 'gpt-4o-mini-tts', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-services/gemini-tts.test.ts', [
    command('tts-gemini-gemini-2.5-flash-preview-tts', 'tts-gemini-gemini-2.5-flash-preview-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/document/1-tts.md', '--gemini-tts', 'gemini-2.5-flash-preview-tts', '--price']),
    command('tts-gemini-gemini-2.5-pro-preview-tts', 'tts-gemini-gemini-2.5-pro-preview-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/document/1-tts.md', '--gemini-tts', 'gemini-2.5-pro-preview-tts', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-services/groq-tts.test.ts', [
    command('tts-groq-canopylabs/orpheus-v1-english', 'tts-groq-canopylabs/orpheus-v1-english', ['src/cli/create-cli.ts', 'tts', 'input/examples/document/1-tts.md', '--groq-tts', 'canopylabs/orpheus-v1-english', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-services/minimax-tts.test.ts', [
    command('tts-minimax-speech-2.8-turbo', 'tts-minimax-speech-2.8-turbo', ['src/cli/create-cli.ts', 'tts', 'input/examples/document/1-tts.md', '--minimax-tts', 'speech-2.8-turbo', '--price']),
    command('tts-minimax-speech-2.8-hd', 'tts-minimax-speech-2.8-hd', ['src/cli/create-cli.ts', 'tts', 'input/examples/document/1-tts.md', '--minimax-tts', 'speech-2.8-hd', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-services/elevenlabs-tts.test.ts', [
    command('tts-elevenlabs-eleven_v3', 'tts-elevenlabs-eleven_v3', ['src/cli/create-cli.ts', 'tts', 'input/examples/document/1-tts.md', '--elevenlabs-tts', 'eleven_v3', '--price']),
    command('tts-elevenlabs-eleven_flash_v2_5', 'tts-elevenlabs-eleven_flash_v2_5', ['src/cli/create-cli.ts', 'tts', 'input/examples/document/1-tts.md', '--elevenlabs-tts', 'eleven_flash_v2_5', '--price']),
    command('tts-elevenlabs-eleven_turbo_v2_5', 'tts-elevenlabs-eleven_turbo_v2_5', ['src/cli/create-cli.ts', 'tts', 'input/examples/document/1-tts.md', '--elevenlabs-tts', 'eleven_turbo_v2_5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-4-tts-e2e/tts-local/kitten-tts.test.ts', [
    command('tts-kitten-micro', 'tts-kitten-micro', ['src/cli/create-cli.ts', 'tts', 'input/examples/document/1-tts.md', '--kitten-tts', 'kitten-tts-micro', '--price']),
    command('tts-kitten-mini', 'tts-kitten-mini', ['src/cli/create-cli.ts', 'tts', 'input/examples/document/1-tts.md', '--kitten-tts', 'kitten-tts-mini', '--price']),
    command('tts-kitten-nano', 'tts-kitten-nano', ['src/cli/create-cli.ts', 'tts', 'input/examples/document/1-tts.md', '--kitten-tts', 'kitten-tts-nano', '--price']),
    command('tts-kitten-nano-0.8-int8', 'tts-kitten-nano-0.8-int8', ['src/cli/create-cli.ts', 'tts', 'input/examples/document/1-tts.md', '--kitten-tts', 'kitten-tts-nano-0.8-int8', '--price']),
  ]),
]
