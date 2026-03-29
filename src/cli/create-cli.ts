import { Clerc, defaultFormatters, helpPlugin, versionPlugin } from 'clerc'
import { rootCommand } from './define-root-command'
import { configCommand } from './commands/config/define-config-command'
import { metadataCommand } from '~/cli/commands/process-steps/step-0-metadata/define-metadata-command'
import { downloadCommand } from '~/cli/commands/process-steps/step-1-download/define-download-command'
import { transcribeCommand } from '~/cli/commands/process-steps/step-2-stt/define-transcribe-command'
import { writeCommand } from '~/cli/commands/process-steps/step-3-write/define-write-command'
import { extractCommand } from '~/cli/commands/process-steps/step-2-document/define-extract-command'
import { ttsCommand } from '~/cli/commands/process-steps/step-4-tts/define-tts-command'
import { imageCommand } from '~/cli/commands/process-steps/step-5-image/define-image-command'
import { musicCommand } from '~/cli/commands/process-steps/step-7-music/define-music-command'
import { videoCommand } from '~/cli/commands/process-steps/step-6-video/define-video-command'
import { setupCommand } from '~/cli/commands/process-steps/step-0-setup/define-setup-command'
import { sampleCommand } from '~/cli/commands/sample/define-sample-command'
import { installProcessFailureHandlers } from '~/cli/failure-handlers'
import { CONFIG_COMMAND_HELP_FLAG_GROUPS } from '~/cli/flags'
import { CLIUsageError, normalizeExitCode, usageMessage } from '~/utils/error-handler'
import { redactCliArgv } from '~/logger/redaction'
import { modelsCommand } from '~/cli/commands/models/define-models-command'
import { linksCommand } from '~/cli/commands/links/define-links-command'
import { PROCESS_COMMANDS, canonicalizeProcessCommand } from '~/types'
import * as l from '~/logger'
import { runWithLogContext, reconfigureLogger } from '~/logger'

const cliErrorHandler = (error: unknown): void => {
  const exitCode = normalizeExitCode(error)
  if (exitCode === 2) {
    l.error(`Usage error: ${usageMessage(error)}`)
    process.exit(2)
  }

  l.error('Command failed', error)

  if (error instanceof Error && error.message.includes('yt-dlp')) {
    l.info("Run 'bun as setup' to install yt-dlp and other dependencies")
  }
  if (error instanceof Error && error.message.includes('OPENAI_API_KEY')) {
    l.info('Set OPENAI_API_KEY environment variable to use OpenAI models')
  }
  if (error instanceof Error && error.message.includes('GEMINI_API_KEY')) {
    l.info('Set GEMINI_API_KEY environment variable to use Gemini models')
  }
  if (error instanceof Error && error.message.includes('GROQ_API_KEY')) {
    l.info('Set GROQ_API_KEY environment variable to use Groq models')
  }
  if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) {
    l.info('Set ANTHROPIC_API_KEY environment variable to use Anthropic Claude models')
  }
  if (error instanceof Error && error.message.includes('MINIMAX_API_KEY')) {
    l.info('Set MINIMAX_API_KEY environment variable to use MiniMax models')
  }
  if (error instanceof Error && error.message.includes('ELEVENLABS_API_KEY')) {
    l.info('Set ELEVENLABS_API_KEY environment variable to use ElevenLabs transcription/TTS/music')
  }

  process.exit(1)
}

const CLI_VERSION = (await import('../../package.json')).version as string

const COMMAND_ALIASES: Record<string, string> = {
  model: 'models',
  meta: 'metadata',
  info: 'metadata',
  dl: 'download',
  transcribe: 'stt',
  transcript: 'stt',
  transcription: 'stt',
  extract: 'ocr',
  document: 'ocr',
  voice: 'tts',
  llm: 'write',
  llms: 'write',
  samples: 'sample'
}

const COMMAND_HELP_SHORTCUTS = new Set(['help', 'h', '-h', '--h'])

const normalizeCommandAliases = (argv: string[]): string[] => {
  if (argv.length === 0) {
    return argv
  }

  const [first, second, ...rest] = argv

  if (first === 'help' && typeof second === 'string') {
    const mapped = COMMAND_ALIASES[second]
    if (mapped) {
      return ['help', mapped, ...rest]
    }
    return argv
  }

  if (typeof first === 'string') {
    const mapped = COMMAND_ALIASES[first]
    if (mapped) {
      return [mapped, ...(argv.slice(1))]
    }
  }

  return argv
}

const normalizeKnownCommandName = (command: string): string | null => {
  if (!knownCommands.has(command)) {
    return null
  }

  const mapped = COMMAND_ALIASES[command] ?? command
  return PROCESS_COMMANDS.includes(mapped as typeof PROCESS_COMMANDS[number])
    ? canonicalizeProcessCommand(mapped as Parameters<typeof canonicalizeProcessCommand>[0])
    : mapped
}

