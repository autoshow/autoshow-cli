import { readEnv } from '~/utils/validate/env-utils'

export const ensureAssemblyAiSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('ASSEMBLYAI_API_KEY')
  if (!apiKey) {
    throw new Error('ASSEMBLYAI_API_KEY environment variable is required for AssemblyAI transcription')
  }
}
