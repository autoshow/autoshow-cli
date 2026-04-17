import { PROCESS_COMMANDS } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { redactCliArgv } from '~/logger/redaction'

export const knownCommands = new Set<string>([
  ...PROCESS_COMMANDS,
  'config',
  'cache',
  'setup',
  'sample',
  'models',
  'report',
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

const REMOVED_FLAG_MESSAGES: Record<string, string> = {
  '--dry-run': 'The --dry-run flag was removed. Use --price for estimate-only mode.',
  '--provider': 'The generic --provider flag was removed. Use provider-named flags such as --assemblyai-stt, --glm-ocr, or --openai.',
  '--json-output': 'The --json-output flag was removed. Write output is JSON-only now.',
  '--md-output': 'The --md-output flag was removed. Write output is JSON-only now.',
  '--structured': 'The --structured flag was removed. Structured output is now internal and always JSON-only.',
  '--no-structured': 'The --no-structured flag was removed. Structured output is now internal and always JSON-only.',
  '--structured-strict': 'The --structured-strict flag was removed. Structured output mode is no longer configurable from the CLI.',
  '--no-structured-strict': 'The --no-structured-strict flag was removed. Structured output mode is no longer configurable from the CLI.',
  '--structured-compat-retries': 'The --structured-compat-retries flag was removed. Structured fallback retries are now internal only.'
}

export const normalizeKnownCommandName = (command: string): string | null => {
  return knownCommands.has(command) ? command : null
}

export const formatInput = (argv: string[]): string => {
  const redacted = redactCliArgv(argv)
  return `bun as ${redacted.join(' ')}`.trim()
}

export const validateSttFlagCompatibility = (argv: string[]): void => {
  validateRemovedLegacyFlags(argv)

  if (argv[0] !== 'stt') {
    return
  }

  const usedUnsupportedFlags = argv.filter((token) => TRANSCRIBE_UNSUPPORTED_LLM_FLAGS.has(token))
  if (usedUnsupportedFlags.length > 0) {
    throw CLIUsageError('LLM provider flags are not supported with "stt" (--openai, --groq, --gemini, --anthropic, --minimax, --grok, --llama). Use: bun as write <input> [flags]')
  }
}

const validateRemovedLegacyFlags = (argv: string[]): void => {
  for (const token of argv) {
    if (!token.startsWith('--')) {
      continue
    }

    const flag = token.includes('=') ? token.slice(0, token.indexOf('=')) : token
    const message = REMOVED_FLAG_MESSAGES[flag]
    if (message) {
      throw CLIUsageError(message)
    }
  }
}
