import { l, err } from '@/logging'
import { spawn, readFile, stat, ensureDir } from '@/node-utils'
import { AUDIO_FMT, AUDIO_Q } from './create-media-command'

export async function downloadAudioFromUrls(markdownFile: string, verbose = false): Promise<void> {
  if (!markdownFile.toLowerCase().endsWith('.md')) {
    err(`Input file "${markdownFile}" is not a markdown file (.md extension required)`)
  }
  
  const isInputFile = await isFile(markdownFile)
  if (!isInputFile) {
    err(`Input file "${markdownFile}" does not exist or is not accessible`)
  }
  
  try {
    const data = await readFile(markdownFile, 'utf8')
    const urlRegex = /https?:\/\/[^\s>)"]+/g
    const urls = [...data.matchAll(urlRegex)].map(match => match[0].replace(/[)>]$/, ''))
    
    if (urls.length === 0) {
      err(`No URLs found in markdown file: ${markdownFile}`)
    }
    
    l.opts(`Processing ${urls.length} URLs with yt-dlp`)
    
    const outputDir = 'output'
    await ensureDir(outputDir)
    
    const ytDlpArgs = [
      '-x',
      '-f', 'bestaudio/best',
      '--audio-format', AUDIO_FMT,
      '--audio-quality', AUDIO_Q,
      '--embed-thumbnail',
      '--restrict-filenames',
      '--no-playlist',
      '-P', outputDir,
      '-o', '%(upload_date>%Y-%m-%d)s-%(title).200S.%(ext)s',
      ...urls
    ]
    
    await new Promise<void>((resolve, reject) => {
      const ytDlpProcess = spawn('yt-dlp', ytDlpArgs, { 
        stdio: verbose ? 'inherit' : 'ignore' 
      })
      
      ytDlpProcess.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`yt-dlp process failed with exit code ${code}`))
        }
      })
      
      ytDlpProcess.on('error', (error) => {
        reject(new Error(`yt-dlp process error: ${error.message}`))
      })
    })
    
    l.success(`Successfully downloaded ${urls.length} audio files`)
  } catch (error) {
    err(`Error reading markdown file: ${(error as Error).message}`)
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