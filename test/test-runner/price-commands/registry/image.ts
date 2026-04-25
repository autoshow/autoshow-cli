import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const imageRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts', [
    command('image-openai-gpt-image-1', 'image-openai-gpt-image-1', ['src/cli/create-cli.ts', 'image', 'a sunset', '--openai-image', 'gpt-image-1', '--price']),
    command('image-openai-gpt-image-1-mini', 'image-openai-gpt-image-1-mini', ['src/cli/create-cli.ts', 'image', 'a sunset', '--openai-image', 'gpt-image-1-mini', '--price']),
    command('image-openai-gpt-image-1.5', 'image-openai-gpt-image-1.5', ['src/cli/create-cli.ts', 'image', 'a sunset', '--openai-image', 'gpt-image-1.5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/gemini-image-gen.test.ts', [
    command('image-gemini-gemini-3-pro-image-preview', 'image-gemini-gemini-3-pro-image-preview', ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini-image', 'gemini-3-pro-image-preview', '--price']),
    command('image-gemini-imagen-4.0-ultra-generate-001', 'image-gemini-imagen-4.0-ultra-generate-001', ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini-image', 'imagen-4.0-ultra-generate-001', '--price']),
    command('image-gemini-imagen-4.0-fast-generate-001', 'image-gemini-imagen-4.0-fast-generate-001', ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini-image', 'imagen-4.0-fast-generate-001', '--price']),
    command('image-gemini-imagen-4.0-generate-001', 'image-gemini-imagen-4.0-generate-001', ['src/cli/create-cli.ts', 'image', 'a sunset', '--gemini-image', 'imagen-4.0-generate-001', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/minimax-image-gen.test.ts', [
    command('image-minimax-image-01', 'image-minimax-image-01', ['src/cli/create-cli.ts', 'image', 'a sunset', '--minimax-image', 'image-01', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/glm-image-gen.test.ts', [
    command('image-glm-glm-image', 'image-glm-glm-image', ['src/cli/create-cli.ts', 'image', 'a sunset', '--glm-image', 'glm-image', '--price']),
    command('image-glm-cogView-4-250304', 'image-glm-cogView-4-250304', ['src/cli/create-cli.ts', 'image', 'a sunset', '--glm-image', 'cogView-4-250304', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/grok-image-gen.test.ts', [
    command('image-grok-grok-imagine-image', 'image-grok-grok-imagine-image', ['src/cli/create-cli.ts', 'image', 'a sunset', '--grok-image', 'grok-imagine-image', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/runway-image-gen.test.ts', [
    command('image-runway-gen4_image', 'image-runway-gen4_image', ['src/cli/create-cli.ts', 'image', 'a sunset', '--runway-image', 'gen4_image', '--price']),
  ]),
]
