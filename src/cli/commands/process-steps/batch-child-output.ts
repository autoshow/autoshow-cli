import { mkdir } from 'node:fs/promises'
import { sanitizeTitleSlug } from './step-1-download/audio/metadata-utils'
import type { BatchChildDirectoryIdentity, BatchChildRunContext } from '~/types'

export const normalizeBatchChildPublishedAt = (
  publishedAt?: string
): string | undefined => {
  if (!publishedAt || publishedAt.length === 0) {
    return undefined
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
    return publishedAt
  }

  const parsed = new Date(publishedAt)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const resolveBatchChildSlug = (
  identity: BatchChildDirectoryIdentity
): string => {
  const slugCandidate = identity.slug ?? identity.title ?? identity.fallbackLabel ?? 'item'
  const slug = sanitizeTitleSlug(slugCandidate, 180)
  return slug.length > 0 ? slug : 'item'
}

export const buildBatchChildDirectoryStem = (
  identity: BatchChildDirectoryIdentity
): string => {
  const slug = resolveBatchChildSlug(identity)
  const publishedAt = normalizeBatchChildPublishedAt(identity.publishedAt)
  return publishedAt ? `${publishedAt}-${slug}` : slug
}

export const reserveBatchChildOutputDir = async (
  context: BatchChildRunContext | undefined,
  identity: BatchChildDirectoryIdentity
): Promise<string | undefined> => {
  if (!context) {
    return undefined
  }

  if (context.outputDir) {
    return context.outputDir
  }

  const stem = buildBatchChildDirectoryStem(identity)

  for (let counter = 1; ; counter += 1) {
    const candidateName = counter === 1 ? stem : `${stem}-${counter}`
    const candidatePath = `${context.batchDir}/${candidateName}`

    try {
      await mkdir(candidatePath)
      context.outputDir = candidatePath
      return candidatePath
    } catch (error) {
      const code = error instanceof Error && 'code' in error
        ? (error as Error & { code?: string }).code
        : undefined

      if (code === 'EEXIST') {
        continue
      }

      throw error
    }
  }
}
