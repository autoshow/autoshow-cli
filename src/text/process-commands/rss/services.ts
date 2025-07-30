import { l } from '@/logging'
import type { ProcessingOptions } from '@/types'

export function getLLMService(options: ProcessingOptions): string | undefined {
  const p = '[text/process-commands/rss/services]'
  l.dim(`${p} Detecting LLM service from options`)
  
  if (options.chatgpt) {
    l.dim(`${p} ChatGPT service detected`)
    return 'chatgpt'
  }
  if (options.claude) {
    l.dim(`${p} Claude service detected`)
    return 'claude'
  }
  if (options.gemini) {
    l.dim(`${p} Gemini service detected`)
    return 'gemini'
  }
  
  l.dim(`${p} No LLM service detected`)
  return undefined
}

export function getTranscriptService(options: ProcessingOptions): string | undefined {
  const p = '[text/process-commands/rss/services]'
  l.dim(`${p} Detecting transcription service from options`)
  
  if (options.deepgram) {
    l.dim(`${p} Deepgram service detected`)
    return 'deepgram'
  }
  if (options.assembly) {
    l.dim(`${p} Assembly service detected`)
    return 'assembly'
  }
  if (options.whisper) {
    l.dim(`${p} Whisper service detected`)
    return 'whisper'
  }
  
  l.dim(`${p} No transcription service detected`)
  return undefined
}