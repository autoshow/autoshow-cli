import { extractExplicitFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { CLIUsageError } from '~/utils/error-handler'

type OcrLikeContext = {
  flags: Record<string, unknown> & { out?: unknown }
}

export const validateEpubInspectCommandFlags = (
  ctx: OcrLikeContext,
  argv: string[] = Bun.argv.slice(2)
): void => {
  const epubInspectCount = [ctx.flags['epub-bun'], ctx.flags['epub-calibre']].filter(Boolean).length
  if (epubInspectCount > 1) {
    throw CLIUsageError('Cannot use both EPUB inspect engines at the same time (--epub-bun, --epub-calibre)')
  }

  const explicitFlags = extractExplicitFlags(argv)
  const outWasExplicitlyProvided = explicitFlags.has('out')

  if (epubInspectCount > 0 && outWasExplicitlyProvided && ctx.flags.out !== 'json') {
    throw CLIUsageError('EPUB inspect mode supports JSON output only. Use --out json with --epub-bun or --epub-calibre.')
  }
}
