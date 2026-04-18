import type { PriceSelectionEntry } from '../../../../src/types/tests-dir-types'
import { command, exact, reportOnly } from '../helpers'

export const ocrRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/step-2-ocr-e2e/ocr-services/service-models.test.ts', [
    command('extract-mistral-mistral-ocr-2512', 'extract-mistral-mistral-ocr-2512', ['src/cli/create-cli.ts', 'ocr', 'input/examples/document/1-document.pdf', '--mistral-ocr', 'mistral-ocr-2512', '--price']),
    command('extract-glm-glm-ocr', 'extract-glm-glm-ocr', ['src/cli/create-cli.ts', 'ocr', 'input/examples/document/1-document.pdf', '--glm-ocr', 'glm-ocr', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts', [
    command('extract-firecrawl-url', 'extract-firecrawl-url', ['src/cli/create-cli.ts', 'ocr', 'https://ajcwebdev.com', '--url-backend', 'firecrawl', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts', [
    reportOnly('extract-glm-reader-url', ['src/cli/create-cli.ts', 'ocr', 'https://ajcwebdev.com', '--url-backend', 'glm-reader', '--price']),
  ]),
  ...exact('test/test-cases/e2e/step-2-ocr-e2e/ocr-local/ocr-paddle-ocr-image.test.ts', [
    command('extract-paddle-ocr-image', 'extract-paddle-ocr-image', ['src/cli/create-cli.ts', 'ocr', 'input/examples/document/1-document.pdf', '--paddle-ocr', '--price']),
  ]),
]
