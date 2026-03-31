import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  DownloadFlowId,
  DownloadProfile,
  DownloadProfileId,
  DownloadRequest,
  DownloadResult,
  ResolvedEngine
} from '~/types'
import { commandExists } from '~/utils/cli-utils'
import * as l from '~/logger'

const BUN_FETCH_TIMEOUT_MS = 60_000

const BUN_FETCH_PROFILES: Record<string, DownloadProfile> = {
  'bun-fetch-default': {
    engine: 'bun-fetch',
    profileId: 'bun-fetch-default',
    flags: []
  }
}

const WGET2_PROFILES: Record<string, DownloadProfile> = {
  'wget2-default': {
    engine: 'wget2',
    profileId: 'wget2-default',
    flags: [
      '--quiet',
      '--tries=3',
      '--timeout=30',
      '--read-timeout=30'
    ]
  }
}

const FLOW_DEFAULTS: Record<DownloadFlowId, { engine: ResolvedEngine, profileId: string }> = {
  'uv-installer': { engine: 'bun-fetch', profileId: 'bun-fetch-default' },
  'yt-dlp-binary': { engine: 'bun-fetch', profileId: 'bun-fetch-default' },
  'whisper-model': { engine: 'wget2', profileId: 'wget2-default' },
  'llama-tarball': { engine: 'wget2', profileId: 'wget2-default' }
}

const downloadFallbackEvents: string[] = []

const noteDownloadFallback = (message: string): void => {
  downloadFallbackEvents.push(message)
}

export const consumeDownloadFallbackEvents = (): string[] => {
  const events = [...downloadFallbackEvents]
  downloadFallbackEvents.length = 0
  return events
}

const resolveProfile = (req: DownloadRequest): DownloadProfile => {
  let targetEngine: ResolvedEngine
  let targetProfileId: string

  if (req.flowId && FLOW_DEFAULTS[req.flowId]) {
    const defaults = FLOW_DEFAULTS[req.flowId]
    targetEngine = defaults.engine
    targetProfileId = defaults.profileId
  } else {
    targetEngine = 'bun-fetch'
    targetProfileId = 'bun-fetch-default'
  }

  if (targetEngine === 'wget2' && !commandExists('wget2')) {
    l.warn('wget2 not installed, falling back to bun-fetch')
    noteDownloadFallback('wget2 missing -> bun-fetch fallback')
    targetEngine = 'bun-fetch'
    targetProfileId = 'bun-fetch-default'
  }

  const profileLookups: Record<ResolvedEngine, Record<string, DownloadProfile>> = {
    'bun-fetch': BUN_FETCH_PROFILES,
    wget2: WGET2_PROFILES
  }

  const profiles = profileLookups[targetEngine]
  const selected = profiles[targetProfileId]
  if (!selected) return BUN_FETCH_PROFILES['bun-fetch-default']!
  return selected
}

const buildWget2Args = (req: DownloadRequest, profile: DownloadProfile): string[] => {
  const args = [...profile.flags]

  if (req.headers) {
    for (const [key, value] of Object.entries(req.headers)) {
      args.push(`--header=${key}: ${value}`)
    }
  }

  args.push('--output-document', req.destination, req.url)

  return args
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

const runDownloadThenTar = async (cmd: string, args: string[], req: DownloadRequest, archivePath: string): Promise<{ exitCode: number }> => {
  const dlProc = Bun.spawn([cmd, ...args], { stdout: 'inherit', stderr: 'inherit' })
  const dlCode = await dlProc.exited
  if (dlCode !== 0) {
    return { exitCode: dlCode }
  }

  const tarArgs = buildTarArgsFromFile(req, archivePath)
  const tarProc = Bun.spawn(
    ['tar', ...tarArgs],
    { stdout: 'inherit', stderr: 'inherit', ...(req.pipeCwd ? { cwd: req.pipeCwd } : {}) }
  )

  const tarCode = await tarProc.exited
  return { exitCode: tarCode }
}

const runWget2PipeToTar = async (req: DownloadRequest, profile: DownloadProfile): Promise<{ exitCode: number }> => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'autoshow-pipe-to-tar-'))
  const tempArchivePath = join(tempRoot, 'archive.tar.gz')

  try {
    const wget2Args = buildWget2Args(
      { ...req, destination: tempArchivePath, mode: 'file' },
      profile
    )
    return await runDownloadThenTar('wget2', wget2Args, req, tempArchivePath)
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }
}

