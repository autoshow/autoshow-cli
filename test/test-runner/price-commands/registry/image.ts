import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const imageRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts', [
    command('image-openai-gpt-image-1.5', 'image-openai-gpt-image-1.5', ['src/cli/create-cli.ts', 'image', 'a sunset', '--openai', 'gpt-image-1.5', '--price']),
    command('image-openai-gpt-image-2', 'image-openai-gpt-image-2', ['src/cli/create-cli.ts', 'image', 'a sunset', '--openai', 'gpt-image-2', '--image-size', '1024x1536', '--image-quality', 'low', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/gemini-image-gen.test.ts', [
    command('image-gemini-imagen-4.0-ultra-generate-001', 'image-gemini-imagen-4.0-ultra-generate-001', ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini', 'imagen-4.0-ultra-generate-001', '--price']),
    command('image-gemini-imagen-4.0-fast-generate-001', 'image-gemini-imagen-4.0-fast-generate-001', ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini', 'imagen-4.0-fast-generate-001', '--price']),
    command('image-gemini-imagen-4.0-generate-001', 'image-gemini-imagen-4.0-generate-001', ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini', 'imagen-4.0-generate-001', '--price']),
    command('image-gemini-gemini-3.1-flash-image-preview', 'image-gemini-gemini-3.1-flash-image-preview', ['src/cli/create-cli.ts', 'image', 'a tiny purple circle on white background', '--gemini', 'gemini-3.1-flash-image-preview', '--image-size', '1K', '--image-aspect-ratio', '1:1', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/minimax-image-gen.test.ts', [
    command('image-minimax-image-01', 'image-minimax-image-01', ['src/cli/create-cli.ts', 'image', 'a dramatic fox portrait in snow', '--minimax', 'image-01', '--image-aspect-ratio', '16:9', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/grok-image-gen.test.ts', [
    command('image-grok-grok-imagine-image', 'image-grok-grok-imagine-image', ['src/cli/create-cli.ts', 'image', 'a sunset', '--grok', 'grok-imagine-image', '--price']),
    command('image-grok-grok-imagine-image-quality', 'image-grok-grok-imagine-image-quality', ['src/cli/create-cli.ts', 'image', 'A simple blue cube on a white background', '--grok', 'grok-imagine-image-quality', '--image-size', '1K', '--image-aspect-ratio', '1:1', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/runway-image-gen.test.ts', [
    command('image-runway-gen4_image', 'image-runway-gen4_image', ['src/cli/create-cli.ts', 'image', 'a sunset', '--runway', 'gen4_image', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/bfl-image-gen.test.ts', [
    command('image-bfl-flux-2-pro-preview', 'image-bfl-flux-2-pro-preview', ['src/cli/create-cli.ts', 'image', 'a sunset', '--bfl', 'flux-2-pro-preview', '--price']),
    command('image-bfl-flux-2-klein-4b', 'image-bfl-flux-2-klein-4b', ['src/cli/create-cli.ts', 'image', 'A tiny blue square on a white background', '--bfl', 'flux-2-klein-4b', '--image-size', '64x64', '--image-format', 'jpeg', '--price']),
    command('image-bfl-flux-2-klein-9b-preview', 'image-bfl-flux-2-klein-9b-preview', ['src/cli/create-cli.ts', 'image', 'A tiny blue square on a white background', '--bfl', 'flux-2-klein-9b-preview', '--image-size', '64x64', '--image-format', 'jpeg', '--price']),
    command('image-bfl-flux-2-klein-9b', 'image-bfl-flux-2-klein-9b', ['src/cli/create-cli.ts', 'image', 'A tiny blue square on a white background', '--bfl', 'flux-2-klein-9b', '--image-size', '64x64', '--image-format', 'jpeg', '--price']),
    command('image-bfl-flux-2-pro', 'image-bfl-flux-2-pro', ['src/cli/create-cli.ts', 'image', 'A tiny blue square on a white background', '--bfl', 'flux-2-pro', '--image-size', '64x64', '--image-format', 'jpeg', '--price']),
    command('image-bfl-flux-2-max', 'image-bfl-flux-2-max', ['src/cli/create-cli.ts', 'image', 'A tiny blue square on a white background', '--bfl', 'flux-2-max', '--image-size', '64x64', '--image-format', 'jpeg', '--price']),
    command('image-bfl-flux-2-flex', 'image-bfl-flux-2-flex', ['src/cli/create-cli.ts', 'image', 'A tiny blue square on a white background', '--bfl', 'flux-2-flex', '--image-size', '64x64', '--image-format', 'jpeg', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/deapi-image-gen.test.ts', [
    command('image-deapi-Flux1schnell', 'image-deapi-Flux1schnell', ['src/cli/create-cli.ts', 'image', 'a sunset', '--deapi', 'Flux1schnell', '--price']),
    command('image-deapi-ZImageTurbo_INT8', 'image-deapi-ZImageTurbo_INT8', ['src/cli/create-cli.ts', 'image', 'a sunset', '--deapi', 'ZImageTurbo_INT8', '--price']),
    command('image-deapi-Flux_2_Klein_4B_BF16', 'image-deapi-Flux_2_Klein_4B_BF16', ['src/cli/create-cli.ts', 'image', 'a sunset', '--deapi', 'Flux_2_Klein_4B_BF16', '--price']),
  ]),
]
