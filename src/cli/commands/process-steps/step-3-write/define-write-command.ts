import { defineCliCommand } from '~/cli/native'
import { writeFlags } from '~/cli/flags'
import { handleProcessTarget } from '~/cli/commands/process-steps/step-1-download/targets/handle-process-target'
import { validateEpubInspectCommandFlags } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/command-validation'

const inputParameter = [{ key: '[input]', description: 'URL, local file, directory, or URL list (.md/.txt)' }] as const

export const writeCommand = defineCliCommand({
  name: 'write',
  description: 'Run the write pipeline for media, documents, or raw text inputs',
  parameters: inputParameter,
  flags: writeFlags,
  help: {
    examples: [
      ['bun as write https://youtube.com/watch?v=abc', 'Full pipeline with default local models'],
      ['bun as write video.mp4 --llm openai --prompt shortSummary longSummary', 'Summarize with OpenAI'],
      ['bun as write video.mp4 --stt deepgram --llm openai --prompt shortSummary longSummary', 'Transcribe with Deepgram STT, then summarize with OpenAI'],
      ['bun as write input/examples/batch/2-urls.md --llm gemini --batch-all --price', 'Estimate cost for a batch'],
      ['bun as write input/examples/document/1-epub.epub --epub-bun --llm llama --format json', 'Inspect EPUB structure, then summarize it with the default local llama model'],
      ['bun as write ./output/demo/text --prompt rockSong', 'Generate lyric drafts from project text into ./output/demo/lyrics'],
      ['bun as write ./output/demo/text/01-track-one.md --llm openai=gpt-5.4 --prompt folkSong', 'Generate one project lyric draft with a hosted LLM']
    ]
  }
}, async (ctx) => {
  validateEpubInspectCommandFlags(ctx)
  await handleProcessTarget('write', ctx.parameters.input, ctx.flags, ctx.rawParsed.doubleDash)
})
