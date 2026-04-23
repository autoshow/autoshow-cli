import * as l from '~/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const ANTHROPIC_OCR_LIMIT_SOURCE = 'project/links/claude-all-links.md'
export const ANTHROPIC_OCR_IMAGE_BYTES = 5 * 1024 * 1024
export const ANTHROPIC_OCR_REQUEST_BYTES = 32 * 1024 * 1024
export const ANTHROPIC_OCR_FILES_UPLOAD_BYTES = 500 * 1024 * 1024
export const ANTHROPIC_OCR_PDF_CHUNK_PAGE_COUNT = 10
export const ANTHROPIC_OCR_FILES_BETA = 'files-api-2025-04-14'
export const ANTHROPIC_OCR_MAX_TOKENS = 64000

export const setupAnthropicOcr = async (): Promise<void> => {
  const apiKey = readEnv('ANTHROPIC_API_KEY')
  if (apiKey) {
    l.write('success', 'ANTHROPIC_API_KEY found — Anthropic OCR ready')
  } else {
    l.warn('ANTHROPIC_API_KEY not set — Anthropic OCR will not work until set')
    l.write('info', 'Set ANTHROPIC_API_KEY environment variable to use Anthropic OCR')
  }
}

export const ensureAnthropicOcrSetup = async (): Promise<void> => {
  const apiKey = readEnv('ANTHROPIC_API_KEY')
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required for Anthropic OCR')
  }
}
