import { l, err } from '../../logging.ts'
import { writeFile, execFilePromise } from '../../node-utils.ts'
import type { ShowNoteMetadata, VideoInfo } from '@/types.ts'

export function sanitizeTitle(title: string) {
  return title
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 200)
}

export async function saveInfo(
  type: 'playlist' | 'urls' | 'channel' | 'rss' | 'combined',
  data: string[] | VideoInfo[] | ShowNoteMetadata[],
  title?: string
) {
  l.dim(`saveInfo called with type: ${type}, data length: ${data.length}, title: ${title || 'none'}`)
  
  if (type === 'combined') {
    const items = data as ShowNoteMetadata[]
    const jsonContent = JSON.stringify(items, null, 2)
    const jsonFilePath = `content/combined-feeds-info.json`
    await writeFile(jsonFilePath, jsonContent)
    l.success(`Combined RSS feeds information (${items.length} items) saved to: ${jsonFilePath}`)
    return
  }
  
  if (type === 'rss') {
    const items = data as ShowNoteMetadata[]
    const jsonContent = JSON.stringify(items, null, 2)
    const sanitizedTitle = sanitizeTitle(title || '')
    const jsonFilePath = `content/${sanitizedTitle}_info.json`
    await writeFile(jsonFilePath, jsonContent)
    l.dim(`RSS feed information saved to: ${jsonFilePath}`)
    return
  }
  
  let urls: string[] = []
  let outputFilePath = ''
  let successLogFunction = l.success
  
  if (type === 'channel') {
    const videosToProcess = data as VideoInfo[]
    urls = videosToProcess.map((video) => video.url)
    outputFilePath = 'content/channel_info.json'
  } else if (type === 'playlist') {
    urls = data as string[]
    const sanitizedTitle = sanitizeTitle(title || 'playlist')
    outputFilePath = `content/${sanitizedTitle}_info.json`
  } else if (type === 'urls') {
    urls = data as string[]
    outputFilePath = `content/urls_info.json`
    successLogFunction = l.wait
  }
  
  l.dim(`Processing ${urls.length} URLs for metadata extraction`)
  
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
          `Error extracting metadata for ${url}: ${
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
  
  l.dim(`Successfully extracted metadata for ${validMetadata.length} of ${urls.length} URLs`)
  
  const jsonContent = JSON.stringify(validMetadata, null, 2)
  await writeFile(outputFilePath, jsonContent)
  successLogFunction(`${type === 'urls' ? 'Video' : type.charAt(0).toUpperCase() + type.slice(1)} information saved to: ${outputFilePath}`)
}