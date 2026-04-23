import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupAssemblyAiStt = async (): Promise<void> => {
  const apiKey = readEnv('ASSEMBLYAI_API_KEY')
  if (apiKey) {
    l.write('success', 'ASSEMBLYAI_API_KEY found — AssemblyAI transcription ready')
  } else {
    l.warn('ASSEMBLYAI_API_KEY not set — AssemblyAI transcription will not work until set')
    l.write('info', 'Set ASSEMBLYAI_API_KEY environment variable to use AssemblyAI transcription')
  }
}

export const ensureAssemblyAiSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('ASSEMBLYAI_API_KEY')
  if (!apiKey) {
    throw new Error('ASSEMBLYAI_API_KEY environment variable is required for AssemblyAI transcription')
  }
}
