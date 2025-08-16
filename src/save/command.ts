import { l } from '@/logging'
import { getEndpointFlag } from './services/s3'
import { getB2EnvironmentVars } from './services/b2'
import type { ProcessingOptions } from '@/types'

export function buildCommandWithEnv(baseCommand: string, options: ProcessingOptions): string {
  const p = '[save/command]'
  if (options.save === 'b2') {
    const b2Env = getB2EnvironmentVars()
    if (Object.keys(b2Env).length > 0) {
      const envVars = Object.entries(b2Env)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ')
      l.dim(`${p} Adding B2 environment variables to command`)
      return `${envVars} ${baseCommand}`
    }
  }
  return baseCommand
}

export function buildUploadCommand(
  filePath: string,
  bucketName: string,
  s3Key: string,
  options: ProcessingOptions
): string {
  const p = '[save/command]'
  l.dim(`${p} Building upload command for ${options.save}`)
  
  if (options.save === 'r2') {
    const profile = process.env['AWS_PROFILE'] || 'r2'
    const baseCommand = `aws s3 cp "${filePath}" "s3://${bucketName}/${s3Key}" --profile ${profile}${getEndpointFlag(options)}`
    return baseCommand
  }
  if (options.save === 'b2') {
    const baseCommand = `aws s3 cp "${filePath}" "s3://${bucketName}/${s3Key}"${getEndpointFlag(options)}`
    return buildCommandWithEnv(baseCommand, options)
  }
  return `aws s3 cp "${filePath}" "s3://${bucketName}/${s3Key}"`
}

export function buildBucketCommand(
  command: string,
  bucketName: string,
  options: ProcessingOptions,
  additionalArgs?: string
): string {
  const p = '[save/command]'
  l.dim(`${p} Building bucket command for ${options.save}: ${command}`)
  
  if (options.save === 'r2') {
    const profile = process.env['AWS_PROFILE'] || 'r2'
    const baseCommand = `aws s3api ${command} --bucket "${bucketName}" --profile ${profile}${getEndpointFlag(options)}${additionalArgs || ''}`
    return baseCommand
  }
  if (options.save === 'b2') {
    const baseCommand = `aws s3api ${command} --bucket "${bucketName}"${getEndpointFlag(options)}${additionalArgs || ''}`
    return buildCommandWithEnv(baseCommand, options)
  }
  return `aws s3api ${command} --bucket "${bucketName}"${additionalArgs || ''}`
}