import test from 'node:test'
import { strictEqual, ok } from 'node:assert/strict'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  { universal: 'npm run as -- text --file "input/audio.mp3" --assembly universal' },
  { 'slam-1': 'npm run as -- text --file "input/audio.mp3" --assembly slam-1' },
  { 'nova-3': 'npm run as -- text --file "input/audio.mp3" --deepgram nova-3' },
  { 'gpt-5': 'npm run as -- text --file "input/audio.mp3" --chatgpt gpt-5' },
  { 'gpt-5-mini': 'npm run as -- text --file "input/audio.mp3" --chatgpt gpt-5-mini' },
  { 'gpt-5-nano': 'npm run as -- text --file "input/audio.mp3" --chatgpt gpt-5-nano' },
  { 'claude-opus-4-20250514': 'npm run as -- text --file "input/audio.mp3" --claude claude-opus-4-20250514' },
  { 'claude-sonnet-4-20250514': 'npm run as -- text --file "input/audio.mp3" --claude claude-sonnet-4-20250514' },
  { 'claude-opus-4-1-20250805': 'npm run as -- text --file "input/audio.mp3" --claude claude-opus-4-1-20250805' },
  { 'gemini-2.5-pro': 'npm run as -- text --file "input/audio.mp3" --gemini gemini-2.5-pro' },
  { 'gemini-2.5-flash': 'npm run as -- text --file "input/audio.mp3" --gemini gemini-2.5-flash' },
  { 'gemini-2.5-flash-lite-preview-06-17': 'npm run as -- text --file "input/audio.mp3" --gemini gemini-2.5-flash-lite-preview-06-17' },
]

test('CLI model tests', { concurrency: 1 }, async (t) => {
  const outputDirectory = resolve(process.cwd(), 'output')
  let fileCounter = 1
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [model, command] = entry
    
    await t.test(`Model: ${model}`, { concurrency: 1 }, async () => {
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
      const newFiles = afterRun.filter(f => !beforeRun.includes(f))
      ok(newFiles.length > 0, 'Expected at least one new file')
      
      for (const file of newFiles) {
        if (file.endsWith('.part')) continue
        if (/^\d+-/.test(file)) continue
        const oldPath = join(outputDirectory, file)
        if (!existsSync(oldPath)) continue
        
        const fileExtension = file.substring(file.lastIndexOf('.'))
        const baseName = file.substring(0, file.lastIndexOf('.'))
        
        const newName = `${String(fileCounter).padStart(2, '0')}-${baseName}-${model}${fileExtension}`
        const newPath = join(outputDirectory, newName)
        renameSync(oldPath, newPath)
        fileCounter++
      }
    })
  }
})