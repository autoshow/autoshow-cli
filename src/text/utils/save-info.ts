import { l, err } from '@/logging'
import { writeFile, execFilePromise, ensureDir, join } from '@/node-utils'
import type { ShowNoteMetadata, VideoInfo, ProcessingOptions } from '@/types'

export function sanitizeTitle(title: string) {
  return title
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 200)
}

export function constructOutputPath(filename: string, options?: ProcessingOptions): string {
  const baseOutput = 'output'
  const outputPath = options?.outputDir 
    ? join(baseOutput, options.outputDir, filename)
    : join(baseOutput, filename)
  return outputPath
}

export async function saveInfo(
  type: 'playlist' | 'urls' | 'channel' | 'rss' | 'combined',
  data: string[] | VideoInfo[] | ShowNoteMetadata[],
  title?: string
) {
  const p = '[text/utils/save-info]'
  
  await ensureDir('output')
  
  if (type === 'combined') {
    const items = data as ShowNoteMetadata[]
    const jsonContent = JSON.stringify(items, null, 2)
    const jsonFilePath = constructOutputPath('combined-feeds-info.json')
    await writeFile(jsonFilePath, jsonContent)
    l.success(`Combined RSS feeds information (${items.length} items) saved to: ${jsonFilePath}`)
    return
  }
  
  if (type === 'rss') {
    const items = data as ShowNoteMetadata[]
    const jsonContent = JSON.stringify(items, null, 2)
    const sanitizedTitle = sanitizeTitle(title || '')
    const jsonFilePath = constructOutputPath(`${sanitizedTitle}_info.json`)
    await writeFile(jsonFilePath, jsonContent)
    l.success(`RSS feed information saved to: ${jsonFilePath}`)
    return
  }
  
  let urls: string[] = []
  let outputFilePath = ''
  let successLogFunction = l.success
  
  if (type === 'channel') {
    const videosToProcess = data as VideoInfo[]
    urls = videosToProcess.map((video) => video.url)
    outputFilePath = constructOutputPath('channel_info.json')
  } else if (type === 'playlist') {
    urls = data as string[]
    const sanitizedTitle = sanitizeTitle(title || 'playlist')
    outputFilePath = constructOutputPath(`${sanitizedTitle}_info.json`)
  } else if (type === 'urls') {
    urls = data as string[]
    outputFilePath = constructOutputPath('urls_info.json')
    successLogFunction = l.wait
  }
  
  const metadataList = await Promise.all(
    urls.map(async (url) => {
      try {
        const { stdout } = await execFilePromise('yt-dlp', [
          '--restrict-filenames',
          '--print', '%(webpage_url)s',
          '--print', '%(channel)s',
          '--print', '%(uploader_url)s',
          '--print', '%(title)s',
          '--print', '%(upload_date>%Y-%m-%d)s',
          '--print', '%(thumbnail)s',
          url,
        ])
        const [
          showLink, channel, channelURL, vidTitle, publishDate, coverImage
        ] = stdout.trim().split('\n')
        if (!showLink || !channel || !channelURL || !vidTitle || !publishDate || !coverImage) {
          throw new Error('Incomplete metadata received from yt-dlp.')
        }
        return {
          showLink,
          channel,
          channelURL,
          title: vidTitle,
          description: '',
          publishDate,
          coverImage,
        } as ShowNoteMetadata
      } catch (error) {
        err(
          `${p} Error extracting metadata for ${url}: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
        return null
      }
    })
  )
  
  const validMetadata = metadataList.filter(
    (metadata): metadata is ShowNoteMetadata => metadata !== null
  )
  
  const jsonContent = JSON.stringify(validMetadata, null, 2)
  await writeFile(outputFilePath, jsonContent)
  successLogFunction(`${type === 'urls' ? 'Video' : type.charAt(0).toUpperCase() + type.slice(1)} information saved to: ${outputFilePath}`)
}