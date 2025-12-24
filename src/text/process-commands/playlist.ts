import { processVideo } from './video.ts'
import { saveInfo } from '../utils/save-info.ts'
import { l, err } from '@/logging'
import { execFilePromise } from '@/node-utils'
import type { ProcessingOptions } from '@/text/text-types'

export async function processPlaylist(
  options: ProcessingOptions,
  playlistUrl: string,
  llmServices?: string,
  transcriptServices?: string
) {
  try {
    const { stdout, stderr } = await execFilePromise('yt-dlp', [
      '--dump-single-json',
      '--flat-playlist',
      '--no-warnings',
      playlistUrl,
    ])

    if (stderr) {
      err(`yt-dlp warnings: ${stderr}`)
    }

    const playlistData: { title: string, entries: Array<{ id: string }> } = JSON.parse(stdout)
    const playlistTitle = playlistData.title
    const entries = playlistData.entries

    const urls: string[] = entries.map((entry) => `https://www.youtube.com/watch?v=${entry.id}`)

    if (urls.length === 0) {
      err('Error: No videos found in the playlist.')
      process.exit(1)
    }

    l.opts(`Found ${urls.length} videos in the playlist: ${playlistTitle}...`)

    if (options.info) {
      await saveInfo('playlist', urls, playlistTitle)
      return
    }

    for (const [index, url] of urls.entries()) {
      l.final(`Processing video ${index + 1}/${urls.length}: ${url}`)
      try {
        await processVideo(options, url, llmServices, transcriptServices)
      } catch (error) {
        err(`Error processing video ${url}: ${(error as Error).message}`)
      }
    }
  } catch (error) {
    err(`Error processing playlist: ${(error as Error).message}`)
    process.exit(1)
  }
}