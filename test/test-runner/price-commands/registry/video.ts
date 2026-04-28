import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const videoRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/step-6-video-gen-e2e/video-gen.test.ts', [
    command('video-gemini-veo-3.1-fast-generate-preview', 'video-gemini-veo-3.1-fast-generate-preview', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--gemini-video', 'veo-3.1-fast-generate-preview', '--price']),
    command('video-gemini-veo-3.1-generate-preview', 'video-gemini-veo-3.1-generate-preview', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--gemini-video', 'veo-3.1-generate-preview', '--price']),
    command('video-minimax-MiniMax-Hailuo-2.3', 'video-minimax-MiniMax-Hailuo-2.3', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--minimax-video', 'MiniMax-Hailuo-2.3', '--price']),
    command('video-minimax-T2V-01', 'video-minimax-T2V-01', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--minimax-video', 'T2V-01', '--price']),
    command('video-minimax-MiniMax-Hailuo-02', 'video-minimax-MiniMax-Hailuo-02', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--minimax-video', 'MiniMax-Hailuo-02', '--price']),
    command('video-minimax-T2V-01-Director', 'video-minimax-T2V-01-Director', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--minimax-video', 'T2V-01-Director', '--price']),
    command('video-deapi-Ltxv_13B_0_9_8_Distilled_FP8', 'video-deapi-Ltxv_13B_0_9_8_Distilled_FP8', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--deapi-video', 'Ltxv_13B_0_9_8_Distilled_FP8', '--price']),
    command('video-deapi-Ltx2_19B_Dist_FP8', 'video-deapi-Ltx2_19B_Dist_FP8', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--deapi-video', 'Ltx2_19B_Dist_FP8', '--price']),
    command('video-deapi-Ltx2_3_22B_Dist_INT8', 'video-deapi-Ltx2_3_22B_Dist_INT8', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--deapi-video', 'Ltx2_3_22B_Dist_INT8', '--price']),
  ]),
]
