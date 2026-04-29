import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const musicRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/step-7-music-gen-e2e/elevenlabs-music-gen.test.ts', [
    command('music-elevenlabs-music_v1', 'music-elevenlabs-music_v1', ['src/cli/create-cli.ts', 'music', 'an ambient piano song', '--elevenlabs-music', 'music_v1', '--music-duration', '10', '--price']),
    command('music-pipeline-elevenlabs-music_v1', 'music-pipeline-elevenlabs-music_v1', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--openai', 'gpt-5.4', '--elevenlabs-music', 'music_v1', '--music-duration', '20', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-7-music-gen-e2e/minimax-music-gen.test.ts', [
    command('music-elevenlabs-music_v1', 'music-elevenlabs-music_v1', ['src/cli/create-cli.ts', 'music', 'an ambient piano song', '--elevenlabs-music', 'music_v1', '--music-duration', '10', '--price']),
    command('music-minimax-music-2.5', 'music-minimax-music-2.5', ['src/cli/create-cli.ts', 'music', 'an ambient piano song', '--minimax-music', 'music-2.5', '--price']),
    command('music-pipeline-minimax-music-2.5', 'music-pipeline-minimax-music-2.5', ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--minimax-music', 'music-2.5', '--price']),
  ]),
]
