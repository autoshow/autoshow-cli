import { describe, test, expect } from 'bun:test'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'
import { l } from '@/logging'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  
  { '01-file-default': 'bun as -- text --file "input/audio.mp3"' },
  { '02-file-save-audio': 'bun as -- text --file "input/audio.mp3" --saveAudio' },
  
  
  { '03-whisper-tiny': 'bun as -- text --file "input/audio.mp3" --whisper tiny' },
  { '04-whisper-base': 'bun as -- text --file "input/audio.mp3" --whisper base' },
  { '05-whisper-small': 'bun as -- text --file "input/audio.mp3" --whisper small' },
  { '06-whisper-medium': 'bun as -- text --file "input/audio.mp3" --whisper medium' },
  { '07-whisper-large-v3-turbo': 'bun as -- text --file "input/audio.mp3" --whisper large-v3-turbo' },
  
  
  { '08-whisper-coreml-tiny': 'bun as -- text --file "input/audio.mp3" --whisper-coreml tiny' },
  { '09-whisper-coreml-large-v3-turbo': 'bun as -- text --file "input/audio.mp3" --whisper-coreml large-v3-turbo' },
  
  
  { '10-video-default': 'bun as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk"' },
  { '11-video-save-audio': 'bun as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --saveAudio' },
  
  
  { '12-urls-default': 'bun as -- text --urls "input/example-urls.md"' },
  
  
  { '13-playlist-default': 'bun as -- text --playlist "https://www.youtube.com/playlist?list=PLCVnrVv4KhXPz0SoAVu8Rc1emAdGPbSbr"' },
  
  
  { '14-channel-last-1': 'bun as -- text --channel "https://www.youtube.com/@fsjamorg" --last 1' },
  
  
  { '15-rss-default': 'bun as -- text --rss "https://ajcwebdev.substack.com/feed"' },
  { '16-rss-last-1': 'bun as -- text --rss "https://feeds.transistor.fm/fsjam-podcast" --last 1' },
  { '17-rss-item': 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --item "https://api.substack.com/feed/podcast/36236609/fd1f1532d9842fe1178de1c920442541.mp3"' },
  
  
  { '18-playlist-info': 'bun as -- text --playlist "https://www.youtube.com/playlist?list=PLCVnrVv4KhXPz0SoAVu8Rc1emAdGPbSbr" --info' },
  { '19-urls-info': 'bun as -- text --urls "input/example-urls.md" --info' },
  { '20-channel-info': 'bun as -- text --channel "https://www.youtube.com/@ajcwebdev" --info --last 1' },
  { '21-rss-info': 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --info' },
  
  
  { '22-custom-prompt': 'bun as -- text --file "input/audio.mp3" --customPrompt "input/custom-prompt.md"' },
  
  
  { '23-print-prompt': 'bun as -- text --printPrompt summary longChapters' },
]

describe('CLI local tests', () => {
  const outputDirectory = resolve(process.cwd(), 'output')
  let fileCounter = 1
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [testName, command] = entry
    
    test(`Local: ${testName}`, async () => {
      l('Starting test', { testName })
      const beforeRun = readdirSync(outputDirectory)
      
      let errorOccurred = false
      try {
        await new Promise<string>((resolve, reject) => {
          exec(command, { shell: '/bin/zsh' }, (
            error: ExecException | null, stdout: string, _stderr: string
          ) => {
              if (error) {
                l('Command failed', { testName, error: error.message })
                reject(error)
              } else {
                l('Command succeeded', { testName })
                resolve(stdout)
              }
            }
          )
        })
      } catch {
        errorOccurred = true
      }
      
      expect(errorOccurred).toBe(false)
      const afterRun = readdirSync(outputDirectory)
      
      let filesToRename: string[] = []
      
      const newFiles = afterRun.filter(f => !beforeRun.includes(f))
      if (newFiles.length > 0) {
        l('Found new files', { testName, count: newFiles.length })
        filesToRename = newFiles
      } else {
        const possibleFile = afterRun.find(f => 
          !f.endsWith('.part') && 
          !f.match(/^\d{2}-/) && 
          f.endsWith('.md')
        )
        if (possibleFile) {
          l('Found modified file', { testName, file: possibleFile })
          filesToRename = [possibleFile]
        }
      }
      
      expect(filesToRename.length > 0).toBeTruthy()
      
      for (const file of filesToRename) {
        if (file.endsWith('.part')) continue
        if (/^\d{2}-/.test(file)) continue
        
        const oldPath = join(outputDirectory, file)
        if (!existsSync(oldPath)) continue
        
        const fileExtension = file.substring(file.lastIndexOf('.'))
        const baseName = file.substring(0, file.lastIndexOf('.'))
        
        const newName = `${String(fileCounter).padStart(2, '0')}-${baseName}-${testName}${fileExtension}`
        const newPath = join(outputDirectory, newName)
        
        l('Renaming file', { from: file, to: newName })
        renameSync(oldPath, newPath)
        fileCounter++
      }
    })
  }
})

