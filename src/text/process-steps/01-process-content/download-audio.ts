import { l, err } from '@/logging'
import { execPromise, readFile, access, rename, execFilePromise, unlink, ensureDir } from '@/node-utils'
import { detectFileTypeFromBuffer, isSupportedFormat } from '@/text/utils/file-type-detector'
import type { ProcessingOptions } from '@/text/text-types'
import { createSpinner, getCliContext, requireDependency } from '@/utils'

export async function saveAudio(id: string, ensureFolders?: boolean) {
  if (ensureFolders) {
    return
  }

  const extensions = ['.wav']

  for (const ext of extensions) {
    try {
      await unlink(`${id}${ext}`)
    } catch (error) {
      if (error instanceof Error && (error as Error).message !== 'ENOENT') {
        err('Error deleting file', { file: `${id}${ext}`, error: (error as Error).message })
      }
    }
  }
}

export async function executeWithRetry(
  command: string,
  args: string[],
) {
  const ctx = getCliContext()
  const maxRetries = ctx.network.maxRetries

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { stderr } = await execFilePromise(command, args)
      if (stderr) {
        err('yt-dlp warnings', { warnings: stderr })
      }
      return
    } catch (error) {
      if (attempt === maxRetries) {
        err('Failed after max attempts', { maxRetries })
        throw error
      }

      const delayMs = 1000 * 2 ** (attempt - 1)
      l('Retry attempt failed, waiting', { attempt, delayMs })
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

export async function downloadAudio(
  options: ProcessingOptions,
  input: string,
  filename: string
) {
  const spinner = createSpinner('Download Audio').start()

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
    requireDependency('yt-dlp', 'to download audio from YouTube')
    
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
      err('Error downloading audio', { error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  } else if (options.file) {
    requireDependency('ffmpeg', 'to convert audio files')
    
    try {
      await access(input)

      const buffer = await readFile(input)
      const fileType = await detectFileTypeFromBuffer(new Uint8Array(buffer))
      
      l('Detected file type', { ext: fileType?.ext, mime: fileType?.mime })

      if (!fileType || !isSupportedFormat(fileType.ext)) {
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
      err('Error processing local file', { error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  } else {
    throw new Error('Invalid option provided for audio download/processing.')
  }

  return outputPath
}