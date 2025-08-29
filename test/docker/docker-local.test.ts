import test from 'node:test'
import { strictEqual, ok } from 'node:assert/strict'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'

import type { ExecException } from 'node:child_process'

const p = '[docker/docker-local]'

const dockerBase = 'docker run --rm -v $(pwd)/input:/app/input -v $(pwd)/output:/app/output -v $(pwd)/models:/app/models --env-file .env autoshow-cli'

const cliCommands = [
  {
    category: 'text',
    tests: [
      { '01-file-default': `${dockerBase} text --file "input/audio.mp3"` },
      { '02-file-whisper-tiny': `${dockerBase} text --file "input/audio.mp3" --whisper tiny` },
      { '03-video-default': `${dockerBase} text --video "https://www.youtube.com/watch?v=MORMZXEaONk"` },
      { '04-rss-default': `${dockerBase} text --rss "https://ajcwebdev.substack.com/feed"` },
    ],
    expectedExtensions: ['.md'],
    description: 'Docker Text Processing'
  },
  {
    category: 'tts',
    tests: [
      { 'coqui-default': `${dockerBase} tts file input/sample.md --coqui` },
      { 'kitten-default': `${dockerBase} tts file input/sample.md --kitten` },
    ],
    expectedExtensions: ['.wav', '.mp3'],
    description: 'Docker TTS'
  },
  {
    category: 'image',
    tests: [
      { 'sdcpp-default': `${dockerBase} image generate --prompt "A beautiful sunset" --service sdcpp` },
    ],
    expectedExtensions: ['.png', '.jpg', '.jpeg'],
    description: 'Docker Image Generation'
  },
  {
    category: 'music',
    tests: [
      { 'audiocraft-piano': `${dockerBase} music generate --prompt "calm piano melody" --service audiocraft` },
      { 'stable-audio-ambient': `${dockerBase} music generate --prompt "ambient electronic music" --service stable-audio` },
    ],
    expectedExtensions: ['.wav', '.mp3', '.flac', '.m4a'],
    description: 'Docker Music Generation'
  }
]

const runDockerCommand = async (command: string): Promise<string> => {
  console.log(`${p} Executing Docker command: ${command.split(' ').slice(0, 8).join(' ')}...`)
  
  return new Promise<string>((resolve, reject) => {
    exec(command, { shell: '/bin/bash', timeout: 600000 }, (
      error: ExecException | null, stdout: string, stderr: string
    ) => {
      if (error) {
        console.log(`${p} Docker command failed: ${error.message}`)
        console.log(`${p} stdout: ${stdout}`)
        console.log(`${p} stderr: ${stderr}`)
        reject(error)
      } else {
        console.log(`${p} Docker command completed successfully`)
        if (stdout) console.log(`${p} stdout: ${stdout.substring(0, 200)}...`)
        resolve(stdout)
      }
    })
  })
}

const findOutputFiles = (beforeRun: string[], afterRun: string[], expectedExtensions: string[]): string[] => {
  console.log(`${p} Checking for new files with extensions: ${expectedExtensions.join(', ')}`)
  
  const newFiles = afterRun.filter(f => !beforeRun.includes(f))
  console.log(`${p} Found ${newFiles.length} new files: ${newFiles.join(', ')}`)
  
  if (newFiles.length > 0) {
    return newFiles.filter(f => expectedExtensions.some(ext => f.endsWith(ext)))
  }
  
  const possibleFile = afterRun.find(f => 
    !f.endsWith('.part') && 
    !f.match(/^\d{2}-/) && 
    expectedExtensions.some(ext => f.endsWith(ext))
  )
  
  if (possibleFile) {
    console.log(`${p} Found possible modified file: ${possibleFile}`)
    return [possibleFile]
  }
  
  console.log(`${p} No matching files found`)
  return []
}

const renameOutputFiles = (filesToRename: string[], testName: string, fileCounter: { value: number }, outputDirectory: string): void => {
  console.log(`${p} Renaming ${filesToRename.length} files for test: ${testName}`)
  
  for (const file of filesToRename) {
    if (file.endsWith('.part')) {
      console.log(`${p} Skipping partial file: ${file}`)
      continue
    }
    if (/^\d{2}-/.test(file)) {
      console.log(`${p} Skipping already renamed file: ${file}`)
      continue
    }
    
    const oldPath = join(outputDirectory, file)
    if (!existsSync(oldPath)) {
      console.log(`${p} File no longer exists: ${oldPath}`)
      continue
    }
    
    const fileExtension = file.substring(file.lastIndexOf('.'))
    const baseName = file.substring(0, file.lastIndexOf('.'))
    
    const newName = `${String(fileCounter.value).padStart(2, '0')}-${baseName}-${testName}${fileExtension}`
    const newPath = join(outputDirectory, newName)
    
    console.log(`${p} Renaming ${file} to ${newName}`)
    renameSync(oldPath, newPath)
    fileCounter.value++
  }
}

test('CLI Docker local tests', { concurrency: 1 }, async (t) => {
  const outputDirectory = resolve(process.cwd(), 'output')
  const fileCounter = { value: 1 }
  
  console.log(`${p} Starting Docker tests with output directory: ${outputDirectory}`)
  
  for (const commandGroup of cliCommands) {
    console.log(`${p} Testing ${commandGroup.category} commands`)
    
    for (const commandObj of commandGroup.tests) {
      const entry = Object.entries(commandObj)[0]
      if (!entry) continue
      const [testName, command] = entry
      
      await t.test(`${commandGroup.description}: ${testName}`, { concurrency: 1 }, async () => {
        console.log(`${p} Running test: ${commandGroup.description} - ${testName}`)
        
        const beforeRun = readdirSync(outputDirectory)
        console.log(`${p} Files before test: ${beforeRun.length}`)
        
        let errorOccurred = false
        let commandOutput = ''
        try {
          commandOutput = await runDockerCommand(command)
        } catch (error) {
          console.log(`${p} Test failed with error: ${error}`)
          errorOccurred = true
        }
        
        strictEqual(errorOccurred, false, `Docker command should execute successfully for ${testName}`)
        
        const afterRun = readdirSync(outputDirectory)
        console.log(`${p} Files after test: ${afterRun.length}`)
        
        const filesToRename = findOutputFiles(beforeRun, afterRun, commandGroup.expectedExtensions)
        
        ok(filesToRename.length > 0, `Expected at least one new or modified ${commandGroup.category} file for ${testName}. Command output: ${commandOutput.substring(0, 200)}`)
        
        renameOutputFiles(filesToRename, testName, fileCounter, outputDirectory)
        
        console.log(`${p} Test completed: ${commandGroup.description} - ${testName}`)
      })
    }
  }
  
  console.log(`${p} All Docker tests completed`)
})