const normalizeCommandHelpShortcut = (argv: string[]): string[] => {
  if (argv.length === 2) {
    const [first, second] = argv
    if (
      typeof first === 'string' &&
      typeof second === 'string' &&
      knownCommands.has(first) &&
      COMMAND_HELP_SHORTCUTS.has(second)
    ) {
      return ['help', first]
    }
  }

  return argv
}

const knownCommands = new Set<string>([
  ...PROCESS_COMMANDS,
  ...Object.keys(COMMAND_ALIASES),
  'config',
  'setup',
  'sample',
  'samples',
  'model',
  'models',
  'help',
  'version'
])

const TRANSCRIBE_UNSUPPORTED_LLM_FLAGS = new Set<string>([
  '--openai',
  '--groq',
  '--gemini',
  '--anthropic',
  '--minimax',
  '--grok',
  '--llama'
])

const formatInput = (argv: string[]): string => {
  const redacted = redactCliArgv(argv)
  return `bun as ${redacted.join(' ')}`.trim()
}

const validateSttFlagCompatibility = (argv: string[]): void => {
  if (argv[0] !== 'stt') {
    return
  }

  const usedUnsupportedFlags = argv.filter((token) => TRANSCRIBE_UNSUPPORTED_LLM_FLAGS.has(token))
  if (usedUnsupportedFlags.length > 0) {
    throw CLIUsageError('LLM provider flags are not supported with "stt" (--openai, --groq, --gemini, --anthropic, --minimax, --grok, --llama). Use: bun as write <input> [flags]')
  }
}

const BARE_FLAG_DEFAULTS: Record<string, string> = {
  '--openai':    'gpt-5.4',
  '--groq':      'openai/gpt-oss-20b',
  '--gemini':    'gemini-3.1-flash-lite-preview',
  '--anthropic': 'claude-sonnet-4-6',
  '--minimax':   'MiniMax-M2.5',
  '--grok':      'grok-4.20-reasoning',
  '--llama':     'ggml-org/gemma-3-270m-it-GGUF',
  '--elevenlabs-stt': 'scribe_v2',
  '--groq-stt': 'whisper-large-v3-turbo',
  '--openai-stt': 'gpt-4o-transcribe-diarize',
  '--elevenlabs-tts': 'eleven_v3',
  '--openai-tts': 'gpt-4o-mini-tts',
  '--gemini-tts': 'gemini-2.5-flash-preview-tts',
  '--elevenlabs-music': 'music_v1',
  '--minimax-tts': 'speech-2.8-turbo',
  '--minimax-music': 'music-2.5',
  '--minimax-image': 'image-01',
  '--gemini-video': 'veo-3.1-fast-generate-preview',
  '--minimax-video': 'MiniMax-Hailuo-2.3'
}

const HELP_COMMAND_GROUPS = [
  ['core', 'Core Commands'],
  ['setup', 'Setup & Utilities'],
  ['processing', 'Processing & Generation']
] as const

type HelpCommandGroupKey = typeof HELP_COMMAND_GROUPS[number][0]
const HELP_COMMAND_GROUP_DEFINITIONS: [string, string][] = HELP_COMMAND_GROUPS.map(([key, label]) => [key, label])

const HELP_COMMAND_GROUP_BY_NAME: Readonly<Record<string, HelpCommandGroupKey>> = {
  '': 'core',
  version: 'core',
  help: 'core',
  config: 'setup',
  setup: 'setup',
  sample: 'setup',
  models: 'setup',
  links: 'setup',
  metadata: 'processing',
  download: 'processing',
  ocr: 'processing',
  stt: 'processing',
  write: 'processing',
  tts: 'processing',
  image: 'processing',
  music: 'processing',
  video: 'processing'
}

const COMMAND_DEFINITIONS = [
  rootCommand,
  configCommand,
  setupCommand,
  sampleCommand,
  modelsCommand,
  linksCommand,
  metadataCommand,
  downloadCommand,
  extractCommand,
  transcribeCommand,
  writeCommand,
  ttsCommand,
  imageCommand,
  musicCommand,
  videoCommand
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

const expandBareModelFlags = (argv: string[]): string[] => {
  const result: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i] as string
    const def = BARE_FLAG_DEFAULTS[token]
    if (def !== undefined) {
      const next = argv[i + 1]
      if (next === undefined || (typeof next === 'string' && next.startsWith('-'))) {

        result.push(token, def)
      } else {

        result.push(token)
      }
    } else {
      result.push(token)
    }
  }
  return result
}

