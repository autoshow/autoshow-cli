import { describe, test, expect } from 'bun:test'
import { exec } from 'node:child_process'
import { l } from '@/logging'

import type { ExecException } from 'node:child_process'

const cliCommands = [

  { '01-transcript-cost-deepgram': 'bun as -- --transcriptCost "input/audio.mp3" --deepgram' },
  { '02-transcript-cost-assembly': 'bun as -- --transcriptCost "input/audio.mp3" --assembly' },


  { '03-llm-cost-chatgpt': 'bun as -- --llmCost "input/audio-prompt.md" --chatgpt' },
  { '04-llm-cost-claude': 'bun as -- --llmCost "input/audio-prompt.md" --claude' },
  { '05-llm-cost-gemini': 'bun as -- --llmCost "input/audio-prompt.md" --gemini' },
]

describe('CLI cost estimation tests', () => {
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [testName, command] = entry
    
    test(`Cost: ${testName}`, async () => {
      l(`Starting test`, { testName })
      
      let errorOccurred = false
      let stdout = ''
      try {
        stdout = await new Promise<string>((resolve, reject) => {
          exec(command, { shell: '/bin/zsh' }, (
            error: ExecException | null, stdout: string, _stderr: string
          ) => {
              if (error) {
                l(`Command failed`, { testName, error: error.message })
                reject(error)
              } else {
                l(`Command succeeded`, { testName })
                resolve(stdout)
              }
            }
          )
        })
      } catch {
        errorOccurred = true
      }
      
      expect(errorOccurred).toBe(false)
      
      
      l(`Output`, { testName, preview: stdout.substring(0, 200) })
    })
  }
})
