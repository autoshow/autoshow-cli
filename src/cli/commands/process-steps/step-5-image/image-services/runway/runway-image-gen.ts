import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupRunwayImageGen = async (): Promise<void> => {
  const apiKey = readEnv('RUNWAYML_API_SECRET')
  if (apiKey) {
    l.write('success', 'RUNWAYML_API_SECRET found — Runway image generation ready')
  } else {
    l.warn('RUNWAYML_API_SECRET not set — Runway image generation will not work until set')
    l.write('info', 'Set RUNWAYML_API_SECRET environment variable to use Runway image models')
  }
}

export const ensureRunwayImageGenSetup = async (): Promise<void> => {
  const apiKey = readEnv('RUNWAYML_API_SECRET')
  if (!apiKey) {
    throw new Error('RUNWAYML_API_SECRET environment variable is required for Runway image generation')
  }
}
