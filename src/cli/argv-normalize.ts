import { PROCESS_COMMANDS } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { redactCliArgv } from '~/utils/logger/redaction'

export const knownCommands = new Set<string>([
  ...PROCESS_COMMANDS,
  'stt',
  'ocr',
  'resume',
  'lyrics',
  'config',
  'cache',
  'setup',
  'links',
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
  '--llama',
  '--mistral'
])

export const formatInput = (argv: string[]): string => {
  const redacted = redactCliArgv(argv)
  return `bun as ${redacted.join(' ')}`.trim()
}

export const validateSttFlagCompatibility = (argv: string[]): void => {
  if (argv[0] !== 'extract') {
    return
  }

  const usedUnsupportedFlags = argv.filter((token) => TRANSCRIBE_UNSUPPORTED_LLM_FLAGS.has(token))
  if (usedUnsupportedFlags.length > 0) {
    throw CLIUsageError('LLM provider flags are not supported with "extract" (--openai, --groq, --gemini, --anthropic, --minimax, --grok, --llama, --mistral). For Mistral STT, use --mistral-stt <model>.')
  }
}
