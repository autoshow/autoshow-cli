import { configCommand } from './commands/setup-and-utilities/config/define-config-command'
import { cacheCommand } from './commands/setup-and-utilities/cache/define-cache-command'
import { metadataCommand } from '~/cli/commands/process-steps/step-0-metadata/define-metadata-command'
import { downloadCommand } from '~/cli/commands/process-steps/step-1-download/define-download-command'
import { extractCommand } from '~/cli/commands/process-steps/step-2-extract/define-extract-command'
import { writeCommand } from '~/cli/commands/process-steps/step-3-write/define-write-command'
import { resumeCommand } from '~/cli/commands/process-steps/resume/define-resume-command'
import { ttsCommand } from '~/cli/commands/process-steps/step-4-tts/define-tts-command'
import { imageCommand } from '~/cli/commands/process-steps/step-5-image/define-image-command'
import { videoCommand } from '~/cli/commands/process-steps/step-6-video/define-video-command'
import { musicCommand } from '~/cli/commands/process-steps/step-7-music/define-music-command'
import { comicCommand } from '~/cli/commands/process-steps/step-8-comic/define-comic-command'
import { setupCommand } from '~/cli/commands/setup-and-utilities/setup/define-setup-command'
import { sockCommand } from '~/cli/commands/setup-and-utilities/sock/define-sock-command'
import { installProcessFailureHandlers } from '~/cli/failure-handlers'
import { CONFIG_COMMAND_HELP_FLAG_GROUPS } from '~/cli/flags'
import { extractErrorHints, isUsageError, normalizeExitCode, usageMessage } from '~/utils/error-handler'
import { linksCommand } from '~/cli/commands/setup-and-utilities/links/define-links-command'
import { benchmarkCommand } from '~/cli/commands/setup-and-utilities/benchmark/define-benchmark-command'
import * as l from '~/utils/logger'
import type { HelpCommandGroupKey } from '~/types'
import {
  colorizeHelpDescription,
  colorizeFlagDescriptions,
  colorizeHelpFlagGroups,
  helpColorsEnabled
} from '~/cli/help-colors'
import { dispatchNativeCli } from '~/cli/native'
import type { CliFlagsDefinition, CliRootDefinition } from '~/cli/native'

const cliErrorHandler = (error: unknown): void => {
  if (isUsageError(error)) {
    l.error(`Usage error: ${usageMessage(error)}`)
    for (const hint of extractErrorHints(error)) {
      l.write('info', hint)
    }
    process.exit(2)
  }

  const exitCode = normalizeExitCode(error)
  l.error('Command failed', error)

  for (const hint of extractErrorHints(error)) {
    l.write('info', hint)
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
  sock: 'setup',
  links: 'setup',
  resume: 'setup',
  metadata: 'processing',
  download: 'processing',
  extract: 'processing',
  write: 'processing',
  tts: 'processing',
  image: 'processing',
  video: 'processing',
  music: 'processing',
  comic: 'processing',
  benchmark: 'setup'
}

const COMMAND_DEFINITIONS = [
  configCommand,
  cacheCommand,
  setupCommand,
  sockCommand,
  linksCommand,
  metadataCommand,
  downloadCommand,
  extractCommand,
  resumeCommand,
  writeCommand,
  ttsCommand,
  imageCommand,
  videoCommand,
  musicCommand,
  comicCommand,
  benchmarkCommand
] as const

const GLOBAL_FLAG_DEFINITIONS = {
  help: {
    description: colorizeHelpDescription('Show help'),
    short: 'h',
    type: Boolean,
    default: false,
    negatable: false
  },
  version: {
    description: colorizeHelpDescription('Print current version'),
    short: 'v',
    type: Boolean,
    default: false,
    negatable: false
  },
  'config-path': {
    description: colorizeHelpDescription('Path to config file (default: config/autoshow.json in project root)'),
    type: String
  },
  'allow-over-budget': {
    description: colorizeHelpDescription('Continue even if cost estimate exceeds the configured budget limit'),
    type: Boolean,
    default: false,
    negatable: false
  },
  verbose: {
    description: colorizeHelpDescription('Enable debug-level logging (overrides AUTOSHOW_LOG_LEVEL)'),
    type: Boolean,
    default: false,
    negatable: false
  },
  quiet: {
    description: colorizeHelpDescription('Suppress all output except errors (overrides AUTOSHOW_LOG_LEVEL)'),
    short: 'q',
    type: Boolean,
    default: false,
    negatable: false
  },
  json: {
    description: colorizeHelpDescription('Output logs as JSON (overrides AUTOSHOW_LOG_FORMAT)'),
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

const createNativeRootDefinition = (): CliRootDefinition => ({
  name: 'AutoShow CLI',
  scriptName: 'bun as',
  description: 'Process audio/video and documents with transcription, extraction, and write workflows',
  version: CLI_VERSION,
  globalFlags: GLOBAL_FLAG_DEFINITIONS,
  commandGroups: HELP_COMMAND_GROUP_DEFINITIONS,
  flagGroups: colorizeHelpFlagGroups(CONFIG_COMMAND_HELP_FLAG_GROUPS)
})

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

const main = async (): Promise<void> => {
  applyUniversalHelpDescriptionColors()
  const argv = Bun.argv.slice(2)
  await dispatchNativeCli(argv, createNativeRootDefinition(), COMMAND_DEFINITIONS)
}

installProcessFailureHandlers()

try {
  await main()
} catch (error) {
  cliErrorHandler(error)
}
