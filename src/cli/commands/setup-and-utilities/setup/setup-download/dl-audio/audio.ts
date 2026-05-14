import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { commandExists, runInherit, detectPlatform } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/logger'
import { downloadFile } from '~/cli/commands/setup-and-utilities/setup/setup-download/download'
import { withRetry } from '~/utils/retries'
import { makeExecutable } from '~/utils/filesystem'
import { ytDlpManagedBinaryPath } from '~/utils/runtime-paths'
import { hasYtDlpBinary } from '~/cli/commands/process-steps/step-1-download/audio/yt-dlp-binary'

const shouldPrintCompletion = (): boolean => {
  return (process.env['AUTOSHOW_COMPACT_SETUP'] || '0') !== '1'
}

const installFfmpeg = async (): Promise<void> => {
  if (commandExists('ffmpeg')) {
    return
  }

  l.write('info', 'Installing FFmpeg')
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await runInherit('brew', ['install', 'ffmpeg'])
    l.write('success', 'FFmpeg installed')
    return
  }

  if (platform === 'linux') {
    if (process.env['DOCKER_CONTAINER']) {
      l.warn('FFmpeg should be pre-installed in Docker container')
      throw new Error('FFmpeg unavailable in Docker container')
    }

    await runInherit('sudo', ['apt', 'install', '-y', 'ffmpeg'])
    l.write('success', 'FFmpeg installed')
    return
  }

  l.error('Unsupported platform for automatic FFmpeg installation')
  throw new Error('Unsupported platform for FFmpeg setup')
}

const installYtDlp = async (): Promise<void> => {
  if (hasYtDlpBinary()) {
    return
  }

  l.write('info', 'Installing yt-dlp')
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await runInherit('brew', ['install', 'yt-dlp'])
    l.write('success', 'yt-dlp installed')
    return
  }

  if (platform === 'linux') {
    if (process.env['DOCKER_CONTAINER']) {
      l.warn('yt-dlp should be pre-installed in Docker container')
      throw new Error('yt-dlp unavailable in Docker container')
    }

    await mkdir(dirname(ytDlpManagedBinaryPath), { recursive: true })
    await withRetry(
      { retryClass: 'setup_download', operationName: 'yt-dlp-binary' },
      async () => {
        await downloadFile({
          url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
          destination: ytDlpManagedBinaryPath,
          flowId: 'yt-dlp-binary'
        })
      }
    )
    await makeExecutable(ytDlpManagedBinaryPath)
    l.write('success', 'yt-dlp installed')
    return
  }

  l.error('Unsupported platform for automatic yt-dlp installation')
  throw new Error('Unsupported platform for yt-dlp setup')
}

export const setupYtDependencies = async (): Promise<void> => {
  await installFfmpeg()
  await installYtDlp()

  if (shouldPrintCompletion()) {
    l.write('success', 'yt-dlp and FFmpeg setup complete')
  }
}
