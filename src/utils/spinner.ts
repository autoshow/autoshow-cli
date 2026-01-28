import ora, { type Ora, type Options as OraOptions } from 'ora'
import { getCliContext } from './cli-context.ts'

export type SpinnerOptions = Omit<OraOptions, 'isEnabled'>

export function createSpinner(text: string, options?: SpinnerOptions): Ora {
  const ctx = getCliContext()
  
  const isEnabled = ctx.stderrTTY && !ctx.quiet && ctx.format === 'human'
  
  return ora({
    text,
    ...options,
    isEnabled
  })
}
