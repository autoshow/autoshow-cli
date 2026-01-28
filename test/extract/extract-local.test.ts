import { describe, test, expect } from 'bun:test'
import { readdirSync, existsSync, renameSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'
import { l } from '@/logging'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  { '01-pdf-default': 'bun as -- extract pdf "input/document.pdf"' },
  { '02-pdf-custom-output': 'bun as -- extract pdf "input/document.pdf" --output "output/custom-extract.txt"' },
  { '03-pdf-page-breaks': 'bun as -- extract pdf "input/document.pdf" --page-breaks' },
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
          f.endsWith('.txt')
        )
        if (possibleFile) {
          l(`Found modified file`, { testName, file: possibleFile })
          filesToRename = [possibleFile]
        }
      }
      
      expect(filesToRename.length > 0).toBeTruthy()
      
      
      for (const file of filesToRename) {
        const filePath = join(outputDirectory, file)
        if (existsSync(filePath) && file.endsWith('.txt')) {
          const stats = statSync(filePath)
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
        if (/^\d{2}-/.test(file)) continue
        if (file === 'temp') continue
        
        const oldPath = join(outputDirectory, file)
        if (!existsSync(oldPath)) continue
        
        const fileExtension = file.substring(file.lastIndexOf('.'))
        const baseName = file.substring(0, file.lastIndexOf('.'))
        
        const newName = `${String(fileCounter).padStart(2, '0')}-${baseName}-${testName}${fileExtension}`
        const newPath = join(outputDirectory, newName)
        
        l(`Renaming file`, { from: file, to: newName })
        renameSync(oldPath, newPath)
        fileCounter++
      }
    })
  }
})

