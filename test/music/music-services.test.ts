import test from 'node:test'
import { strictEqual, ok } from 'node:assert/strict'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'
import type { ExecException } from 'node:child_process'

const cliCommands = [
  { 'elevenlabs-basic': 'bun as -- music generate --prompt "An upbeat electronic dance track with driving synths"' },
  { 'elevenlabs-instrumental': 'bun as -- music generate --prompt "A peaceful acoustic guitar melody" --instrumental' },
  { 'elevenlabs-duration': 'bun as -- music generate --prompt "A dramatic orchestral piece" --duration 30s' },
  { 'elevenlabs-plan': 'bun as -- music plan --prompt "A pop song about summer" --duration 1m' },
]

test('CLI music services tests', { concurrency: 1 }, async (t) => {
  if (!process.env['ELEVENLABS_API_KEY']) {
    t.skip('ELEVENLABS_API_KEY not set')
    return
  }
  const outputDirectory = resolve(process.cwd(), 'output')
  let fileCounter = 1
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [testName, command] = entry
    
    await t.test(`Music Service: ${testName}`, { concurrency: 1 }, async () => {
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
      
      strictEqual(errorOccurred, false)
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
      
      // For 'plan' command, no file is created
      if (!testName.includes('plan')) {
        ok(filesToRename.length > 0, 'Expected at least one new music file')
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
