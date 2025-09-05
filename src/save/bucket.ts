import { getOrCreateBucket as factoryGetOrCreateBucket } from './service-factory'
import type { ProcessingOptions } from '@/text/text-types'

export async function getOrCreateBucket(options: ProcessingOptions): Promise<string | null> {
  return factoryGetOrCreateBucket(options)
}