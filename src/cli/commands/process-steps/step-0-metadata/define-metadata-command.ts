import { defineCommand } from 'clerc'
import { metadataFlags } from '~/cli/flags'
import { handleProcessTarget } from '~/cli/commands/process-steps/step-1-download/targets/handle-process-target'

const inputParameter = [{ key: '[input]', description: 'URL, local file, directory, or URL list (.md/.txt)' }] as const

export const metadataCommand = defineCommand({
  name: 'metadata',
  description: 'Collect and display metadata for media or document without downloading',
  parameters: inputParameter,
  flags: metadataFlags,
  help: {
    examples: [
      ['bun as metadata https://youtube.com/watch?v=abc', 'Get metadata for a YouTube video'],
      ['bun as metadata ./input/examples/batch/2-urls.md --batch-all', 'Get metadata for all URLs in a file']
    ]
  }
}, async (ctx) => {
  await handleProcessTarget('metadata', ctx.parameters.input, ctx.flags, ctx.rawParsed.doubleDash)
})
