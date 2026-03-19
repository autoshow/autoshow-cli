import { defineCommand } from 'clerc'
import { writeFlags } from './flags'
import { handleProcessTarget } from '~/cli/commands/process-steps/step-1-download/targets/handle-process-target'

const inputParameter = [{ key: '[input]', description: 'URL, local file, directory, or URL list (.md/.txt)' }] as const

export const rootCommand = defineCommand({
  name: '',
  description: 'Default command (equivalent to write <input>)',
  parameters: inputParameter,
  flags: writeFlags
}, async (ctx) => {
  await handleProcessTarget('write', ctx.parameters.input, ctx.flags, ctx.rawParsed.doubleDash)
})
