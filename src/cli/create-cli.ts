import { Clerc, defaultFormatters, helpPlugin, versionPlugin } from 'clerc'
import { configCommand } from './commands/setup-and-utilities/config/define-config-command'
import { cacheCommand } from './commands/setup-and-utilities/cache/define-cache-command'
import { metadataCommand } from '~/cli/commands/process-steps/step-0-metadata/define-metadata-command'
import { downloadCommand } from '~/cli/commands/process-steps/step-1-download/define-download-command'
import { extractCommand } from '~/cli/commands/process-steps/step-2-extract/define-extract-command'
import { writeCommand } from '~/cli/commands/process-steps/step-3-write/define-write-command'
import { resumeCommand } from '~/cli/commands/process-steps/resume/define-resume-command'
import { ttsCommand } from '~/cli/commands/process-steps/step-4-tts/define-tts-command'
import { imageCommand } from '~/cli/commands/process-steps/step-5-image/define-image-command'
import { musicCommand } from '~/cli/commands/process-steps/step-7-music/define-music-command'
import { videoCommand } from '~/cli/commands/process-steps/step-6-video/define-video-command'
import { lyricsCommand } from '~/cli/commands/process-steps/step-8-lyrics/define-lyrics-command'
import { setupCommand } from '~/cli/commands/setup-and-utilities/setup/define-setup-command'
import { installProcessFailureHandlers } from '~/cli/failure-handlers'
import { CONFIG_COMMAND_HELP_FLAG_GROUPS } from '~/cli/flags'
import { normalizeStep2ArgvAliases } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { CLIUsageError, isUsageError, normalizeExitCode, usageMessage } from '~/utils/error-handler'
import { linksCommand } from '~/cli/commands/setup-and-utilities/links/define-links-command'
import * as l from '~/utils/logger'
import { runWithLogContext, reconfigureLogger } from '~/utils/logger'
import {
  knownCommands,
  formatInput,
  validateSttFlagCompatibility
} from '~/cli/argv-normalize'
import { maybeThrowDeprecatedProcessCommand } from '~/cli/commands/process-steps/step-2-extract/extract-migration'
import type { HelpCommandGroupKey } from '~/types'
import {
  colorText,
  colorizeHelpDescription,
  colorizeHelpFlagGroups,
  colorizeFlagDescriptions,
  withPatchedHelpConsole,
  shouldPatchHelpConsole,
  helpColorsEnabled,
  HELP_TYPE_COLOR,
  HELP_DEFAULT_VALUE_COLOR_NAME
} from '~/cli/help-colors'

const cliErrorHandler = (error: unknown): void => {
  if (isUsageError(error)) {
    l.error(`Usage error: ${usageMessage(error)}`)
    process.exit(2)
  }

  const exitCode = normalizeExitCode(error)
  l.error('Command failed', error)

  const ERROR_HINTS: Record<string, string> = {
    'yt-dlp': "Run 'bun as setup' to install yt-dlp and other dependencies",
    'Google Cloud CLI is required for Google transcription': "Run 'bun as setup --gcloud' to verify gcloud installation, auth, project, billing, and Speech-to-Text API access",
    'Google Cloud CLI auth is required for Google transcription': "Run 'bun as setup --gcloud' to verify gcloud installation, auth, project, billing, and Speech-to-Text API access",
    'Google Cloud project is required for Google transcription': "Run 'bun as setup --gcloud' to verify gcloud installation, auth, project, billing, and Speech-to-Text API access",
    'Google Cloud billing must be linked': "Run 'bun as setup --gcloud --gcloud-project PROJECT_ID' to create or select a project, link billing, and enable Speech-to-Text",
    'Google Cloud Speech-to-Text API must be enabled': "Run 'bun as setup --gcloud' to verify gcloud installation, auth, project, billing, and Speech-to-Text API access",
    'AWS CLI is required for AWS transcription': "Run 'bun as setup --aws' to verify AWS CLI installation, auth, region, and auto-create/save S3 staging when missing",
    'AWS CLI credentials are required for AWS transcription': "Run 'bun as setup --aws' to verify AWS CLI installation, auth, region, and auto-create/save S3 staging when missing",
    'AWS region is required for AWS transcription': "Run 'bun as setup --aws' to verify AWS CLI installation, auth, region, and auto-create/save S3 staging when missing",
    'AWS S3 bucket is required for AWS transcription': "Run 'bun as setup --aws' to auto-create and save an S3 staging bucket when none is configured, or use 'bun as config --aws-region ... --aws-bucket ... --aws-stt standard'",
    'OPENAI_API_KEY': 'Set OPENAI_API_KEY environment variable to use OpenAI models',
    'GEMINI_API_KEY': 'Set GEMINI_API_KEY environment variable to use Gemini models',
    'GROQ_API_KEY': 'Set GROQ_API_KEY environment variable to use Groq models',
    'DEEPINFRA_API_KEY': 'Set DEEPINFRA_API_KEY environment variable to use DeepInfra transcription',
    'DEAPI_API_KEY': 'Set DEAPI_API_KEY environment variable to use deAPI transcription and exact STT pricing',
    'ANTHROPIC_API_KEY': 'Set ANTHROPIC_API_KEY environment variable to use Anthropic Claude models',
    'MINIMAX_API_KEY': 'Set MINIMAX_API_KEY environment variable to use MiniMax models',
    'ELEVENLABS_API_KEY': 'Set ELEVENLABS_API_KEY environment variable to use ElevenLabs transcription/TTS/music',
    'SPEECHMATICS_API_KEY': 'Set SPEECHMATICS_API_KEY environment variable to use Speechmatics transcription',
    'REVAI_ACCESS_TOKEN': 'Set REVAI_ACCESS_TOKEN environment variable to use Rev transcription',
    'GLADIA_API_KEY': 'Set GLADIA_API_KEY environment variable to use Gladia transcription',
    'HAPPYSCRIBE_API_KEY': 'Set HAPPYSCRIBE_API_KEY environment variable to use Happy Scribe transcription',
    'SUPADATA_API_KEY': 'Set SUPADATA_API_KEY environment variable to use Supadata transcription'
  }

  if (error instanceof Error) {
    for (const [needle, hint] of Object.entries(ERROR_HINTS)) {
      if (error.message.includes(needle)) {
        l.write('info', hint)
      }
    }
  }

  process.exit(exitCode)
}

