import test from 'node:test'
import { strictEqual, ok } from 'node:assert/strict'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  { titles: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt titles --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { summary: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt summary --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { shortSummary: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt shortSummary --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { longSummary: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt longSummary --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { bulletPoints: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt bulletPoints --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { quotes: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt quotes --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { chapterTitlesAndQuotes: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt chapterTitlesAndQuotes --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { x: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt x --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { facebook: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt facebook --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { linkedin: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt linkedin --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { instagram: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt instagram --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { tiktok: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt tiktok --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { youtubeDescription: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt youtubeDescription --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { emailNewsletter: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt emailNewsletter --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { seoArticle: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt seoArticle --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { contentStrategy: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt contentStrategy --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { chapterTitles: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt chapterTitles --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { shortChapters: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt shortChapters --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { mediumChapters: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt mediumChapters --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { longChapters: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt longChapters --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { takeaways: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt takeaways --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { questions: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt questions --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { faq: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt faq --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { blog: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt blog --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { rapSong: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt rapSong --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { rockSong: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt rockSong --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { countrySong: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt countrySong --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { popSong: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt popSong --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { jazzSong: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt jazzSong --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { folkSong: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt folkSong --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { shortStory: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt shortStory --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { screenplay: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt screenplay --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' },
  { poetryCollection: 'npm run as -- text --rss "https://ajcwebdev.substack.com/feed" --prompt poetryCollection --whisper-coreml large-v3-turbo --chatgpt gpt-5-nano' }
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
      
      let filesToRename: string[] = []
      
      const newFiles = afterRun.filter(f => !beforeRun.includes(f))
      if (newFiles.length > 0) {
        filesToRename = newFiles
      } else {
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
        if (/^\d{2}-/.test(file)) continue
        
        const oldPath = join(outputDirectory, file)
        if (!existsSync(oldPath)) continue
        
        const fileExtension = file.substring(file.lastIndexOf('.'))
        const baseName = file.substring(0, file.lastIndexOf('.'))
        
        const newName = `${String(fileCounter).padStart(2, '0')}-${baseName}-${prompt}${fileExtension}`
        const newPath = join(outputDirectory, newName)
        
        renameSync(oldPath, newPath)
        fileCounter++
      }
    })
  }
})