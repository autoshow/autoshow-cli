import { copyFile, rename, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { basename, extname, join } from 'node:path'
import type { Step1Metadata, VideoMetadata } from '~/types'
import * as l from '~/logger'
import { downloadVideo } from './yt-utils'
import { commandExists, exec } from '~/utils/cli-utils'
import { setupYtDependencies } from '~/cli/commands/process-steps/step-1-download/setup-download/dl-audio/audio'
import { buildMediaStep1Slug, sanitizeTitleSlug } from './metadata-utils'
import { MEDIA_EXTENSIONS } from '~/cli/commands/process-steps/step-1-download/targets/target-utils'
import type { DownloadAudioOptions } from '~/types'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { materializeNormalizedAudioArtifact, planNormalizedAudioArtifact } from './audio-normalize'


let ytDlpVersionVerified = false

const isDirectMediaUrl = (url: string): boolean => {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return MEDIA_EXTENSIONS.some(ext => pathname.endsWith(ext))
  } catch {
    return false
  }
}

const createTempDownloadPath = (
  outputDir: string,
  prefix: string,
  extension: string
): string => join(outputDir, `${prefix}-${randomUUID()}${extension}`)

const inferExtensionFromContentType = (contentType: string): string => (
  contentType.includes('mpeg') ? '.mp3'
    : contentType.includes('mp4') || contentType.includes('m4a') ? '.m4a'
      : contentType.includes('ogg') ? '.ogg'
        : contentType.includes('wav') ? '.wav'
          : contentType.includes('aac') ? '.aac'
            : '.mp3'
)

const buildPreferredMediaBaseName = (videoMetadata: VideoMetadata): string => {
  const slugTitle = sanitizeTitleSlug(videoMetadata.title, 180) || 'audio'
  const datePrefix = videoMetadata.publishDate ? `${videoMetadata.publishDate}-` : ''
  return `${datePrefix}${slugTitle}`
}

const ensureUniqueOutputPath = async (
  outputDir: string,
  fileName: string,
  existingPath?: string
): Promise<string> => {
  const extension = extname(fileName)
  const baseName = extension.length > 0 ? fileName.slice(0, -extension.length) : fileName
  let candidate = join(outputDir, fileName)
  let counter = 2

  while (candidate !== existingPath && await Bun.file(candidate).exists()) {
    candidate = join(outputDir, `${baseName}-${counter}${extension}`)
    counter++
  }

  return candidate
}

const finalizeDownloadedMedia = async (
  sourcePath: string,
  outputDir: string,
  videoMetadata: VideoMetadata,
  options: { copy?: boolean, fallbackExtension?: string } = {}
): Promise<string> => {
  const extension = (extname(sourcePath) || options.fallbackExtension || '.mp3').toLowerCase()
  const preferredFileName = `${buildPreferredMediaBaseName(videoMetadata)}${extension}`
  const finalPath = await ensureUniqueOutputPath(outputDir, preferredFileName, sourcePath)

  if (sourcePath === finalPath) {
    return sourcePath
  }

  if (options.copy) {
    await copyFile(sourcePath, finalPath)
  } else {
    await rename(sourcePath, finalPath)
  }

  return finalPath
}