const CLI_VERSION = (await import('../../package.json')).version as string

const HELP_COMMAND_GROUPS = [
  ['core', 'Core Commands'],
  ['setup', 'Setup & Utilities'],
  ['processing', 'Processing & Generation']
] as const

const HELP_COMMAND_GROUP_DEFINITIONS: [string, string][] = HELP_COMMAND_GROUPS.map(([key, label]) => [key, label])

const HELP_COMMAND_GROUP_BY_NAME: Readonly<Record<string, HelpCommandGroupKey>> = {
  version: 'core',
  help: 'core',
  config: 'setup',
  cache: 'setup',
  setup: 'setup',
  links: 'setup',
  metadata: 'processing',
  download: 'processing',
  extract: 'processing',
  resume: 'processing',
  write: 'processing',
  tts: 'processing',
  image: 'processing',
  music: 'processing',
  video: 'processing',
  lyrics: 'processing'
}

const COMMAND_DEFINITIONS = [
  configCommand,
  cacheCommand,
  setupCommand,
  linksCommand,
  metadataCommand,
  downloadCommand,
  extractCommand,
  resumeCommand,
  writeCommand,
  ttsCommand,
  imageCommand,
  musicCommand,
  videoCommand,
  lyricsCommand
] as const

const setCommandHelpGroup = (command: unknown, group: HelpCommandGroupKey): void => {
  if (typeof command !== 'object' || command === null) {
    return
  }

  const commandDefinition = command as { help?: Record<string, unknown> }
  const existingHelp = commandDefinition.help
  commandDefinition.help = {
    ...(typeof existingHelp === 'object' && existingHelp !== null && !Array.isArray(existingHelp) ? existingHelp : {}),
    group
  }
}

const applyCommandHelpGroups = (): void => {
  for (const command of COMMAND_DEFINITIONS) {
    const group = HELP_COMMAND_GROUP_BY_NAME[command.name]
    if (group !== undefined) {
      setCommandHelpGroup(command, group)
    }
  }
}

applyCommandHelpGroups()

let helpDescriptionColorsApplied = false
const applyUniversalHelpDescriptionColors = (): void => {
  if (!helpColorsEnabled || helpDescriptionColorsApplied) {
    return
  }

  for (const command of COMMAND_DEFINITIONS) {
    colorizeFlagDescriptions(command.flags as Record<string, unknown> | undefined)
  }

  helpDescriptionColorsApplied = true
}

