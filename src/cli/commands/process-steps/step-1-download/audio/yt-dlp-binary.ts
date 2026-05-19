import { existsSync } from 'node:fs'
import { ytDlpManagedBinaryPath } from '~/utils/runtime-paths'

export const AUTOSHOW_YTDLP_BIN_ENV = 'AUTOSHOW_YTDLP_BIN'

export type YtDlpBinarySource = 'env' | 'managed' | 'path'

export type ResolvedYtDlpBinary = {
  path: string
  source: YtDlpBinarySource
}

export type ResolveYtDlpBinaryOptions = {
  env?: Record<string, string | undefined>
  managedPath?: string
  exists?: (path: string) => boolean
  which?: (command: string) => string | null
}

export const resolveYtDlpBinaryInfo = (
  options: ResolveYtDlpBinaryOptions = {}
): ResolvedYtDlpBinary | undefined => {
  const env = options.env ?? process.env
  const managedPath = options.managedPath ?? ytDlpManagedBinaryPath
  const exists = options.exists ?? existsSync
  const which = options.which ?? ((command: string) => Bun.which(command))
  const override = env[AUTOSHOW_YTDLP_BIN_ENV]?.trim()

  if (override) {
    return { path: override, source: 'env' }
  }

  if (exists(managedPath)) {
    return { path: managedPath, source: 'managed' }
  }

  const pathBinary = which('yt-dlp')
  return pathBinary ? { path: pathBinary, source: 'path' } : undefined
}

export const resolveYtDlpBinary = (
  options: ResolveYtDlpBinaryOptions = {}
): string | undefined => resolveYtDlpBinaryInfo(options)?.path

export const hasYtDlpBinary = (
  options: ResolveYtDlpBinaryOptions = {}
): boolean => resolveYtDlpBinaryInfo(options) !== undefined

export const getYtDlpBinary = (): string => resolveYtDlpBinary() ?? 'yt-dlp'
