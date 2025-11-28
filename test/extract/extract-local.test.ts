import test from 'node:test'
import { strictEqual, ok } from 'node:assert/strict'
import { readdirSync, existsSync, renameSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  { '01-pdf-default': 'bun as -- extract pdf "input/document.pdf"' },
  { '02-pdf-custom-output': 'bun as -- extract pdf "input/document.pdf" --output "output/custom-extract.txt"' },
  { '03-pdf-page-breaks': 'bun as -- extract pdf "input/document.pdf" --page-breaks' },
]

test('CLI extract local tests', { concurrency: 1 }, async (t) => {
  const p = '[test/extract/local]'
  const outputDirectory = resolve(process.cwd(), 'output')
  let fileCounter = 1
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [testName, command] = entry
    
    await t.test(`Local Extract: ${testName}`, { concurrency: 1 }, async () => {
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
          f.endsWith('.txt')
        )
        if (possibleFile) {
          console.log(`${p} Found modified file for ${testName}: ${possibleFile}`)
          filesToRename = [possibleFile]
        }
      }
      
      ok(filesToRename.length > 0, 'Expected at least one new or modified file')
      
      // Verify files contain extracted text
      for (const file of filesToRename) {
        const filePath = join(outputDirectory, file)
        if (existsSync(filePath) && file.endsWith('.txt')) {
          const stats = statSync(filePath)
          ok(stats.size > 0, `Expected ${file} to contain extracted text`)
          console.log(`${p} Verified file ${file} has size ${stats.size} bytes`)
        }
      }
      
      // Verify page breaks are present if requested
      if (testName.includes('page-breaks')) {
        const file = filesToRename.find(f => f.endsWith('.txt'))
        if (file) {
          const fs = await import('node:fs/promises')
          const content = await fs.readFile(join(outputDirectory, file), 'utf-8')
          ok(content.includes('--- Page Break ---'), 'Expected page break markers in output')
          console.log(`${p} Verified page breaks in ${file}`)
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
