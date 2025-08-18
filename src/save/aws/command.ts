import type { ProcessingOptions } from '@/text/text-types'

export function buildUploadCommand(
  filePath: string,
  bucketName: string,
  s3Key: string,
  _options: ProcessingOptions
): string {
  return `aws s3 cp "${filePath}" "s3://${bucketName}/${s3Key}"`
}

export function buildBucketCommand(
  command: string,
  bucketName: string,
  _options: ProcessingOptions,
  additionalArgs?: string
): string {
  return `aws s3api ${command} --bucket "${bucketName}"${additionalArgs || ''}`
}