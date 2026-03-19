import { describe, test, expect } from 'bun:test'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'
import type { ExecException } from 'node:child_process'

const elevenlabsCommands = [
  { 'elevenlabs-basic': 'bun as -- music generate --service elevenlabs --prompt "An upbeat electronic dance track with driving synths"' },
  { 'elevenlabs-instrumental': 'bun as -- music generate --service elevenlabs --prompt "A peaceful acoustic guitar melody" --instrumental' },
  { 'elevenlabs-duration': 'bun as -- music generate --service elevenlabs --prompt "A dramatic orchestral piece" --duration 30s' },
  { 'elevenlabs-plan': 'bun as -- music plan --prompt "A pop song about summer" --duration 1m' },
]

const minimaxCommands = [
  { 'minimax-basic': 'bun as -- music generate --service minimax --prompt "Contemporary pop with catchy hooks" --lyrics "[Verse]\\nHello world, this is a test\\nJust a simple song at best\\n[Chorus]\\nLa la la, sing along\\nThis is our test song"' },
  { 'minimax-format': 'bun as -- music generate --service minimax --prompt "Upbeat dance track" --lyrics "[Verse]\\nDancing through the night\\nEverything feels right\\n[Chorus]\\nMove your feet, feel the beat" --format mp3_44100_128000' },
]

describe.skipIf(!process.env['ELEVENLABS_API_KEY'])('CLI ElevenLabs music services tests', () => {
  const outputDirectory = resolve(process.cwd(), 'output')
  let fileCounter = 1
  
  for (const commandObj of elevenlabsCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [testName, command] = entry
    
    test(`ElevenLabs: ${testName}`, async () => {
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
          })
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
          (f.endsWith('.mp3') || f.endsWith('.opus') || f.endsWith('.pcm'))
        )
        if (possibleFile) {
          filesToRename = [possibleFile]
        }
      }
      
      
      if (!testName.includes('plan')) {
        expect(filesToRename.length > 0).toBeTruthy()
      }
      
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

describe.skipIf(!process.env['MINIMAX_API_KEY'])('CLI MiniMax music services tests', () => {
  const outputDirectory = resolve(process.cwd(), 'output')
  let fileCounter = 1
  
  for (const commandObj of minimaxCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [testName, command] = entry
    
    test(`MiniMax: ${testName}`, async () => {
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
          })
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
          (f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.pcm'))
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
