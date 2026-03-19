import { commandExists, runInherit, detectPlatform } from '../../../step-0-setup/setup-orchestrator/run-complete-setup'
import * as l from '~/logger'
import { downloadFile } from '~/utils/download'
import { withRetry } from '~/utils/retries'

const shouldPrintCompletion = (): boolean => {
  return (process.env['AUTOSHOW_COMPACT_SETUP'] || '0') !== '1'
}

const installFfmpeg = async (): Promise<void> => {
  if (commandExists('ffmpeg')) {
    l.success('FFmpeg already installed')
    return
  }

  l.info('Installing FFmpeg')
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await runInherit('brew', ['install', 'ffmpeg'])
    l.success('FFmpeg installed')
    return
  }

  if (platform === 'linux') {
    if (process.env['DOCKER_CONTAINER']) {
      l.warn('FFmpeg should be pre-installed in Docker container')
      throw new Error('FFmpeg unavailable in Docker container')
    }

    await runInherit('sudo', ['apt', 'install', '-y', 'ffmpeg'])
    l.success('FFmpeg installed')
    return
  }

  l.error('Unsupported platform for automatic FFmpeg installation')
  throw new Error('Unsupported platform for FFmpeg setup')
}

const installYtDlp = async (): Promise<void> => {
  if (commandExists('yt-dlp')) {
    l.success('yt-dlp already installed')
    return
  }

  l.info('Installing yt-dlp')
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await runInherit('brew', ['install', 'yt-dlp'])
    l.success('yt-dlp installed')
    return
  }

  if (platform === 'linux') {
    if (process.env['DOCKER_CONTAINER']) {
      l.warn('yt-dlp should be pre-installed in Docker container')
      throw new Error('yt-dlp unavailable in Docker container')
    }

    const tempPath = `/tmp/yt-dlp-${Date.now()}`
    await withRetry(
      { retryClass: 'setup_download', operationName: 'yt-dlp-binary' },
      async () => {
        await downloadFile({
          url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
          destination: tempPath,
          flowId: 'yt-dlp-binary'
        })
      }
    )
    await runInherit('sudo', ['mv', tempPath, '/usr/local/bin/yt-dlp'])
    await runInherit('sudo', ['chmod', 'a+rx', '/usr/local/bin/yt-dlp'])
    l.success('yt-dlp installed')
    return
  }

  l.error('Unsupported platform for automatic yt-dlp installation')
  throw new Error('Unsupported platform for yt-dlp setup')
}

export const setupYtDependencies = async (): Promise<void> => {
  await installFfmpeg()
  await installYtDlp()

  if (shouldPrintCompletion()) {
    l.success('yt-dlp and FFmpeg setup complete')
  }
}
