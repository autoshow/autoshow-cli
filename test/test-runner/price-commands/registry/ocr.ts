import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const ocrRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/service-models.test.ts', [
    command('extract-mistral-mistral-ocr-2512', 'extract-mistral-mistral-ocr-2512', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'mistral=mistral-ocr-2512', '--price']),
    command('extract-glm-glm-ocr', 'extract-glm-glm-ocr', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'glm=glm-ocr', '--price']),
    command('extract-kimi-kimi-k2.6', 'extract-kimi-kimi-k2.6', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'kimi=kimi-k2.6', '--price']),
    command('extract-openai-gpt-5.4-nano', 'extract-openai-gpt-5.4-nano', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'openai=gpt-5.4-nano', '--price']),
    command('extract-anthropic-claude-haiku-4-5', 'extract-anthropic-claude-haiku-4-5', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'anthropic=claude-haiku-4-5', '--price']),
    command('extract-gemini-gemini-3.1-flash-lite-preview', 'extract-gemini-gemini-3.1-flash-lite-preview', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'gemini=gemini-3.1-flash-lite-preview', '--price']),
    command('extract-deepinfra-qwen3-vl-235b-a22b-instruct', 'extract-deepinfra-qwen3-vl-235b-a22b-instruct', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'deepinfra=Qwen/Qwen3-VL-235B-A22B-Instruct', '--price']),
    command('extract-deepinfra-qwen3-vl-30b-a3b-instruct', 'extract-deepinfra-Qwen/Qwen3-VL-30B-A3B-Instruct', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct', '--price']),
    command('extract-openai-gpt-5.5', 'extract-openai-gpt-5.5', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png', '--provider', 'openai=gpt-5.5', '--price']),
    command('extract-openai-gpt-5.4', 'extract-openai-gpt-5.4', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png', '--provider', 'openai=gpt-5.4', '--price']),
    command('extract-openai-gpt-5.4-mini', 'extract-openai-gpt-5.4-mini', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png', '--provider', 'openai=gpt-5.4-mini', '--price']),
    command('extract-grok-grok-4.3', 'extract-grok-grok-4.3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png', '--provider', 'grok=grok-4.3', '--price']),
    command('extract-anthropic-claude-opus-4-7', 'extract-anthropic-claude-opus-4-7', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png', '--provider', 'anthropic=claude-opus-4-7', '--price']),
    command('extract-anthropic-claude-sonnet-4-6', 'extract-anthropic-claude-sonnet-4-6', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png', '--provider', 'anthropic=claude-sonnet-4-6', '--price']),
    command('extract-gemini-gemini-3.1-pro-preview', 'extract-gemini-gemini-3.1-pro-preview', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png', '--provider', 'gemini=gemini-3.1-pro-preview', '--price']),
    command('extract-unstructured-hi_res_and_enrichment', 'extract-unstructured-hi_res_and_enrichment', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png', '--provider', 'unstructured=hi_res_and_enrichment', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ocr-supadata.test.ts', [
    command('extract-supadata-url', 'extract-supadata-url', ['src/cli/create-cli.ts', 'extract', 'https://ajcwebdev.com', '--url-provider', 'supadata', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts', [
    command('extract-firecrawl-url', 'extract-firecrawl-url', ['src/cli/create-cli.ts', 'extract', 'https://ajcwebdev.com', '--url-provider', 'firecrawl', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts', [
    command('extract-glm-reader-url', 'extract-glm-reader-url', ['src/cli/create-cli.ts', 'extract', 'https://ajcwebdev.com', '--url-provider', 'glm-reader', '--price']),
  ]),
  ...exact('test/test-cases/e2e/local/step-2-ocr-e2e/ocr-local/ocr-paddle-ocr-image.test.ts', [
    command('extract-paddle-ocr-image', 'extract-paddle-ocr-image', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'paddle', '--price']),
  ]),
]
