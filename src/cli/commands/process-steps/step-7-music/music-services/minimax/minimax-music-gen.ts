import { readEnv } from '~/utils/validate/env-utils'

export const ensureMinimaxMusicGenSetup = async (): Promise<void> => {
  const apiKey = readEnv('MINIMAX_API_KEY')
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY environment variable is required for MiniMax music generation')
  }
}
