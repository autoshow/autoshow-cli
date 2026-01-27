import test from 'node:test'
import { strictEqual, ok } from 'node:assert/strict'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  // AssemblyAI models
  { 'assembly-universal': 'bun as -- text --file "input/audio.mp3" --assembly universal' },
  { 'assembly-slam-1': 'bun as -- text --file "input/audio.mp3" --assembly slam-1' },
  { 'assembly-nano': 'bun as -- text --file "input/audio.mp3" --assembly nano' },
  
  // Deepgram models
  { 'deepgram-nova-3': 'bun as -- text --file "input/audio.mp3" --deepgram nova-3' },
  { 'deepgram-nova-2': 'bun as -- text --file "input/audio.mp3" --deepgram nova-2' },
  
  // OpenAI ChatGPT models
  { 'chatgpt-gpt-5': 'bun as -- text --file "input/audio.mp3" --chatgpt gpt-5' },
  { 'chatgpt-gpt-5-mini': 'bun as -- text --file "input/audio.mp3" --chatgpt gpt-5-mini' },
  { 'chatgpt-gpt-5-nano': 'bun as -- text --file "input/audio.mp3" --chatgpt gpt-5-nano' },
  
  // Anthropic Claude models
  { 'claude-opus-4-20250514': 'bun as -- text --file "input/audio.mp3" --claude claude-opus-4-20250514' },
  { 'claude-sonnet-4-20250514': 'bun as -- text --file "input/audio.mp3" --claude claude-sonnet-4-20250514' },
  { 'claude-opus-4-1-20250805': 'bun as -- text --file "input/audio.mp3" --claude claude-opus-4-1-20250805' },
  
  // Google Gemini models
  { 'gemini-2.5-pro': 'bun as -- text --file "input/audio.mp3" --gemini gemini-2.5-pro' },
  { 'gemini-2.5-flash': 'bun as -- text --file "input/audio.mp3" --gemini gemini-2.5-flash' },
  { 'gemini-2.5-flash-lite-preview-06-17': 'bun as -- text --file "input/audio.mp3" --gemini gemini-2.5-flash-lite-preview-06-17' },
]

test('CLI model tests', { concurrency: 1 }, async (t) => {
  const p = '[test/text/models]'
  const outputDirectory = resolve(process.cwd(), 'output')
  let fileCounter = 1
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [model, command] = entry
    
    await t.test(`Model: ${model}`, { concurrency: 1 }, async () => {
      console.log(`${p} Starting test: ${model}`)
      const beforeRun = readdirSync(outputDirectory)
      
      let errorOccurred = false
      try {
        await new Promise<string>((resolve, reject) => {
          exec(command, { shell: '/bin/zsh' }, (
            error: ExecException | null, stdout: string, _stderr: string
          ) => {
              if (error) {
                console.error(`${p} Command failed for ${model}: ${error.message}`)
                reject(error)
              } else {
                console.log(`${p} Command succeeded for ${model}`)
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
        
        console.log(`${p} Renaming file: ${file} -> ${newName}`)
        renameSync(oldPath, newPath)
        fileCounter++
      }
    })
  }
})
