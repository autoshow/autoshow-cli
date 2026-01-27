import { processVideo } from '../video'
import { saveInfo } from '../../utils/save-info'
import { validateChannelOptions } from './channel-validation'
import { logChannelProcessingStatus } from './channel-logging'
import { selectVideos } from './selector'
import { l, err } from '@/logging'
import { execFilePromise } from '@/node-utils'
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
      err(`yt-dlp warnings: ${stderr}`)
    }

    const { allVideos, videosToProcess } = await selectVideos(stdout, options)
    logChannelProcessingStatus(allVideos.length, videosToProcess.length, options)

    if (options.info) {
      await saveInfo('channel', videosToProcess, '')
      return
    }

    for (const [index, video] of videosToProcess.entries()) {
      const url = video.url
      l.final(`Processing video ${index + 1}/${videosToProcess.length}: ${url}`)

      try {
        await processVideo(options, url, llmServices, transcriptServices)
      } catch (error) {
        err(`Error processing video ${url}: ${(error as Error).message}`)
      }
    }
  } catch (error) {
    err(`Error processing channel: ${(error as Error).message}`)
    process.exit(1)
  }
}