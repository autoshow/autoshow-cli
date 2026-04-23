import { CLIUsageError } from '~/utils/error-handler'

const buildMigrationMessage = (
  command: 'stt' | 'ocr'
): string => `The "${command}" command has been replaced by "extract". Use: bun as extract <input> [flags]`

export const throwExtractMigrationError = (
  command: 'stt' | 'ocr'
): never => {
  throw CLIUsageError(buildMigrationMessage(command))
}

export const maybeThrowDeprecatedProcessCommand = (
  argv: string[]
): void => {
  const [first, second] = argv
  if (first === 'stt' || first === 'ocr') {
    throwExtractMigrationError(first)
  }

  if (first === 'help' && (second === 'stt' || second === 'ocr')) {
    throwExtractMigrationError(second)
  }
}
