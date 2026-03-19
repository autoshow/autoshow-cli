import { defineCommand } from 'clerc'
import { transcribeFlags } from '~/cli/flags'
import { handleProcessTarget } from '~/cli/commands/process-steps/step-1-download/targets/handle-process-target'

const inputParameter = [{ key: '[input]', description: 'URL, local file, directory, or URL list (.md/.txt)' }] as const

export const transcribeCommand = defineCommand({
  name: 'transcribe',
  description: 'Download audio and transcribe only',
  parameters: inputParameter,
  flags: transcribeFlags
}, async (ctx) => {
  await handleProcessTarget('transcribe', ctx.parameters.input, ctx.flags, ctx.rawParsed.doubleDash)
})
