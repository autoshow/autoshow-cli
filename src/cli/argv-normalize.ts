import { PROCESS_COMMANDS } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { redactCliArgv } from '~/logger/redaction'

export const knownCommands = new Set<string>([
  ...PROCESS_COMMANDS,
  'lyrics',
  'config',
  'cache',
  'setup',
  'sample',
  'models',
  'links',
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

const UNSUPPORTED_LEGACY_FLAGS = new Set<string>([
  '--dry-run',
  '--provider',
  '--json-output',
  '--md-output',
  '--structured',
  '--no-structured',
  '--structured-strict',
  '--no-structured-strict',
  '--structured-compat-retries'
])

export const formatInput = (argv: string[]): string => {
  const redacted = redactCliArgv(argv)
  return `bun as ${redacted.join(' ')}`.trim()
}

export const validateSttFlagCompatibility = (argv: string[]): void => {
  validateUnsupportedLegacyFlags(argv)
  validateLyricsFlagCompatibility(argv)

  if (argv[0] !== 'stt') {
    return
  }

  const usedUnsupportedFlags = argv.filter((token) => TRANSCRIBE_UNSUPPORTED_LLM_FLAGS.has(token))
  if (usedUnsupportedFlags.length > 0) {
    throw CLIUsageError('LLM provider flags are not supported with "stt" (--openai, --groq, --gemini, --anthropic, --minimax, --grok, --llama). Use: bun as write <input> [flags]')
  }
}

const validateLyricsFlagCompatibility = (argv: string[]): void => {
  if (argv[0] !== 'lyrics') {
    return
  }

  const REMOVED_FLAG_MESSAGES: Record<string, string> = {
    '--out': '--out has been removed. Lyrics outputs always go to autoshow run directories under ./output.',
    '--res': '--res has been removed. Lyrics rendering always uses 1920x1080.',
    '--fps': '--fps has been removed. Lyrics rendering always uses 30fps.',
    '--tmp': '--tmp has been removed. Lyrics uses a per-run .lyrics-tmp workspace inside each output directory.'
  }

  for (const token of argv) {
    if (!token.startsWith('--')) {
      continue
    }

    const flag = token.includes('=') ? token.slice(0, token.indexOf('=')) : token
    const removedMessage = REMOVED_FLAG_MESSAGES[flag]
    if (removedMessage) {
      throw CLIUsageError(removedMessage)
    }

    if (flag === '--price') {
      throw CLIUsageError('The "lyrics" command is local-only and does not support --price.')
    }
  }
}

const validateUnsupportedLegacyFlags = (argv: string[]): void => {
  for (const token of argv) {
    if (!token.startsWith('--')) {
      continue
    }

    const flag = token.includes('=') ? token.slice(0, token.indexOf('=')) : token
    if (UNSUPPORTED_LEGACY_FLAGS.has(flag)) {
      throw CLIUsageError(`Unknown option ${flag}`)
    }
  }
}
