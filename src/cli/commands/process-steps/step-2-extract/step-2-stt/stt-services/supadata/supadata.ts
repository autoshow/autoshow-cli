import { isDirectMediaUrl } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { SUPADATA_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'

const SUPADATA_SUPPORTED_HOST_PATTERNS = [
  /(^|\.)youtube\.com$/i,
  /(^|\.)youtu\.be$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)fb\.watch$/i
]

export const getSupadataBaseUrl = (): string => SUPADATA_DEFAULT_BASE_URL

export const isSupadataSupportedSourceUrl = (
  sourceUrl: string | undefined
): boolean => {
  if (typeof sourceUrl !== 'string' || sourceUrl.length === 0) {
    return false
  }

  try {
    const parsed = new URL(sourceUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }

    if (isDirectMediaUrl(sourceUrl)) {
      return true
    }

    const hostname = parsed.hostname.toLowerCase()
    return SUPADATA_SUPPORTED_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
  } catch {
    return false
  }
}

export const describeSupadataUnsupportedSource = (
  sourceUrl: string | undefined
): string => {
  if (typeof sourceUrl !== 'string' || sourceUrl.length === 0) {
    return 'Supadata requires a public source URL and cannot transcribe local file inputs through the AutoShow CLI'
  }

  try {
    const parsed = new URL(sourceUrl)
    if (parsed.protocol === 'file:') {
      return 'Supadata requires a public source URL and cannot transcribe local file inputs through the AutoShow CLI'
    }
  } catch {
  }

  return `Supadata only supports public YouTube, TikTok, Instagram, X/Twitter, Facebook, or direct media/file URLs; unsupported source URL: ${sourceUrl}`
}

export const ensureSupadataSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('SUPADATA_API_KEY')
  if (!apiKey) {
    throw new Error('SUPADATA_API_KEY environment variable is required for Supadata transcription')
  }
}
