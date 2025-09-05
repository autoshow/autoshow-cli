import { selectPrompts } from './select-prompt.ts'
import { l, err, logInitialFunctionCall } from '@/logging'
import type { ProcessingOptions } from '@/text/text-types'

export async function printPrompt(sections: string[]): Promise<void> {
  const p = '[text/process-steps/03-select-prompts/print-prompt]'
  logInitialFunctionCall('printPrompt', { sections })

  try {
    l.dim(`${p} Processing prompt sections: ${sections.join(', ')}`)
    
    const processingOptions: ProcessingOptions = {
      printPrompt: sections
    }
    
    const promptText = await selectPrompts(processingOptions)
    
    l.dim(`${p} Generated prompt text successfully`)
    console.log(promptText)
    
    l.success('Prompt sections printed successfully')
  } catch (error) {
    err(`${p} Error generating prompt text: ${(error as Error).message}`)
    throw error
  }
}