import { fileTypeFromBuffer } from 'file-type'
import { l, err } from '@/logging'
import { execPromise, readFile, access, rename, execFilePromise, unlink, ensureDir } from '@/node-utils'
import type { ProcessingOptions } from '@/text/text-types'
import ora from 'ora'

export async function saveAudio(id: string, ensureFolders?: boolean) {
  const p = '[text/process-steps/02-download-audio]'
  if (ensureFolders) {
    return
  }

  const extensions = ['.wav']

  for (const ext of extensions) {
    try {
      await unlink(`${id}${ext}`)
    } catch (error) {
      if (error instanceof Error && (error as Error).message !== 'ENOENT') {
        err(`${p} Error deleting file ${id}${ext}: ${(error as Error).message}`)
      }
    }
  }
}

export async function executeWithRetry(
  command: string,
  args: string[],
) {
  const p = '[text/process-steps/02-download-audio]'
  const maxRetries = 7

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { stderr } = await execFilePromise(command, args)
      if (stderr) {
        err(`${p} yt-dlp warnings: ${stderr}`)
      }
      return
    } catch (error) {
      if (attempt === maxRetries) {
        err(`${p} Failed after ${maxRetries} attempts`)
        throw error
      }

      const delayMs = 1000 * 2 ** (attempt - 1)
      l.dim(`${p} Retry ${attempt} failed, waiting ${delayMs}ms...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

export async function downloadAudio(
  options: ProcessingOptions,
  input: string,
  filename: string
) {
  const p = '[text/process-steps/02-download-audio]'

  const spinner = ora('Download Audio').start()

  const baseOutput = 'output'
  const finalPath = options.outputDir 
    ? `${baseOutput}/${options.outputDir}/${filename}`
    : `${baseOutput}/${filename}`
  const outputPath = `${finalPath}.wav`

  const outputDir = finalPath.substring(0, finalPath.lastIndexOf('/'))
  await ensureDir(outputDir)

  try {
    await access(outputPath)
    const renamedPath = `${finalPath}-renamed.wav`
    await rename(outputPath, renamedPath)
    spinner.info(`Existing file found at ${outputPath}. Renamed to ${renamedPath}`)
  } catch {
  }

  if (options.video || options.playlist || options.urls || options.rss || options.channel) {
    try {
      await executeWithRetry(
        'yt-dlp',
        [
          '--no-warnings',
          '--restrict-filenames',
          '--extract-audio',
          '--audio-format', 'wav',
          '--postprocessor-args', 'ffmpeg:-ar 16000 -ac 1',
          '--no-playlist',
          '-o', outputPath,
          input,
        ]
      )
      spinner.succeed('Audio downloaded successfully.')
    } catch (error) {
      spinner.fail('Audio download failed.')
      err(`${p} Error downloading audio: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  } else if (options.file) {
    const supportedFormats = new Set([
      'wav', 'mp3', 'm4a', 'aac', 'ogg', 'flac',
      'mp4', 'mkv', 'avi', 'mov', 'webm',
    ])
    try {
      await access(input)

      const buffer = await readFile(input)
      const fileType = await fileTypeFromBuffer(buffer)

      if (!fileType || !supportedFormats.has(fileType.ext)) {
        throw new Error(
          fileType ? `Unsupported file type: ${fileType.ext}` : 'Unable to determine file type'
        )
      }
      await execPromise(
        `ffmpeg -i "${input}" -ar 16000 -ac 1 -c:a pcm_s16le "${outputPath}"`,
        { maxBuffer: 10000 * 1024 }
      )
      spinner.succeed('File converted successfully.')
    } catch (error) {
      spinner.fail('File conversion failed.')
      err(`${p} Error processing local file: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  } else {
    throw new Error('Invalid option provided for audio download/processing.')
  }

  return outputPath
}