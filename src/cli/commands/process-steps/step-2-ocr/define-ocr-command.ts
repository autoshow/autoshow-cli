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
      ['bun as ocr document.pdf --mistral-ocr mistral-ocr-latest', 'Extract with Mistral OCR API'],
      ['bun as ocr document.pdf --glm-ocr glm-ocr', 'Extract with GLM OCR API'],
      ['bun as ocr book.epub --lang eng+fra', 'Extract from EPUB with multilingual OCR']
    ]
  }
}, async (ctx) => {
  const ocrEngineCount = [
    ctx.flags['ocrmypdf'] === true,
    ctx.flags['paddle-ocr'] === true,
    typeof ctx.flags['mistral-ocr'] === 'string',
    typeof ctx.flags['glm-ocr'] === 'string'
  ].filter(Boolean).length

  if (ocrEngineCount > 1 && ctx.flags['price'] !== true && ctx.flags['dry-run'] !== true) {
    throw CLIUsageError('Use at most one standalone OCR engine flag at a time (--ocrmypdf, --paddle-ocr, --mistral-ocr, --glm-ocr).')
  }

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
