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

export const formatInput = (argv: string[]): string => {
  const redacted = redactCliArgv(argv)
  return `bun as ${redacted.join(' ')}`.trim()
}

export const validateSttFlagCompatibility = (argv: string[]): void => {
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

  for (const token of argv) {
    if (!token.startsWith('--')) {
      continue
    }

    const flag = token.includes('=') ? token.slice(0, token.indexOf('=')) : token
    if (flag === '--price') {
      throw CLIUsageError('The "lyrics" command is local-only and does not support --price.')
    }
  }
}
