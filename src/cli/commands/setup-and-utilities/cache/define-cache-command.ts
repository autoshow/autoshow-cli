import { defineCommand } from 'clerc'
import * as l from '~/logger'
import { clearMediaCache, pruneMediaCache } from '~/cli/commands/process-steps/step-2-stt/media'
import { CLIUsageError } from '~/utils/error-handler'

const actionParameter = [{ key: '<action>', description: 'Cache action: prune or clear' }] as const

export const cacheCommand = defineCommand({
  name: 'cache',
  description: 'Manage the persistent STT media cache',
  parameters: actionParameter,
  help: {
    examples: [
      ['bun as cache prune', 'Prune expired or over-limit STT media cache entries'],
      ['bun as cache clear', 'Remove all STT media cache entries']
    ]
  }
}, async (ctx) => {
  const action = String(ctx.parameters.action || '').trim().toLowerCase()

  if (action === 'prune') {
    await pruneMediaCache()
    l.write('success', 'Cache prune complete')
    return
  }

  if (action === 'clear') {
    await clearMediaCache()
    l.write('success', 'Cache clear complete')
    return
  }

  throw CLIUsageError(`Unknown cache action "${action}". Use "prune" or "clear".`)
})
