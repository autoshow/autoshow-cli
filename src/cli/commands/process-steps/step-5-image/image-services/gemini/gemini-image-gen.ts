import * as l from '~/logger'

export const setupGeminiImageGen = async (): Promise<void> => {
  const apiKey = process.env['GEMINI_API_KEY']
  if (apiKey && apiKey.length > 0) {
    l.success('GEMINI_API_KEY found — Gemini image generation ready')
  } else {
    l.warn('GEMINI_API_KEY not set — Gemini image generation will not work until set')
    l.info('Set GEMINI_API_KEY environment variable to use Gemini image models')
  }
}

export const ensureGeminiImageGenSetup = async (): Promise<void> => {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey || apiKey.length === 0) {
    throw new Error('GEMINI_API_KEY environment variable is required for Gemini image generation')
  }
}
