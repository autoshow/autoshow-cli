import * as l from '~/logger'
import { exec, loadEnvFile } from '~/utils/cli-utils'

const buildAndroidClientArgs = async (url: string, outputDir: string): Promise<string[]> => {
  await loadEnvFile()

  const acceptLanguage = process.env['YTDLP_ACCEPT_LANGUAGE']
  const userAgent = process.env['YTDLP_USER_AGENT']
  const noCheckCerts = String(process.env['YTDLP_NO_CHECK_CERTS'] || '').toLowerCase() === 'true'

  const args: string[] = [
    '--extract-audio',
    '--audio-format',
    'mp3',
    '--output',
    `${outputDir}/%(title)s.%(ext)s`,
    '--restrict-filenames',
    '--no-playlist',
    '--progress'
  ]

  if (acceptLanguage) {
    args.push('--add-header', `Accept-Language: ${acceptLanguage}`)
  }
  if (userAgent) {
    args.push('--user-agent', userAgent)
  }
  if (noCheckCerts) {
    args.push('--no-check-certificates')
  }

  args.push('--extractor-args', 'youtube:player_client=android', url)
  return args
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
    const args = await buildAndroidClientArgs(url, outputDir)
    const result = await exec('yt-dlp', args)

    if (result.exitCode !== 0) {
      const details = (result.stderr || result.stdout || 'unknown yt-dlp error').trim()
      const message = `yt-dlp download failed using youtube:player_client=android. ${details}`
      l.error(message)
      throw new Error(message)
    }

    return await findDownloadedAudio(outputDir)
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    if (details.startsWith('yt-dlp download failed using youtube:player_client=android.')) {
      throw error instanceof Error ? error : new Error(details)
    }

    const message = `yt-dlp download failed using youtube:player_client=android. ${details}`
    l.error(message)
    throw new Error(message)
  }
}
