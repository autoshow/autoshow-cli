import { getCliContext } from './cli-context.ts'

export type BatchProgressOptions = {
  label: string
  total: number
}

export type BatchProgress = {
  complete: (success: boolean) => void
  skip: () => void
  summary: () => BatchSummary
  printSummary: () => void
}

export type BatchSummary = {
  processed: number
  succeeded: number
  failed: number
  skipped: number
  total: number
  remaining: number
}

export function createBatchProgress(options: BatchProgressOptions): BatchProgress {
  const ctx = getCliContext()
  let processed = 0
  let succeeded = 0
  let failed = 0
  let skipped = 0
  
  const summary = (): BatchSummary => ({
    processed,
    succeeded,
    failed,
    skipped,
    total: options.total,
    remaining: options.total - processed - skipped
  })
  
  const complete = (success: boolean): void => {
    processed++
    if (success) {
      succeeded++
    } else {
      failed++
    }
  }
  
  const skip = (): void => {
    skipped++
  }
  
  const printSummary = (): void => {
    if (ctx.quiet || ctx.format === 'json') {
      return
    }
    
    const s = summary()
    const parts: string[] = []
    
    if (s.succeeded > 0) {
      parts.push(`${s.succeeded} succeeded`)
    }
    if (s.failed > 0) {
      parts.push(`${s.failed} failed`)
    }
    if (s.skipped > 0) {
      parts.push(`${s.skipped} skipped`)
    }
    
    const summaryText = parts.length > 0 
      ? parts.join(', ')
      : 'no items processed'
    
    const msg = `Batch complete: ${summaryText} (${s.total} total ${options.label})`
    
    if (!ctx.noColor) {
      const color = s.failed === 0 ? '\x1b[32m' : s.succeeded > 0 ? '\x1b[33m' : '\x1b[31m'
      console.error(`${color}${msg}\x1b[0m`)
    } else {
      console.error(msg)
    }
  }
  
  return { complete, skip, summary, printSummary }
}

export function formatBatchProgress(current: number, total: number, skipped?: number): string {
  const base = `[${current}/${total}]`
  if (skipped && skipped > 0) {
    return `${base} (${skipped} skipped)`
  }
  return base
}
