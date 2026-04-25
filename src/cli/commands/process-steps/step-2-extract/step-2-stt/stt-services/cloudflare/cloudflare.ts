import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupCloudflareStt = async (): Promise<void> => {
  const apiToken = readEnv('CLOUDFLARE_API_TOKEN')
  const accountId = readEnv('CLOUDFLARE_ACCOUNT_ID')
  if (apiToken && accountId) {
    l.write('success', 'CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID found — Cloudflare transcription ready')
  } else {
    if (!apiToken) l.warn('CLOUDFLARE_API_TOKEN not set — Cloudflare transcription will not work until set')
    if (!accountId) l.warn('CLOUDFLARE_ACCOUNT_ID not set — Cloudflare transcription will not work until set')
    l.write('info', 'Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID environment variables to use Cloudflare transcription')
  }
}

export const ensureCloudflareSttSetup = async (): Promise<void> => {
  const missing = [
    readEnv('CLOUDFLARE_API_TOKEN') ? undefined : 'CLOUDFLARE_API_TOKEN',
    readEnv('CLOUDFLARE_ACCOUNT_ID') ? undefined : 'CLOUDFLARE_ACCOUNT_ID'
  ].filter((value): value is string => value !== undefined)

  if (missing.length > 0) {
    throw new Error(`${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} required for Cloudflare transcription`)
  }
}
