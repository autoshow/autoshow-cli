import { spawn } from 'node:child_process'
import { getCliContext } from './cli-context.ts'

const DEFAULT_THRESHOLD = 50

export async function withPager(content: string, threshold: number = DEFAULT_THRESHOLD): Promise<void> {
  const ctx = getCliContext()
  const lines = content.split('\n').length
  
  if (!ctx.stdoutTTY || lines < threshold || ctx.format !== 'human' || ctx.quiet) {
    console.log(content)
    return
  }
  
  return new Promise((resolve) => {
    const less = spawn('less', ['-FIRX'], {
      stdio: ['pipe', 'inherit', 'inherit']
    })
    
    less.on('error', () => {
      console.log(content)
      resolve()
    })
    
    less.on('close', () => {
      resolve()
    })
    
    less.stdin.write(content)
    less.stdin.end()
  })
}

export function wouldUsePager(lineCount: number, threshold: number = DEFAULT_THRESHOLD): boolean {
  const ctx = getCliContext()
  return ctx.stdoutTTY && lineCount >= threshold && ctx.format === 'human' && !ctx.quiet
}
