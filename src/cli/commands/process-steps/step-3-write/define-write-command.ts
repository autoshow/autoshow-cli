import { defineCommand } from 'clerc'
import { writeFlags } from '~/cli/flags'
import { handleProcessTarget } from '~/cli/commands/process-steps/step-1-download/targets/handle-process-target'
import { validateEpubInspectCommandFlags } from '~/cli/commands/process-steps/step-2-ocr/command-validation'

const inputParameter = [{ key: '[input]', description: 'URL, local file, directory, or URL list (.md/.txt)' }] as const

export const writeCommand = defineCommand({
  name: 'write',
  description: 'Run the write pipeline for media, documents, or raw text inputs',
  parameters: inputParameter,
  flags: writeFlags,
  help: {
    examples: [
      ['bun as write https://youtube.com/watch?v=abc', 'Full pipeline with default local models'],
      ['bun as write video.mp4 --openai --prompt summary', 'Summarize with OpenAI'],
      ['bun as write video.mp4 --gcloud-stt --openai --prompt summary', 'Transcribe with Google Cloud STT, then summarize with OpenAI'],
      ['bun as write ./input/examples/document/2-urls.md --gemini --batch-all --price', 'Estimate cost for a batch'],
      ['bun as write ./input/examples/document/1-epub.epub --epub-bun --llama --out json', 'Inspect EPUB structure, then summarize it with the default local llama model'],
      ['bun as write ./albums/demo/text --text-input --prompt rockSong --rendered-out-dir ./albums/demo/lyrics', 'Process raw text files into rendered song lyrics']
    ]
  }
}, async (ctx) => {
  validateEpubInspectCommandFlags(ctx)
  await handleProcessTarget('write', ctx.parameters.input, ctx.flags, ctx.rawParsed.doubleDash)
})
