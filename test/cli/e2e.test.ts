/**
 * tests/e2e.test.ts
 * 
 * Runs each CLI command as a subtest using Node.js's built-in test runner.
 * For each command, we compare the output directory before and after execution
 * to detect any new files, rename them by prepending a global counter, and assert
 * that at least one new file was created.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
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
      'npm run as -- --file "content/examples/audio.mp3" --deepseek',
      'npm run as -- --file "content/examples/audio.mp3" --fireworks',
      'npm run as -- --file "content/examples/audio.mp3" --together',
      'npm run as -- --file "content/examples/audio.mp3" --deepgram',
      'npm run as -- --file "content/examples/audio.mp3" --assembly',
      'npm run as -- --file "content/examples/audio.mp3" --assembly best',
      'npm run as -- --file "content/examples/audio.mp3" --assembly nano',
      'npm run as -- --file "content/examples/audio.mp3" --deepgram nova-2',
      'npm run as -- --file "content/examples/audio.mp3" --deepgram base',
      'npm run as -- --file "content/examples/audio.mp3" --deepgram enhanced',
      'npm run as -- --file "content/examples/audio.mp3" --chatgpt gpt-4.5-preview',
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
      'npm run as -- --file "content/examples/audio.mp3" --deepseek deepseek-chat',
      'npm run as -- --file "content/examples/audio.mp3" --deepseek deepseek-reasoner',
      'npm run as -- --file "content/examples/audio.mp3" --fireworks accounts/fireworks/models/llama-v3p1-405b-instruct',
      'npm run as -- --file "content/examples/audio.mp3" --fireworks accounts/fireworks/models/llama-v3p1-70b-instruct',
      'npm run as -- --file "content/examples/audio.mp3" --fireworks accounts/fireworks/models/llama-v3p1-8b-instruct',
      'npm run as -- --file "content/examples/audio.mp3" --fireworks accounts/fireworks/models/llama-v3p2-3b-instruct',
      'npm run as -- --file "content/examples/audio.mp3" --fireworks accounts/fireworks/models/qwen2p5-72b-instruct',
      'npm run as -- --file "content/examples/audio.mp3" --together meta-llama/Llama-3.2-3B-Instruct-Turbo',
      'npm run as -- --file "content/examples/audio.mp3" --together meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
      'npm run as -- --file "content/examples/audio.mp3" --together meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      'npm run as -- --file "content/examples/audio.mp3" --together meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      'npm run as -- --file "content/examples/audio.mp3" --together google/gemma-2-27b-it',
      'npm run as -- --file "content/examples/audio.mp3" --together google/gemma-2-9b-it',
      'npm run as -- --file "content/examples/audio.mp3" --together Qwen/Qwen2.5-72B-Instruct-Turbo',
      'npm run as -- --file "content/examples/audio.mp3" --together Qwen/Qwen2.5-7B-Instruct-Turbo',
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
      const outputDirectory = path.resolve(process.cwd(), 'content')
      let fileCounter = 1

      for (const cmd of cliCommands) {
            await t.test(`Command: ${cmd}`, { concurrency: 1 }, async () => {
                  const beforeRun = fs.readdirSync(outputDirectory)

                  let errorOccurred = false
                  try {
                        await new Promise<string>((resolve, reject) => {
                              exec(
                                    cmd,
                                    { shell: '/bin/zsh' }, 
                                    (error: ExecException | null, stdout: string, _stderr: string) => {
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

                  assert.strictEqual(errorOccurred, false)

                  const afterRun = fs.readdirSync(outputDirectory)
                  const newFiles = afterRun.filter(f => !beforeRun.includes(f))
                  assert.ok(newFiles.length > 0, 'Expected at least one new file')

                  for (const file of newFiles) {
                        if (file.endsWith('.part')) continue
                        if (/^\d+-/.test(file)) continue

                        const oldPath = path.join(outputDirectory, file)
                        if (!fs.existsSync(oldPath)) continue

                        const newName = String(fileCounter).padStart(2, '0') + '-' + file
                        const newPath = path.join(outputDirectory, newName)
                        fs.renameSync(oldPath, newPath)
                        fileCounter++
                  }
            })
      }
})