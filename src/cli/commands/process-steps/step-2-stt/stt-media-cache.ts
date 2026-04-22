import { createHash } from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import {
  copyFile,
  link,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, resolve } from 'node:path'
import * as l from '~/logger'
import type {
  AcquireArtifactOptions,
  SttTarget,
  CacheArtifactRecord,
  CacheArtifactStatus,
  CacheLookup,
  MediaCacheEntry,
  PreparedSttMedia,
  Step1Metadata,
  VideoMetadata
} from '~/types'
import { buildMediaStep1Slug, buildVideoMetadataFromInfo, extractLocalFileMetadata, getVideoInfo, isDirectMediaUrl, sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { materializeNormalizedAudioArtifact, planNormalizedAudioArtifact, type AudioNormalizationProfile } from '~/cli/commands/process-steps/step-1-download/audio/audio-normalize'
import { downloadVideo } from '~/cli/commands/process-steps/step-1-download/audio/yt-utils'
import { setupYtDependencies } from '~/cli/commands/process-steps/step-1-download/setup-download/dl-audio/audio'
import { commandExists, ensureDirectory } from '~/utils/cli-utils'
import { getAudioDuration } from './stt-utils/audio-splitter'

const METADATA_SCHEMA_VERSION = 1
const SOURCE_MEDIA_ARTIFACT_VERSION = 6
const DEFAULT_CACHE_MAX_GB = 20
const DEFAULT_CACHE_MAX_AGE_DAYS = 30
const DEFAULT_STT_ACQUIRE_CONCURRENCY = 2
const LOCK_WAIT_MS = 50
const LOCK_TIMEOUT_MS = 30000

// New hosted STT providers must explicitly confirm .m4a support before joining this shared artifact path.
const HOSTED_STT_SHARED_SOURCE_MEDIA_SERVICES = new Set<SttTarget['service']>([
  'assemblyai',
  'aws',
  'deepgram',
  'elevenlabs',
  'gcloud',
  'gladia',
  'groq',
  'mistral',
  'rev',
  'soniox',
  'speechmatics'
])

const sourceMediaAcquireQueue: Array<() => void> = []
let activeSourceMediaAcquireCount = 0

const sleep = async (ms: number): Promise<void> =>
  await new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

const parsePositiveIntegerEnv = (key: string, fallback: number): number => {
  const value = Number.parseInt(process.env[key] ?? '', 10)
  if (!Number.isFinite(value) || value < 1) {
    return fallback
  }

  return value
}

const getSourceMediaAcquireConcurrency = (): number =>
  Math.max(1, parsePositiveIntegerEnv('AUTOSHOW_STT_ACQUIRE_CONCURRENCY', DEFAULT_STT_ACQUIRE_CONCURRENCY))

const isHostedSttTarget = (target: SttTarget): boolean =>
  !target.local && target.service !== 'youtube-captions'

const resolveSourceMediaProfile = (targets: SttTarget[]): AudioNormalizationProfile =>
  targets.some(isHostedSttTarget) ? 'hosted-stt' : 'default'

const assertHostedTargetsSupportSharedSourceMedia = (targets: SttTarget[]): void => {
  for (const target of targets) {
    if (!isHostedSttTarget(target)) {
      continue
    }

    if (!HOSTED_STT_SHARED_SOURCE_MEDIA_SERVICES.has(target.service)) {
      throw new Error(`Hosted STT shared source_media defaults to AAC .m4a uploads. Confirm ${target.service} supports .m4a before adding it to the shared path.`)
    }
  }
}

const withSourceMediaAcquireSlot = async <T,>(fn: () => Promise<T>): Promise<T> => {
  const maxConcurrency = getSourceMediaAcquireConcurrency()
  if (activeSourceMediaAcquireCount >= maxConcurrency) {
    await new Promise<void>((resolve) => {
      sourceMediaAcquireQueue.push(resolve)
    })
  }

  activeSourceMediaAcquireCount += 1
  try {
    return await fn()
  } finally {
    activeSourceMediaAcquireCount = Math.max(0, activeSourceMediaAcquireCount - 1)
    sourceMediaAcquireQueue.shift()?.()
  }
}

const isStreamingUrl = (url: string): boolean => {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host.includes('youtube.com')
      || host.includes('youtu.be')
      || host.includes('twitch.tv')
      || host.includes('tiktok.com')
  } catch {
    return false
  }
}

