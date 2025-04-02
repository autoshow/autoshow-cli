// test/cli/all-models.test.ts

import test from 'node:test'
import { strictEqual, ok } from 'node:assert/strict'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'

import type { ExecException } from 'node:child_process'

const cliCommands = [
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
  'npm run as -- --file "content/examples/audio.mp3" --fireworks accounts/fireworks/models/qwen2p5-72b-instruct',
  'npm run as -- --file "content/examples/audio.mp3" --together meta-llama/Llama-3.2-3B-Instruct-Turbo',
  'npm run as -- --file "content/examples/audio.mp3" --together meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
  'npm run as -- --file "content/examples/audio.mp3" --together meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  'npm run as -- --file "content/examples/audio.mp3" --together meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
  'npm run as -- --file "content/examples/audio.mp3" --together google/gemma-2-27b-it',
  'npm run as -- --file "content/examples/audio.mp3" --together google/gemma-2-9b-it',
  'npm run as -- --file "content/examples/audio.mp3" --together Qwen/Qwen2.5-72B-Instruct-Turbo',
  'npm run as -- --file "content/examples/audio.mp3" --together Qwen/Qwen2.5-7B-Instruct-Turbo',
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