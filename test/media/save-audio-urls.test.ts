import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { readdirSync, existsSync, renameSync, statSync, writeFileSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'
import { l } from '@/logging'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  { '01-download-default': 'bun as -- media download --urls "input/example-urls.md"' },
  { '02-download-verbose': 'bun as -- media download --urls "input/example-urls.md" --verbose' },
]

describe('CLI save audio URLs tests', () => {
  const p = '[test/media/save-audio-urls]'
  const outputDirectory = resolve(process.cwd(), 'output')
  const inputDirectory = resolve(process.cwd(), 'input')
  const testUrlFile = join(inputDirectory, 'test-media-urls.md')
  let fileCounter = 1
  
  
  beforeAll(() => {
    if (!existsSync(join(inputDirectory, 'example-urls.md'))) {
      const sampleUrls = `# Test URLs for Media Download

- https://www.youtube.com/watch?v=dQw4w9WgXcQ
- https://www.youtube.com/watch?v=jNQXAC9IVRw

These are sample URLs for testing the media download functionality.
`
      writeFileSync(testUrlFile, sampleUrls, 'utf-8')
      l(`${p} Created test URL file`, { file: testUrlFile })
    }
  })
  
  afterAll(() => {
    
    if (existsSync(testUrlFile)) {
      try {
        rmSync(testUrlFile)
        l(`${p} Cleaned up test URL file`)
      } catch (err) {
        l(`${p} Could not clean up test file`, { error: String(err) })
      }
    }
  })
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [testName, command] = entry
    
    test(`Save Audio URLs: ${testName}`, async () => {
      l(`${p} Starting test`, { testName })
      const beforeRun = readdirSync(outputDirectory)
      
      let errorOccurred = false
      let errorMessage = ''
      try {
        await new Promise<string>((resolve, reject) => {
          exec(command, { shell: '/bin/zsh' }, (
            error: ExecException | null, stdout: string, _stderr: string
          ) => {
              if (error) {
                l(`${p} Command failed`, { testName, error: error.message })
                errorMessage = error.message
                reject(error)
              } else {
                l(`${p} Command succeeded`, { testName })
                resolve(stdout)
              }
            }
          )
        })
      } catch (err) {
        errorOccurred = true
        l(`${p} Error in test`, { testName, error: errorMessage })
      }
      
      expect(errorOccurred).toBe(false)
      const afterRun = readdirSync(outputDirectory)
      
      let filesToRename: string[] = []
      
      const newFiles = afterRun.filter(f => !beforeRun.includes(f))
      if (newFiles.length > 0) {
        l(`${p} Found new files`, { testName, count: newFiles.length })
        filesToRename = newFiles
      } else {
        const possibleFile = afterRun.find(f => 
          !f.endsWith('.part') && 
          !f.match(/^\d{2}-/) && 
          f.endsWith('.mp3')
        )
        if (possibleFile) {
          l(`${p} Found modified file`, { testName, file: possibleFile })
          filesToRename = [possibleFile]
        }
      }
      
      expect(filesToRename.length > 0).toBeTruthy()
      
      
      for (const file of filesToRename) {
        const filePath = join(outputDirectory, file)
        if (existsSync(filePath) && file.endsWith('.mp3')) {
          const stats = statSync(filePath)
          expect(stats.size > 0).toBeTruthy()
          l(`${p} Verified file`, { file, size: stats.size })
        }
      }
      
      for (const file of filesToRename) {
        if (file.endsWith('.part')) continue
        if (/^\d{2}-/.test(file)) continue
        if (file === 'temp') continue
        
        const oldPath = join(outputDirectory, file)
        if (!existsSync(oldPath)) continue
        
        const fileExtension = file.substring(file.lastIndexOf('.'))
        const baseName = file.substring(0, file.lastIndexOf('.'))
        
        const newName = `${String(fileCounter).padStart(2, '0')}-${baseName}-${testName}${fileExtension}`
        const newPath = join(outputDirectory, newName)
        
        l(`${p} Renaming file`, { from: file, to: newName })
        renameSync(oldPath, newPath)
        fileCounter++
      }
    })
  }
})
