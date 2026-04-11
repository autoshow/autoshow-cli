import * as l from '~/logger'
import { validateData, validateDataSafe } from '~/utils/validate/validation'
import { exec, loadEnvFile } from '~/utils/cli-utils'
import { YtDlpVideoInfoSchema, VideoMetadataSchema, type VideoMetadata, type YtDlpVideoInfo } from '~/types'
import { MEDIA_EXTENSIONS } from '~/cli/commands/process-steps/step-1-download/targets/target-utils'

export type Step1SourceRef = {
  url?: string
  filePath?: string
}

export const getVideoInfo = async (url: string): Promise<YtDlpVideoInfo | null> => {
  try {
    await loadEnvFile()
    
    const args = [
      '--dump-json',
      '--no-playlist',
      '--quiet',
      url
    ]
    
    const result = await exec('yt-dlp', args)
    
    if (result.exitCode !== 0) {
      l.warn(`Failed to fetch video info from yt-dlp`)
      return null
    }
    
    const parsed = JSON.parse(result.stdout)
    const validated = validateDataSafe(YtDlpVideoInfoSchema, parsed, 'yt-dlp video info')
    
    if (!validated) {
      l.debug(`Video info validation failed, using raw data`)
      return parsed as YtDlpVideoInfo
    }
    
    return validated
    
  } catch (error) {
    l.error(`Failed to get video info`, error)
    return null
  }
}

export const extractVideoMetadata = async (url: string): Promise<VideoMetadata> => {
  try {
    const videoInfo = await getVideoInfo(url)
    
    if (videoInfo) {
      const uploadDate = videoInfo.upload_date ? formatUploadDate(videoInfo.upload_date) : undefined

      const chapters = videoInfo.chapters?.flatMap(ch => {
        if (typeof ch.start_time !== 'number' || typeof ch.end_time !== 'number' || typeof ch.title !== 'string') return []
        return [{ startTime: ch.start_time, endTime: ch.end_time, title: ch.title }]
      })

      const metadata: VideoMetadata = {
        title: videoInfo.title || 'Unknown Title',
        duration: videoInfo.duration ? formatDuration(videoInfo.duration) : 'Unknown',
        author: videoInfo.uploader || videoInfo.channel || 'Unknown',
        description: videoInfo.description || '',
        url,
        publishDate: uploadDate,
        thumbnail: videoInfo.thumbnail,
        channelUrl: videoInfo.channel_url,
        ...(chapters !== undefined && chapters.length > 0 ? { chapters } : {})
      }
      
      const validated = validateData(VideoMetadataSchema, metadata, 'video metadata')
      
      return validated
    }
    
    return getFallbackMetadata(url)
  } catch (error) {
    l.error(`Failed to extract video metadata`, error)
    return getFallbackMetadata(url)
  }
}

const formatUploadDate = (dateString: string): string => {
  if (!dateString || dateString.length !== 8) {
    return dateString
  }
  
  const year = dateString.substring(0, 4)
  const month = dateString.substring(4, 6)
  const day = dateString.substring(6, 8)
  
  return `${year}-${month}-${day}`
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

const getFallbackMetadata = (url: string): VideoMetadata => {
  const videoId = url.match(/[?&]v=([^&]+)/)?.[1] || 'unknown'
  const fallback = {
    title: `video_${videoId}`,
    duration: 'Unknown',
    author: 'Unknown',
    description: '',
    url,
    publishDate: undefined,
    thumbnail: undefined,
    channelUrl: undefined
  }
  
  return validateData(VideoMetadataSchema, fallback, 'fallback video metadata')
}

export const sanitizeTitleSlug = (title: string, maxLength = 200): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, maxLength)

const stripFinalExtension = (value: string): string =>
  value.replace(/\.[^.]+$/, '')

const tryDecodeUrlSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export const getSourceBasenameWithoutExtension = (source: Step1SourceRef): string | undefined => {
  if (source.filePath) {
    const filename = source.filePath.split(/[\\/]/).pop()?.trim()
    if (!filename) return undefined
    const withoutExtension = stripFinalExtension(filename)
    return withoutExtension.length > 0 ? withoutExtension : filename
  }

  if (!source.url) {
    return undefined
  }

  try {
    const pathname = new URL(source.url).pathname
    const encodedFilename = pathname.split('/').filter(Boolean).pop()
    if (!encodedFilename || !encodedFilename.includes('.')) {
      return undefined
    }
    const filename = tryDecodeUrlSegment(encodedFilename).trim()
    if (!filename) return undefined
    const withoutExtension = stripFinalExtension(filename)
    return withoutExtension.length > 0 ? withoutExtension : undefined
  } catch {
    return undefined
  }
}

export const buildMediaStep1Slug = (
  source: Step1SourceRef,
  metadata: Pick<VideoMetadata, 'title' | 'publishDate'>
): string => {
  const rawBasename = getSourceBasenameWithoutExtension(source)
  if (rawBasename) {
    return rawBasename
  }

  const datePrefix = metadata.publishDate ? `${metadata.publishDate}-` : ''
  return `${datePrefix}${sanitizeTitleSlug(metadata.title, 180)}`
}

export const buildDocumentStep1Slug = (source: Step1SourceRef, title: string): string =>
  getSourceBasenameWithoutExtension(source) ?? sanitizeTitleSlug(title, 180)

export const createUniqueDirectoryName = (title: string): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0')
  const dateTimeId = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}-${milliseconds}`
  return `${dateTimeId}_${sanitizeTitleSlug(title)}`
}

export const extractLocalFileMetadata = async (filePath: string): Promise<VideoMetadata> => {
  try {
    const ffprobe = await exec('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ])
    const seconds = parseFloat((ffprobe.stdout || '').trim() || '0')
    const duration = seconds > 0 ? formatDuration(seconds) : 'Unknown'
    const base = filePath.split('/').pop() || 'local-media'
    const title = base.replace(/\.[^/.]+$/, '')
    const metadata: VideoMetadata = {
      title,
      duration,
      author: 'Local',
      description: '',
      url: `file://${filePath}`,
      publishDate: undefined,
      thumbnail: undefined,
      channelUrl: undefined
    }
    const validated = validateData(VideoMetadataSchema, metadata, 'local file metadata')
    return validated
  } catch {
    const base = filePath.split('/').pop() || 'local-media'
    return validateData(VideoMetadataSchema, {
      title: base.replace(/\.[^/.]+$/, ''),
      duration: 'Unknown',
      author: 'Local',
      description: '',
      url: `file://${filePath}`,
      publishDate: undefined,
      thumbnail: undefined,
      channelUrl: undefined
    }, 'local file metadata fallback')
  }
}

const isDirectMediaUrl = (url: string): boolean => {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return MEDIA_EXTENSIONS.some(ext => pathname.endsWith(ext))
  } catch {
    return false
  }
}

const extractDirectMediaUrlMetadata = (url: string): VideoMetadata => {
  const pathname = new URL(url).pathname
  const base = pathname.split('/').pop() || 'audio'
  const title = base.replace(/\.[^/.]+$/, '')
  return validateData(VideoMetadataSchema, {
    title,
    duration: 'Unknown',
    author: 'Unknown',
    description: '',
    url,
    publishDate: undefined,
    thumbnail: undefined,
    channelUrl: undefined
  }, 'direct media url metadata')
}

export const extractSourceMetadata = async (source: { url?: string, filePath?: string }): Promise<VideoMetadata> => {
  if (source.filePath) return await extractLocalFileMetadata(source.filePath)
  const url = source.url as string
  if (isDirectMediaUrl(url)) return extractDirectMediaUrlMetadata(url)
  return await extractVideoMetadata(url)
}
