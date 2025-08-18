import { l, err } from '@/logging'
import { execFilePromise } from '@/node-utils'
import type { ProcessingOptions, VideoInfo } from '@/types'

export async function selectVideos(
  stdout: string,
  options: ProcessingOptions
): Promise<{ allVideos: VideoInfo[], videosToProcess: VideoInfo[] }> {
  const p = '[text/process-commands/channel/selector]'
  const videoUrls = stdout.trim().split('\n').filter(Boolean)
  l.opts(`\nFetching detailed information for ${videoUrls.length} videos...`)

  const videoDetailsPromises = videoUrls.map(async (url) => {
    try {
      const { stdout } = await execFilePromise('yt-dlp', [
        '--print', '%(upload_date)s|%(timestamp)s|%(is_live)s|%(webpage_url)s',
        '--no-warnings',
        url,
      ])

      const [uploadDate, timestamp, isLive, videoUrl] = stdout.trim().split('|')

      if (!uploadDate || !timestamp || !videoUrl) {
        throw new Error('Incomplete video information received from yt-dlp')
      }

      const year = uploadDate.substring(0, 4)
      const month = uploadDate.substring(4, 6)
      const day = uploadDate.substring(6, 8)
      const date = new Date(`${year}-${month}-${day}`)

      return {
        uploadDate,
        url: videoUrl,
        date,
        timestamp: parseInt(timestamp, 10) || date.getTime() / 1000,
        isLive: isLive === 'True'
      }
    } catch (error) {
      err(`${p} Error getting details for video ${url}: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  })

  const videoDetailsResults = await Promise.all(videoDetailsPromises)
  const allVideos = videoDetailsResults.filter((video): video is VideoInfo => video !== null)

  if (allVideos.length === 0) {
    err('Error: No videos found in the channel.')
    process.exit(1)
  }

  allVideos.sort((a, b) => a.timestamp - b.timestamp)

  if (options.order !== 'oldest') {
    allVideos.reverse()
  }

  l.opts(`\nFound ${allVideos.length} videos in the channel...`)

  let videosToProcess
  if (options.last) {
    videosToProcess = allVideos.slice(0, options.last)
  } else if (options.days) {
    const now = new Date()
    const cutoff = new Date(now.getTime() - options.days * 24 * 60 * 60 * 1000)
    videosToProcess = allVideos.filter((video) => {
      return video.date >= cutoff
    })
  } else if (options.date && options.date.length > 0) {
    const selectedDates = new Set(options.date)
    
    videosToProcess = allVideos.filter((video) => {
      const videoDateString = video.date.toISOString().substring(0, 10)
      return selectedDates.has(videoDateString)
    })
    
    if (videosToProcess.length === 0) {
      l.warn(`${p} No videos found for the specified dates: ${options.date.join(', ')}`)
      const availableDates = allVideos.map(v => v.date.toISOString().substring(0, 10)).slice(0, 10)
      l.dim(`${p} Available dates in channel (first 10): ${availableDates.join(', ')}`)
    }
  } else {
    videosToProcess = allVideos
  }

  return { allVideos, videosToProcess }
}