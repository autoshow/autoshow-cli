import { l, err } from '@/logging'
import type { ProcessingOptions } from '@/text/text-types'
import { EXIT_USAGE } from '@/utils'

export function validateChannelOptions(options: ProcessingOptions): void {
  if (options.last !== undefined) {
    if (!Number.isInteger(options.last) || options.last < 1) {
      err('Error: The --last option must be a positive integer.', undefined, EXIT_USAGE)
    }
    if (options.order !== undefined) {
      err('Error: The --last option cannot be used with --order.', undefined, EXIT_USAGE)
    }
  }

  if (options.order !== undefined && !['newest', 'oldest'].includes(options.order)) {
    err("Error: The --order option must be either 'newest' or 'oldest'.", undefined, EXIT_USAGE)
  }

  if (options.days !== undefined) {
    if (!Number.isInteger(options.days) || options.days < 1) {
      err('Error: The --days option must be a positive integer.', undefined, EXIT_USAGE)
    }
    if (
      options.last !== undefined ||
      options.order !== undefined ||
      (options.date && options.date.length > 0)
    ) {
      err('Error: The --days option cannot be used with --last, --order, or --date.', undefined, EXIT_USAGE)
    }
  }

  if (options.date && options.date.length > 0) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    for (const d of options.date) {
      if (!dateRegex.test(d)) {
        err('Error: Invalid date format. Please use YYYY-MM-DD format', { date: d }, EXIT_USAGE)
      }
    }
    if (
      options.last !== undefined ||
      options.order !== undefined
    ) {
      err('Error: The --date option cannot be used with --last or --order.', undefined, EXIT_USAGE)
    }
  }

  if (options.last) {
    l('\nProcessing the last videos', { count: options.last })
  } else if (options.days) {
    l('\nProcessing videos from the last days', { days: options.days })
  } else if (options.date && options.date.length > 0) {
    l('\nProcessing videos from specific dates', { dates: options.date.join(', ') })
  }
}