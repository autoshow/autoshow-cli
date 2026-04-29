import type { PriceSelectionEntry } from '~/types'
import { command, exact, reportOnly } from '../helpers'

export const ocrRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts', [
    command('extract-mistral-mistral-ocr-2512', 'extract-mistral-mistral-ocr-2512', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--mistral-ocr', 'mistral-ocr-2512', '--price']),
    command('extract-glm-glm-ocr', 'extract-glm-glm-ocr', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--glm-ocr', 'glm-ocr', '--price']),
    command('extract-openai-gpt-5.4-nano', 'extract-openai-gpt-5.4-nano', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--openai-ocr', 'gpt-5.4-nano', '--price']),
    command('extract-anthropic-claude-haiku-4-5', 'extract-anthropic-claude-haiku-4-5', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--anthropic-ocr', 'claude-haiku-4-5', '--price']),
    command('extract-gemini-gemini-3.1-flash-lite-preview', 'extract-gemini-gemini-3.1-flash-lite-preview', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--gemini-ocr', 'gemini-3.1-flash-lite-preview', '--price']),
    command('extract-deepinfra-olmocr-2-7b-1025', 'extract-deepinfra-olmocr-2-7b-1025', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--deepinfra-ocr', 'allenai/olmOCR-2-7B-1025', '--price']),
    command('extract-deepinfra-paddleocr-vl-0.9b', 'extract-deepinfra-paddleocr-vl-0.9b', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--deepinfra-ocr', 'PaddlePaddle/PaddleOCR-VL-0.9B', '--price']),
    command('extract-deepinfra-qwen3-vl-235b-a22b-instruct', 'extract-deepinfra-qwen3-vl-235b-a22b-instruct', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--deepinfra-ocr', 'Qwen/Qwen3-VL-235B-A22B-Instruct', '--price']),
    command('extract-deepinfra-qwen3-vl-30b-a3b-instruct', 'extract-deepinfra-qwen3-vl-30b-a3b-instruct', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--deepinfra-ocr', 'Qwen/Qwen3-VL-30B-A3B-Instruct', '--price']),
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
