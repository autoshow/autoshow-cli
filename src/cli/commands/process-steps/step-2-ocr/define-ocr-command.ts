import { defineCommand } from 'clerc'
import { extractCommandFlags } from '~/cli/flags'
import { handleProcessTarget } from '~/cli/commands/process-steps/step-1-download/targets/handle-process-target'
import { validateEpubInspectCommandFlags } from './command-validation'

const inputParameter = [{ key: '[input]', description: 'URL, local file, directory, or URL list (.md/.txt)' }] as const

export const ocrCommand = defineCommand({
  name: 'ocr',
  description: 'Extract text from PDF, EPUB, and image files',
  parameters: inputParameter,
  flags: extractCommandFlags,
  help: {
    examples: [
      ['bun as ocr document.pdf', 'Extract text from PDF with Tesseract'],
      ['bun as ocr document.pdf --mistral-ocr mistral-ocr-2512', 'Extract with Mistral OCR API'],
      ['bun as ocr document.pdf --glm-ocr glm-ocr', 'Extract with GLM OCR API'],
      ['bun as ocr document.pdf --openai-ocr gpt-5.4-nano', 'Extract with OpenAI OCR API'],
      ['bun as ocr document.pdf --anthropic-ocr claude-haiku-4-5', 'Extract with Anthropic OCR API'],
      ['bun as ocr document.pdf --gemini-ocr gemini-3.1-flash-lite-preview', 'Extract with Gemini OCR API'],
      ['bun as ocr book.epub --lang eng+fra', 'Extract from EPUB with multilingual OCR'],
      ['bun as ocr ./input/examples/batch/2-urls.md --batch-all', 'Extract every URL from a batch input file']
    ]
  }
}, async (ctx) => {
  validateEpubInspectCommandFlags(ctx)
  await handleProcessTarget('ocr', ctx.parameters.input, ctx.flags, ctx.rawParsed.doubleDash)
})
