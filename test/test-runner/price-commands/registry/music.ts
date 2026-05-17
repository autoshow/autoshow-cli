import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

const minimaxGeminiClipMusicCommand = command(
  'music-multi-minimax-music-2.5-gemini-lyria-3-clip-preview',
  'music-multi-minimax-music-2.5-gemini-lyria-3-clip-preview',
  ['src/cli/create-cli.ts', 'music', 'bright acoustic pop with handclaps and a catchy chorus', '--minimax', 'music-2.5', '--gemini', 'lyria-3-clip-preview', '--music-lyrics-file', 'input/examples/tts/1-tts.md', '--price']
)

export const musicRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/step-7-music-gen-e2e/elevenlabs-music-gen.test.ts', [
    command('music-elevenlabs-music_v1', 'music-elevenlabs-music_v1', ['src/cli/create-cli.ts', 'music', 'an ambient piano song', '--elevenlabs', 'music_v1', '--music-duration', '3', '--music-instrumental', '--price']),
    command('music-pipeline-elevenlabs-music_v1', 'music-pipeline-elevenlabs-music_v1', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--llama', 'ggml-org/gemma-3-270m-it-GGUF', '--elevenlabs-music', 'music_v1', '--music-duration', '3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts', [
    command('music-pipeline-minimax-music-2.5', 'music-pipeline-minimax-music-2.5', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--minimax-music', 'music-2.5', '--music-lyrics-file', 'input/examples/tts/1-tts.md', '--price']),
    minimaxGeminiClipMusicCommand,
  ]),
  ...exact('test/test-cases/e2e/step-7-music-gen-e2e/gemini-music-gen.test.ts', [
    command('music-gemini-lyria-3-pro-preview', 'music-gemini-lyria-3-pro-preview', ['src/cli/create-cli.ts', 'music', 'an ambient piano song', '--gemini', 'lyria-3-pro-preview', '--music-duration', '30', '--price']),
  ]),
]
