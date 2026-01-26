import test from 'node:test'
import { strictEqual, ok } from 'node:assert/strict'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  // File input tests
  { '01-file-default': 'bun as -- text --file "input/audio.mp3"' },
  { '02-file-save-audio': 'bun as -- text --file "input/audio.mp3" --saveAudio' },
  
  // Whisper model tests
  { '03-whisper-tiny': 'bun as -- text --file "input/audio.mp3" --whisper tiny' },
  { '04-whisper-base': 'bun as -- text --file "input/audio.mp3" --whisper base' },
  { '05-whisper-small': 'bun as -- text --file "input/audio.mp3" --whisper small' },
  { '06-whisper-medium': 'bun as -- text --file "input/audio.mp3" --whisper medium' },
  { '07-whisper-large-v3-turbo': 'bun as -- text --file "input/audio.mp3" --whisper large-v3-turbo' },
  
  // Whisper CoreML tests
  { '08-whisper-coreml-tiny': 'bun as -- text --file "input/audio.mp3" --whisper-coreml tiny' },
  { '09-whisper-coreml-large-v3-turbo': 'bun as -- text --file "input/audio.mp3" --whisper-coreml large-v3-turbo' },
  
  // Video input tests
  { '10-video-default': 'bun as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk"' },
  { '11-video-save-audio': 'bun as -- text --video "https://www.youtube.com/watch?v=MORMZXEaONk" --saveAudio' },
  
  // URLs input tests
  { '12-urls-default': 'bun as -- text --urls "input/example-urls.md"' },
  
  // Playlist input tests
  { '13-playlist-default': 'bun as -- text --playlist "https://www.youtube.com/playlist?list=PLCVnrVv4KhXPz0SoAVu8Rc1emAdGPbSbr"' },
  
  // Channel input tests
  { '14-channel-last-1': 'bun as -- text --channel "https://www.youtube.com/@ajcwebdev" --last 1' },
  
  // RSS input tests
  { '15-rss-default': 'bun as -- text --rss "https://ajcwebdev.substack.com/feed"' },
  { '16-rss-last-1': 'bun as -- text --rss "https://feeds.transistor.fm/fsjam-podcast" --last 1' },
  { '17-rss-item': 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --item "https://api.substack.com/feed/podcast/36236609/fd1f1532d9842fe1178de1c920442541.mp3"' },
  
  // Info commands
  { '18-playlist-info': 'bun as -- text --playlist "https://www.youtube.com/playlist?list=PLCVnrVv4KhXPz0SoAVu8Rc1emAdGPbSbr" --info' },
  { '19-urls-info': 'bun as -- text --urls "input/example-urls.md" --info' },
  { '20-channel-info': 'bun as -- text --channel "https://www.youtube.com/@ajcwebdev" --info --last 1' },
  { '21-rss-info': 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --info' },
  
  // Custom prompt test
  { '22-custom-prompt': 'bun as -- text --file "input/audio.mp3" --customPrompt "input/custom-prompt.md"' },
  
  // Print prompt test (no output file expected, just verifies command runs)
  { '23-print-prompt': 'bun as -- text --printPrompt summary longChapters' },
]

test('CLI local tests', { concurrency: 1 }, async (t) => {
  const p = '[test/text/local]'
  const outputDirectory = resolve(process.cwd(), 'output')
  let fileCounter = 1
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [testName, command] = entry
    
    await t.test(`Local: ${testName}`, { concurrency: 1 }, async () => {
      console.log(`${p} Starting test: ${testName}`)
      const beforeRun = readdirSync(outputDirectory)
      
      let errorOccurred = false
      try {
        await new Promise<string>((resolve, reject) => {
          exec(command, { shell: '/bin/zsh' }, (
            error: ExecException | null, stdout: string, _stderr: string
          ) => {
              if (error) {
                console.error(`${p} Command failed for ${testName}: ${error.message}`)
                reject(error)
              } else {
                console.log(`${p} Command succeeded for ${testName}`)
                resolve(stdout)
              }
            }
          )
        })
      } catch {
        errorOccurred = true
      }
      
      strictEqual(errorOccurred, false)
      const afterRun = readdirSync(outputDirectory)
      
      let filesToRename: string[] = []
      
      const newFiles = afterRun.filter(f => !beforeRun.includes(f))
      if (newFiles.length > 0) {
        console.log(`${p} Found ${newFiles.length} new files for ${testName}`)
        filesToRename = newFiles
      } else {
        const possibleFile = afterRun.find(f => 
          !f.endsWith('.part') && 
          !f.match(/^\d{2}-/) && 
          f.endsWith('.md')
        )
        if (possibleFile) {
          console.log(`${p} Found modified file for ${testName}: ${possibleFile}`)
          filesToRename = [possibleFile]
        }
      }
      
      ok(filesToRename.length > 0, 'Expected at least one new or modified file')
      
      for (const file of filesToRename) {
        if (file.endsWith('.part')) continue
        if (/^\d{2}-/.test(file)) continue
        
        const oldPath = join(outputDirectory, file)
        if (!existsSync(oldPath)) continue
        
        const fileExtension = file.substring(file.lastIndexOf('.'))
        const baseName = file.substring(0, file.lastIndexOf('.'))
        
        const newName = `${String(fileCounter).padStart(2, '0')}-${baseName}-${testName}${fileExtension}`
        const newPath = join(outputDirectory, newName)
        
        console.log(`${p} Renaming file: ${file} -> ${newName}`)
        renameSync(oldPath, newPath)
        fileCounter++
      }
    })
  }
})
