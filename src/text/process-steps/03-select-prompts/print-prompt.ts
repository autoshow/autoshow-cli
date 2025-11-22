import { selectPrompts } from './select-prompt.ts'
import { l, err } from '@/logging'
import type { ProcessingOptions } from '@/text/text-types'

export async function printPrompt(sections: string[]): Promise<void> {
  try {
    l.dim(`Processing prompt sections: ${sections.join(', ')}`)
    
    const processingOptions: ProcessingOptions = {
      printPrompt: sections
    }
    
    const promptText = await selectPrompts(processingOptions)
    
    l.dim('Generated prompt text successfully')
    console.log(promptText)
    
    l.success('Prompt sections printed successfully')
  } catch (error) {
    err(`Error generating prompt text: ${(error as Error).message}`)
    throw error
  }
}