import * as l from '~/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupMinimaxMusicGen = async (): Promise<void> => {
  const apiKey = readEnv('MINIMAX_API_KEY')
  if (apiKey) {
    l.success('MINIMAX_API_KEY found — MiniMax music generation ready')
  } else {
    l.warn('MINIMAX_API_KEY not set — MiniMax music generation will not work until set')
    l.info('Set MINIMAX_API_KEY environment variable to use MiniMax music generation')
  }
}

export const ensureMinimaxMusicGenSetup = async (): Promise<void> => {
  const apiKey = readEnv('MINIMAX_API_KEY')
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY environment variable is required for MiniMax music generation')
  }
}
