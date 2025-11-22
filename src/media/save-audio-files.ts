import { l, err } from '@/logging'
import { spawn } from '@/node-utils'
import { fs, path } from '@/node-utils'
import { ensureDir } from '@/node-utils'
import { AUDIO_FMT, AUDIO_Q } from './create-media-command.ts'

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
    err(`Input "${input}" is neither a valid file nor directory`)
  }
  
  await ensureDir(targetDir)
  
  let mediaFiles: string[] = []
  
  if (isInputDirectory) {
    const MEDIA_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.webm', '.mp3', '.wav', '.m4a', '.flac', '.ogg']
    
    try {
      const entries = await fs.readdir(input, { withFileTypes: true })
      mediaFiles = entries
        .filter(entry => entry.isFile() && MEDIA_EXTENSIONS.includes(path.extname(entry.name).toLowerCase()))
        .map(entry => path.join(input, entry.name))
      
      if (mediaFiles.length === 0) {
        err(`No media files found in directory "${input}"`)
      }
    } catch (error) {
      err(`Error reading directory "${input}": ${(error as Error).message}`)
    }
  } else {
    mediaFiles = [input]
  }
  
  l.opts(`Processing ${mediaFiles.length} media files with ffmpeg`)
  
  await Promise.all(mediaFiles.map(async (filePath) => {
    const parsedPath = path.parse(filePath)
    const sanitizedName = await sanitizeFilename(`${parsedPath.name}.${AUDIO_FMT}`)
    const outputPath = path.join(targetDir, sanitizedName)
    
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
  
  l.success(`All ${mediaFiles.length} files converted successfully`)
}

async function isDirectory(inputPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(inputPath)
    return stats.isDirectory()
  } catch {
    return false
  }
}

async function isFile(inputPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(inputPath)
    return stats.isFile()
  } catch {
    return false
  }
}