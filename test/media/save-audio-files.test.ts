import test from 'node:test'
import { strictEqual, ok } from 'node:assert/strict'
import { readdirSync, existsSync, renameSync, statSync, rmSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  { '01-convert-single-file': 'bun as -- media convert --files "input/test-media/sample.mp4"' },
  { '02-convert-directory': 'bun as -- media convert --files "input/test-media"' },
  { '03-convert-custom-output': 'bun as -- media convert --files "input/test-media" --output "output/custom-media"' },
  { '04-convert-verbose': 'bun as -- media convert --files "input/test-media/sample.mp4" --verbose' },
]

test('CLI save audio files tests', { concurrency: 1 }, async (t) => {
  const p = '[test/media/save-audio-files]'
  const outputDirectory = resolve(process.cwd(), 'output')
  const inputDirectory = resolve(process.cwd(), 'input')
  const testMediaDir = join(inputDirectory, 'test-media')
  const testMediaFile = join(testMediaDir, 'sample.mp4')
  let fileCounter = 1
  
  // Create a test media directory with a sample video file
  await t.before(() => {
    if (!existsSync(testMediaDir)) {
      mkdirSync(testMediaDir, { recursive: true })
      console.log(`${p} Created test media directory: ${testMediaDir}`)
    }
    
    if (!existsSync(testMediaFile)) {
      // Create a minimal valid MP4 file using ffmpeg
      const command = `ffmpeg -f lavfi -i sine=frequency=1000:duration=5 -f lavfi -i color=c=blue:s=320x240:d=5 -c:v libx264 -c:a aac -y "${testMediaFile}"`
      
      try {
        exec(command, { shell: '/bin/zsh' }, (error) => {
          if (error) {
            console.log(`${p} Could not create test media file: ${error.message}`)
          } else {
            console.log(`${p} Created test media file: ${testMediaFile}`)
          }
        })
      } catch (err) {
        console.log(`${p} Error creating test file: ${err}`)
      }
    }
  })
  
  await t.after(() => {
    // Clean up test directory if we created it
    if (existsSync(testMediaDir)) {
      try {
        rmSync(testMediaDir, { recursive: true, force: true })
        console.log(`${p} Cleaned up test media directory`)
      } catch (err) {
        console.log(`${p} Could not clean up test directory: ${err}`)
      }
    }
    
    // Clean up custom output directory
    const customOutputDir = join(outputDirectory, 'custom-media')
    if (existsSync(customOutputDir)) {
      try {
        rmSync(customOutputDir, { recursive: true, force: true })
        console.log(`${p} Cleaned up custom output directory`)
      } catch (err) {
        console.log(`${p} Could not clean up custom output directory: ${err}`)
      }
    }
  })
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [testName, command] = entry
    
    await t.test(`Save Audio Files: ${testName}`, { concurrency: 1 }, async () => {
      console.log(`${p} Starting test: ${testName}`)
      
      // Determine the correct output directory based on command
      const checkDir = command.includes('--output') && command.includes('custom-media')
        ? join(outputDirectory, 'custom-media')
        : outputDirectory
      
      const beforeRun = existsSync(checkDir) ? readdirSync(checkDir) : []
      
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
      const afterRun = readdirSync(checkDir)
      
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
        const filePath = join(checkDir, file)
        if (existsSync(filePath) && file.endsWith('.mp3')) {
          const stats = statSync(filePath)
          ok(stats.size > 0, `Expected ${file} to contain audio data`)
          console.log(`${p} Verified file ${file} has size ${stats.size} bytes`)
        }
      }
      
      // Only rename files in the standard output directory
      if (checkDir === outputDirectory) {
        for (const file of filesToRename) {
          if (file.endsWith('.part')) continue
          if (/^\d{2}-/.test(file)) continue
          if (file === 'temp') continue
          
          const oldPath = join(checkDir, file)
          if (!existsSync(oldPath)) continue
          
          const fileExtension = file.substring(file.lastIndexOf('.'))
          const baseName = file.substring(0, file.lastIndexOf('.'))
          
          const newName = `${String(fileCounter).padStart(2, '0')}-${baseName}-${testName}${fileExtension}`
          const newPath = join(checkDir, newName)
          
          console.log(`${p} Renaming file: ${file} -> ${newName}`)
          renameSync(oldPath, newPath)
          fileCounter++
        }
      }
    })
  }
})
