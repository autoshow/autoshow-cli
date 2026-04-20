import { extname } from 'node:path'
import * as l from '~/logger'
import { exec } from '~/utils/cli-utils'
import { MEDIA_EXTENSIONS } from '~/cli/commands/process-steps/step-1-download/media-extensions'
import { buildYtDlpDownloadArgs, buildYtDlpFailureMessage } from './yt-dlp-options'

const isProgressLine = (line: string): boolean => {
  return line.startsWith('[download]') || line.startsWith('[ExtractAudio]')
}

const relayYtDlpLine = (line: string): void => {
  const clean = line.trim()
  if (!clean || !isProgressLine(clean)) {
    return
  }
  l.info(clean)
}

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

export const downloadVideo = async (url: string, outputDir: string): Promise<string> => {
  try {
    const args = await buildYtDlpDownloadArgs(url, outputDir)
    l.info('Downloading audio with yt-dlp')
    const result = await exec('yt-dlp', args, {
      onStdoutLine: relayYtDlpLine,
      onStderrLine: relayYtDlpLine
    })

    if (result.exitCode !== 0) {
      const details = result.stderr || result.stdout || 'unknown yt-dlp error'
      const message = buildYtDlpFailureMessage('download', details)
      l.error(message)
      throw new Error(message)
    }

    l.success('yt-dlp download complete')
    return await findDownloadedAudio(outputDir)
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    if (details.startsWith('yt-dlp download failed.')) {
      throw error instanceof Error ? error : new Error(details)
    }
    throw error instanceof Error ? error : new Error(details)
  }
}
