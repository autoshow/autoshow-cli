import { extractExplicitFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { CLIUsageError } from '~/utils/error-handler'
import { EPUB_INSPECT_JSON_ONLY_ERROR } from '../step-2-shared/inactive-flag-warnings'
import type { OcrLikeContext } from '~/types'

export const validateEpubInspectCommandFlags = (
  ctx: OcrLikeContext,
  argv: string[] = Bun.argv.slice(2)
): void => {
  const explicitFlags = extractExplicitFlags(argv)
  const formatWasExplicitlyProvided = explicitFlags.has('format')

  if (ctx.flags['epub-bun'] === true && formatWasExplicitlyProvided && ctx.flags['format'] !== 'json') {
    throw CLIUsageError(EPUB_INSPECT_JSON_ONLY_ERROR)
  }
}
