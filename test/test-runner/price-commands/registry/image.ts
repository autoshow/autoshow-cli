import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const imageRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/openai-image-gen.test.ts', [
    command('image-openai-gpt-image-1.5', 'image-openai-gpt-image-1.5', ['src/cli/create-cli.ts', 'image', 'a sunset', '--openai', 'gpt-image-1.5', '--price']),
    command('image-openai-gpt-image-2', 'image-openai-gpt-image-2', ['src/cli/create-cli.ts', 'image', 'a sunset', '--openai', 'gpt-image-2', '--image-size', '1024x1536', '--image-quality', 'low', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/gemini-image-gen.test.ts', [
    command('image-gemini-gemini-3.1-flash-image-preview', 'image-gemini-gemini-3.1-flash-image-preview', ['src/cli/create-cli.ts', 'image', 'a tiny purple circle on white background', '--gemini', 'gemini-3.1-flash-image-preview', '--image-size', '1K', '--image-aspect-ratio', '1:1', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/grok-image-gen.test.ts', [
    command('image-grok-grok-imagine-image', 'image-grok-grok-imagine-image', ['src/cli/create-cli.ts', 'image', 'a sunset', '--grok', 'grok-imagine-image', '--price']),
    command('image-grok-grok-imagine-image-quality', 'image-grok-grok-imagine-image-quality', ['src/cli/create-cli.ts', 'image', 'A simple blue cube on a white background', '--grok', 'grok-imagine-image-quality', '--image-size', '1K', '--image-aspect-ratio', '1:1', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-5-image-gen-e2e/bfl-image-gen.test.ts', [
    command('image-bfl-flux-2-pro', 'image-bfl-flux-2-pro', ['src/cli/create-cli.ts', 'image', 'A tiny blue square on a white background', '--bfl', 'flux-2-pro', '--image-size', '64x64', '--image-format', 'jpeg', '--price']),
    command('image-bfl-flux-2-max', 'image-bfl-flux-2-max', ['src/cli/create-cli.ts', 'image', 'A tiny blue square on a white background', '--bfl', 'flux-2-max', '--image-size', '64x64', '--image-format', 'jpeg', '--price']),
    command('image-bfl-flux-2-flex', 'image-bfl-flux-2-flex', ['src/cli/create-cli.ts', 'image', 'A tiny blue square on a white background', '--bfl', 'flux-2-flex', '--image-size', '64x64', '--image-format', 'jpeg', '--price']),
  ]),
]