const expandPromptArgs = (argv: string[]): string[] => {
  const result: string[] = []
  let i = 0
  while (i < argv.length) {
    const token = argv[i] as string
    if (token === '--prompt') {

      i++
      while (i < argv.length) {
        const next = argv[i] as string
        if (next.startsWith('-')) break
        result.push('--prompt', next)
        i++
      }
    } else {
      result.push(token)
      i++
    }
  }
  return result
}

const ansiReset = '\x1b[0m'
const isForceColorEnabled = (): boolean => {
  const value = process.env['FORCE_COLOR']
  return typeof value === 'string' && value !== '' && value !== '0'
}

const shouldUseHelpColors = (): boolean => {
  if (isForceColorEnabled()) {
    return true
  }
  if (process.env['NO_COLOR'] !== undefined) {
    return false
  }
  return process.stdout.isTTY === true
}

const helpColorsEnabled = shouldUseHelpColors()
const colorText = (text: string, color: string): string => {
  if (!helpColorsEnabled) {
    return text
  }
  if (text.length === 0) {
    return text
  }
  const ansiCode = Bun.color(color, 'ansi-16m') ?? ''
  if (ansiCode.length === 0) {
    return text
  }
  return `${ansiCode}${text}${ansiReset}`
}

const HELP_GROUP_COLOR_BY_KEY: Readonly<Record<string, string>> = {
  config: 'lightseagreen',
  pricing: 'goldenrod',
  'step-1-download': 'deepskyblue',
  'step-2-stt': 'dodgerblue',
  'step-2-document': 'mediumseagreen',
  'step-3-write': 'cornflowerblue',
  'step-4-tts': 'darkorange',
  'step-5-image': 'hotpink',
  'step-6-video': 'mediumpurple',
  'step-7-music': 'gold'
}

