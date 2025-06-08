// test/cli/all-models.test.ts

import test from 'node:test'
import { strictEqual, ok } from 'node:assert/strict'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  'npm run as -- text --file "content/examples/audio.mp3" --assembly universal',
  'npm run as -- text --file "content/examples/audio.mp3" --assembly slam-1',
  'npm run as -- text --file "content/examples/audio.mp3" --assembly nano',
  'npm run as -- text --file "content/examples/audio.mp3" --deepgram nova-2',
  'npm run as -- text --file "content/examples/audio.mp3" --deepgram nova-3',
  'npm run as -- text --file "content/examples/audio.mp3" --chatgpt gpt-4o',
  'npm run as -- text --file "content/examples/audio.mp3" --chatgpt gpt-4o-mini',
  'npm run as -- text --file "content/examples/audio.mp3" --chatgpt o1-mini',
  'npm run as -- text --file "content/examples/audio.mp3" --claude claude-3-7-sonnet-latest',
  'npm run as -- text --file "content/examples/audio.mp3" --claude claude-3-5-haiku-latest',
  'npm run as -- text --file "content/examples/audio.mp3" --gemini gemini-1.5-pro',
  'npm run as -- text --file "content/examples/audio.mp3" --gemini gemini-1.5-flash-8b',
  'npm run as -- text --file "content/examples/audio.mp3" --gemini gemini-1.5-flash',
  'npm run as -- text --file "content/examples/audio.mp3" --gemini gemini-2.0-flash-lite',
  'npm run as -- text --file "content/examples/audio.mp3" --gemini gemini-2.0-flash',
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