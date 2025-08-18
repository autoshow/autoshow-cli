import { processVideo } from '../video.ts'
import { saveInfo } from '../../utils/save-info.ts'
import { validateChannelOptions } from './channel-validation.ts'
import { logChannelProcessingStatus } from './channel-logging.ts'
import { selectVideos } from './selector.ts'
import { err, logSeparator, logInitialFunctionCall } from '@/logging'
import { execFilePromise } from '@/node-utils'
import type { ProcessingOptions } from '@/text/text-types'

export async function processChannel(
  options: ProcessingOptions,
  channelUrl: string,
  llmServices?: string,
  transcriptServices?: string
): Promise<void> {
  const p = '[text/process-commands/channel/index]'
  logInitialFunctionCall('processChannel', { llmServices, transcriptServices })
  
  try {
    validateChannelOptions(options)

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
      await saveInfo('channel', videosToProcess, '')
      return
    }

    for (const [index, video] of videosToProcess.entries()) {
      const url = video.url
      logSeparator({
        type: 'channel',
        index,
        total: videosToProcess.length,
        descriptor: url
      })

      try {
        await processVideo(options, url, llmServices, transcriptServices)
      } catch (error) {
        err(`${p} Error processing video ${url}: ${(error as Error).message}`)
      }
    }
  } catch (error) {
    err(`${p} Error processing channel: ${(error as Error).message}`)
    process.exit(1)
  }
}