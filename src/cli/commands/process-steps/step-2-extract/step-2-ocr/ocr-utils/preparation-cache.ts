import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { OcrCloudStagingObject, OcrPreparationCache } from '~/types'

export const createOcrPreparationCache = (): OcrPreparationCache => ({
  pageTriage: new Map(),
  renderedPages: new Map(),
  cloudStaging: new Map(),
  cleanupCallbacks: [],
  nextRenderedPageIndex: 0
})

const getCacheTempDir = async (cache: OcrPreparationCache): Promise<string> => {
  if (!cache.tempDir) {
    cache.tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-prep-'))
  }
  return cache.tempDir
}

export const getCachedRenderedPageImage = async (
  cache: OcrPreparationCache | undefined,
  keyParts: Record<string, unknown>,
  render: (outputPath: string) => Promise<void>
): Promise<{ imagePath: string, cached: boolean }> => {
  if (!cache) {
    throw new Error('OCR rendered page cache was not initialized')
  }

  const key = JSON.stringify(keyParts)
  const existing = cache.renderedPages.get(key)
  if (existing) {
    return { imagePath: await existing, cached: true }
  }

  const promise = (async () => {
    const tempDir = await getCacheTempDir(cache)
    cache.nextRenderedPageIndex += 1
    const imagePath = join(tempDir, `page-${String(cache.nextRenderedPageIndex).padStart(4, '0')}.png`)
    await render(imagePath)
    return imagePath
  })()
  cache.renderedPages.set(key, promise)
  promise.catch(() => {
    if (cache.renderedPages.get(key) === promise) {
      cache.renderedPages.delete(key)
    }
  })

  return { imagePath: await promise, cached: true }
}

export const getCachedCloudStagingObject = async (
  cache: OcrPreparationCache | undefined,
  keyParts: Record<string, unknown>,
  stage: () => Promise<OcrCloudStagingObject>
): Promise<OcrCloudStagingObject> => {
  if (!cache) {
    return await stage()
  }

  const key = JSON.stringify(keyParts)
  const existing = cache.cloudStaging.get(key)
  if (existing) {
    return await existing
  }

  const promise = (async () => {
    const staged = await stage()
    if (staged.cleanup) {
      cache.cleanupCallbacks.push(staged.cleanup)
    }
    return staged
  })()
  cache.cloudStaging.set(key, promise)
  promise.catch(() => {
    if (cache.cloudStaging.get(key) === promise) {
      cache.cloudStaging.delete(key)
    }
  })

  return await promise
}

export const cleanupOcrPreparationCache = async (
  cache: OcrPreparationCache
): Promise<void> => {
  await Promise.all(cache.cleanupCallbacks.splice(0).map(async (cleanup) => {
    try {
      await cleanup()
    } catch {
      // Best-effort cleanup; provider-specific callers log remote cleanup failures.
    }
  }))
  if (cache.tempDir) {
    await rm(cache.tempDir, { recursive: true, force: true })
  }
}
