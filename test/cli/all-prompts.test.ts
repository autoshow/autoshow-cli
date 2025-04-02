// test/cli/all-prompts.test.ts

import test from 'node:test'
import { strictEqual, ok } from 'node:assert/strict'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  'npm run as -- --file "content/examples/audio.mp3" --prompt titles --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt summary --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt shortSummary --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt longSummary --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt bulletPoints --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt quotes --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt chapterTitlesAndQuotes --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt x --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt facebook --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt linkedin --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt chapterTitles --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt shortChapters --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt mediumChapters --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt longChapters --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt takeaways --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt questions --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt faq --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt blog --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt rapSong --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt rockSong --whisper tiny --deepseek',
  'npm run as -- --file "content/examples/audio.mp3" --prompt countrySong --whisper tiny --deepseek'
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