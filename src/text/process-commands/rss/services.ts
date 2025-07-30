import { l } from '../../../logging.ts'
import type { ProcessingOptions } from '@/types.ts'

export function getLLMService(options: ProcessingOptions): string | undefined {
  l.dim('[getLLMService] Detecting LLM service from options')
  
  if (options.chatgpt) {
    l.dim('[getLLMService] ChatGPT service detected')
    return 'chatgpt'
  }
  if (options.claude) {
    l.dim('[getLLMService] Claude service detected')
    return 'claude'
  }
  if (options.gemini) {
    l.dim('[getLLMService] Gemini service detected')
    return 'gemini'
  }
  
  l.dim('[getLLMService] No LLM service detected')
  return undefined
}

export function getTranscriptService(options: ProcessingOptions): string | undefined {
  l.dim('[getTranscriptService] Detecting transcription service from options')
  
  if (options.deepgram) {
    l.dim('[getTranscriptService] Deepgram service detected')
    return 'deepgram'
  }
  if (options.assembly) {
    l.dim('[getTranscriptService] Assembly service detected')
    return 'assembly'
  }
  if (options.whisper) {
    l.dim('[getTranscriptService] Whisper service detected')
    return 'whisper'
  }
  
  l.dim('[getTranscriptService] No transcription service detected')
  return undefined
}