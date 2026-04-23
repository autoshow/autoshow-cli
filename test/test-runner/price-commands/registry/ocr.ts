import type { PriceSelectionEntry } from '~/types'
import { command, exact, reportOnly } from '../helpers'

export const ocrRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts', [
    command('extract-mistral-mistral-ocr-2512', 'extract-mistral-mistral-ocr-2512', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--mistral-ocr', 'mistral-ocr-2512', '--price']),
    command('extract-glm-glm-ocr', 'extract-glm-glm-ocr', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--glm-ocr', 'glm-ocr', '--price']),
    command('extract-openai-gpt-5.4-nano', 'extract-openai-gpt-5.4-nano', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--openai-ocr', 'gpt-5.4-nano', '--price']),
    command('extract-anthropic-claude-haiku-4-5', 'extract-anthropic-claude-haiku-4-5', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--anthropic-ocr', 'claude-haiku-4-5', '--price']),
    command('extract-gemini-gemini-3.1-flash-lite-preview', 'extract-gemini-gemini-3.1-flash-lite-preview', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--gemini-ocr', 'gemini-3.1-flash-lite-preview', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts', [
    command('extract-firecrawl-url', 'extract-firecrawl-url', ['src/cli/create-cli.ts', 'extract', 'https://ajcwebdev.com', '--url-backend', 'firecrawl', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts', [
    reportOnly('extract-glm-reader-url', ['src/cli/create-cli.ts', 'extract', 'https://ajcwebdev.com', '--url-backend', 'glm-reader', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ocr-paddle-ocr-image.test.ts', [
    command('extract-paddle-ocr-image', 'extract-paddle-ocr-image', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--paddle-ocr', '--price']),
  ]),
]
