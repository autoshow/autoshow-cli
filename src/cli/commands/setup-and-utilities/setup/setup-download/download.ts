import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  DownloadFlowId,
  DownloadProfile,
  DownloadProfileId,
  DownloadRequest,
  DownloadResult
} from '~/types'

const BUN_FETCH_TIMEOUT_MS = 60_000

const BUN_FETCH_PROFILES: Record<DownloadProfileId, DownloadProfile> = {
  'bun-fetch-default': {
    engine: 'bun-fetch',
    profileId: 'bun-fetch-default',
    flags: []
  }
}

const FLOW_DEFAULTS: Record<DownloadFlowId, DownloadProfileId> = {
  'uv-installer': 'bun-fetch-default',
  'yt-dlp-binary': 'bun-fetch-default',
  'whisper-model': 'bun-fetch-default',
  'llama-tarball': 'bun-fetch-default'
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
  const response = await fetch(req.url, {
    headers: buildFetchHeaders(req),
    signal: AbortSignal.timeout(BUN_FETCH_TIMEOUT_MS),
    redirect: 'follow'
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

const buildTarArgsFromFile = (req: DownloadRequest, archivePath: string): string[] => {
  if (!req.pipeArgs) {
    return ['-xzf', archivePath, '--strip-components=1', '-C', req.destination]
  }

  return req.pipeArgs.map(arg => arg === '-' ? archivePath : arg)
}

const runBunFetchPipeToTar = async (req: DownloadRequest): Promise<{ exitCode: number }> => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'autoshow-pipe-to-tar-'))
  const tempArchivePath = join(tempRoot, 'archive.tar.gz')

  try {
    const response = await fetchWithDefaults(req)
    const buffer = await response.arrayBuffer()
    await Bun.write(tempArchivePath, buffer)

    const tarArgs = buildTarArgsFromFile(req, tempArchivePath)
    const tarProc = Bun.spawn(
      ['tar', ...tarArgs],
      { stdout: 'inherit', stderr: 'inherit', ...(req.pipeCwd ? { cwd: req.pipeCwd } : {}) }
    )

    const tarCode = await tarProc.exited
    return { exitCode: tarCode }
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }
}

const runBunFetchScriptInstaller = async (req: DownloadRequest): Promise<{ exitCode: number }> => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'autoshow-script-installer-'))
  const tempFile = join(tempRoot, 'installer.sh')

  try {
    const response = await fetchWithDefaults(req)
    const buffer = await response.arrayBuffer()
    await Bun.write(tempFile, buffer)

    const shProc = Bun.spawn(['sh', tempFile], { stdout: 'inherit', stderr: 'inherit' })
    const shCode = await shProc.exited
    return { exitCode: shCode }
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }
}


export const downloadFile = async (req: DownloadRequest): Promise<DownloadResult> => {
  const profile = resolveProfile(req)
  const startedAt = Date.now()

  if (req.mode === 'pipe-to-tar') {
    const result = await runBunFetchPipeToTar(req)
    if (result.exitCode !== 0) {
      throw new Error(`Download + extract failed (exit code ${result.exitCode})`)
    }
    return {
      success: true,
      bytes: 0,
      engine: profile.engine,
      profileId: profile.profileId,
      durationMs: Date.now() - startedAt
    }
  }

  if (req.mode === 'script-installer') {
    const result = await runBunFetchScriptInstaller(req)
    if (result.exitCode !== 0) {
      throw new Error(`Script installer download failed (exit code ${result.exitCode})`)
    }
    return {
      success: true,
      bytes: 0,
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