const runCliScriptInstaller = async (cmd: string, args: string[], tempRoot: string, tempFile: string): Promise<{ exitCode: number }> => {
  try {
    const dlProc = Bun.spawn([cmd, ...args], { stdout: 'inherit', stderr: 'inherit' })
    const dlCode = await dlProc.exited
    if (dlCode !== 0) {
      return { exitCode: dlCode }
    }

    const shProc = Bun.spawn(['sh', tempFile], { stdout: 'inherit', stderr: 'inherit' })
    const shCode = await shProc.exited
    return { exitCode: shCode }
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }
}

const runWget2ScriptInstaller = async (req: DownloadRequest, profile: DownloadProfile): Promise<{ exitCode: number }> => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'autoshow-script-installer-'))
  const tempFile = join(tempRoot, 'installer.sh')

  const wget2Args = buildWget2Args(
    { ...req, destination: tempFile, mode: 'file' },
    profile
  )
  return await runCliScriptInstaller('wget2', wget2Args, tempRoot, tempFile)
}

const runPipeToTar = async (req: DownloadRequest, profile: DownloadProfile): Promise<{ exitCode: number }> => {
  switch (profile.engine) {
    case 'bun-fetch':
      return await runBunFetchPipeToTar(req)
    case 'wget2':
      return await runWget2PipeToTar(req, profile)
  }
}

const runScriptInstaller = async (req: DownloadRequest, profile: DownloadProfile): Promise<{ exitCode: number }> => {
  switch (profile.engine) {
    case 'bun-fetch':
      return await runBunFetchScriptInstaller(req)
    case 'wget2':
      return await runWget2ScriptInstaller(req, profile)
  }
}

const runFileDownload = async (req: DownloadRequest, profile: DownloadProfile): Promise<void> => {
  switch (profile.engine) {
    case 'bun-fetch':
      await runBunFetchFile(req)
      return
    case 'wget2': {
      const args = buildWget2Args(req, profile)
      const proc = Bun.spawn(['wget2', ...args], { stdout: 'inherit', stderr: 'inherit' })
      const exitCode = await proc.exited
      if (exitCode !== 0) {
        throw new Error(`wget2 download failed (exit code ${exitCode})`)
      }
      return
    }
  }
}

export const downloadFile = async (req: DownloadRequest): Promise<DownloadResult> => {
  const profile = resolveProfile(req)
  const startedAt = Date.now()

  if (req.mode === 'pipe-to-tar') {
    const result = await runPipeToTar(req, profile)
    if (result.exitCode !== 0) {
      throw new Error(`Download + extract failed (exit code ${result.exitCode})`)
    }
    return {
      success: true,
      bytes: 0,
      engine: profile.engine,
      profileId: profile.profileId as DownloadProfileId,
      durationMs: Date.now() - startedAt
    }
  }

  if (req.mode === 'script-installer') {
    const result = await runScriptInstaller(req, profile)
    if (result.exitCode !== 0) {
      throw new Error(`Script installer download failed (exit code ${result.exitCode})`)
    }
    return {
      success: true,
      bytes: 0,
      engine: profile.engine,
      profileId: profile.profileId as DownloadProfileId,
      durationMs: Date.now() - startedAt
    }
  }

  await runFileDownload(req, profile)

  const bytes = (await getFileSize(req.destination)) ?? 0

  if (req.expectedMinBytes !== undefined && bytes < req.expectedMinBytes) {
    throw new Error(`Downloaded file too small: ${bytes} bytes (expected >= ${req.expectedMinBytes})`)
  }

  return {
    success: true,
    bytes,
    engine: profile.engine,
    profileId: profile.profileId as DownloadProfileId,
    durationMs: Date.now() - startedAt
  }
}
