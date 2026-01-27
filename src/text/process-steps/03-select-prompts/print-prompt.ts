import { selectPrompts } from './select-prompt'
import { l, err, success } from '@/logging'
import type { ProcessingOptions } from '@/text/text-types'

export async function printPrompt(sections: string[]): Promise<void> {
  try {
    l('Processing prompt sections', { sections })
    
    const processingOptions: ProcessingOptions = {
      printPrompt: sections
    }
    
    const promptText = await selectPrompts(processingOptions)
    
    l('Generated prompt text successfully')
    console.log(promptText)
    
    success('Prompt sections printed successfully')
  } catch (error) {
    err('Error generating prompt text', error as Error)
    throw error
  }
}