import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

const minimaxGeminiClipMusicCommand = command(
  'music-multi-minimax-music-2.6-gemini-lyria-3-clip-preview',
  'music-multi-minimax-music-2.6-gemini-lyria-3-clip-preview',
  ['src/cli/create-cli.ts', 'music', 'bright acoustic pop with handclaps and a catchy chorus', '--provider', 'minimax=music-2.6', '--provider', 'gemini=lyria-3-clip-preview', '--lyrics-file', 'input/examples/tts/1-tts.md', '--price']
)

export const musicRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/step-7-music-gen-e2e/elevenlabs-music-v1.test.ts', [
    command('music-elevenlabs-music_v1', 'music-elevenlabs-music_v1', ['src/cli/create-cli.ts', 'music', 'an ambient piano song', '--provider', 'elevenlabs=music_v1', '--duration', '3', '--instrumental', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-7-music-gen-e2e/elevenlabs-music-v1-pipeline.test.ts', [
    command('music-pipeline-elevenlabs-music_v1', 'music-pipeline-elevenlabs-music_v1', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'llama=ggml-org/gemma-3-270m-it-GGUF', '--music', 'elevenlabs=music_v1', '--music-duration', '3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-7-music-gen-e2e/minimax-music-2.6.test.ts', [
    command('music-minimax-music-2.6', 'music-minimax-music-2.6', ['src/cli/create-cli.ts', 'music', 'an ambient piano instrumental', '--provider', 'minimax=music-2.6', '--instrumental', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-7-music-gen-e2e/minimax-music-2.6-free.test.ts', [
    command('music-minimax-music-2.6-free', 'music-minimax-music-2.6-free', ['src/cli/create-cli.ts', 'music', 'an ambient piano instrumental', '--provider', 'minimax=music-2.6-free', '--instrumental', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-7-music-gen-e2e/minimax-music-2.6-pipeline.test.ts', [
    command('music-pipeline-minimax-music-2.6', 'music-pipeline-minimax-music-2.6', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--music', 'minimax=music-2.6', '--music-lyrics-file', 'input/examples/tts/1-tts.md', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-7-music-gen-e2e/minimax-music-2.6-gemini-lyria-3-clip-preview.test.ts', [
    minimaxGeminiClipMusicCommand,
  ]),
  ...exact('test/test-cases/e2e/service/step-7-music-gen-e2e/gemini-lyria-3-pro-preview.test.ts', [
    command('music-gemini-lyria-3-pro-preview', 'music-gemini-lyria-3-pro-preview', ['src/cli/create-cli.ts', 'music', 'an ambient piano song', '--provider', 'gemini=lyria-3-pro-preview', '--duration', '30', '--price']),
  ]),
]
