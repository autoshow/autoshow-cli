import { processVideo } from '../video.ts'
import { saveInfo } from '../../utils/save-info.ts'
import { validateChannelOptions } from './validation.ts'
import { logChannelProcessingStatus } from './logging.ts'
import { selectVideos } from './selector.ts'
import { l, err, logSeparator, logInitialFunctionCall } from '../../../logging.ts'
import { execFilePromise } from '../../../node-utils.ts'
import type { ProcessingOptions } from '@/types.ts'

export async function processChannel(
  options: ProcessingOptions,
  channelUrl: string,
  llmServices?: string,
  transcriptServices?: string
): Promise<void> {
  logInitialFunctionCall('processChannel', { llmServices, transcriptServices })
  l.dim(`[processChannel] Starting channel processing for: ${channelUrl}`)
  
  try {
    validateChannelOptions(options)

    l.dim('[processChannel] Fetching channel video list')
    const { stdout, stderr } = await execFilePromise('yt-dlp', [
      '--flat-playlist',
      '--print', '%(url)s',
      '--no-warnings',
      channelUrl,
    ])

    if (stderr) {
      err(`[processChannel] yt-dlp warnings: ${stderr}`)
    }

    const { allVideos, videosToProcess } = await selectVideos(stdout, options)
    logChannelProcessingStatus(allVideos.length, videosToProcess.length, options)

    if (options.info) {
      l.dim('[processChannel] Info mode - saving video metadata')
      await saveInfo('channel', videosToProcess, '')
      return
    }

    l.dim(`[processChannel] Processing ${videosToProcess.length} videos`)
    for (const [index, video] of videosToProcess.entries()) {
      const url = video.url
      logSeparator({
        type: 'channel',
        index,
        total: videosToProcess.length,
        descriptor: url
      })

      try {
        l.dim(`[processChannel] Processing video ${index + 1}/${videosToProcess.length}: ${url}`)
        await processVideo(options, url, llmServices, transcriptServices)
        l.dim(`[processChannel] Successfully processed video: ${url}`)
      } catch (error) {
        err(`[processChannel] Error processing video ${url}: ${(error as Error).message}`)
      }
    }
    
    l.dim('[processChannel] Channel processing completed successfully')
  } catch (error) {
    err(`[processChannel] Error processing channel: ${(error as Error).message}`)
    process.exit(1)
  }
}