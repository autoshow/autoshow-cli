import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'

defineLLMWriteTest({
  models: [
    'gpt-5.4',
    'gpt-5.4-pro',
    'gpt-5.4-mini',
    'gpt-5.4-nano',
  ],
  provider: 'openai',
  llmService: 'openai',
  promptProfiles: {
    'gpt-5.4': 'shortSummary',
    'gpt-5.4-pro': 'shortSummary',
    'gpt-5.4-mini': 'shortSummary',
  },
})

defineLLMWriteTest({
  models: [
    'claude-opus-4-7',
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
  ],
  provider: 'anthropic',
  llmService: 'anthropic',
  requiresEnvVar: { key: 'ANTHROPIC_API_KEY', description: 'Anthropic Claude models' },
  promptProfiles: {
    'claude-opus-4-7': 'shortSummary',
    'claude-sonnet-4-6': 'shortSummary',
    'claude-haiku-4-5': 'shortSummary',
  },
})

defineLLMWriteTest({
  models: [
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite-preview',
  ],
  provider: 'gemini',
  llmService: 'gemini',
  requiresEnvVar: { key: 'GEMINI_API_KEY', description: 'Gemini API' },
  promptProfiles: {
    'gemini-3.1-pro-preview': 'shortSummary',
  },
})

defineLLMWriteTest({
  models: [
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
  ],
  provider: 'groq',
  llmService: 'groq',
  requiresEnvVar: { key: 'GROQ_API_KEY', description: 'Groq models' },
  promptProfiles: {
    'openai/gpt-oss-120b': 'shortSummary',
  },
})

defineLLMWriteTest({
  models: [
    'MiniMax-M2.7',
    'MiniMax-M2.7-highspeed',
  ],
  provider: 'minimax',
  llmService: 'minimax',
  requiresEnvVar: { key: 'MINIMAX_API_KEY', description: 'MiniMax models' },
  promptProfiles: {
    'MiniMax-M2.7-highspeed': 'shortSummary',
  },
})

defineLLMWriteTest({
  models: [
    'grok-4.20-reasoning',
    'grok-4.20-non-reasoning',
  ],
  provider: 'grok',
  llmService: 'grok',
  requiresEnvVar: { key: 'XAI_API_KEY', description: 'Grok models' },
  promptProfiles: {
    'grok-4.20-reasoning': 'shortSummary',
  },
})

defineLLMWriteTest({
  models: [
    'glm-5.1',
  ],
  provider: 'glm',
  llmService: 'glm',
  requiresEnvVar: { key: 'GLM_API_KEY', description: 'Z.AI GLM models' },
})

defineLLMWriteTest({
  models: [
    'kimi-k2.6',
  ],
  provider: 'kimi',
  llmService: 'kimi',
  requiresEnvVar: { key: 'KIMI_API_KEY', description: 'Kimi models' },
})