const downloadDirectMediaUrl = async (url: string, outputDir: string): Promise<string> => {
  const pathname = new URL(url).pathname
  const fileExtension = extname(pathname) || '.mp3'
  const dest = createTempDownloadPath(outputDir, 'downloaded-media', fileExtension)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`)
  }
  const bytes = await response.arrayBuffer()
  await Bun.write(dest, bytes)
  return dest
}

const normalizeDownloadedAudio = async (
  inputPath: string,
  outputDir: string,
  videoMetadata: VideoMetadata,
  options: { removeOriginal?: boolean } = {}
): Promise<string> => {
  const inputFile = Bun.file(inputPath)
  const fileSize = inputFile.size
  if (fileSize < 1000) {
    throw new Error(`Input file is too small (${fileSize} bytes), likely corrupted`)
  }

  const { plan } = await planNormalizedAudioArtifact(inputPath)
  const preferredFileName = `${buildPreferredMediaBaseName(videoMetadata)}${plan.outputExtension}`
  const finalPath = await ensureUniqueOutputPath(outputDir, preferredFileName, inputPath)

  l.info(`Normalizing audio to ${plan.outputExtension}: ${basename(inputPath) || 'audio'} (${plan.reason})`)
  await materializeNormalizedAudioArtifact(inputPath, finalPath, plan)

  if (options.removeOriginal && inputPath !== finalPath) {
    await rm(inputPath, { force: true })
  }

  l.success(`Audio ready: ${basename(finalPath)}`)
  return finalPath
}

const verifyYtDlpVersion = async (): Promise<void> => {
  if (ytDlpVersionVerified) {
    return
  }

  try {
    const result = await exec('yt-dlp', ['--version'])
    
    if (result.exitCode !== 0) {
      throw new Error('yt-dlp is not working properly')
    }

    ytDlpVersionVerified = true
  } catch (error) {
    l.error(`yt-dlp verification failed`, error)
    throw error
  }
}

const downloadDirectAudioUrl = async (url: string, outputDir: string): Promise<string> => {
  const resp = await withRetry(
    { retryClass: 'runtime_http_read', operationName: 'direct-audio-download' },
    async () => {
      const r = await fetch(url, { redirect: 'follow' })
      if (!r.ok) {
        const err = new Error(`Direct download failed: ${r.status} ${r.statusText} (${url})`) as Error & { status: number }
        err.status = r.status
        throw err
      }
      return r
    },
    (error) => classifyFetchRetry(error, 'runtime_http_read')
  )
  if (!resp.ok) {
    throw new Error(`Direct download failed: ${resp.status} ${resp.statusText} (${url})`)
  }

  const contentType = resp.headers.get('content-type') ?? ''

  if (contentType.startsWith('text/html')) {
    throw new Error(`Expected audio from ${url}, got HTML (content-type: ${contentType})`)
  }

  const ext = inferExtensionFromContentType(contentType)
  const rawPath = createTempDownloadPath(outputDir, 'raw-audio', ext)
  const bytes = await resp.arrayBuffer()
  await Bun.write(rawPath, bytes)

  const rawFile = Bun.file(rawPath)
  if (rawFile.size < 1000) {
    throw new Error(`Downloaded file is too small (${rawFile.size} bytes), likely corrupted`)
  }

  return rawPath
}

export const downloadAudio = async (options: DownloadAudioOptions, videoMetadata: VideoMetadata): Promise<{ audioPath: string, metadata: Step1Metadata }> => {
  
  if (!commandExists('ffmpeg')) {
    await setupYtDependencies()
  }
  
  let audioPath = ''
  if (options.filePath) {
    if (options.keepOriginalMedia) {
      audioPath = await finalizeDownloadedMedia(options.filePath, options.outputDir, videoMetadata, { copy: true })
    } else {
      audioPath = await normalizeDownloadedAudio(options.filePath, options.outputDir, videoMetadata)
    }
  } else if (options.directDownload) {
    l.info('Downloading direct audio URL')
    const rawPath = await downloadDirectAudioUrl(options.url as string, options.outputDir)
    audioPath = options.keepOriginalMedia
      ? await finalizeDownloadedMedia(rawPath, options.outputDir, videoMetadata)
      : await normalizeDownloadedAudio(rawPath, options.outputDir, videoMetadata, { removeOriginal: true })
  } else if (isDirectMediaUrl(options.url as string)) {
    l.info('Downloading direct media URL')
    const mediaPath = await downloadDirectMediaUrl(options.url as string, options.outputDir)
    const downloadedFile = Bun.file(mediaPath)
    if (downloadedFile.size < 1000) {
      throw new Error('Downloaded file is empty or corrupted')
    }
    audioPath = options.keepOriginalMedia
      ? await finalizeDownloadedMedia(mediaPath, options.outputDir, videoMetadata)
      : await normalizeDownloadedAudio(mediaPath, options.outputDir, videoMetadata, { removeOriginal: true })
  } else {
    if (!commandExists('yt-dlp')) {
      await setupYtDependencies()
    }
    await verifyYtDlpVersion()
    const videoPath = await downloadVideo(options.url as string, options.outputDir)
    const downloadedFile = Bun.file(videoPath)
    const fileSize = downloadedFile.size
    if (fileSize < 1000) {
      throw new Error('Downloaded file is empty or corrupted')
    }
    audioPath = options.keepOriginalMedia
      ? await finalizeDownloadedMedia(videoPath, options.outputDir, videoMetadata)
      : await normalizeDownloadedAudio(videoPath, options.outputDir, videoMetadata, { removeOriginal: true })
  }

  const audioFile = Bun.file(audioPath)
  const audioFileSize = audioFile.size
  const audioFileName = basename(audioPath) || 'audio'

  const slug = buildMediaStep1Slug({
    ...(options.filePath ? { filePath: options.filePath } : {}),
    ...(options.url ? { url: options.url } : {})
  }, videoMetadata)

  const metadata: Step1Metadata = {
    ...videoMetadata,
    slug,
    audioFileName,
    audioFileSize
  }
  
  return { audioPath, metadata }
}
