import { defineCommand } from 'clerc'
import { writeFlags } from '~/cli/flags'
import { handleProcessTarget } from '~/cli/commands/process-steps/step-1-download/targets/handle-process-target'

const inputParameter = [{ key: '[input]', description: 'URL, local file, directory, or URL list (.md/.txt)' }] as const

export const writeCommand = defineCommand({
  name: 'write',
  description: 'Download audio, transcribe, and run LLM summary pipeline',
  parameters: inputParameter,
  flags: writeFlags,
  help: {
    examples: [
      ['bun as write https://youtube.com/watch?v=abc', 'Full pipeline with default local models'],
      ['bun as write video.mp4 --openai --prompt summary', 'Summarize with OpenAI'],
      ['bun as write ./input/examples/document/2-urls.md --gemini --batch-all --price', 'Estimate cost for a batch']
    ]
  }
}, async (ctx) => {
  await handleProcessTarget('write', ctx.parameters.input, ctx.flags, ctx.rawParsed.doubleDash)
})
