import test from 'node:test'
import { strictEqual } from 'node:assert/strict'
import { exec } from 'node:child_process'

import type { ExecException } from 'node:child_process'

const cliCommands = [
  // Transcription cost estimation
  { '01-transcript-cost-deepgram': 'bun as -- --transcriptCost "input/audio.mp3" --deepgram' },
  { '02-transcript-cost-assembly': 'bun as -- --transcriptCost "input/audio.mp3" --assembly' },
  
  // LLM cost estimation
  { '03-llm-cost-chatgpt': 'bun as -- --llmCost "input/audio-prompt.md" --chatgpt' },
  { '04-llm-cost-claude': 'bun as -- --llmCost "input/audio-prompt.md" --claude' },
  { '05-llm-cost-gemini': 'bun as -- --llmCost "input/audio-prompt.md" --gemini' },
]

test('CLI cost estimation tests', { concurrency: 1 }, async (t) => {
  const p = '[test/text/cost]'
  
  for (const commandObj of cliCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [testName, command] = entry
    
    await t.test(`Cost: ${testName}`, { concurrency: 1 }, async () => {
      console.log(`${p} Starting test: ${testName}`)
      
      let errorOccurred = false
      let stdout = ''
      try {
        stdout = await new Promise<string>((resolve, reject) => {
          exec(command, { shell: '/bin/zsh' }, (
            error: ExecException | null, stdout: string, _stderr: string
          ) => {
              if (error) {
                console.error(`${p} Command failed for ${testName}: ${error.message}`)
                reject(error)
              } else {
                console.log(`${p} Command succeeded for ${testName}`)
                resolve(stdout)
              }
            }
          )
        })
      } catch {
        errorOccurred = true
      }
      
      strictEqual(errorOccurred, false, 'Command should complete without errors')
      
      // Cost commands output to stdout, not files - verify we got some output
      console.log(`${p} Output for ${testName}: ${stdout.substring(0, 200)}...`)
    })
  }
})
