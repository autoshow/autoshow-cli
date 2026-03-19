import { describe, test, expect } from 'bun:test'
import { readdirSync, existsSync, renameSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'
import { l } from '@/logging'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  { '01-pdf-unpdf-default': 'bun as -- extract pdf "input/document.pdf"' },
  { '02-pdf-unpdf-custom-output': 'bun as -- extract pdf "input/document.pdf" --output "output/custom-extract.txt"' },
  { '03-pdf-unpdf-page-breaks': 'bun as -- extract pdf "input/document.pdf" --page-breaks' },
  { '04-epub-default': 'bun as -- extract epub "input/epub-example.epub"' },
]

describe('CLI extract local tests', () => {
  const outputDirectory = resolve(process.cwd(), 'output')
  let fileCounter = 1
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [testName, command] = entry
    
    test(`Local Extract: ${testName}`, async () => {
      l(`Starting test`, { testName })
      const beforeRun = readdirSync(outputDirectory)
      
      let errorOccurred = false
      let errorMessage = ''
      try {
        await new Promise<string>((resolve, reject) => {
          exec(command, { shell: '/bin/zsh' }, (
            error: ExecException | null, stdout: string, _stderr: string
          ) => {
              if (error) {
                l(`Command failed`, { testName, error: error.message })
                errorMessage = error.message
                reject(error)
              } else {
                l(`Command succeeded`, { testName })
                resolve(stdout)
              }
            }
          )
        })
      } catch (err) {
        errorOccurred = true
        l(`Error in test`, { testName, error: errorMessage })
      }
      
      expect(errorOccurred).toBe(false)
      const afterRun = readdirSync(outputDirectory)
      
      let filesToRename: string[] = []
      
      const newFiles = afterRun.filter(f => !beforeRun.includes(f))
      if (newFiles.length > 0) {
        l(`Found new files`, { testName, count: newFiles.length })
        filesToRename = newFiles
      } else {
        const possibleFile = afterRun.find(f => 
          !f.endsWith('.part') && 
          !f.match(/^\d{2}-/) && 
          (f.endsWith('.txt') || statSync(join(outputDirectory, f)).isDirectory())
        )
        if (possibleFile) {
          l(`Found modified file`, { testName, file: possibleFile })
          filesToRename = [possibleFile]
        }
      }
      
      expect(filesToRename.length > 0).toBeTruthy()
      
      
      for (const file of filesToRename) {
        const filePath = join(outputDirectory, file)
        const stats = statSync(filePath)
        
        if (stats.isDirectory()) {
          const dirContents = readdirSync(filePath)
          const txtFiles = dirContents.filter(f => f.endsWith('.txt'))
          expect(txtFiles.length > 0).toBeTruthy()
          l(`Verified directory`, { file, txtFiles: txtFiles.length })
          
          for (const txtFile of txtFiles) {
            const txtStats = statSync(join(filePath, txtFile))
            expect(txtStats.size > 0).toBeTruthy()
          }
        } else if (file.endsWith('.txt')) {
          expect(stats.size > 0).toBeTruthy()
          l(`Verified file`, { file, size: stats.size })
        }
      }
      
      
      if (testName.includes('page-breaks')) {
        const file = filesToRename.find(f => f.endsWith('.txt'))
        if (file) {
          const fs = await import('node:fs/promises')
          const content = await fs.readFile(join(outputDirectory, file), 'utf-8')
          expect(content.includes('--- Page Break ---')).toBeTruthy()
          l(`Verified page breaks`, { file })
        }
      }
      
      for (const file of filesToRename) {
        if (file.endsWith('.part')) continue
        if (/^\d{14}-/.test(file)) continue
        if (file === 'temp') continue
        
        const oldPath = join(outputDirectory, file)
        if (!existsSync(oldPath)) continue
        
        const stats = statSync(oldPath)
        let fileExtension = ''
        let baseName = file
        
        if (stats.isFile() && file.includes('.')) {
          fileExtension = file.substring(file.lastIndexOf('.'))
          baseName = file.substring(0, file.lastIndexOf('.'))
        }
        
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0]
        const newName = `${timestamp}-${baseName}-${testName}${fileExtension}`
        const newPath = join(outputDirectory, newName)
        
        l(`Renaming file`, { from: file, to: newName })
        renameSync(oldPath, newPath)
        fileCounter++
      }
    })
  }
})

