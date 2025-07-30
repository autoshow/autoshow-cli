import { l, err } from '../../../logging.ts'
import type { ProcessingOptions } from '@/types.ts'

export function validateChannelOptions(options: ProcessingOptions): void {
  l.dim('[validateChannelOptions] Starting channel options validation')
  
  if (options.last !== undefined) {
    if (!Number.isInteger(options.last) || options.last < 1) {
      err('Error: The --last option must be a positive integer.')
      process.exit(1)
    }
    if (options.order !== undefined) {
      err('Error: The --last option cannot be used with --order.')
      process.exit(1)
    }
    l.dim(`[validateChannelOptions] Last option validated: ${options.last}`)
  }

  if (options.order !== undefined && !['newest', 'oldest'].includes(options.order)) {
    err("Error: The --order option must be either 'newest' or 'oldest'.")
    process.exit(1)
  }

  if (options.days !== undefined) {
    if (!Number.isInteger(options.days) || options.days < 1) {
      err('Error: The --days option must be a positive integer.')
      process.exit(1)
    }
    if (
      options.last !== undefined ||
      options.order !== undefined ||
      (options.date && options.date.length > 0)
    ) {
      err('Error: The --days option cannot be used with --last, --order, or --date.')
      process.exit(1)
    }
    l.dim(`[validateChannelOptions] Days option validated: ${options.days}`)
  }

  if (options.date && options.date.length > 0) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    for (const d of options.date) {
      if (!dateRegex.test(d)) {
        err(`Error: Invalid date format "${d}". Please use YYYY-MM-DD format.`)
        process.exit(1)
      }
    }
    if (
      options.last !== undefined ||
      options.order !== undefined
    ) {
      err('Error: The --date option cannot be used with --last or --order.')
      process.exit(1)
    }
    l.dim(`[validateChannelOptions] Date filtering enabled for ${options.date.length} dates: ${options.date.join(', ')}`)
  }

  if (options.last) {
    l.dim(`\nProcessing the last ${options.last} videos`)
  } else if (options.days) {
    l.dim(`\nProcessing videos from the last ${options.days} days`)
  } else if (options.date && options.date.length > 0) {
    l.dim(`\nProcessing videos from specific dates: ${options.date.join(', ')}`)
  }
  
  l.dim('[validateChannelOptions] Channel validation completed successfully')
}