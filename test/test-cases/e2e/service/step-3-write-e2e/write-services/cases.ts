export const openaiWrite = {
  provider: 'openai',
  llmService: 'openai',
} as const

export const anthropicWrite = {
  provider: 'anthropic',
  llmService: 'anthropic',
  requiresEnvVar: { key: 'ANTHROPIC_API_KEY', description: 'Anthropic Claude models' },
} as const

export const geminiWrite = {
  provider: 'gemini',
  llmService: 'gemini',
  requiresEnvVar: { key: 'GEMINI_API_KEY', description: 'Gemini API' },
} as const

export const groqWrite = {
  provider: 'groq',
  llmService: 'groq',
  requiresEnvVar: { key: 'GROQ_API_KEY', description: 'Groq models' },
} as const

export const minimaxWrite = {
  provider: 'minimax',
  llmService: 'minimax',
  requiresEnvVar: { key: 'MINIMAX_API_KEY', description: 'MiniMax models' },
} as const

export const grokWrite = {
  provider: 'grok',
  llmService: 'grok',
  requiresEnvVar: { key: 'XAI_API_KEY', description: 'Grok models' },
} as const

export const glmWrite = {
  provider: 'glm',
  llmService: 'glm',
  requiresEnvVar: { key: 'GLM_API_KEY', description: 'Z.AI GLM models' },
} as const

export const kimiWrite = {
  provider: 'kimi',
  llmService: 'kimi',
  requiresEnvVar: { key: 'KIMI_API_KEY', description: 'Kimi models' },
} as const
