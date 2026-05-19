import * as l from '~/utils/logger'
import { isDirectMediaUrl } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { logProviderReadiness } from '~/cli/commands/setup-and-utilities/setup/setup-logging'

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

export const getSupadataBaseUrl = (): string =>
  readEnv('SUPADATA_BASE_URL') ?? 'https://api.supadata.ai/v1'

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

export const setupSupadataStt = async (): Promise<void> => {
  const apiKey = readEnv('SUPADATA_API_KEY')
  if (apiKey) {
    logProviderReadiness(l, {
      provider: 'supadata',
      capability: 'transcription',
      status: 'ready',
      envKey: 'SUPADATA_API_KEY',
      detail: getSupadataBaseUrl()
    })
  } else {
    logProviderReadiness(l, {
      provider: 'supadata',
      capability: 'transcription',
      status: 'missing',
      envKey: 'SUPADATA_API_KEY',
      detail: 'Set SUPADATA_API_KEY environment variable to use Supadata transcription'
    })
  }
}

export const ensureSupadataSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('SUPADATA_API_KEY')
  if (!apiKey) {
    throw new Error('SUPADATA_API_KEY environment variable is required for Supadata transcription')
  }
}
