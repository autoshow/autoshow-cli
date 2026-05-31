import { readEnv } from '~/utils/validate/env-utils'

export const ANTHROPIC_OCR_LIMIT_SOURCE = 'project/links/claude-all-links.md'
export const ANTHROPIC_OCR_IMAGE_BYTES = 5 * 1024 * 1024
export const ANTHROPIC_OCR_FILES_UPLOAD_BYTES = 500 * 1024 * 1024

export const ANTHROPIC_OCR_FILES_BETA = 'files-api-2025-04-14'
export const ANTHROPIC_OCR_MAX_TOKENS = 64000

export const ensureAnthropicOcrSetup = async (): Promise<void> => {
  const apiKey = readEnv('ANTHROPIC_API_KEY')
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required for Anthropic OCR')
  }
}
