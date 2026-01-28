import { describe, test, expect } from 'bun:test'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'
import { l } from '@/logging'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  
  { titles: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt titles --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { summary: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt summary --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { shortSummary: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt shortSummary --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { longSummary: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt longSummary --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { bulletPoints: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt bulletPoints --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { shortChapters: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt shortChapters --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { mediumChapters: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt mediumChapters --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { longChapters: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt longChapters --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { chapterTitles: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt chapterTitles --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  
  
  { takeaways: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt takeaways --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { questions: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt questions --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { quotes: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt quotes --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { faq: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt faq --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { chapterTitlesAndQuotes: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt chapterTitlesAndQuotes --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { keyMoments: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt keyMoments --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { keyMomentsCount5: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt keyMoments --keyMomentsCount 5 --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { keyMomentDuration90: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt keyMoments --keyMomentDuration 90 --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  
  
  { x: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt x --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { facebook: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt facebook --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { linkedin: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt linkedin --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { instagram: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt instagram --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { tiktok: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt tiktok --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { youtubeDescription: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt youtubeDescription --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { emailNewsletter: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt emailNewsletter --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { seoArticle: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt seoArticle --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { contentStrategy: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt contentStrategy --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { blog: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt blog --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  
  
  { rapSong: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt rapSong --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { rockSong: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt rockSong --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { countrySong: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt countrySong --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { popSong: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt popSong --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { jazzSong: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt jazzSong --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { folkSong: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt folkSong --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { shortStory: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt shortStory --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { screenplay: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt screenplay --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
  { poetryCollection: 'bun as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt poetryCollection --whisper-coreml large-v3-turbo --chatgpt gpt-5.2' },
]

describe('CLI prompt tests', () => {
  const outputDirectory = resolve(process.cwd(), 'output')
  let fileCounter = 1
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [prompt, command] = entry
    
    test(`Prompt: ${prompt}`, async () => {
      l(`Starting test`, { prompt })
      const beforeRun = readdirSync(outputDirectory)
      
      let errorOccurred = false
      try {
        await new Promise<string>((resolve, reject) => {
          exec(command, { shell: '/bin/zsh' }, (
            error: ExecException | null, stdout: string, _stderr: string
          ) => {
              if (error) {
                l(`Command failed`, { prompt, error: error.message })
                reject(error)
              } else {
                l(`Command succeeded`, { prompt })
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
        l(`Found new files`, { prompt, count: newFiles.length })
        filesToRename = newFiles
      } else {
        const possibleFile = afterRun.find(f => 
          !f.endsWith('.part') && 
          !f.match(/^\d{2}-/) && 
          f.endsWith('.md')
        )
        if (possibleFile) {
          l(`Found modified file`, { prompt, file: possibleFile })
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
        
        const newName = `${String(fileCounter).padStart(2, '0')}-${baseName}-${prompt}${fileExtension}`
        const newPath = join(outputDirectory, newName)
        
        l(`Renaming file`, { from: file, to: newName })
        renameSync(oldPath, newPath)
        fileCounter++
      }
    })
  }
})

