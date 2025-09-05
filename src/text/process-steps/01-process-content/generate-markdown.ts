import { l, err } from '@/logging'
import { execFilePromise, basename, extname } from '@/node-utils'
import { sanitizeTitle, constructOutputPath } from '../../utils/save-info.ts'
import type { ProcessingOptions, ShowNoteMetadata } from '@/text/text-types'

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
  const p = '[text/process-steps/01-generate-markdown]'
  l.step(`\nStep 1 - Process Content\n`)

  const { filename, metadata } = await (async () => {
    switch (true) {
      case !!options.video:
      case !!options.playlist:
      case !!options.urls:
      case !!options.channel:
        try {
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
          err(`${p} Error extracting metadata for ${input}: ${error instanceof Error ? error.message : String(error)}`)
          throw error
        }
      case !!options.file:
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

  const finalPath = constructOutputPath(filename, options)
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

  return { frontMatter: frontMatterContent, finalPath, filename, metadata }
}