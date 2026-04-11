import * as l from '~/logger'
import { exec } from '~/utils/cli-utils'
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

const findDownloadedAudio = async (outputDir: string): Promise<string> => {
  const files = await Bun.$`find ${outputDir} -type f \( -name "*.mp3" -o -name "*.m4a" -o -name "*.webm" -o -name "*.mp4" -o -name "*.opus" -o -name "*.ogg" -o -name "*.aac" \)`.text()
  const list = files.trim().split('\n').filter(f => f.length > 0)
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
