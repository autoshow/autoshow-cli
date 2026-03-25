import { defineCommand } from 'clerc'
import { metadataFlags } from '~/cli/flags'
import { handleProcessTarget } from '~/cli/commands/process-steps/step-1-download/targets/handle-process-target'

const inputParameter = [{ key: '[input]', description: 'URL, local file, directory, or URL list (.md/.txt)' }] as const

export const metadataCommand = defineCommand({
  name: 'metadata',
  description: 'Collect and display metadata for media or document without downloading',
  parameters: inputParameter,
  flags: metadataFlags
}, async (ctx) => {
  await handleProcessTarget('metadata', ctx.parameters.input, ctx.flags, ctx.rawParsed.doubleDash)
})
