import { l } from '@/logging'
import type { ProcessingOptions } from '@/types'

export function buildUploadCommand(
  filePath: string,
  bucketName: string,
  s3Key: string,
  _options: ProcessingOptions
): string {
  const p = '[save/aws/command]'
  l.dim(`${p} Building S3 upload command`)
  
  return `aws s3 cp "${filePath}" "s3://${bucketName}/${s3Key}"`
}

export function buildBucketCommand(
  command: string,
  bucketName: string,
  _options: ProcessingOptions,
  additionalArgs?: string
): string {
  const p = '[save/aws/command]'
  l.dim(`${p} Building S3 bucket command: ${command}`)
  
  return `aws s3api ${command} --bucket "${bucketName}"${additionalArgs || ''}`
}