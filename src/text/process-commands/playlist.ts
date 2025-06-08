// src/process-commands/playlist.ts

import { processVideo } from './video.ts'
import { saveInfo } from '../utils/save-info.ts'
import { l, err, logSeparator, logInitialFunctionCall } from '../utils/logging.ts'
import { execFilePromise } from '../utils/node-utils.ts'
import type { ProcessingOptions } from '../utils/types.ts'

export async function processPlaylist(
  options: ProcessingOptions,
  playlistUrl: string,
  llmServices?: string,
  transcriptServices?: string
) {
  // Log the processing parameters for debugging purposes
  logInitialFunctionCall('processPlaylist', { llmServices, transcriptServices })

  try {
    // Fetch playlist metadata
    const { stdout, stderr } = await execFilePromise('yt-dlp', [
      '--dump-single-json',
      '--flat-playlist',
      '--no-warnings',
      playlistUrl,
    ])

    // Log any warnings from yt-dlp
    if (stderr) {
      err(`yt-dlp warnings: ${stderr}`)
    }

    const playlistData: { title: string, entries: Array<{ id: string }> } = JSON.parse(stdout)
    const playlistTitle = playlistData.title
    const entries = playlistData.entries

    const urls: string[] = entries.map((entry) => `https://www.youtube.com/watch?v=${entry.id}`)

    // Exit if no videos were found in the playlist
    if (urls.length === 0) {
      err('Error: No videos found in the playlist.')
      process.exit(1)
    }

    l.opts(`\nFound ${urls.length} videos in the playlist: ${playlistTitle}...`)

    // If the --info option is provided, save playlist info and return
    if (options.info) {
      await saveInfo('playlist', urls, playlistTitle)
      return
    }

    // Process each video sequentially, with error handling for individual videos
    for (const [index, url] of urls.entries()) {
      // Visual separator for each video in the console
      logSeparator({
        type: 'playlist',
        index,
        total: urls.length,
        descriptor: url
      })
      try {
        // Process the video using the existing processVideo function
        await processVideo(options, url, llmServices, transcriptServices)
      } catch (error) {
        // Log error but continue processing remaining videos
        err(`Error processing video ${url}: ${(error as Error).message}`)
      }
    }
  } catch (error) {
    // Handle fatal errors that prevent playlist processing
    err(`Error processing playlist: ${(error as Error).message}`)
    process.exit(1)
  }
}