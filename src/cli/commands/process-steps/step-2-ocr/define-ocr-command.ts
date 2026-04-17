import { defineCommand } from 'clerc'
import { extractCommandFlags } from '~/cli/flags'
import { handleProcessTarget } from '~/cli/commands/process-steps/step-1-download/targets/handle-process-target'
import { extractExplicitFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { CLIUsageError } from '~/utils/error-handler'

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
      ['bun as ocr book.epub --lang eng+fra', 'Extract from EPUB with multilingual OCR']
    ]
  }
}, async (ctx) => {
  const epubInspectCount = [ctx.flags['epub-bun'], ctx.flags['epub-calibre']].filter(Boolean).length
  if (epubInspectCount > 1) {
    throw CLIUsageError('Cannot use both EPUB inspect engines at the same time (--epub-bun, --epub-calibre)')
  }

  const explicitFlags = extractExplicitFlags(Bun.argv.slice(2))
  const outWasExplicitlyProvided = explicitFlags.has('out')

  if (epubInspectCount > 0 && outWasExplicitlyProvided && ctx.flags.out !== 'json') {
    throw CLIUsageError('EPUB inspect mode supports JSON output only. Use --out json with --epub-bun or --epub-calibre.')
  }

  await handleProcessTarget('ocr', ctx.parameters.input, ctx.flags, ctx.rawParsed.doubleDash)
})
