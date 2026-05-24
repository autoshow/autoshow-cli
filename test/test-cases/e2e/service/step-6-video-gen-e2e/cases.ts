export const geminiVideo = {
  provider: 'gemini',
  videoService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
  envVarDescription: 'Gemini video generation',
} as const

export const minimaxVideo = {
  provider: 'minimax',
  videoService: 'minimax',
  envVarKey: 'MINIMAX_API_KEY',
  envVarDescription: 'MiniMax video generation',
} as const

export const glmVideo = {
  provider: 'glm',
  videoService: 'glm',
  envVarKey: 'GLM_API_KEY',
  envVarDescription: 'GLM video generation',
} as const

export const grokVideo = {
  provider: 'grok',
  videoService: 'grok',
  envVarKey: 'XAI_API_KEY',
  envVarDescription: 'Grok video generation',
} as const

export const runwayVideo = {
  provider: 'runway',
  videoService: 'runway',
  envVarKey: 'RUNWAYML_API_SECRET',
  envVarDescription: 'Runway video generation',
} as const
