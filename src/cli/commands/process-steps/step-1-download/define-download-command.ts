import { defineCommand } from 'clerc'
import { downloadFlags } from '~/cli/flags'
import { handleProcessTarget } from './targets/handle-process-target'

const inputParameter = [{ key: '[input]', description: 'URL, local file, directory, or URL list (.md/.txt)' }] as const

export const downloadCommand = defineCommand({
  name: 'download',
  description: 'Download media or document and collect metadata only',
  parameters: inputParameter,
  flags: downloadFlags
}, async (ctx) => {
  await handleProcessTarget('download', ctx.parameters.input, ctx.flags, ctx.rawParsed.doubleDash)
})
