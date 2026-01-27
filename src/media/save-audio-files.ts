import { l, err, success } from '@/logging'
import { spawn, stat, readdir, parse, extname, join, ensureDir } from '@/node-utils'
import { AUDIO_FMT, AUDIO_Q } from './create-media-command'

export async function sanitizeFilename(filename: string): Promise<string> {
  const ext = filename.match(/\.[^.]+$/)?.[0] || ''
  const base = (ext ? filename.slice(0, -ext.length) : filename)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
  
  return base + ext
}

export async function convertLocalAudioFiles(
  input: string,
  outputDir?: string,
  verbose = false
): Promise<void> {
  const targetDir = outputDir || 'output'
  
  const isInputDirectory = await isDirectory(input)
  const isInputFile = await isFile(input)
  
  if (!isInputDirectory && !isInputFile) {
    err('Input is neither a valid file nor directory', { input })
  }
  
  await ensureDir(targetDir)
  
  let mediaFiles: string[] = []
  
  if (isInputDirectory) {
    const MEDIA_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.webm', '.mp3', '.wav', '.m4a', '.flac', '.ogg']
    
    try {
      const entries = await readdir(input, { withFileTypes: true })
      mediaFiles = entries
        .filter(entry => entry.isFile() && MEDIA_EXTENSIONS.includes(extname(entry.name).toLowerCase()))
        .map(entry => join(input, entry.name))
      
      if (mediaFiles.length === 0) {
        err('No media files found in directory', { directory: input })
      }
    } catch (error) {
      err('Error reading directory', { directory: input, error: (error as Error).message })
    }
  } else {
    mediaFiles = [input]
  }
  
  l('Processing media files with ffmpeg', { count: mediaFiles.length })
  
  await Promise.all(mediaFiles.map(async (filePath) => {
    const parsedPath = parse(filePath)
    const sanitizedName = await sanitizeFilename(`${parsedPath.name}.${AUDIO_FMT}`)
    const outputPath = join(targetDir, sanitizedName)
    
    await new Promise<void>((resolve, reject) => {
      const ffmpegProcess = spawn('ffmpeg', [
        '-i', filePath,
        '-vn',
        '-acodec', 'libmp3lame',
        '-q:a', AUDIO_Q,
        '-y',
        outputPath
      ], { stdio: verbose ? 'inherit' : 'ignore' })
      
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`ffmpeg process failed with exit code ${code}`))
        }
      })
      
      ffmpegProcess.on('error', (error) => {
        reject(new Error(`ffmpeg process error: ${error.message}`))
      })
    })
  }))
  
  success('All files converted successfully', { count: mediaFiles.length })
}

async function isDirectory(inputPath: string): Promise<boolean> {
  try {
    const stats = await stat(inputPath)
    return stats.isDirectory()
  } catch {
    return false
  }
}

async function isFile(inputPath: string): Promise<boolean> {
  try {
    const stats = await stat(inputPath)
    return stats.isFile()
  } catch {
    return false
  }
}