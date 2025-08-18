import { l, err } from '@/logging'
import { spawn, fs } from '@/node-utils'
import { ensureDir } from '@/node-utils'
import { AUDIO_FMT, AUDIO_Q } from './create-media-command.ts'

export async function downloadAudioFromUrls(markdownFile: string, verbose = false): Promise<void> {
  const p = '[media/save-audio-urls]'
  l.dim(`${p} Starting audio download from URLs in file: ${markdownFile}`)
  
  if (!markdownFile.toLowerCase().endsWith('.md')) {
    err(`Input file "${markdownFile}" is not a markdown file (.md extension required)`)
  }
  
  const isInputFile = await isFile(markdownFile)
  if (!isInputFile) {
    err(`Input file "${markdownFile}" does not exist or is not accessible`)
  }
  
  try {
    const data = await fs.readFile(markdownFile, 'utf8')
    const urlRegex = /https?:\/\/[^\s>)"]+/g
    const urls = [...data.matchAll(urlRegex)].map(match => match[0].replace(/[)>]$/, ''))
    
    if (urls.length === 0) {
      err(`No URLs found in markdown file: ${markdownFile}`)
    }
    
    l.opts(`Found ${urls.length} URLs to process:`)
    urls.forEach(url => l.dim(`  - ${url}`))
    
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
    
    l.dim(`${p} Executing yt-dlp with arguments:`)
    l.dim(`${p} yt-dlp ${ytDlpArgs.join(' ')}`)
    
    await new Promise<void>((resolve, reject) => {
      const ytDlpProcess = spawn('yt-dlp', ytDlpArgs, { 
        stdio: verbose ? 'inherit' : 'ignore' 
      })
      
      ytDlpProcess.on('close', (code) => {
        l.dim(`${p} yt-dlp process exited with code: ${code}`)
        if (code === 0) {
          l.dim(`${p} All URLs processed successfully`)
          resolve()
        } else {
          reject(new Error(`yt-dlp process failed with exit code ${code}`))
        }
      })
      
      ytDlpProcess.on('error', (error) => {
        reject(new Error(`yt-dlp process error: ${error.message}`))
      })
    })
    
    l.final('Audio download from URLs completed successfully')
  } catch (error) {
    err(`Error reading markdown file: ${(error as Error).message}`)
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