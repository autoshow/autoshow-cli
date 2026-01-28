import { describe, test, expect } from 'bun:test'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'
import { l } from '@/logging'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  
  { 'assembly-universal': 'bun as -- text --file "input/audio.mp3" --assembly universal' },
  { 'assembly-slam-1': 'bun as -- text --file "input/audio.mp3" --assembly slam-1' },
  { 'assembly-nano': 'bun as -- text --file "input/audio.mp3" --assembly nano' },
  
  
  { 'deepgram-nova-3': 'bun as -- text --file "input/audio.mp3" --deepgram nova-3' },
  { 'deepgram-nova-2': 'bun as -- text --file "input/audio.mp3" --deepgram nova-2' },
  
  
  { 'chatgpt-gpt-5': 'bun as -- text --file "input/audio.mp3" --chatgpt gpt-5' },
  { 'chatgpt-gpt-5-mini': 'bun as -- text --file "input/audio.mp3" --chatgpt gpt-5-mini' },
  { 'chatgpt-gpt-5-nano': 'bun as -- text --file "input/audio.mp3" --chatgpt gpt-5-nano' },
  
  
  { 'claude-opus-4-20250514': 'bun as -- text --file "input/audio.mp3" --claude claude-opus-4-20250514' },
  { 'claude-sonnet-4-20250514': 'bun as -- text --file "input/audio.mp3" --claude claude-sonnet-4-20250514' },
  { 'claude-opus-4-1-20250805': 'bun as -- text --file "input/audio.mp3" --claude claude-opus-4-1-20250805' },
  
  
  { 'gemini-2.5-pro': 'bun as -- text --file "input/audio.mp3" --gemini gemini-2.5-pro' },
  { 'gemini-2.5-flash': 'bun as -- text --file "input/audio.mp3" --gemini gemini-2.5-flash' },
  { 'gemini-2.5-flash-lite-preview-06-17': 'bun as -- text --file "input/audio.mp3" --gemini gemini-2.5-flash-lite-preview-06-17' },
]

describe('CLI model tests', () => {
  const outputDirectory = resolve(process.cwd(), 'output')
  let fileCounter = 1
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [model, command] = entry
    
    test(`Model: ${model}`, async () => {
      l(`Starting test`, { model })
      const beforeRun = readdirSync(outputDirectory)
      
      let errorOccurred = false
      try {
        await new Promise<string>((resolve, reject) => {
          exec(command, { shell: '/bin/zsh' }, (
            error: ExecException | null, stdout: string, _stderr: string
          ) => {
              if (error) {
                l(`Command failed`, { model, error: error.message })
                reject(error)
              } else {
                l(`Command succeeded`, { model })
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
      const newFiles = afterRun.filter(f => !beforeRun.includes(f))
      expect(newFiles.length > 0).toBeTruthy()
      
      for (const file of newFiles) {
        if (file.endsWith('.part')) continue
        if (/^\d+-/.test(file)) continue
        const oldPath = join(outputDirectory, file)
        if (!existsSync(oldPath)) continue
        
        const fileExtension = file.substring(file.lastIndexOf('.'))
        const baseName = file.substring(0, file.lastIndexOf('.'))
        
        const newName = `${String(fileCounter).padStart(2, '0')}-${baseName}-${model}${fileExtension}`
        const newPath = join(outputDirectory, newName)
        
        l(`Renaming file`, { from: file, to: newName })
        renameSync(oldPath, newPath)
        fileCounter++
      }
    })
  }
})

