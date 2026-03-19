import { processVideo } from '../video'
import { saveInfo, sanitizeTitle, outputExists } from '../../utils/save-info'
import { validateChannelOptions } from './channel-validation'
import { logChannelProcessingStatus } from './channel-logging'
import { selectVideos } from './selector'
import { l, err } from '@/logging'
import { execFilePromise } from '@/node-utils'
import { getCliContext, createBatchProgress } from '@/utils'
import type { ProcessingOptions } from '@/text/text-types'

export async function processChannel(
  options: ProcessingOptions,
  channelUrl: string,
  llmServices?: string,
  transcriptServices?: string
): Promise<void> {
  try {
    validateChannelOptions(options)

    const { stdout, stderr } = await execFilePromise('yt-dlp', [
      '--flat-playlist',
      '--print', '%(url)s',
      '--no-warnings',
      channelUrl,
    ])

    if (stderr) {
      err('yt-dlp warnings', { warnings: stderr })
    }

    const { allVideos, videosToProcess } = await selectVideos(stdout, options)
    logChannelProcessingStatus(allVideos.length, videosToProcess.length, options)

    if (options.info) {
      await saveInfo('channel', videosToProcess, '')
      return
    }

    const ctx = getCliContext()
    const progress = createBatchProgress({ label: 'videos', total: videosToProcess.length })

    for (const [index, video] of videosToProcess.entries()) {
      const url = video.url
      
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
            l('Skipping (output exists)', { current: index + 1, total: videosToProcess.length, title: vidTitle })
            progress.skip()
            continue
          }
        } catch {
        }
      }
      
      l('Processing video', { current: index + 1, total: videosToProcess.length, url })

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
    err('Error processing channel', { error: (error as Error).message })
    process.exit(1)
  }
}