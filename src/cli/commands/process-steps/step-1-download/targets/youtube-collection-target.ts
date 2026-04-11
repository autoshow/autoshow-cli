import * as v from 'valibot'
import * as l from '~/logger'
import { exec } from '~/utils/cli-utils'
import type { ProcessCommand, RuntimeOptions } from '~/types'
import { isOcrCommand } from '~/types'
import { isLikelyUrl, processBatch } from './target-utils'
import { processSingleTarget } from './single-target'
import { validateDataSafe } from '~/utils/validate/validation'
import { buildYtDlpListArgs, buildYtDlpFailureMessage } from '../audio/yt-dlp-options'

const YtDlpPlaylistItemSchema = v.object({
  webpage_url: v.optional(v.string(), undefined),
  url: v.optional(v.string(), undefined)
})

const ensureAbsoluteYoutubeUrl = (idOrUrl: string): string => {
  if (!idOrUrl) return ''
  if (idOrUrl.startsWith('http://') || idOrUrl.startsWith('https://')) return idOrUrl
  return `https://www.youtube.com/watch?v=${idOrUrl}`
}

const isYoutubeUrl = (s: string): boolean => {
  try {
    const u = new URL(s)
    const h = u.hostname.toLowerCase()
    return h.includes('youtube.com') || h.includes('youtu.be')
  } catch {
    return false
  }
}

export const buildYoutubeCollectionListArgs = async (url: string): Promise<string[]> =>
  await buildYtDlpListArgs(url, { all: true, order: 'newest' })

const getYoutubeCollectionItems = async (url: string): Promise<string[]> => {
  try {
    const args = await buildYoutubeCollectionListArgs(url)
    const res = await exec('yt-dlp', args)
    if (res.exitCode !== 0) {
      l.warn(buildYtDlpFailureMessage('list', res.stderr || res.stdout || 'unknown yt-dlp error'))
      return []
    }
    const lines = res.stdout.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
    const items: string[] = lines.map((line: string) => {
      try {
        const raw: unknown = JSON.parse(line)
        const parsed = validateDataSafe(YtDlpPlaylistItemSchema, raw, 'yt-dlp playlist item')
        if (!parsed) return ''
        const direct = parsed.webpage_url ?? ''
        const id = parsed.url ?? ''
        const finalUrl = direct || ensureAbsoluteYoutubeUrl(id)
        return finalUrl
      } catch {
        return ''
      }
    }).filter((u: string) => u.length > 0)
    const uniq = Array.from(new Set(items))
    return uniq
  } catch {
    l.warn(`Failed to enumerate YouTube items`)
    return []
  }
}

export const resolveYoutubeCollectionItems = async (
  resolvedTarget: string,
  command: ProcessCommand
): Promise<string[] | null> => {
  if (!isLikelyUrl(resolvedTarget) || !isYoutubeUrl(resolvedTarget) || isOcrCommand(command)) {
    return null
  }

  const items = await getYoutubeCollectionItems(resolvedTarget)
  if (items.length <= 1) {
    return null
  }

  return items
}

export const tryHandleYoutubeCollectionTarget = async (
  resolvedTarget: string,
  command: ProcessCommand,
  opts: RuntimeOptions
): Promise<boolean> => {
  const items = await resolveYoutubeCollectionItems(resolvedTarget, command)
  if (!items) {
    return false
  }

  l.info(`Detected YouTube collection URL, processing ${items.length} videos`)
  const { fail, failureExitCode } = await processBatch(items, 'youtube_collection', command, opts, processSingleTarget)
  if (items.length > 0 && fail === items.length) {
    const error = new Error(`Batch processing failed for ${fail} item(s)`)
    if (failureExitCode !== undefined) {
      ;(error as Error & { exitCode?: number }).exitCode = failureExitCode
    }
    throw error
  }

  return true
}
