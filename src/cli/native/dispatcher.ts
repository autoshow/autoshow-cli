import * as l from '~/utils/logger'
import { reconfigureLogger, runWithLogContext } from '~/utils/logger'
import { configureCacheDir } from '~/utils/process-lock'
import { configureYtDlpAuth } from '~/cli/commands/process-steps/step-1-download/audio/yt-dlp-options'
import { configureModelPath } from '~/cli/commands/process-steps/step-3-write/write-local/llama/llama-config'
import type {
  CliCommandDefinition,
  CliCommandContext,
  CliRootDefinition
} from './types'
import { parseNativeCli } from './parser'
import { renderCommandHelp, renderRootHelp } from './help-renderer'
import { NativeUnknownFlagError } from './errors'

const formatVersion = (version: string): string =>
  version.startsWith('v') ? version : `v${version}`

export const dispatchNativeCli = async (
  argv: string[],
  root: CliRootDefinition,
  commands: readonly CliCommandDefinition[]
): Promise<void> => {
  const parsed = parseNativeCli(argv, commands, root.globalFlags)

  if (parsed.mode === 'help') {
    if (parsed.argv.length === 0) {
      console.log('No command specified. Showing help:\n')
    }
    if (parsed.command) {
      console.log(renderCommandHelp(root, parsed.command))
      return
    }
    console.log(renderRootHelp(root, commands))
    return
  }

  if (parsed.mode === 'version') {
    console.log(formatVersion(root.version))
    return
  }

  const command = parsed.command
  if (command === undefined) {
    return
  }

  const unknownFlags = Object.keys(parsed.rawParsed.unknown)
  if (!command.allowUnknownFlags && unknownFlags.length > 0) {
    throw new NativeUnknownFlagError(unknownFlags)
  }

  reconfigureLogger({
    verbose: parsed.flags['verbose'] === true,
    quiet: parsed.flags['quiet'] === true,
    json: parsed.flags['json'] === true
  })

  const cacheDir = typeof parsed.flags['cache-dir'] === 'string' ? parsed.flags['cache-dir'] : undefined
  const cookies = typeof parsed.flags['cookies'] === 'string' ? parsed.flags['cookies'] : undefined
  const cookiesFromBrowser = typeof parsed.flags['cookies-from-browser'] === 'string' ? parsed.flags['cookies-from-browser'] : undefined
  const modelPath = typeof parsed.flags['model-path'] === 'string' ? parsed.flags['model-path'] : undefined

  if (cacheDir) configureCacheDir(cacheDir)
  if (cookies || cookiesFromBrowser) configureYtDlpAuth({ ...(cookies ? { cookies } : {}), ...(cookiesFromBrowser ? { cookiesFromBrowser } : {}) })
  if (modelPath) configureModelPath(modelPath)

  const store: Record<string, unknown> = { startedAtMs: Date.now() }
  const ctx: CliCommandContext = {
    argv: parsed.argv,
    ...(parsed.calledAs ? { calledAs: parsed.calledAs } : {}),
    command,
    flags: parsed.flags,
    parameters: parsed.parameters,
    rawParsed: parsed.rawParsed,
    store
  }

  await runWithLogContext({ command: parsed.calledAs ?? command.name }, async () => {
    await command.handler(ctx)
  })

  const startedAtMs = store['startedAtMs']
  if (typeof startedAtMs === 'number') {
    const elapsedMs = Date.now() - startedAtMs
    l.debug(`Command "${parsed.calledAs ?? command.name}" completed in ${elapsedMs}ms`)
  }
}
