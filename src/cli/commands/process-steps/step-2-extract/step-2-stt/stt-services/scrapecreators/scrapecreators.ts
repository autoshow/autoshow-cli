import { SCRAPECREATORS_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'

const YOUTUBE_HOST_PATTERNS = [
  /(^|\.)youtube\.com$/i,
  /(^|\.)youtu\.be$/i
]

export const getScrapeCreatorsBaseUrl = (): string => SCRAPECREATORS_DEFAULT_BASE_URL

export const isScrapeCreatorsSupportedSourceUrl = (
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

    const hostname = parsed.hostname.toLowerCase()
    return YOUTUBE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
  } catch {
    return false
  }
}

export const describeScrapeCreatorsUnsupportedSource = (
  sourceUrl: string | undefined
): string => {
  if (typeof sourceUrl !== 'string' || sourceUrl.length === 0) {
    return 'ScrapeCreators YouTube transcript retrieval requires a YouTube URL and cannot transcribe local file inputs through the AutoShow CLI'
  }

  try {
    const parsed = new URL(sourceUrl)
    if (parsed.protocol === 'file:') {
      return 'ScrapeCreators YouTube transcript retrieval requires a YouTube URL and cannot transcribe local file inputs through the AutoShow CLI'
    }
  } catch {
  }

  return `ScrapeCreators YouTube transcript retrieval only supports youtube.com and youtu.be URLs; unsupported source URL: ${sourceUrl}`
}

export const ensureScrapeCreatorsSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('SCRAPECREATORS_API_KEY')
  if (!apiKey) {
    throw new Error('SCRAPECREATORS_API_KEY environment variable is required for ScrapeCreators YouTube transcript retrieval')
  }
}
