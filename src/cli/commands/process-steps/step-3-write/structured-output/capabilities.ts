import type { LLMService, ProviderStructuredCapability, StructuredMode } from '~/types'

const CAPABILITIES: Record<LLMService, ProviderStructuredCapability> = {
  'openai': {
    nativeStructuredOutput: true,
    strictMode: true
  },
  'groq': {
    nativeStructuredOutput: true,
    strictMode: true
  },
  'anthropic': {
    nativeStructuredOutput: true,
    strictMode: false
  },
  'gemini': {
    nativeStructuredOutput: true,
    strictMode: false
  },
  'minimax': {
    nativeStructuredOutput: false,
    strictMode: false
  },
  'grok': {
    nativeStructuredOutput: true,
    strictMode: true
  },
  'llama.cpp': {
    nativeStructuredOutput: false,
    strictMode: false
  }
}

export const getStructuredCapability = (service: LLMService): ProviderStructuredCapability => {
  return CAPABILITIES[service]
}

export const resolveStructuredMode = (service: LLMService, enabled: boolean): StructuredMode => {
  if (!enabled) return 'off'
  if (service === 'llama.cpp') return 'off'
  return CAPABILITIES[service].nativeStructuredOutput ? 'native' : 'compat'
}

export const shouldApplyStrictMode = (
  service: LLMService,
  requestedStrict: boolean
): boolean => {
  return requestedStrict && CAPABILITIES[service].strictMode
}
