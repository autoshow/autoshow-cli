import test from 'node:test'
import { strictEqual, ok } from 'node:assert/strict'
import { readdirSync, existsSync, renameSync, statSync, writeFileSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  { '01-download-default': 'npm run as -- media download --urls "input/example-urls.md"' },
  { '02-download-verbose': 'npm run as -- media download --urls "input/example-urls.md" --verbose' },
]

test('CLI media download tests', { concurrency: 1 }, async (t) => {
  const p = '[test/media/download]'
  const outputDirectory = resolve(process.cwd(), 'output')
  const inputDirectory = resolve(process.cwd(), 'input')
  const testUrlFile = join(inputDirectory, 'test-media-urls.md')
  let fileCounter = 1
  
  // Create a test markdown file with sample URLs if example-urls.md doesn't exist
  await t.before(() => {
    if (!existsSync(join(inputDirectory, 'example-urls.md'))) {
      const sampleUrls = `# Test URLs for Media Download

- https://www.youtube.com/watch?v=dQw4w9WgXcQ
- https://www.youtube.com/watch?v=jNQXAC9IVRw

These are sample URLs for testing the media download functionality.
`
      writeFileSync(testUrlFile, sampleUrls, 'utf-8')
      console.log(`${p} Created test URL file: ${testUrlFile}`)
    }
  })
  
  await t.after(() => {
    // Clean up test file if we created it
    if (existsSync(testUrlFile)) {
      try {
        rmSync(testUrlFile)
        console.log(`${p} Cleaned up test URL file`)
      } catch (err) {
        console.log(`${p} Could not clean up test file: ${err}`)
      }
    }
  })
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [testName, command] = entry
    
    await t.test(`Media Download: ${testName}`, { concurrency: 1 }, async () => {
      console.log(`${p} Starting test: ${testName}`)
      const beforeRun = readdirSync(outputDirectory)
      
      let errorOccurred = false
      let errorMessage = ''
      try {
        await new Promise<string>((resolve, reject) => {
          exec(command, { shell: '/bin/zsh' }, (
            error: ExecException | null, stdout: string, _stderr: string
          ) => {
              if (error) {
                console.error(`${p} Command failed for ${testName}: ${error.message}`)
                errorMessage = error.message
                reject(error)
              } else {
                console.log(`${p} Command succeeded for ${testName}`)
                resolve(stdout)
              }
            }
          )
        })
      } catch (err) {
        errorOccurred = true
        console.error(`${p} Error in test ${testName}: ${errorMessage}`)
      }
      
      strictEqual(errorOccurred, false, `Test should complete without errors: ${errorMessage}`)
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
          f.endsWith('.mp3')
        )
        if (possibleFile) {
          console.log(`${p} Found modified file for ${testName}: ${possibleFile}`)
          filesToRename = [possibleFile]
        }
      }
      
      ok(filesToRename.length > 0, 'Expected at least one new or modified file')
      
      // Verify files contain audio data
      for (const file of filesToRename) {
        const filePath = join(outputDirectory, file)
        if (existsSync(filePath) && file.endsWith('.mp3')) {
          const stats = statSync(filePath)
          ok(stats.size > 0, `Expected ${file} to contain audio data`)
          console.log(`${p} Verified file ${file} has size ${stats.size} bytes`)
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
        
        console.log(`${p} Renaming file: ${file} -> ${newName}`)
        renameSync(oldPath, newPath)
        fileCounter++
      }
    })
  }
})
