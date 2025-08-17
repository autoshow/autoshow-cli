import { l } from '@/logging'
import { getOrCreateBucket as factoryGetOrCreateBucket } from './service-factory'
import type { ProcessingOptions } from '@/types'

export async function getOrCreateBucket(options: ProcessingOptions): Promise<string | null> {
  const p = '[save/bucket]'
  l.dim(`${p} Delegating bucket operations to service factory`)
  
  return factoryGetOrCreateBucket(options)
}