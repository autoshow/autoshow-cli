import { l, err, success } from '@/logging'
import { spawn, readFile, stat, ensureDir } from '@/node-utils'
import { AUDIO_FMT, AUDIO_Q } from './create-media-command'
import { registerProcess } from '@/utils'

export async function downloadAudioFromUrls(markdownFile: string, verbose = false): Promise<void> {
  if (!markdownFile.toLowerCase().endsWith('.md')) {
    err('Input file is not a markdown file (.md extension required)', { file: markdownFile })
  }
  
  const isInputFile = await isFile(markdownFile)
  if (!isInputFile) {
    err('Input file does not exist or is not accessible', { file: markdownFile })
  }
  
  try {
    const data = await readFile(markdownFile, 'utf8')
    const urlRegex = /https?:\/\/[^\s>)"]+/g
    const urls = [...data.matchAll(urlRegex)].map(match => match[0].replace(/[)>]$/, ''))
    
    if (urls.length === 0) {
      err('No URLs found in markdown file', { file: markdownFile })
    }
    
    l('Processing URLs with yt-dlp', { count: urls.length })
    
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
      
      const unregister = registerProcess(ytDlpProcess)
      
      ytDlpProcess.on('close', (code) => {
        unregister()
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`yt-dlp process failed with exit code ${code}`))
        }
      })
      
      ytDlpProcess.on('error', (error) => {
        unregister()
        reject(new Error(`yt-dlp process error: ${error.message}`))
      })
    })
    
    success('Successfully downloaded audio files', { count: urls.length })
  } catch (error) {
    err('Error reading markdown file', { error: (error as Error).message })
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