const HELP_DEFAULT_VALUE_COLOR = 'springgreen'
const HELP_FLAG_NAME_COLOR = 'cyan'
const HELP_TYPE_COLOR = 'lightsalmon'
const HELP_MODEL_VALUE_COLOR = 'deepskyblue'
const HELP_MODEL_DELIMITER_COLOR = 'steelblue'
const HELP_MODEL_SEGMENT_PATTERN = /(\bmodel(?:s)?(?:\s+ID)?(?:\s*\([^)]*\))?\s*:\s*)([^\n]+)/gi
const HELP_FLAG_ROW_PATTERN = /^(\s+)(--.+?)(\s{2,})(.*)$/gm
const ANSI_ESCAPE_PATTERN = /\x1b\[[0-9;]*m/
const ANSI_ESCAPE_GLOBAL_PATTERN = /\x1b\[[0-9;]*m/g
const ROOT_COMMAND_DESCRIPTION = 'Default command (equivalent to metadata <input>)'
const ROOT_COMMAND_GROUP_LABEL = 'Core Commands'
const ROOT_COMMAND_GROUP_ROW = `    (root)    ${ROOT_COMMAND_DESCRIPTION}`

const hasAnsiEscapes = (text: string): boolean => ANSI_ESCAPE_PATTERN.test(text)
const stripAnsiEscapes = (text: string): string => text.replace(ANSI_ESCAPE_GLOBAL_PATTERN, '')

const colorizeModelToken = (token: string): string => {
  const leadingWhitespace = token.match(/^\s*/)?.[0] ?? ''
  const trailingWhitespace = token.match(/\s*$/)?.[0] ?? ''
  const core = token.slice(leadingWhitespace.length, token.length - trailingWhitespace.length)
  if (core.length === 0) {
    return token
  }
  return `${leadingWhitespace}${colorText(core, HELP_MODEL_VALUE_COLOR)}${trailingWhitespace}`
}

const colorizeModelValueList = (modelValues: string): string => {
  const parts = modelValues.split('|')
  const divider = colorText('|', HELP_MODEL_DELIMITER_COLOR)
  return parts.map(colorizeModelToken).join(divider)
}

const colorizeHelpDescription = (description: string): string => {
  if (!helpColorsEnabled || hasAnsiEscapes(description)) {
    return description
  }

  return description.replace(HELP_MODEL_SEGMENT_PATTERN, (_match, prefix: string, modelValues: string) => {
    return `${prefix}${colorizeModelValueList(modelValues)}`
  })
}

const colorizeHelpFlagRows = (rendered: string): string => {
  const hasHelpSections = rendered.includes('\nFlags\n') || rendered.includes('\nGlobal Flags\n')
  if (!helpColorsEnabled || (!hasHelpSections && hasAnsiEscapes(rendered))) {
    return rendered
  }

  return rendered.replace(HELP_FLAG_ROW_PATTERN, (_match, indent: string, flagName: string, spacing: string, tail: string) => {
    return `${indent}${colorText(flagName, HELP_FLAG_NAME_COLOR)}${spacing}${tail}`
  })
}

const moveRootCommandIntoCoreGroup = (rendered: string): string => {
  if (!rendered.includes('\nCommands\n')) {
    return rendered
  }

  const lines = rendered.split('\n')
  const rootIndex = lines.findIndex(line => stripAnsiEscapes(line).trim() === `(root)  ${ROOT_COMMAND_DESCRIPTION}`)
  const coreIndex = lines.findIndex(line => stripAnsiEscapes(line).trim() === ROOT_COMMAND_GROUP_LABEL)

  if (rootIndex === -1 || coreIndex === -1 || rootIndex > coreIndex) {
    return rendered
  }

  lines.splice(rootIndex, 1)

  const updatedCoreIndex = lines.findIndex(line => stripAnsiEscapes(line).trim() === ROOT_COMMAND_GROUP_LABEL)
  if (updatedCoreIndex === -1) {
    return rendered
  }

  if (updatedCoreIndex > 0 && stripAnsiEscapes(lines[updatedCoreIndex - 1] ?? '').trim() === '') {
    lines.splice(updatedCoreIndex - 1, 1)
  }

  const insertionIndex = lines.findIndex(line => stripAnsiEscapes(line).trim().startsWith('version'))
  if (insertionIndex === -1) {
    return rendered
  }

  lines.splice(insertionIndex, 0, ROOT_COMMAND_GROUP_ROW)
  return lines.join('\n')
}

const transformHelpOutput = (rendered: string): string => {
  const normalized = moveRootCommandIntoCoreGroup(rendered)
  return colorizeHelpFlagRows(normalized)
}

const withPatchedHelpConsole = async (run: () => Promise<void>): Promise<void> => {
  const originalLog = console.log
  console.log = (...args: unknown[]): void => {
    const transformed = args.map(arg => {
      if (typeof arg !== 'string') {
        return arg
      }
      return transformHelpOutput(arg)
    })
    originalLog(...transformed)
  }

  try {
    await run()
  } finally {
    console.log = originalLog
  }
}

const shouldPatchHelpConsole = (argv: string[]): boolean => {
  if (argv.length === 0) {
    return true
  }
  if (argv[0] === 'help') {
    return true
  }
  return argv.includes('--help') || argv.includes('-h')
}

const colorizeFlagDescriptions = (flags: Record<string, unknown> | undefined): void => {
  if (!helpColorsEnabled || flags === undefined) {
    return
  }

  for (const definition of Object.values(flags)) {
    if (typeof definition !== 'object' || definition === null || Array.isArray(definition)) {
      continue
    }

    const optionDefinition = definition as Record<string, unknown>
    const description = optionDefinition['description']
    if (typeof description !== 'string') {
      continue
    }

    optionDefinition['description'] = colorizeHelpDescription(description)
  }
}

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

const colorizeHelpFlagGroups = (
  groups: readonly (readonly [string, string])[]
): [string, string][] => {
  return groups.map(([key, label]) => {
    const color = HELP_GROUP_COLOR_BY_KEY[key]
    if (typeof color !== 'string') {
      return [key, label]
    }
    return [key, colorText(label, color)]
  })
}

const createCli = () => {
  applyUniversalHelpDescriptionColors()

  const cli = Clerc.create({
    name: 'AutoShow CLI',
    scriptName: 'bun as',
    description: [
      'Process audio/video and documents with transcription, extraction, and write workflows',
      '',
      'Aliases:',
      '  models: model',
      '  metadata: meta, info',
      '  download: dl',
      '  stt: transcribe, transcript, transcription',
      '  ocr: extract, document',
      '  tts: voice',
      '  write: llm, llms',
      '  sample: samples'
    ].join('\n'),
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
          return colorText(formattedValue, HELP_DEFAULT_VALUE_COLOR)
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
  const argv = normalizeCommandHelpShortcut(normalizeCommandAliases(expandPromptArgs(expandBareModelFlags(Bun.argv.slice(2)))))
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

      const maybeCommand = rest[0]
      const canonicalCommand = maybeCommand ? normalizeKnownCommandName(maybeCommand) : null
      if (canonicalCommand) {
        await parseCli(['help', canonicalCommand])
        return
      }

      await parseCli(['help'])
      return
    }

    if (first === '--version' || first === '-v' || first === '-V') {
      await parseCli(['--version'])
      return
    }

    if (first !== '--' && first!.startsWith('-')) {
      const maybeCommand = rest.find(token => knownCommands.has(token))
      const canonicalCommand = maybeCommand ? normalizeKnownCommandName(maybeCommand) : null
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
