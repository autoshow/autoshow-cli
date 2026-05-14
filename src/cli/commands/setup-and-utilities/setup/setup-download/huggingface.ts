import { mkdir, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { withRetry, classifyFetchRetry } from '~/utils/retries'

export type HuggingFaceFileEntry = {
  path: string
  type?: string
  size?: number
}

export type HuggingFaceDownloadOptions = {
  repoId: string
  revision?: string
  token: string
  destination: string
  allowPatterns?: string[]
  requiredFiles?: string[]
  fetchImpl?: typeof fetch
  maxAttempts?: number
  retryDelayMs?: number
}

const DEFAULT_REVISION = 'main'
const HF_DOWNLOAD_TIMEOUT_MS = 120_000

const encodeRepoPath = (value: string): string =>
  value.split('/').map((part) => encodeURIComponent(part)).join('/')

const buildHeaders = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`
})

export const buildHuggingFaceTreeUrl = (repoId: string, revision = DEFAULT_REVISION): string =>
  `https://huggingface.co/api/models/${encodeRepoPath(repoId)}/tree/${encodeURIComponent(revision)}?recursive=1`

export const buildHuggingFaceResolveUrl = (
  repoId: string,
  revision: string,
  path: string
): string =>
  `https://huggingface.co/${encodeRepoPath(repoId)}/resolve/${encodeURIComponent(revision)}/${encodeRepoPath(path)}`

const escapeRegex = (value: string): string => value.replace(/[.+?^${}()|[\]\\]/g, '\\$&')

const globToRegex = (pattern: string): RegExp => {
  const source = pattern
    .split('**')
    .map((chunk) => chunk.split('*').map(escapeRegex).join('[^/]*'))
    .join('.*')
  return new RegExp(`^${source}$`)
}

export const matchesAllowPattern = (path: string, allowPatterns: readonly string[] | undefined): boolean => {
  if (!allowPatterns || allowPatterns.length === 0) return true
  return allowPatterns.some((pattern) => globToRegex(pattern).test(path))
}

const fetchWithRetry = async (
  url: string,
  options: Pick<HuggingFaceDownloadOptions, 'fetchImpl' | 'maxAttempts' | 'retryDelayMs' | 'token'>
): Promise<Response> => {
  const fetchImpl = options.fetchImpl ?? fetch
  return await withRetry(
    {
      retryClass: 'setup_download',
      operationName: 'huggingface-download',
      policy: {
        maxAttempts: options.maxAttempts ?? 3,
        baseDelayMs: options.retryDelayMs ?? 1_000,
        maxDelayMs: options.retryDelayMs ?? 1_000,
        jitter: false,
        exponential: false
      }
    },
    async () => {
      const response = await fetchImpl(url, {
        headers: buildHeaders(options.token),
        redirect: 'follow',
        signal: AbortSignal.timeout(HF_DOWNLOAD_TIMEOUT_MS)
      })

      if (!response.ok) {
        const error = new Error(`Hugging Face download failed: HTTP ${response.status} ${response.statusText}`)
        ;(error as Error & { status?: number, headers?: Headers }).status = response.status
        ;(error as Error & { status?: number, headers?: Headers }).headers = response.headers
        throw error
      }

      return response
    },
    (error) => classifyFetchRetry(error, 'setup_download')
  )
}

const normalizeTreeEntry = (entry: unknown): HuggingFaceFileEntry | null => {
  if (!entry || typeof entry !== 'object') return null
  const record = entry as Record<string, unknown>
  const path = typeof record['path'] === 'string'
    ? record['path']
    : typeof record['rfilename'] === 'string'
      ? record['rfilename']
      : undefined
  if (!path) return null
  return {
    path,
    ...(typeof record['type'] === 'string' ? { type: record['type'] } : {}),
    ...(typeof record['size'] === 'number' ? { size: record['size'] } : {})
  }
}

export const listHuggingFaceRepoFiles = async (
  options: Pick<HuggingFaceDownloadOptions, 'repoId' | 'revision' | 'token' | 'fetchImpl' | 'maxAttempts' | 'retryDelayMs'>
): Promise<HuggingFaceFileEntry[]> => {
  const revision = options.revision ?? DEFAULT_REVISION
  const response = await fetchWithRetry(buildHuggingFaceTreeUrl(options.repoId, revision), options)
  const payload = await response.json()
  if (!Array.isArray(payload)) {
    throw new Error(`Unexpected Hugging Face file listing for ${options.repoId}`)
  }

  return payload
    .map(normalizeTreeEntry)
    .filter((entry): entry is HuggingFaceFileEntry => entry !== null)
    .filter((entry) => entry.type === undefined || entry.type === 'file')
}

const validateRequiredFiles = async (destination: string, requiredFiles: readonly string[] | undefined): Promise<void> => {
  if (!requiredFiles || requiredFiles.length === 0) return

  const missing: string[] = []
  for (const file of requiredFiles) {
    if (!await Bun.file(join(destination, file)).exists()) {
      missing.push(file)
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required Hugging Face files: ${missing.join(', ')}`)
  }
}

const downloadOneFile = async (
  file: HuggingFaceFileEntry,
  options: Required<Pick<HuggingFaceDownloadOptions, 'repoId' | 'token' | 'destination'>> &
    Pick<HuggingFaceDownloadOptions, 'revision' | 'fetchImpl' | 'maxAttempts' | 'retryDelayMs'>
): Promise<void> => {
  const revision = options.revision ?? DEFAULT_REVISION
  const targetPath = join(options.destination, file.path)
  const tempPath = `${targetPath}.download-${process.pid}-${Date.now()}`
  await mkdir(dirname(targetPath), { recursive: true })

  try {
    const response = await fetchWithRetry(
      buildHuggingFaceResolveUrl(options.repoId, revision, file.path),
      options
    )
    const data = await response.arrayBuffer()
    await Bun.write(tempPath, data)
    await rename(tempPath, targetPath)
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined)
    throw error
  }
}

export const downloadHuggingFaceSnapshot = async (options: HuggingFaceDownloadOptions): Promise<void> => {
  if (!options.token.trim()) {
    throw new Error('HUGGINGFACE_TOKEN is required to download Hugging Face assets')
  }

  const files = (await listHuggingFaceRepoFiles(options))
    .filter((file) => matchesAllowPattern(file.path, options.allowPatterns))

  if (files.length === 0) {
    throw new Error(`No Hugging Face files matched ${options.repoId}`)
  }

  await mkdir(options.destination, { recursive: true })
  for (const file of files) {
    await downloadOneFile(file, {
      repoId: options.repoId,
      revision: options.revision ?? DEFAULT_REVISION,
      token: options.token,
      destination: options.destination,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options.maxAttempts !== undefined ? { maxAttempts: options.maxAttempts } : {}),
      ...(options.retryDelayMs !== undefined ? { retryDelayMs: options.retryDelayMs } : {})
    })
  }

  await validateRequiredFiles(options.destination, options.requiredFiles)
}
