// src/process-steps/01-generate-markdown.ts

import { l, err, logInitialFunctionCall } from '../utils/logging.ts'
import { execFilePromise, basename, extname, writeFile } from '../utils/node-utils.ts'
import type { ProcessingOptions, ShowNoteMetadata, VideoInfo } from '../utils/types.ts'

export async function saveInfo(
  type: 'playlist' | 'urls' | 'channel' | 'rss',
  data: string[] | VideoInfo[] | ShowNoteMetadata[],
  title?: string
) {
  // Handle RSS items
  if (type === 'rss') {
    const items = data as ShowNoteMetadata[]
    const jsonContent = JSON.stringify(items, null, 2)
    const sanitizedTitle = sanitizeTitle(title || '')
    const jsonFilePath = `content/${sanitizedTitle}_info.json`
    await writeFile(jsonFilePath, jsonContent)
    l.dim(`RSS feed information saved to: ${jsonFilePath}`)
    return
  }

  // Handle channel, playlist, or urls
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

  const metadataList = await Promise.all(
    urls.map(async (url) => {
      try {
        // Execute yt-dlp command to extract metadata
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

  const jsonContent = JSON.stringify(validMetadata, null, 2)
  await writeFile(outputFilePath, jsonContent)
  successLogFunction(`${type === 'urls' ? 'Video' : type.charAt(0).toUpperCase() + type.slice(1)} information saved to: ${outputFilePath}`)
}

export function sanitizeTitle(title: string) {
  return title
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 200)
}

export function buildFrontMatter(metadata: {
  showLink: string
  channel: string
  channelURL: string
  title: string
  description: string
  publishDate: string
  coverImage: string
}) {
  return [
    '---',
    `showLink: "${metadata.showLink}"`,
    `channel: "${metadata.channel}"`,
    `channelURL: "${metadata.channelURL}"`,
    `title: "${metadata.title}"`,
    `description: "${metadata.description}"`,
    `publishDate: "${metadata.publishDate}"`,
    `coverImage: "${metadata.coverImage}"`,
    '---\n',
  ]
}

export async function generateMarkdown(
  options: ProcessingOptions,
  input: string | ShowNoteMetadata
) {
  l.step(`\nStep 1 - Generate Markdown\n`)
  logInitialFunctionCall('generateMarkdown', { options, input })

  const { filename, metadata } = await (async () => {
    switch (true) {
      case !!options.video:
      case !!options.playlist:
      case !!options.urls:
      case !!options.channel:
        try {
          l.dim('  Extracting metadata with yt-dlp. Parsing output...')
          const { stdout } = await execFilePromise('yt-dlp', [
            '--restrict-filenames',
            '--print', '%(webpage_url)s',
            '--print', '%(channel)s',
            '--print', '%(uploader_url)s',
            '--print', '%(title)s',
            '--print', '%(upload_date>%Y-%m-%d)s',
            '--print', '%(thumbnail)s',
            input as string,
          ])

          const [
            showLink = '',
            videoChannel = '',
            uploader_url = '',
            videoTitle = '',
            formattedDate = '',
            thumbnail = '',
          ] = stdout.trim().split('\n')

          const filenameResult = `${formattedDate}-${sanitizeTitle(videoTitle)}`

          return {
            filename: filenameResult,
            metadata: {
              showLink: showLink,
              channel: videoChannel,
              channelURL: uploader_url,
              title: videoTitle,
              description: '',
              publishDate: formattedDate,
              coverImage: thumbnail,
            }
          }
        } catch (error) {
          err(`Error extracting metadata for ${input}: ${error instanceof Error ? error.message : String(error)}`)
          throw error
        }

      case !!options.file:
        l.dim('\n  Generating markdown for a local file...')
        const originalFilename = basename(input as string)
        const filenameWithoutExt = originalFilename.replace(extname(originalFilename), '')
        const localFilename = sanitizeTitle(filenameWithoutExt)

        return {
          filename: localFilename,
          metadata: {
            showLink: originalFilename,
            channel: '',
            channelURL: '',
            title: originalFilename,
            description: '',
            publishDate: '',
            coverImage: '',
          }
        }

      case !!options.rss:
        l.dim('\n  Generating markdown for an RSS item...\n')
        const item = input as ShowNoteMetadata
        const {
          publishDate,
          title: rssTitle,
          coverImage,
          showLink,
          channel: rssChannel,
          channelURL,
        } = item

        const rssFilename = `${publishDate}-${sanitizeTitle(rssTitle)}`

        return {
          filename: rssFilename,
          metadata: {
            showLink: showLink,
            channel: rssChannel,
            channelURL: channelURL,
            title: rssTitle,
            description: '',
            publishDate: publishDate,
            coverImage: coverImage,
          }
        }

      default:
        throw new Error('Invalid option provided for markdown generation.')
    }
  })()

  const finalPath = `content/${filename}`
  const frontMatter = buildFrontMatter({
    showLink: metadata.showLink || '',
    channel: metadata.channel || '',
    channelURL: metadata.channelURL || '',
    title: metadata.title,
    description: metadata.description,
    publishDate: metadata.publishDate || '',
    coverImage: metadata.coverImage || ''
  })
  const frontMatterContent = frontMatter.join('\n')

  l.dim(`\n  generateMarkdown returning:\n\n    - finalPath: ${finalPath}\n    - filename: ${filename}\n`)
  l.dim(`frontMatterContent:\n\n${frontMatterContent}\n`)
  return { frontMatter: frontMatterContent, finalPath, filename, metadata }
}