export interface ConfigureOptions {
  service?: 's3' | 'r2' | 'all'
  reset?: boolean
  test?: boolean
  [key: string]: any
}

export interface ServiceConfigurationStatus {
  configured: boolean
  tested: boolean
  working: boolean
  settings: Record<string, string>
  issues: string[]
}

export interface CredentialValidationResult {
  valid: boolean
  error?: string
  details?: Record<string, any>
}

export interface EnvVariable {
  key: string
  value: string
  description?: string
}

export interface ConfigStatus {
  service: string
  configured: boolean
  tested: boolean
  issues: string[]
  details: Record<string, string>
}

export interface S3ConfigResult {
  configured: boolean
  tested: boolean
  issues: string[]
  details: Record<string, string>
}

export interface CloudflareApiToken {
  value: string
  id: string
  name: string
}