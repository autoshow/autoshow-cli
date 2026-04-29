import { defineLLMWriteTest } from '../../../../test-utils/define-llm-write-test'

defineLLMWriteTest({
  models: [
    'gpt-5.4',
    'gpt-5.4-pro',
    'gpt-5.4-mini',
    'gpt-5.4-nano',
  ],
  cliFlag: '--openai',
  llmService: 'openai',
})

defineLLMWriteTest({
  models: [
    'claude-opus-4-7',
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
    'claude-opus-4-6',
  ],
  cliFlag: '--anthropic',
  llmService: 'anthropic',
  requiresEnvVar: { key: 'ANTHROPIC_API_KEY', description: 'Anthropic Claude models' },
})

defineLLMWriteTest({
  models: [
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite-preview',
  ],
  cliFlag: '--gemini',
  llmService: 'gemini',
  requiresEnvVar: { key: 'GEMINI_API_KEY', description: 'Gemini API' },
})

defineLLMWriteTest({
  models: [
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
  ],
  cliFlag: '--groq',
  llmService: 'groq',
  requiresEnvVar: { key: 'GROQ_API_KEY', description: 'Groq models' },
})

defineLLMWriteTest({
  models: [
    'MiniMax-M2.5',
    'MiniMax-M2.5-highspeed',
  ],
  cliFlag: '--minimax',
  llmService: 'minimax',
  requiresEnvVar: { key: 'MINIMAX_API_KEY', description: 'MiniMax models' },
})

defineLLMWriteTest({
  models: [
    'grok-4.20-reasoning',
    'grok-4.20-non-reasoning',
  ],
  cliFlag: '--grok',
  llmService: 'grok',
  requiresEnvVar: { key: 'XAI_API_KEY', description: 'Grok models' },
})

defineLLMWriteTest({
  models: [
    'glm-5.1',
  ],
  cliFlag: '--glm',
  llmService: 'glm',
  requiresEnvVar: { key: 'GLM_API_KEY', description: 'Z.AI GLM models' },
})

defineLLMWriteTest({
  models: [
    'kimi-k2.6',
  ],
  cliFlag: '--kimi',
  llmService: 'kimi',
  requiresEnvVar: { key: 'KIMI_API_KEY', description: 'Kimi models' },
})