const parseDurationSeconds = (duration: string): number | null => {
  if (!duration || duration === 'Unknown') {
    return null
  }

  const parts = duration.split(':').map((value) => Number.parseInt(value, 10))
  if (parts.some((part) => !Number.isFinite(part))) {
    return null
  }

  if (parts.length === 3) {
    return (parts[0] as number) * 3600 + (parts[1] as number) * 60 + (parts[2] as number)
  }

  if (parts.length === 2) {
    return (parts[0] as number) * 60 + (parts[1] as number)
  }

  return null
}

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex')

const canonicalizeUrl = (url: string): string => {
  const parsed = new URL(url)
  parsed.hash = ''

  const sortedParams = [...parsed.searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
    )
  parsed.search = ''
  for (const [key, value] of sortedParams) {
    parsed.searchParams.append(key, value)
  }

  return parsed.toString()
}

const getCacheRootDir = (): string =>
  join(process.env['AUTOSHOW_CACHE_DIR'] ?? join(process.env['HOME'] ?? resolve('.'), '.cache', 'autoshow-cli'), 'media')

const getEntryDir = (cacheKey: string): string => join(getCacheRootDir(), cacheKey)
const getEntryJsonPath = (cacheKey: string): string => join(getEntryDir(cacheKey), 'entry.json')
const getEntryMetadataPath = (cacheKey: string): string => join(getEntryDir(cacheKey), 'metadata.json')
const getLockDir = (cacheKey: string): string => join(getEntryDir(cacheKey), '.lock')

const isCacheRecoverableError = (error: unknown): boolean => {
  const code = error instanceof Error && 'code' in error ? (error as Error & { code?: string }).code : undefined
  return code === 'EACCES' || code === 'ENOSPC' || code === 'ENOTDIR' || code === 'ENOENT'
}

const withCacheLock = async <T,>(cacheKey: string, fn: () => Promise<T>): Promise<T> => {
  const entryDir = getEntryDir(cacheKey)
  const lockDir = getLockDir(cacheKey)
  const startedAt = Date.now()
  await mkdir(entryDir, { recursive: true })

  while (true) {
    try {
      await mkdir(lockDir)
      break
    } catch (error) {
      if (Date.now() - startedAt > LOCK_TIMEOUT_MS) {
        throw error
      }
      await sleep(LOCK_WAIT_MS)
    }
  }

  try {
    return await fn()
  } finally {
    await rm(lockDir, { recursive: true, force: true })
  }
}

const readEntryJson = async (cacheKey: string): Promise<MediaCacheEntry | null> => {
  try {
    return JSON.parse(await readFile(getEntryJsonPath(cacheKey), 'utf-8')) as MediaCacheEntry
  } catch {
    return null
  }
}

const writeEntryJson = async (
  cacheKey: string,
  entry: MediaCacheEntry
): Promise<void> => {
  await writeFile(getEntryJsonPath(cacheKey), JSON.stringify(entry, null, 2))
}

const updateLastAccessed = async (cacheKey: string, entry: MediaCacheEntry): Promise<void> => {
  const updated: MediaCacheEntry = {
    ...entry,
    lastAccessedAt: new Date().toISOString()
  }
  await writeEntryJson(cacheKey, updated)
}

const ensureMediaTooling = async (needsYtDlp: boolean): Promise<void> => {
  if (!commandExists('ffmpeg') || !commandExists('ffprobe') || (needsYtDlp && !commandExists('yt-dlp'))) {
    await setupYtDependencies()
  }
}

