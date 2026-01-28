import { describe, test, expect } from 'bun:test'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  { 'qwen3-default': 'bun as -- tts input/sample.md --qwen3' },
  { 'qwen3-ryan': 'bun as -- tts input/sample.md --qwen3 --qwen3-speaker Ryan' },
  { 'qwen3-japanese': 'bun as -- tts input/sample.md --qwen3 --qwen3-speaker Ono_Anna --qwen3-language Japanese' },
  { 'qwen3-instruct': 'bun as -- tts input/sample.md --qwen3 --qwen3-instruct "Speak with enthusiasm"' },
  
  { 'chatterbox-turbo': 'bun as -- tts input/sample.md --chatterbox' },
  { 'chatterbox-standard': 'bun as -- tts input/sample.md --chatterbox --chatterbox-model standard' },
  { 'chatterbox-exaggeration': 'bun as -- tts input/sample.md --chatterbox --chatterbox-model standard --chatterbox-exaggeration 0.7' },
  
  { 'cosyvoice-default': 'bun as -- tts input/sample.md --cosyvoice' },
  { 'cosyvoice-instruct': 'bun as -- tts input/sample.md --cosyvoice --cosy-instruct "Speak with enthusiasm"' },
  { 'cosyvoice-japanese': 'bun as -- tts input/sample.md --cosyvoice --cosy-language ja' },
  { 'cosyvoice-cantonese': 'bun as -- tts input/sample.md --cosyvoice --cosy-instruct "Use Cantonese dialect"' },

  { 'fishaudio-default': 'bun as -- tts input/sample.md --fish-audio' },
]

describe('CLI TTS local tests', () => {
  const outputDirectory = resolve(process.cwd(), 'output')
  let fileCounter = 1
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [testName, command] = entry
    
    test(`Local TTS: ${testName}`, async () => {
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
      
      expect(errorOccurred).toBe(false)
      const afterRun = readdirSync(outputDirectory)
      
      let filesToRename: string[] = []
      
      const newFiles = afterRun.filter(f => !beforeRun.includes(f))
      if (newFiles.length > 0) {
        filesToRename = newFiles
      } else {
        const possibleFile = afterRun.find(f => 
          !f.endsWith('.part') && 
          !f.match(/^\d{2}-/) && 
          (f.endsWith('.wav') || f.endsWith('.mp3'))
        )
        if (possibleFile) {
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
        
        const newName = `${String(fileCounter).padStart(2, '0')}-${baseName}-${testName}${fileExtension}`
        const newPath = join(outputDirectory, newName)
        
        renameSync(oldPath, newPath)
        fileCounter++
      }
    })
  }
})
