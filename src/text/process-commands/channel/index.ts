import { processVideo } from '../video.ts'
import { saveInfo } from '../../utils/save-info.ts'
import { validateChannelOptions } from './validation.ts'
import { logChannelProcessingStatus } from './channel-logging.ts'
import { selectVideos } from './selector.ts'
import { l, err, logSeparator, logInitialFunctionCall } from '@/logging'
import { execFilePromise } from '@/node-utils'
import type { ProcessingOptions } from '@/types'

export async function processChannel(
  options: ProcessingOptions,
  channelUrl: string,
  llmServices?: string,
  transcriptServices?: string
): Promise<void> {
  const p = '[text/process-commands/channel/index]'
  logInitialFunctionCall('processChannel', { llmServices, transcriptServices })
  l.dim(`${p} Starting channel processing for: ${channelUrl}`)
  
  try {
    validateChannelOptions(options)

    l.dim(`${p} Fetching channel video list`)
    const { stdout, stderr } = await execFilePromise('yt-dlp', [
      '--flat-playlist',
      '--print', '%(url)s',
      '--no-warnings',
      channelUrl,
    ])

    if (stderr) {
      err(`${p} yt-dlp warnings: ${stderr}`)
    }

    const { allVideos, videosToProcess } = await selectVideos(stdout, options)
    logChannelProcessingStatus(allVideos.length, videosToProcess.length, options)

    if (options.info) {
      l.dim(`${p} Info mode - saving video metadata`)
      await saveInfo('channel', videosToProcess, '')
      return
    }

    l.dim(`${p} Processing ${videosToProcess.length} videos`)
    for (const [index, video] of videosToProcess.entries()) {
      const url = video.url
      logSeparator({
        type: 'channel',
        index,
        total: videosToProcess.length,
        descriptor: url
      })

      try {
        l.dim(`${p} Processing video ${index + 1}/${videosToProcess.length}: ${url}`)
        await processVideo(options, url, llmServices, transcriptServices)
        l.dim(`${p} Successfully processed video: ${url}`)
      } catch (error) {
        err(`${p} Error processing video ${url}: ${(error as Error).message}`)
      }
    }
    
    l.dim(`${p} Channel processing completed successfully`)
  } catch (error) {
    err(`${p} Error processing channel: ${(error as Error).message}`)
    process.exit(1)
  }
}