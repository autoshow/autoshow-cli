import { stat } from 'node:fs/promises'
import type {
  DownloadFlowId,
  DownloadProfile,
  DownloadProfileId,
  DownloadRequest,
  DownloadResult
} from '~/types'
import { extractTarGzBuffer } from './tar-gz'

const BUN_FETCH_TIMEOUT_MS = 60_000

const BUN_FETCH_PROFILES: Record<DownloadProfileId, DownloadProfile> = {
  'bun-fetch-default': {
    engine: 'bun-fetch',
    profileId: 'bun-fetch-default',
    flags: []
  }
}

const FLOW_DEFAULTS: Record<DownloadFlowId, DownloadProfileId> = {
  'uv-release': 'bun-fetch-default',
  'yt-dlp-binary': 'bun-fetch-default',
  'whisper-model': 'bun-fetch-default',
  'llama-tarball': 'bun-fetch-default',
  'whisper-source': 'bun-fetch-default',
  'reverb-source': 'bun-fetch-default',
  'reverb-model': 'bun-fetch-default'
}

const resolveProfile = (req: DownloadRequest): DownloadProfile => {
  const targetProfileId = req.flowId ? FLOW_DEFAULTS[req.flowId] : 'bun-fetch-default'
  const selected = BUN_FETCH_PROFILES[targetProfileId]
  if (!selected) return BUN_FETCH_PROFILES['bun-fetch-default']!
  return selected
}

const getFileSize = async (path: string): Promise<number | null> => {
  try {
    const s = await stat(path)
    return s.size
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

const buildFetchHeaders = (req: DownloadRequest): Record<string, string> | undefined => {
  if (!req.headers) return undefined
  return req.headers
}

const fetchWithDefaults = async (req: DownloadRequest): Promise<Response> => {
  const headers = buildFetchHeaders(req)
  const response = await fetch(req.url, {
    signal: AbortSignal.timeout(BUN_FETCH_TIMEOUT_MS),
    redirect: 'follow',
    ...(headers ? { headers } : {})
  })
  if (!response.ok) {
    throw new Error(`bun-fetch download failed: HTTP ${response.status} ${response.statusText}`)
  }
  return response
}

const runBunFetchFile = async (req: DownloadRequest): Promise<void> => {
  const response = await fetchWithDefaults(req)
  const buffer = await response.arrayBuffer()
  await Bun.write(req.destination, buffer)
}

export const downloadFile = async (req: DownloadRequest): Promise<DownloadResult> => {
  const profile = resolveProfile(req)
  const startedAt = Date.now()

  if (req.mode === 'tar-gz') {
    const response = await fetchWithDefaults(req)
    const buffer = await response.arrayBuffer()
    const bytes = buffer.byteLength
    if (req.expectedMinBytes !== undefined && bytes < req.expectedMinBytes) {
      throw new Error(`Downloaded archive too small: ${bytes} bytes (expected >= ${req.expectedMinBytes})`)
    }
    await extractTarGzBuffer(buffer, {
      destination: req.destination,
      ...(req.stripComponents !== undefined ? { stripComponents: req.stripComponents } : {})
    })
    return {
      success: true,
      bytes,
      engine: profile.engine,
      profileId: profile.profileId,
      durationMs: Date.now() - startedAt
    }
  }

  await runBunFetchFile(req)

  const bytes = (await getFileSize(req.destination)) ?? 0

  if (req.expectedMinBytes !== undefined && bytes < req.expectedMinBytes) {
    throw new Error(`Downloaded file too small: ${bytes} bytes (expected >= ${req.expectedMinBytes})`)
  }

  return {
    success: true,
    bytes,
    engine: profile.engine,
    profileId: profile.profileId,
    durationMs: Date.now() - startedAt
  }
}