const fetchDirectMedia = async (url: string, outputPath: string): Promise<void> => {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`)
  }
  const bytes = await response.arrayBuffer()
  await Bun.write(outputPath, bytes)
}

const stageSourceMediaArtifact = async (
  source: { url?: string, filePath?: string },
  workspaceDir: string,
  profile: AudioNormalizationProfile
): Promise<string> => {
  const materializeFromSourcePath = async (
    sourcePath: string,
    options: { removeOriginal?: boolean } = {}
  ): Promise<string> => {
    const { plan } = await planNormalizedAudioArtifact(sourcePath, profile)
    const stagedPath = join(workspaceDir, `source_media${plan.outputExtension}`)
    await materializeNormalizedAudioArtifact(sourcePath, stagedPath, plan)
    if (options.removeOriginal && sourcePath !== stagedPath) {
      await rm(sourcePath, { force: true })
    }
    return stagedPath
  }

  if (source.filePath) {
    const absoluteFilePath = resolve(source.filePath)
    return await materializeFromSourcePath(absoluteFilePath)
  }

  const url = source.url as string
  if (isDirectMediaUrl(url)) {
    const pathname = new URL(url).pathname
    const directSuffix = extname(pathname).toLowerCase() || '.bin'
    const downloadedPath = join(workspaceDir, `downloaded${directSuffix}`)
    await fetchDirectMedia(url, downloadedPath)
    return await materializeFromSourcePath(downloadedPath, { removeOriginal: true })
  }

  await ensureMediaTooling(true)
  const downloadedPath = await downloadVideo(url, workspaceDir)
  return await materializeFromSourcePath(downloadedPath, { removeOriginal: true })
}

const resolveCacheLookup = async (
  source: { url?: string, filePath?: string }
): Promise<CacheLookup> => {
  if (source.filePath) {
    const absoluteFilePath = resolve(source.filePath)
    const metadata = await extractLocalFileMetadata(absoluteFilePath)
    const fileStats = await stat(absoluteFilePath)
    const cacheKey = sha256(`local|${absoluteFilePath}|${fileStats.size}|${fileStats.mtimeMs}`)
    return { cacheKey, weakFingerprint: false, metadata }
  }

  const url = source.url as string

  if (isDirectMediaUrl(url)) {
    const metadata: VideoMetadata = {
      title: basename(new URL(url).pathname).replace(/\.[^/.]+$/, '') || 'audio',
      duration: 'Unknown',
      author: 'Unknown',
      description: '',
      url,
      publishDate: undefined,
      thumbnail: undefined,
      channelUrl: undefined
    }

    try {
      const headResponse = await fetch(url, { method: 'HEAD', redirect: 'follow' })
      const canonicalUrl = canonicalizeUrl(headResponse.url || url)
      const etag = headResponse.headers.get('etag')
      const contentLength = headResponse.headers.get('content-length')
      const fingerprintPart = etag ?? contentLength
      if (fingerprintPart) {
        return {
          cacheKey: sha256(`direct|${canonicalUrl}|${fingerprintPart}`),
          weakFingerprint: false,
          metadata
        }
      }
      return {
        cacheKey: sha256(`direct|${canonicalUrl}`),
        weakFingerprint: true,
        metadata
      }
    } catch {
      return {
        cacheKey: sha256(`direct|${canonicalizeUrl(url)}`),
        weakFingerprint: true,
        metadata
      }
    }
  }

  const videoInfo = await getVideoInfo(url)
  const metadata = videoInfo ? buildVideoMetadataFromInfo(url, videoInfo) : {
    title: 'unknown',
    duration: 'Unknown',
    author: 'Unknown',
    description: '',
    url,
    publishDate: undefined,
    thumbnail: undefined,
    channelUrl: undefined
  } satisfies VideoMetadata
  const sourceId = videoInfo?.id
  const canonicalUrl = canonicalizeUrl(url)

  if (isStreamingUrl(url) && sourceId) {
    return {
      cacheKey: sha256(`stream|${canonicalUrl}|${sourceId}`),
      weakFingerprint: false,
      metadata,
      ...(videoInfo ? { sourceVideoInfo: videoInfo } : {})
    }
  }

  return {
    cacheKey: sha256(`stream|${canonicalUrl}`),
    weakFingerprint: true,
    metadata,
    ...(videoInfo ? { sourceVideoInfo: videoInfo } : {})
  }
}

export const resolveSttSourceMetadata = async (
  source: { url?: string, filePath?: string }
): Promise<VideoMetadata> => (await resolveCacheLookup(source)).metadata

const buildPrimaryOutputPaths = (
  metadata: VideoMetadata,
  outputDir: string | undefined,
  sourceMediaExecutionPath: string
): {
  sourceMediaPath: string
  primaryFilePath: string
} => {
  const slugTitle = sanitizeTitleSlug(metadata.title, 180)
  const datePrefix = metadata.publishDate ? `${metadata.publishDate}-` : ''
  const baseName = `${datePrefix}${slugTitle}`

  if (!outputDir) {
    return {
      primaryFilePath: sourceMediaExecutionPath,
      sourceMediaPath: sourceMediaExecutionPath
    }
  }

  const sourceMediaPath = join(outputDir, `${baseName}${extname(sourceMediaExecutionPath)}`)

  return {
    primaryFilePath: sourceMediaPath,
    sourceMediaPath
  }
}

const publishArtifact = async (
  finalPath: string,
  builder: () => Promise<string>
): Promise<void> => {
  const builtPath = await builder()
  if (builtPath !== finalPath) {
    await rename(builtPath, finalPath)
  }
}

const materializeOutputArtifact = async (
  sourcePath: string,
  destinationPath: string
): Promise<void> => {
  await ensureDirectory(dirname(destinationPath))
  await rm(destinationPath, { force: true })

  try {
    await link(sourcePath, destinationPath)
    return
  } catch (error) {
    const code = error instanceof Error && 'code' in error
      ? (error as Error & { code?: string }).code
      : undefined
    if (code !== 'EXDEV' && code !== 'EMLINK' && code !== 'EPERM' && code !== 'EACCES' && code !== 'EBUSY') {
      throw error
    }
  }

  try {
    await copyFile(sourcePath, destinationPath, fsConstants.COPYFILE_FICLONE)
  } catch {
    await copyFile(sourcePath, destinationPath)
  }
}

const probeDurationSeconds = async (
  preferredPath: string | undefined,
  metadata: VideoMetadata
): Promise<number> => {
  const fromMetadata = parseDurationSeconds(metadata.duration)
  if (fromMetadata !== null && fromMetadata > 0) {
    return fromMetadata
  }

  if (!preferredPath) {
    return 0
  }

  const probed = await getAudioDuration(preferredPath)
  return Number.isFinite(probed) && probed > 0 ? probed : 0
}

const buildEmptyEntry = (cacheKey: string, weakFingerprint: boolean): MediaCacheEntry => {
  const now = new Date().toISOString()
  return {
    cacheKey,
    weakFingerprint,
    metadataSchemaVersion: METADATA_SCHEMA_VERSION,
    artifactVersions: {
      source_media: SOURCE_MEDIA_ARTIFACT_VERSION
    },
    createdAt: now,
    lastAccessedAt: now,
    artifacts: {}
  }
}

const getEntryArtifactPath = (
  cacheKey: string,
  artifact: CacheArtifactRecord | undefined
): string | undefined => artifact ? join(getEntryDir(cacheKey), artifact.fileName) : undefined

const removeStaleSourceMediaArtifacts = async (
  entryDir: string,
  keepPath?: string | undefined
): Promise<void> => {
  const candidates = [
    'source_media.mp3',
    'source_media.m4a',
    'source_media.ogg',
    'source_media.flac',
    'wav16k_mono.wav'
  ]

  await Promise.all(candidates.map(async (fileName) => {
    const candidatePath = join(entryDir, fileName)
    if (candidatePath !== keepPath) {
      await rm(candidatePath, { force: true })
    }
  }))
}

const getMaxCacheBytes = (): number => {
  const value = Number.parseFloat(process.env['AUTOSHOW_CACHE_MAX_GB'] ?? '')
  const maxGb = Number.isFinite(value) && value > 0 ? value : DEFAULT_CACHE_MAX_GB
  return maxGb * 1024 * 1024 * 1024
}

const getMaxCacheAgeMs = (): number => {
  const value = Number.parseFloat(process.env['AUTOSHOW_CACHE_MAX_AGE_DAYS'] ?? '')
  const days = Number.isFinite(value) && value > 0 ? value : DEFAULT_CACHE_MAX_AGE_DAYS
  return days * 24 * 60 * 60 * 1000
}

export const pruneMediaCache = async (): Promise<void> => {
  const rootDir = getCacheRootDir()
  const maxCacheBytes = getMaxCacheBytes()
  const maxAgeMs = getMaxCacheAgeMs()

  try {
    const entries = await Bun.file(rootDir).exists()
      ? await Bun.$`find ${rootDir} -mindepth 1 -maxdepth 1 -type d`.text()
      : ''
    const directories = entries.trim().split('\n').filter((value) => value.length > 0)

    const inspected = await Promise.all(directories.map(async (directoryPath) => {
      const entryJsonPath = join(directoryPath, 'entry.json')
      const entry = await Bun.file(entryJsonPath).exists()
        ? JSON.parse(await readFile(entryJsonPath, 'utf-8')) as MediaCacheEntry
        : null
      const directoryStats = await stat(directoryPath)
      const lastAccessedAt = entry?.lastAccessedAt ? Date.parse(entry.lastAccessedAt) : directoryStats.mtimeMs
      const createdAt = entry?.createdAt ? Date.parse(entry.createdAt) : directoryStats.birthtimeMs
      const size = entry?.artifacts
        ? Object.values(entry.artifacts).reduce((sum, artifact) => sum + (artifact?.size ?? 0), 0)
        : 0

      return {
        path: directoryPath,
        lastAccessedAt: Number.isFinite(lastAccessedAt) ? lastAccessedAt : 0,
        createdAt: Number.isFinite(createdAt) ? createdAt : 0,
        size
      }
    }))

    const now = Date.now()
    let totalSize = inspected.reduce((sum, entry) => sum + entry.size, 0)

    for (const entry of inspected.filter((item) => now - item.lastAccessedAt > maxAgeMs)) {
      await rm(entry.path, { recursive: true, force: true })
      totalSize -= entry.size
    }

    const lruEntries = inspected
      .filter((entry) => now - entry.lastAccessedAt <= maxAgeMs)
      .sort((left, right) => left.lastAccessedAt - right.lastAccessedAt)

    for (const entry of lruEntries) {
      if (totalSize <= maxCacheBytes) {
        break
      }
      await rm(entry.path, { recursive: true, force: true })
      totalSize -= entry.size
    }
  } catch {
  }
}

export const clearMediaCache = async (): Promise<void> => {
  await rm(getCacheRootDir(), { recursive: true, force: true })
}

export const prepareSttMedia = async (
  options: AcquireArtifactOptions
): Promise<PreparedSttMedia> => {
  const { source, targets, outputDir, noCache = false, refreshCache = false } = options
  const sourceMediaProfile = resolveSourceMediaProfile(targets)
  if (sourceMediaProfile === 'hosted-stt') {
    assertHostedTargetsSupportSharedSourceMedia(targets)
  }

  const cacheLookup = await resolveCacheLookup(source)
  if (cacheLookup.weakFingerprint) {
    l.info(`cache.weak_fingerprint key=${cacheLookup.cacheKey}`)
  }

  const buildUncached = async (): Promise<PreparedSttMedia> => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'autoshow-stt-acquire-'))
    const timings: PreparedSttMedia['timings'] = {}
    const sourceMediaStatus: CacheArtifactStatus = 'miss'

    try {
      const sourceMediaExecutionPath = await withSourceMediaAcquireSlot(async () => {
        await ensureMediaTooling(!source.filePath && !isDirectMediaUrl(source.url ?? ''))

        const startedAt = Date.now()
        const stagedPath = await stageSourceMediaArtifact(source, workspaceDir, sourceMediaProfile)
        timings.sourceMediaMs = Date.now() - startedAt
        return stagedPath
      })
      l.info(`cache.bypass artifact=source_media`)

      const outputPaths = buildPrimaryOutputPaths(
        cacheLookup.metadata,
        outputDir,
        sourceMediaExecutionPath
      )

      if (outputPaths.sourceMediaPath !== sourceMediaExecutionPath) {
        await materializeOutputArtifact(sourceMediaExecutionPath, outputPaths.sourceMediaPath)
      }

      const primaryStats = await stat(outputPaths.primaryFilePath)
      const step1Metadata: Step1Metadata = {
        ...cacheLookup.metadata,
        slug: buildMediaStep1Slug(source, cacheLookup.metadata),
        audioFileName: basename(outputPaths.primaryFilePath),
        audioFileSize: primaryStats.size
      }
      const durationSeconds = await probeDurationSeconds(sourceMediaExecutionPath, cacheLookup.metadata)

      return {
        metadata: cacheLookup.metadata,
        ...(cacheLookup.sourceVideoInfo ? { sourceVideoInfo: cacheLookup.sourceVideoInfo } : {}),
        step1Metadata,
        durationSeconds,
        executionArtifacts: {
          sourceMediaPath: sourceMediaExecutionPath
        },
        outputArtifacts: {
          sourceMediaPath: outputPaths.sourceMediaPath
        },
        cache: {
          sourceMedia: sourceMediaStatus
        },
        timings,
        cleanup: async () => {
          await rm(workspaceDir, { recursive: true, force: true })
        }
      }
    } catch (error) {
      await rm(workspaceDir, { recursive: true, force: true })
      throw error
    }
  }

  if (noCache) {
    return await buildUncached()
  }

  try {
    await mkdir(getCacheRootDir(), { recursive: true })

    return await withCacheLock(cacheLookup.cacheKey, async () => {
      const timings: PreparedSttMedia['timings'] = {}
      const entryDir = getEntryDir(cacheLookup.cacheKey)
      const entryMetadataPath = getEntryMetadataPath(cacheLookup.cacheKey)
      let entry = await readEntryJson(cacheLookup.cacheKey)
      if (!entry) {
        entry = buildEmptyEntry(cacheLookup.cacheKey, cacheLookup.weakFingerprint)
      }

      await writeFile(entryMetadataPath, JSON.stringify(cacheLookup.metadata, null, 2))

      let sourceMediaExecutionPath = getEntryArtifactPath(cacheLookup.cacheKey, entry.artifacts?.source_media)
      let sourceMediaStatus: CacheArtifactStatus = 'hit'

      const sourceMediaValid = sourceMediaExecutionPath
        && !refreshCache
        && entry.artifactVersions?.source_media === SOURCE_MEDIA_ARTIFACT_VERSION
        && await Bun.file(sourceMediaExecutionPath).exists()
      if (!sourceMediaValid) {
        sourceMediaStatus = 'miss'
        const workspaceDir = await mkdtemp(join(tmpdir(), 'autoshow-stt-source-'))
        try {
          const builtSourcePath = await withSourceMediaAcquireSlot(async () => {
            await ensureMediaTooling(!source.filePath && !isDirectMediaUrl(source.url ?? ''))
            const startedAt = Date.now()
            const stagedPath = await stageSourceMediaArtifact(source, workspaceDir, sourceMediaProfile)
            timings.sourceMediaMs = Date.now() - startedAt
            return stagedPath
          })
          const finalPath = join(entryDir, basename(builtSourcePath))
          await removeStaleSourceMediaArtifacts(entryDir, finalPath)
          if (sourceMediaExecutionPath && sourceMediaExecutionPath !== finalPath) {
            await rm(sourceMediaExecutionPath, { force: true })
          }
          await publishArtifact(finalPath, async () => builtSourcePath)
          const artifactStats = await stat(finalPath)
          sourceMediaExecutionPath = finalPath
          entry.artifacts = {
            source_media: {
              fileName: basename(finalPath),
              size: artifactStats.size
            }
          }
          entry.artifactVersions = {
            source_media: SOURCE_MEDIA_ARTIFACT_VERSION
          }
          l.info(`${refreshCache ? 'cache.rebuild' : 'cache.miss'} artifact=source_media key=${cacheLookup.cacheKey}`)
        } finally {
          await rm(workspaceDir, { recursive: true, force: true })
        }
      } else if (sourceMediaExecutionPath) {
        l.info(`cache.hit artifact=source_media key=${cacheLookup.cacheKey}`)
      }

      if (!sourceMediaExecutionPath) {
        throw new Error('No STT artifacts were prepared')
      }

      await removeStaleSourceMediaArtifacts(entryDir, sourceMediaExecutionPath)
      entry.artifacts = entry.artifacts?.source_media
        ? { source_media: entry.artifacts.source_media }
        : {}
      entry.artifactVersions = {
        source_media: SOURCE_MEDIA_ARTIFACT_VERSION
      }

      entry.durationSeconds = entry.durationSeconds && entry.durationSeconds > 0
        ? entry.durationSeconds
        : await probeDurationSeconds(sourceMediaExecutionPath, cacheLookup.metadata)
      entry.lastAccessedAt = new Date().toISOString()
      entry.metadataSchemaVersion = METADATA_SCHEMA_VERSION
      await writeEntryJson(cacheLookup.cacheKey, entry)
      await updateLastAccessed(cacheLookup.cacheKey, entry)

      const outputPaths = buildPrimaryOutputPaths(
        cacheLookup.metadata,
        outputDir,
        sourceMediaExecutionPath
      )

      if (outputPaths.sourceMediaPath !== sourceMediaExecutionPath) {
        await materializeOutputArtifact(sourceMediaExecutionPath, outputPaths.sourceMediaPath)
      }

      const primaryStats = await stat(outputPaths.primaryFilePath)
      const step1Metadata: Step1Metadata = {
        ...cacheLookup.metadata,
        slug: buildMediaStep1Slug(source, cacheLookup.metadata),
        audioFileName: basename(outputPaths.primaryFilePath),
        audioFileSize: primaryStats.size
      }

      void pruneMediaCache()

      return {
        metadata: cacheLookup.metadata,
        ...(cacheLookup.sourceVideoInfo ? { sourceVideoInfo: cacheLookup.sourceVideoInfo } : {}),
        step1Metadata,
        durationSeconds: entry.durationSeconds ?? 0,
        executionArtifacts: {
          sourceMediaPath: sourceMediaExecutionPath
        },
        outputArtifacts: {
          sourceMediaPath: outputPaths.sourceMediaPath
        },
        cache: {
          sourceMedia: sourceMediaStatus
        },
        timings
      }
    })
  } catch (error) {
    if (!isCacheRecoverableError(error)) {
      throw error
    }
    l.warn(`Cache unavailable; continuing without cache (${error instanceof Error ? error.message : String(error)})`)
    return await buildUncached()
  }
}
