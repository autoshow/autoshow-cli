export const openaiImage = {
  provider: 'openai',
  imageService: 'openai',
  envVarKey: 'OPENAI_API_KEY',
} as const

export const bflImage = {
  provider: 'bfl',
  imageService: 'bfl',
  envVarKey: 'BFL_API_KEY',
  imageExtension: 'jpg',
} as const

export const grokImage = {
  provider: 'grok',
  imageService: 'grok',
  envVarKey: 'XAI_API_KEY',
  imageExtension: 'jpg',
} as const
