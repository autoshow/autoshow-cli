import { processVideo } from './video'
import { saveInfo, sanitizeTitle, outputExists } from '../utils/save-info'
import { l, err } from '@/logging'
import { execFilePromise } from '@/node-utils'
import { getCliContext, createBatchProgress } from '@/utils'
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
      err('yt-dlp warnings', { warnings: stderr })
    }

    const playlistData: { title: string, entries: Array<{ id: string }> } = JSON.parse(stdout)
    const playlistTitle = playlistData.title
    const entries = playlistData.entries

    const urls: string[] = entries.map((entry) => `https://www.youtube.com/watch?v=${entry.id}`)

    if (urls.length === 0) {
      err('Error: No videos found in the playlist.')
      process.exit(1)
    }

    l('Found videos in the playlist', { count: urls.length, playlistTitle })

    if (options.info) {
      await saveInfo('playlist', urls, playlistTitle)
      return
    }

    const ctx = getCliContext()
    const progress = createBatchProgress({ label: 'videos', total: urls.length })
    
    for (const [index, url] of urls.entries()) {
      if (ctx.network.skipExisting) {
        try {
          const { stdout: metaStdout } = await execFilePromise('yt-dlp', [
            '--restrict-filenames',
            '--print', '%(title)s',
            '--print', '%(upload_date>%Y-%m-%d)s',
            url,
          ])
          const [vidTitle = '', formattedDate = ''] = metaStdout.trim().split('\n')
          const expectedFilename = `${formattedDate}-${sanitizeTitle(vidTitle)}`
          
          if (outputExists(expectedFilename, options)) {
            l('Skipping (output exists)', { current: index + 1, total: urls.length, title: vidTitle })
            progress.skip()
            continue
          }
        } catch {
        }
      }
      
      l('Processing video', { current: index + 1, total: urls.length, url })
      try {
        await processVideo(options, url, llmServices, transcriptServices)
        progress.complete(true)
      } catch (error) {
        err('Error processing video', { url, error: (error as Error).message })
        progress.complete(false)
      }
    }
    
    progress.printSummary()
  } catch (error) {
    err('Error processing playlist', { error: (error as Error).message })
    process.exit(1)
  }
}