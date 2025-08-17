import { l } from '@/logging'
import type { ProcessingOptions } from '@/types'

export function buildUploadCommand(
  filePath: string,
  bucketName: string,
  s3Key: string,
  options: ProcessingOptions
): string {
  const p = '[save/command]'
  l.dim(`${p} Building upload command for ${options.save}`)
  
  if (options.save === 'r2') {
    return ''
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
    return ''
  }
  
  return `aws s3api ${command} --bucket "${bucketName}"${additionalArgs || ''}`
}