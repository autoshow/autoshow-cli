import test from 'node:test'
import { strictEqual, ok } from 'node:assert/strict'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  { titles: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt titles --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { summary: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt summary --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { shortSummary: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt shortSummary --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { longSummary: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt longSummary --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { bulletPoints: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt bulletPoints --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { quotes: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt quotes --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { chapterTitlesAndQuotes: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt chapterTitlesAndQuotes --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { x: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt x --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { facebook: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt facebook --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { linkedin: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt linkedin --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { chapterTitles: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt chapterTitles --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { shortChapters: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt shortChapters --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { mediumChapters: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt mediumChapters --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { longChapters: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt longChapters --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { takeaways: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt takeaways --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { questions: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt questions --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { faq: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt faq --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { blog: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt blog --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { rapSong: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt rapSong --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { rockSong: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt rockSong --whisper-coreml large-v3-turbo --chatgpt gpt-5' },
  { countrySong: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt countrySong --whisper-coreml large-v3-turbo --chatgpt gpt-5' }
]

test('CLI prompt tests', { concurrency: 1 }, async (t) => {
  const outputDirectory = resolve(process.cwd(), 'output')
  let fileCounter = 1
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [prompt, command] = entry
    
    await t.test(`Prompt: ${prompt}`, { concurrency: 1 }, async () => {
      const beforeRun = readdirSync(outputDirectory)
      
      let errorOccurred = false
      try {
        await new Promise<string>((resolve, reject) => {
          exec(command, { shell: '/bin/zsh' }, (
            error: ExecException | null, stdout: string, _stderr: string
          ) => {
              if (error) {
                reject(error)
              } else {
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
      
      // Check for new OR modified files
      let filesToRename: string[] = []
      
      // First check for new files
      const newFiles = afterRun.filter(f => !beforeRun.includes(f))
      if (newFiles.length > 0) {
        filesToRename = newFiles
      } else {
        // If no new files, look for the most recently modified file
        // This handles the case where the same file is being overwritten
        const possibleFile = afterRun.find(f => 
          !f.endsWith('.part') && 
          !f.match(/^\d{2}-/) && 
          f.endsWith('.md')
        )
        if (possibleFile) {
          filesToRename = [possibleFile]
        }
      }
      
      ok(filesToRename.length > 0, 'Expected at least one new or modified file')
      
      for (const file of filesToRename) {
        if (file.endsWith('.part')) continue
        // Skip if already renamed with our pattern
        if (/^\d{2}-/.test(file)) continue
        
        const oldPath = join(outputDirectory, file)
        if (!existsSync(oldPath)) continue
        
        // Extract file extension and base name
        const fileExtension = file.substring(file.lastIndexOf('.'))
        const baseName = file.substring(0, file.lastIndexOf('.'))
        
        // Create new name with counter, base name, and prompt
        const newName = `${String(fileCounter).padStart(2, '0')}-${baseName}-${prompt}${fileExtension}`
        const newPath = join(outputDirectory, newName)
        
        // Rename the file immediately to prevent it from being overwritten by the next command
        renameSync(oldPath, newPath)
        fileCounter++
      }
    })
  }
})