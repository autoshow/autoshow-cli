import { CLIUsageError } from '~/utils/error-handler'
import type { InputFamily, ProcessCommand } from '~/types'
import { describeUnsupportedInputForCommand } from '../routing/input-routing'

export const throwUnsupportedProcessInput = (
  command: ProcessCommand,
  item: string,
  family: InputFamily
): never => {
  throw CLIUsageError(`Unsupported ${command} input "${item}". ${describeUnsupportedInputForCommand(command, family)}`)
}

export const throwUnrecognizedExtractInput = (
  item: string
): never => {
  throw CLIUsageError(`Could not classify extract input "${item}". Verify the file type or route it explicitly as media or document content.`)
}

