import { extname } from 'node:path'
import * as l from '~/utils/logger'
import { exec } from '~/utils/cli-utils'
import { MEDIA_EXTENSIONS } from '~/cli/commands/process-steps/step-1-download/media-extensions'
import { buildYtDlpDownloadArgs, buildYtDlpFailureMessage } from './yt-dlp-options'
import { logAudioDownload } from './audio-logging'

const DOWNLOADED_MEDIA_EXTENSIONS: ReadonlySet<string> = new Set(MEDIA_EXTENSIONS)

const findDownloadedAudio = async (outputDir: string): Promise<string> => {
  const files = await Bun.$`find ${outputDir} -type f`.text()
  const list = files
    .trim()
    .split('\n')
    .filter(f => f.length > 0)
    .filter((filePath) => DOWNLOADED_MEDIA_EXTENSIONS.has(extname(filePath).toLowerCase()))
  const first = list[0]
  if (!first) {
    l.error(`No files found in ${outputDir}`)
    throw new Error('No downloaded files found')
  }
  return first
}

export const downloadVideo = async (
  url: string,
  outputDir: string,
  options: { bestQuality?: boolean } = {}
): Promise<string> => {
  try {
    const args = await buildYtDlpDownloadArgs(url, outputDir, options)
    logAudioDownload(l, {
      source: 'yt-dlp',
      status: 'started',
      target: outputDir
    })
    const result = await exec('yt-dlp', args)

    if (result.exitCode !== 0) {
      const details = result.stderr || result.stdout || 'unknown yt-dlp error'
      const message = buildYtDlpFailureMessage('download', details)
      l.error(message)
      throw new Error(message)
    }

    const downloadedPath = await findDownloadedAudio(outputDir)
    logAudioDownload(l, {
      source: 'yt-dlp',
      status: 'downloaded',
      target: downloadedPath
    })
    return downloadedPath
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    if (details.startsWith('yt-dlp download failed.')) {
      throw error instanceof Error ? error : new Error(details)
    }
    throw error instanceof Error ? error : new Error(details)
  }
}
