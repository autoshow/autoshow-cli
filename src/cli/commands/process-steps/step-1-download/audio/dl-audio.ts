import { join } from 'node:path'
import type { Step1Metadata, VideoMetadata } from '~/types'
import * as l from '~/logger'
import { downloadVideo } from './yt-utils'
import { commandExists, exec } from '~/utils/cli-utils'
import { setupYtDependencies } from '~/cli/commands/process-steps/step-1-download/setup-download/dl-audio/audio'
import { sanitizeTitleSlug } from './metadata-utils'
import type { DownloadAudioOptions } from '~/types'
import { withRetry, classifyFetchRetry } from '~/utils/retries'


const DIRECT_MEDIA_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.mp4', '.webm', '.mkv', '.opus', '.ogg', '.aac', '.mov', '.flac']
let ytDlpVersionVerified = false

const isDirectMediaUrl = (url: string): boolean => {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return DIRECT_MEDIA_EXTENSIONS.some(ext => pathname.endsWith(ext))
  } catch {
    return false
  }
}

const downloadDirectMediaUrl = async (url: string, outputDir: string): Promise<string> => {
  const pathname = new URL(url).pathname
  const filename = pathname.split('/').pop() || 'audio.mp3'
  const dest = join(outputDir, filename)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`)
  }
  const bytes = await response.arrayBuffer()
  await Bun.write(dest, bytes)
  return dest
}

export const convertToWav = async (inputPath: string, outputDir: string, removeOriginal: boolean = true): Promise<string> => {
  try {
    const inputFile = Bun.file(inputPath)
    const fileSize = inputFile.size
    
    if (fileSize < 1000) {
      throw new Error(`Input file is too small (${fileSize} bytes), likely corrupted`)
    }
    
    const inputFilename = inputPath.split('/').pop() || 'audio'
    const outputFilename = inputFilename.replace(/\.[^/.]+$/, '.wav')
    const wavPath = `${outputDir}/${outputFilename}`
    
    const result = await exec('ffmpeg', [
      '-i', inputPath,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      '-y',
      wavPath
    ])
    
    if (result.exitCode !== 0) {
      throw new Error(`Failed to convert to WAV: ${result.stderr}`)
    }
    
    if (removeOriginal) {
      await Bun.$`rm -f ${inputPath}`.quiet()
    }
    
    return wavPath
  } catch (error) {
    l.error(`Failed to convert to WAV`, error)
    throw error
  }
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

  const ext = contentType.includes('mpeg') ? '.mp3'
    : contentType.includes('mp4') || contentType.includes('m4a') ? '.m4a'
    : contentType.includes('ogg') ? '.ogg'
    : contentType.includes('wav') ? '.wav'
    : contentType.includes('aac') ? '.aac'
    : '.mp3'

  const rawPath = `${outputDir}/raw_audio${ext}`
  const bytes = await resp.arrayBuffer()
  await Bun.write(rawPath, bytes)

  const rawFile = Bun.file(rawPath)
  if (rawFile.size < 1000) {
    throw new Error(`Downloaded file is too small (${rawFile.size} bytes), likely corrupted`)
  }

  return await convertToWav(rawPath, outputDir, true)
}

export const downloadAudio = async (options: DownloadAudioOptions, videoMetadata: VideoMetadata): Promise<{ audioPath: string, metadata: Step1Metadata }> => {
  
  if (!commandExists('ffmpeg')) {
    await setupYtDependencies()
  }
  
  let audioPath = ''
  if (options.filePath) {
    audioPath = await convertToWav(options.filePath, options.outputDir, false)
  } else if (options.directDownload) {

    audioPath = await downloadDirectAudioUrl(options.url as string, options.outputDir)
  } else if (isDirectMediaUrl(options.url as string)) {
    const mediaPath = await downloadDirectMediaUrl(options.url as string, options.outputDir)
    const downloadedFile = Bun.file(mediaPath)
    if (downloadedFile.size < 1000) {
      throw new Error('Downloaded file is empty or corrupted')
    }
    audioPath = await convertToWav(mediaPath, options.outputDir, true)
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
    audioPath = await convertToWav(videoPath, options.outputDir, true)
  }
  
  const slugTitle = sanitizeTitleSlug(videoMetadata.title, 180)
  const datePrefix = videoMetadata.publishDate ? `${videoMetadata.publishDate}-` : ''
  const sanitizedAudioName = `${datePrefix}${slugTitle}.wav`
  const sanitizedAudioPath = `${options.outputDir}/${sanitizedAudioName}`
  if (audioPath !== sanitizedAudioPath) {
    const mvResult = await Bun.$`mv ${audioPath} ${sanitizedAudioPath}`.quiet().nothrow()
    if (mvResult.exitCode === 0) {
      audioPath = sanitizedAudioPath
    }
  }

  const audioFile = Bun.file(audioPath)
  const audioFileSize = audioFile.size
  const audioFileName = audioPath.split('/').pop() || 'audio.wav'

  const slug = audioFileName.replace(/\.[^.]+$/, '')

  const metadata: Step1Metadata = {
    ...videoMetadata,
    slug,
    audioFileName,
    audioFileSize
  }
  
  return { audioPath, metadata }
}
