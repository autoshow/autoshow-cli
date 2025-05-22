// test/cli/e2e.test.ts

import test from 'node:test'
import { strictEqual, ok } from 'node:assert/strict'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  'npm run as -- --rss "https://ajcwebdev.substack.com/feed" --whisper tiny',
  'npm run as -- --rss "https://ajcwebdev.substack.com/feed" --info',
  'npm run as -- --channel "https://www.youtube.com/@ajcwebdev" --info',
  'npm run as -- --video "https://www.youtube.com/watch?v=MORMZXEaONk"',
  'npm run as -- --playlist "https://www.youtube.com/playlist?list=PLCVnrVv4KhXPz0SoAVu8Rc1emAdGPbSbr" --whisper tiny',
  'npm run as -- --playlist "https://www.youtube.com/playlist?list=PLCVnrVv4KhXPz0SoAVu8Rc1emAdGPbSbr" --info',
  'npm run as -- --urls "content/examples/example-urls.md" --whisper tiny',
  'npm run as -- --urls "content/examples/example-urls.md" --info',
  'npm run as -- --file "content/examples/audio.mp3"',
  'npm run as -- --file "content/examples/audio.mp3" --whisper tiny',
  'npm run as -- --file "content/examples/audio.mp3" --prompt titles summary',
  'npm run as -- --file "content/examples/audio.mp3" --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --claude',
  'npm run as -- --file "content/examples/audio.mp3" --gemini',
  'npm run as -- --file "content/examples/audio.mp3" --deepgram',
  'npm run as -- --file "content/examples/audio.mp3" --assembly',
  'npm run as -- --file "content/examples/audio.mp3" --assembly best',
  'npm run as -- --file "content/examples/audio.mp3" --assembly nano',
  'npm run as -- --file "content/examples/audio.mp3" --deepgram nova-2',
  'npm run as -- --file "content/examples/audio.mp3" --deepgram base',
  'npm run as -- --file "content/examples/audio.mp3" --deepgram enhanced',
  'npm run as -- --file "content/examples/audio.mp3" --chatgpt gpt-4o',
  'npm run as -- --file "content/examples/audio.mp3" --chatgpt gpt-4o-mini',
  'npm run as -- --file "content/examples/audio.mp3" --chatgpt o1-mini',
  'npm run as -- --file "content/examples/audio.mp3" --claude claude-3-7-sonnet-latest',
  'npm run as -- --file "content/examples/audio.mp3" --claude claude-3-5-haiku-latest',
  'npm run as -- --file "content/examples/audio.mp3" --claude claude-3-opus-latest',
  'npm run as -- --file "content/examples/audio.mp3" --gemini gemini-1.5-pro',
  'npm run as -- --file "content/examples/audio.mp3" --gemini gemini-1.5-flash-8b',
  'npm run as -- --file "content/examples/audio.mp3" --gemini gemini-1.5-flash',
  'npm run as -- --file "content/examples/audio.mp3" --gemini gemini-2.0-flash-lite',
  'npm run as -- --file "content/examples/audio.mp3" --gemini gemini-2.0-flash',
  'npm run as -- --file "content/examples/audio.mp3" --prompt titles --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt summary --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt shortSummary --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt longSummary --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt bulletPoints --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt quotes --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt chapterTitlesAndQuotes --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt x --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt facebook --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt linkedin --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt chapterTitles --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt shortChapters --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt mediumChapters --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt longChapters --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt takeaways --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt questions --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt faq --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt blog --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt rapSong --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt rockSong --whisper tiny --chatgpt',
  'npm run as -- --file "content/examples/audio.mp3" --prompt countrySong --whisper tiny --chatgpt'
]

test('CLI end-to-end tests', { concurrency: 1 }, async (t) => {
  const outputDirectory = resolve(process.cwd(), 'content')
  let fileCounter = 1
  for (const cmd of cliCommands) {
    await t.test(`Command: ${cmd}`, { concurrency: 1 }, async () => {
      const beforeRun = readdirSync(outputDirectory)
      let errorOccurred = false
      try {
        await new Promise<string>((resolve, reject) => {
          exec(cmd, { shell: '/bin/zsh' }, (
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
      const newFiles = afterRun.filter(f => !beforeRun.includes(f))
      ok(newFiles.length > 0, 'Expected at least one new file')
      for (const file of newFiles) {
        if (file.endsWith('.part')) continue
        if (/^\d+-/.test(file)) continue
        const oldPath = join(outputDirectory, file)
        if (!existsSync(oldPath)) continue
        const newName = String(fileCounter).padStart(2, '0') + '-' + file
        const newPath = join(outputDirectory, newName)
        renameSync(oldPath, newPath)
        fileCounter++
      }
    })
  }
})