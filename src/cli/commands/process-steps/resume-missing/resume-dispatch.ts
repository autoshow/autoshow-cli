import * as l from '~/logger'
import type { ProcessCommand, RuntimeOptions } from '~/types'
import { canonicalizeProcessCommand } from '../process-command-kinds'
import { CLIUsageError } from '~/utils/error-handler'
import { getResumeAdapter } from './resume-registry'

export const dispatchResumeMissing = async (
  command: ProcessCommand,
  target: string | undefined,
  opts: RuntimeOptions,
  explicitFlags: Set<string>,
  doubleDash: string[] = [],
  maxCents?: number
): Promise<void> => {
  const displayCommand = canonicalizeProcessCommand(command)
  const adapter = getResumeAdapter(command)
  if (!adapter) {
    throw CLIUsageError(`--resume-missing is not supported with "${displayCommand}".`)
  }

  if ((typeof target === 'string' && target.length > 0) || doubleDash.length > 0) {
    throw CLIUsageError('--resume-missing does not accept a positional input.')
  }
  if (opts.price) {
    throw CLIUsageError('--resume-missing does not support --price.')
  }
  if (maxCents !== undefined) {
    l.warn('Skipping budget preflight for --resume-missing')
  }

  const resumeBatchDir = await adapter.resolveBatchDir(opts.resumeMissing, opts, explicitFlags)
  if (opts.resumeMissing === undefined) {
    l.info(`Auto-discovered resumable ${adapter.command.toUpperCase()} batch: ${resumeBatchDir}`)
  }

  await adapter.resume(resumeBatchDir, opts, explicitFlags)
}
