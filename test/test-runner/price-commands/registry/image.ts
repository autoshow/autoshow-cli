import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const imageRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/openai-gpt-image-1.5.test.ts', [
    command('image-openai-gpt-image-1.5', 'image-openai-gpt-image-1.5', ['src/cli/create-cli.ts', 'image', 'a sunset', '--provider', 'openai=gpt-image-1.5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/openai-gpt-image-2.test.ts', [
    command('image-openai-gpt-image-2', 'image-openai-gpt-image-2', ['src/cli/create-cli.ts', 'image', 'a sunset', '--provider', 'openai=gpt-image-2', '--size', '1024x1536', '--quality', 'low', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/openai-gpt-image-2-pipeline.test.ts', [
    command('image-openai-gpt-image-2', 'image-openai-gpt-image-2', ['src/cli/create-cli.ts', 'image', 'a sunset', '--provider', 'openai=gpt-image-2', '--size', '1024x1536', '--quality', 'low', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/gemini-image-gen.test.ts', [
    command('image-gemini-gemini-3.1-flash-image-preview', 'image-gemini-gemini-3.1-flash-image-preview', ['src/cli/create-cli.ts', 'image', 'a tiny purple circle on white background', '--provider', 'gemini=gemini-3.1-flash-image-preview', '--size', '1K', '--aspect-ratio', '1:1', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/grok-imagine-image.test.ts', [
    command('image-grok-grok-imagine-image', 'image-grok-grok-imagine-image', ['src/cli/create-cli.ts', 'image', 'a sunset', '--provider', 'grok=grok-imagine-image', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/grok-imagine-image-quality.test.ts', [
    command('image-grok-grok-imagine-image-quality', 'image-grok-grok-imagine-image-quality', ['src/cli/create-cli.ts', 'image', 'A simple blue cube on a white background', '--provider', 'grok=grok-imagine-image-quality', '--size', '1K', '--aspect-ratio', '1:1', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/bfl-flux-2-pro.test.ts', [
    command('image-bfl-flux-2-pro', 'image-bfl-flux-2-pro', ['src/cli/create-cli.ts', 'image', 'A tiny blue square on a white background', '--provider', 'bfl=flux-2-pro', '--size', '64x64', '--format', 'jpeg', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/bfl-flux-2-max.test.ts', [
    command('image-bfl-flux-2-max', 'image-bfl-flux-2-max', ['src/cli/create-cli.ts', 'image', 'A tiny blue square on a white background', '--provider', 'bfl=flux-2-max', '--size', '64x64', '--format', 'jpeg', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/bfl-flux-2-flex.test.ts', [
    command('image-bfl-flux-2-flex', 'image-bfl-flux-2-flex', ['src/cli/create-cli.ts', 'image', 'A tiny blue square on a white background', '--provider', 'bfl=flux-2-flex', '--size', '64x64', '--format', 'jpeg', '--price']),
  ]),
]
