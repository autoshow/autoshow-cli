import type { PriceSelectionEntry } from '../../../../src/types/tests-dir-types'
import { command, exact } from '../helpers'

export const videoRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/step-6-video-gen-e2e/video-gen.test.ts', [
    command('video-gemini-veo-3.1-fast-generate-preview', 'video-gemini-veo-3.1-fast-generate-preview', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--gemini-video', 'veo-3.1-fast-generate-preview', '--price']),
    command('video-gemini-veo-3.1-generate-preview', 'video-gemini-veo-3.1-generate-preview', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--gemini-video', 'veo-3.1-generate-preview', '--price']),
    command('video-minimax-MiniMax-Hailuo-2.3', 'video-minimax-MiniMax-Hailuo-2.3', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--minimax-video', 'MiniMax-Hailuo-2.3', '--price']),
    command('video-minimax-T2V-01', 'video-minimax-T2V-01', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--minimax-video', 'T2V-01', '--price']),
    command('video-minimax-MiniMax-Hailuo-02', 'video-minimax-MiniMax-Hailuo-02', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--minimax-video', 'MiniMax-Hailuo-02', '--price']),
    command('video-minimax-T2V-01-Director', 'video-minimax-T2V-01-Director', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--minimax-video', 'T2V-01-Director', '--price']),
  ]),
]
