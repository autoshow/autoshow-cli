import test from 'node:test'
import { strictEqual, ok } from 'node:assert/strict'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  // Multiple prompts test
  { '01-file-multiple-prompts': 'bun as -- text --file "input/audio.mp3" --prompt titles summary' },
  
  // LLM service tests
  { '02-chatgpt-default': 'bun as -- text --file "input/audio.mp3" --chatgpt' },
  { '03-claude-default': 'bun as -- text --file "input/audio.mp3" --claude' },
  { '04-gemini-default': 'bun as -- text --file "input/audio.mp3" --gemini' },
  
  // Transcription service tests
  { '05-deepgram-default': 'bun as -- text --file "input/audio.mp3" --deepgram' },
  { '06-deepgram-nova-2': 'bun as -- text --file "input/audio.mp3" --deepgram nova-2' },
  { '07-assembly-default': 'bun as -- text --file "input/audio.mp3" --assembly' },
  { '08-assembly-nano': 'bun as -- text --file "input/audio.mp3" --assembly nano' },
  { '09-assembly-speaker-labels': 'bun as -- text --video "https://ajc.pics/autoshow/fsjam-short.mp3" --assembly --speakerLabels' },
]

test('CLI services tests', { concurrency: 1 }, async (t) => {
  const p = '[test/text/services]'
  const outputDirectory = resolve(process.cwd(), 'output')
  let fileCounter = 1
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [testName, command] = entry
    
    await t.test(`Service: ${testName}`, { concurrency: 1 }, async () => {
      console.log(`${p} Starting test: ${testName}`)
      const beforeRun = readdirSync(outputDirectory)
      
      let errorOccurred = false
      try {
        await new Promise<string>((resolve, reject) => {
          exec(command, { shell: '/bin/zsh' }, (
            error: ExecException | null, stdout: string, _stderr: string
          ) => {
              if (error) {
                console.error(`${p} Command failed for ${testName}: ${error.message}`)
                reject(error)
              } else {
                console.log(`${p} Command succeeded for ${testName}`)
                resolve(stdout)
              }
            }
          )
        })
      } catch {
        errorOccurred = true
      }
      
      strictEqual(errorOccurred, false)
      
      // printPrompt doesn't create files, just prints to stdout
      if (testName.includes('print-prompt')) {
        return
      }
      
      const afterRun = readdirSync(outputDirectory)
      
      let filesToRename: string[] = []
      
      const newFiles = afterRun.filter(f => !beforeRun.includes(f))
      if (newFiles.length > 0) {
        console.log(`${p} Found ${newFiles.length} new files for ${testName}`)
        filesToRename = newFiles
      } else {
        const possibleFile = afterRun.find(f => 
          !f.endsWith('.part') && 
          !f.match(/^\d{2}-/) && 
          (f.endsWith('.md') || f.endsWith('.json'))
        )
        if (possibleFile) {
          console.log(`${p} Found modified file for ${testName}: ${possibleFile}`)
          filesToRename = [possibleFile]
        }
      }
      
      ok(filesToRename.length > 0, 'Expected at least one new or modified file')
      
      for (const file of filesToRename) {
        if (file.endsWith('.part')) continue
        if (/^\d{2}-/.test(file)) continue
        
        const oldPath = join(outputDirectory, file)
        if (!existsSync(oldPath)) continue
        
        const fileExtension = file.substring(file.lastIndexOf('.'))
        const baseName = file.substring(0, file.lastIndexOf('.'))
        
        const newName = `${String(fileCounter).padStart(2, '0')}-${baseName}-${testName}${fileExtension}`
        const newPath = join(outputDirectory, newName)
        
        console.log(`${p} Renaming file: ${file} -> ${newName}`)
        renameSync(oldPath, newPath)
        fileCounter++
      }
    })
  }
})
