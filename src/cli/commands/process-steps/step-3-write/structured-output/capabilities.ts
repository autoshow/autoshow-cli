import type { LLMService, ProviderStructuredCapability, StructuredStrategy } from '~/types'

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
  'glm': {
    nativeStructuredOutput: true,
    strictMode: false
  },
  'llama.cpp': {
    nativeStructuredOutput: false,
    strictMode: false
  }
}

export const resolveStructuredStrategy = (service: LLMService): StructuredStrategy => {
  return CAPABILITIES[service].nativeStructuredOutput ? 'native' : 'schema-guided'
}

export const shouldApplyStrictMode = (
  service: LLMService,
  requestedStrict: boolean
): boolean => {
  return requestedStrict && CAPABILITIES[service].strictMode
}