const createCli = () => {
  applyUniversalHelpDescriptionColors()

  const cli = Clerc.create({
    name: 'AutoShow CLI',
    scriptName: 'bun as',
    description: 'Process audio/video and documents with transcription, extraction, and write workflows',
    version: CLI_VERSION
  })
    .use(versionPlugin())
    .use(helpPlugin({
      groups: {
        commands: HELP_COMMAND_GROUP_DEFINITIONS,
        flags: colorizeHelpFlagGroups(CONFIG_COMMAND_HELP_FLAG_GROUPS)
      },
      formatters: {
        formatTypeValue: (type): string => {
          const formattedType = defaultFormatters.formatTypeValue(type)
          return colorText(formattedType, HELP_TYPE_COLOR)
        },
        formatFlagDefault: <T>(value: T): string => {
          const formattedValue = defaultFormatters.formatFlagDefault(value)
          return colorText(formattedValue, HELP_DEFAULT_VALUE_COLOR_NAME)
        }
      }
    }))

  for (const commandName of ['version', 'help'] as const) {
    const registeredCommand = cli._commands.get(commandName)
    const group = HELP_COMMAND_GROUP_BY_NAME[commandName]
    if (registeredCommand && group !== undefined) {
      setCommandHelpGroup(registeredCommand, group)
    }
  }

  return cli
    .interceptor({ enforce: 'pre', handler: async (ctx, next) => {
      const unknownFlags = Object.keys(
        ((ctx.rawParsed as { unknown?: Record<string, unknown> } | undefined)?.unknown) ?? {}
      )

      if (ctx.command?.name !== 'links' && unknownFlags.length > 0) {
        throw CLIUsageError(
          unknownFlags.length === 1
            ? `Unexpected flag: ${unknownFlags[0]}`
            : `Unexpected flags: ${unknownFlags.join(', ')}`
        )
      }

      await next()
    }})
    .globalFlag('help', colorizeHelpDescription('Show help'), {
      short: 'h',
      type: Boolean,
      default: false,
      negatable: false
    })
    .globalFlag('version', colorizeHelpDescription('Print current version'), {
      short: 'v',
      type: Boolean,
      default: false,
      negatable: false
    })
    .globalFlag('config-path', colorizeHelpDescription('Path to config file (default: config/autoshow.json in project root)'), {
      type: String
    })
    .globalFlag('allow-over-budget', colorizeHelpDescription('Continue even if cost estimate exceeds the configured budget limit'), {
      type: Boolean,
      default: false,
      negatable: false
    })
    .globalFlag('verbose', colorizeHelpDescription('Enable debug-level logging (overrides AUTOSHOW_LOG_LEVEL)'), {
      type: Boolean,
      default: false,
      negatable: false
    })
    .globalFlag('quiet', colorizeHelpDescription('Suppress all output except errors (overrides AUTOSHOW_LOG_LEVEL)'), {
      short: 'q',
      type: Boolean,
      default: false,
      negatable: false
    })
    .globalFlag('json', colorizeHelpDescription('Output logs as JSON (overrides AUTOSHOW_LOG_FORMAT)'), {
      type: Boolean,
      default: false,
      negatable: false
    })
    .command(COMMAND_DEFINITIONS)
    .interceptor({ enforce: 'pre', handler: async (ctx, next) => {
      const flags = ctx.flags as Record<string, unknown>
      reconfigureLogger({
        verbose: flags['verbose'] === true,
        quiet: flags['quiet'] === true,
        json: flags['json'] === true
      })
      const store = ctx.store as { startedAtMs?: number }
      store.startedAtMs = Date.now()
      const command = ctx.calledAs || ctx.command?.name || '(root)'
      await runWithLogContext({ command }, async () => {
        await next()
      })
    }})
    .interceptor({ enforce: 'post', handler: async (ctx, next) => {
      await next()

      const store = ctx.store as { startedAtMs?: number }
      const startedAtMs = store.startedAtMs
      if (typeof startedAtMs !== 'number' || !ctx.command) {
        return
      }

      if (ctx.command.name === 'help' || ctx.command.name === 'version') {
        return
      }

      const elapsedMs = Date.now() - startedAtMs
      const commandName = ctx.calledAs || ctx.command.name || '(root)'
      l.debug(`Command "${commandName}" completed in ${elapsedMs}ms`)
    }})
    .errorHandler(cliErrorHandler)
}

const main = async (): Promise<void> => {
  const argv = normalizeStep2ArgvAliases(Bun.argv.slice(2))
  maybeThrowDeprecatedProcessCommand(argv)
  validateSttFlagCompatibility(argv)
  const parseCli = async (parseArgv: string[]): Promise<void> => {
    if (shouldPatchHelpConsole(parseArgv)) {
      await withPatchedHelpConsole(async () => {
        await createCli().parse({ argv: parseArgv })
      })
      return
    }
    await createCli().parse({ argv: parseArgv })
  }

  if (argv.length > 0) {
    const [first, ...rest] = argv

    if (first === '--help' || first === '-h') {
      if (rest.length === 0) {
        await parseCli(['help'])
        return
      }
    }

    if (first === '--version' || first === '-v' || first === '-V') {
      if (rest.length === 0) {
        await parseCli(['--version'])
        return
      }
    }

    if (first !== '--' && first!.startsWith('-')) {
      const maybeCommand = rest.find(token => knownCommands.has(token))
      const canonicalCommand = maybeCommand && knownCommands.has(maybeCommand) ? maybeCommand : null
      if (canonicalCommand) {
        throw CLIUsageError(`Unsupported argument order: "${formatInput(argv)}". Use: bun as ${canonicalCommand} <input> [flags]`)
      }

      throw CLIUsageError(`Unsupported argument order: "${formatInput(argv)}". Use: bun as <command> [parameters] [flags]`)
    }
  }

  await parseCli(argv)
}

installProcessFailureHandlers()

try {
  await main()
} catch (error) {
  cliErrorHandler(error)
}
