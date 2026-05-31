import { readEnv } from '~/utils/validate/env-utils'

export const GEMINI_INLINE_PDF_BYTES = 50 * 1024 * 1024
export const GEMINI_INLINE_NON_PDF_BYTES = 100 * 1024 * 1024
export const GEMINI_FILE_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024
export const GEMINI_PDF_PAGE_COUNT_LIMIT = 1000
export const GEMINI_OCR_LIMIT_SOURCE = 'project/links/gemini-all-links.md'

export const ensureGeminiOcrSetup = async (): Promise<void> => {
  const apiKey = readEnv('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required for Gemini OCR')
  }
}
