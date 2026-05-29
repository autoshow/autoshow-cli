import { readEnv } from '~/utils/validate/env-utils'

const UNSTRUCTURED_API_BASE_URL = 'https://platform.unstructuredapp.io'

export const getUnstructuredApiKey = (): string | undefined => readEnv('UNSTRUCTURED_API_KEY')

const resolveUnstructuredApiBaseUrl = (): string => {
  const configured = readEnv('UNSTRUCTURED_API_URL')
  const baseUrl = configured && configured.length > 0 ? configured : UNSTRUCTURED_API_BASE_URL
  return baseUrl.replace(/\/+$/, '')
}

export const resolveUnstructuredApiUrl = (path: string): string => {
  const baseUrl = resolveUnstructuredApiBaseUrl()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return baseUrl.endsWith('/api/v1')
    ? `${baseUrl}${normalizedPath}`
    : `${baseUrl}/api/v1${normalizedPath}`
}

export const ensureUnstructuredOcrSetup = async (): Promise<void> => {
  const apiKey = getUnstructuredApiKey()
  if (!apiKey) {
    throw new Error('UNSTRUCTURED_API_KEY environment variable is required for Unstructured OCR')
  }
}
