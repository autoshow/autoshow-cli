import { PROCESS_COMMANDS, canonicalizeProcessCommand } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { redactCliArgv } from '~/logger/redaction'

export const COMMAND_ALIASES: Record<string, string> = {
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

export const knownCommands = new Set<string>([
  ...PROCESS_COMMANDS,
  ...Object.keys(COMMAND_ALIASES),
  'config',
  'cache',
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

export const BARE_FLAG_DEFAULTS: Record<string, string> = {
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

export const normalizeCommandAliases = (argv: string[]): string[] => {
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

export const normalizeKnownCommandName = (command: string): string | null => {
  if (!knownCommands.has(command)) {
    return null
  }

  const mapped = COMMAND_ALIASES[command] ?? command
  return PROCESS_COMMANDS.includes(mapped as typeof PROCESS_COMMANDS[number])
    ? canonicalizeProcessCommand(mapped as Parameters<typeof canonicalizeProcessCommand>[0])
    : mapped
}

export const normalizeCommandHelpShortcut = (argv: string[]): string[] => {
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

export const formatInput = (argv: string[]): string => {
  const redacted = redactCliArgv(argv)
  return `bun as ${redacted.join(' ')}`.trim()
}

export const validateSttFlagCompatibility = (argv: string[]): void => {
  if (argv[0] !== 'stt') {
    return
  }

  const usedUnsupportedFlags = argv.filter((token) => TRANSCRIBE_UNSUPPORTED_LLM_FLAGS.has(token))
  if (usedUnsupportedFlags.length > 0) {
    throw CLIUsageError('LLM provider flags are not supported with "stt" (--openai, --groq, --gemini, --anthropic, --minimax, --grok, --llama). Use: bun as write <input> [flags]')
  }
}

export const expandBareModelFlags = (argv: string[]): string[] => {
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

export const expandPromptArgs = (argv: string[]): string[] => {
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
