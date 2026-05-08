import { defineCommand } from 'clerc'
import { downloadFlags } from '~/cli/flags'
import { handleProcessTarget } from './targets/handle-process-target'

const inputParameter = [{ key: '[input]', description: 'URL, local file, directory, or URL list (.md/.txt)' }] as const

export const downloadCommand = defineCommand({
  name: 'download',
  description: 'Download media or document and collect metadata only',
  parameters: inputParameter,
  flags: downloadFlags,
  help: {
    examples: [
      ['bun as download https://youtube.com/watch?v=abc', 'Download audio from a URL'],
      ['bun as download input/examples/batch/2-urls.md --batch-limit 3', 'Download first 3 items from a URL list'],
      ['bun as download https://example.com/feed --batch-all --keep-original-media --flat-batch', 'Download all podcast episode files into one batch directory']
    ]
  }
}, async (ctx) => {
  await handleProcessTarget('download', ctx.parameters.input, ctx.flags, ctx.rawParsed.doubleDash)
})
