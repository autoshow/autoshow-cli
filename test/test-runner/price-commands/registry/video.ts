import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const videoRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/gemini-veo-3.1-fast-generate-preview.test.ts', [
    command('video-gemini-veo-3.1-fast-generate-preview', 'video-gemini-veo-3.1-fast-generate-preview', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--provider', 'gemini=veo-3.1-fast-generate-preview', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/gemini-veo-3.1-generate-preview.test.ts', [
    command('video-gemini-veo-3.1-generate-preview', 'video-gemini-veo-3.1-generate-preview', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--provider', 'gemini=veo-3.1-generate-preview', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/minimax-hailuo-2.3.test.ts', [
    command('video-minimax-MiniMax-Hailuo-2.3', 'video-minimax-MiniMax-Hailuo-2.3', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--provider', 'minimax=MiniMax-Hailuo-2.3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/minimax-hailuo-2.3-fast.test.ts', [
    command('video-minimax-MiniMax-Hailuo-2.3-Fast', 'video-minimax-MiniMax-Hailuo-2.3-Fast', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'minimax=MiniMax-Hailuo-2.3-Fast', '--mode', 'image-to-video', '--input-image', 'input/examples/document/1-document.jpg', '--duration', '6', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/minimax-t2v-01.test.ts', [
    command('video-minimax-T2V-01', 'video-minimax-T2V-01', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--provider', 'minimax=T2V-01', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/minimax-t2v-01-director.test.ts', [
    command('video-minimax-T2V-01-Director', 'video-minimax-T2V-01-Director', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--provider', 'minimax=T2V-01-Director', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/glm-cogvideox-3.test.ts', [
    command('video-glm-cogvideox-3', 'video-glm-cogvideox-3', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'glm=cogvideox-3', '--duration', '5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/glm-viduq1-text.test.ts', [
    command('video-glm-viduq1-text', 'video-glm-viduq1-text', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'glm=viduq1-text', '--duration', '5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/grok-imagine-video.test.ts', [
    command('video-grok-grok-imagine-video', 'video-grok-grok-imagine-video', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'grok=grok-imagine-video', '--duration', '1', '--resolution', '480p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/runway-gen4.5.test.ts', [
    command('video-runway-gen4.5', 'video-runway-gen4.5', ['src/cli/create-cli.ts', 'video', 'A serene mountain landscape at sunrise with mist rolling through the valleys', '--provider', 'runway=gen4.5', '--duration', '5', '--price']),
  ]),
]
