
export const ensureGeminiImageGenSetup = async (): Promise<void> => {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey || apiKey.length === 0) {
    throw new Error('GEMINI_API_KEY environment variable is required for Gemini image generation')
  }
}
