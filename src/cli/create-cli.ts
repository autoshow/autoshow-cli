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
import { isUsageError, normalizeExitCode, usageMessage } from '~/utils/error-handler'
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
    'AWS CLI is required for AWS transcription': "Run 'bun as setup --aws' to verify AWS CLI installation, auth, region, and Transcribe access",
    'AWS CLI credentials are required for AWS transcription': "Run 'bun as setup --aws' to verify AWS CLI installation, auth, region, and Transcribe access",
    'AWS region is required for AWS transcription': "Run 'bun as setup --aws' to verify AWS CLI installation, auth, region, and Transcribe access",
    'AWS S3 bucket is required for AWS transcription': "Run 'bun as setup --aws --aws-create-bucket' to provision a staging bucket shared by Transcribe and Textract, then pass --aws-region/--aws-bucket or save them with 'bun as config --aws-region ... --aws-bucket ... --aws-stt standard'",
    'OPENAI_API_KEY': 'Set OPENAI_API_KEY environment variable to use OpenAI models',
    'GEMINI_API_KEY': 'Set GEMINI_API_KEY environment variable to use Gemini models',
    'GROQ_API_KEY': 'Set GROQ_API_KEY environment variable to use Groq models',
    'GLM_API_KEY': 'Set GLM_API_KEY environment variable to use GLM models',
    'DEEPINFRA_API_KEY': 'Set DEEPINFRA_API_KEY environment variable to use DeepInfra transcription',
    'DEAPI_API_KEY': 'Set DEAPI_API_KEY environment variable to use deAPI transcription and exact STT pricing',
    'ANTHROPIC_API_KEY': 'Set ANTHROPIC_API_KEY environment variable to use Anthropic Claude models',
    'MINIMAX_API_KEY': 'Set MINIMAX_API_KEY environment variable to use MiniMax models',
    'ELEVENLABS_API_KEY': 'Set ELEVENLABS_API_KEY environment variable to use ElevenLabs transcription/TTS/music',
    'SPEECHMATICS_API_KEY': 'Set SPEECHMATICS_API_KEY environment variable to use Speechmatics transcription',
    'REVAI_ACCESS_TOKEN': 'Set REVAI_ACCESS_TOKEN environment variable to use Rev transcription',
    'GLADIA_API_KEY': 'Set GLADIA_API_KEY environment variable to use Gladia transcription',
    'HAPPYSCRIBE_API_KEY': 'Set HAPPYSCRIBE_API_KEY environment variable to use Happy Scribe transcription',
    'SUPADATA_API_KEY': 'Set SUPADATA_API_KEY environment variable to use Supadata transcription',
    'SCRAPECREATORS_API_KEY': 'Set SCRAPECREATORS_API_KEY environment variable to use ScrapeCreators YouTube transcript retrieval'
  }

  if (error instanceof Error) {
    const emittedHints = new Set<string>()
    for (const [needle, hint] of Object.entries(ERROR_HINTS)) {
      if (error.message.includes(needle) && !emittedHints.has(hint)) {
        emittedHints.add(hint)
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
