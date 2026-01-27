import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { readdirSync, existsSync, renameSync, statSync, rmSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'
import { l } from '@/logging'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  { '01-convert-single-file': 'bun as -- media convert --files "input/test-media/sample.mp4"' },
  { '02-convert-directory': 'bun as -- media convert --files "input/test-media"' },
  { '03-convert-custom-output': 'bun as -- media convert --files "input/test-media" --output "output/custom-media"' },
  { '04-convert-verbose': 'bun as -- media convert --files "input/test-media/sample.mp4" --verbose' },
]

describe('CLI save audio files tests', () => {
  const p = '[test/media/save-audio-files]'
  const outputDirectory = resolve(process.cwd(), 'output')
  const inputDirectory = resolve(process.cwd(), 'input')
  const testMediaDir = join(inputDirectory, 'test-media')
  const testMediaFile = join(testMediaDir, 'sample.mp4')
  let fileCounter = 1
  
  // Create a test media directory with a sample video file
  beforeAll(() => {
    if (!existsSync(testMediaDir)) {
      mkdirSync(testMediaDir, { recursive: true })
      l(`${p} Created test media directory`, { directory: testMediaDir })
    }
    
    if (!existsSync(testMediaFile)) {
      // Create a minimal valid MP4 file using ffmpeg
      const command = `ffmpeg -f lavfi -i sine=frequency=1000:duration=5 -f lavfi -i color=c=blue:s=320x240:d=5 -c:v libx264 -c:a aac -y "${testMediaFile}"`
      
      try {
        exec(command, { shell: '/bin/zsh' }, (error) => {
          if (error) {
            l(`${p} Could not create test media file`, { error: error.message })
          } else {
            l(`${p} Created test media file`, { file: testMediaFile })
          }
        })
      } catch (err) {
        l(`${p} Error creating test file`, { error: String(err) })
      }
    }
  })
  
  afterAll(() => {
    // Clean up test directory if we created it
    if (existsSync(testMediaDir)) {
      try {
        rmSync(testMediaDir, { recursive: true, force: true })
        l(`${p} Cleaned up test media directory`)
      } catch (err) {
        l(`${p} Could not clean up test directory`, { error: String(err) })
      }
    }
    
    // Clean up custom output directory
    const customOutputDir = join(outputDirectory, 'custom-media')
    if (existsSync(customOutputDir)) {
      try {
        rmSync(customOutputDir, { recursive: true, force: true })
        l(`${p} Cleaned up custom output directory`)
      } catch (err) {
        l(`${p} Could not clean up custom output directory`, { error: String(err) })
      }
    }
  })
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [testName, command] = entry
    
    test(`Save Audio Files: ${testName}`, async () => {
      l(`${p} Starting test`, { testName })
      
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
      const afterRun = readdirSync(checkDir)
      
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
      
      // Verify files contain audio data
      for (const file of filesToRename) {
        const filePath = join(checkDir, file)
        if (existsSync(filePath) && file.endsWith('.mp3')) {
          const stats = statSync(filePath)
          expect(stats.size > 0).toBeTruthy()
          l(`${p} Verified file`, { file, size: stats.size })
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
          
          l(`${p} Renaming file`, { from: file, to: newName })
          renameSync(oldPath, newPath)
          fileCounter++
        }
      }
    })
  }
})
