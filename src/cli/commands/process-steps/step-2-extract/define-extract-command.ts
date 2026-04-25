import { defineCommand } from 'clerc'
import { ocrCommandFlags, sttFlags } from '~/cli/flags'
import { handleProcessTarget } from '~/cli/commands/process-steps/step-1-download/targets/handle-process-target'
import { validateEpubInspectCommandFlags } from './step-2-ocr/command-validation'

const inputParameter = [{ key: '[input]', description: 'URL, local file, directory, URL list (.md/.txt), or X Space link' }] as const

const extractFlags = {
  ...sttFlags,
  ...ocrCommandFlags
} as const

export const extractCommand = defineCommand({
  name: 'extract',
  description: 'Route media to STT and documents/articles/images to text extraction',
  parameters: inputParameter,
  flags: extractFlags,
  help: {
    examples: [
      ['bun as extract https://youtube.com/watch?v=abc', 'Transcribe media with the default Whisper tiny STT model'],
      ['bun as extract file.mp3 --assemblyai-stt universal-3-pro', 'Transcribe media with AssemblyAI STT'],
      ['bun as extract document.pdf --mistral-ocr mistral-ocr-2512', 'Extract text from a document with Mistral OCR'],
      ['bun as extract article.html --url-backend glm-reader', 'Extract article text from HTML inputs'],
      ['bun as extract ./input/examples/batch/2-urls.md --batch-all', 'Process every routed item from a mixed input list'],
      ['bun as extract https://x.com/i/spaces/1DXxyRYNejbKM', 'Extract X Space metadata via the X API']
    ]
  }
}, async (ctx) => {
  validateEpubInspectCommandFlags(ctx)
  await handleProcessTarget('extract', ctx.parameters.input, ctx.flags, ctx.rawParsed.doubleDash)
})
