import { ensureDirectory } from '~/utils/cli-utils'
import { CLIUsageError } from '~/utils/error-handler'
import { reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import * as l from '~/utils/logger'
import type { BatchChildRunContext, BatchItemProcessResult, RuntimeOptions } from '~/types'

export const processXSpace = async (
  target: string,
  baseDir: string,
  _opts: RuntimeOptions,
  batchChildContext?: BatchChildRunContext
): Promise<BatchItemProcessResult> => {
  const bearerToken = process.env['X_BEARER_TOKEN']
  if (!bearerToken) {
    throw CLIUsageError(
      'X_BEARER_TOKEN environment variable is required for X/Twitter Space extraction. '
      + 'Create a Bearer Token at https://developer.x.com/en/portal/dashboard'
    )
  }

  const { parseSpaceInput, XApiClient, collectSpaces, renderSpacesJson, renderSpacesMarkdown } = await import('~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/x-spaces')

  const parsedInput = parseSpaceInput(target)
  const client = new XApiClient({ bearerToken })
  const artifact = await collectSpaces({
    client,
    input: parsedInput
  })

  const firstSpace = artifact.spaces[0]
  const label = firstSpace?.title?.trim() || `x-space-${parsedInput.ids[0] ?? 'unknown'}`

  const effectiveBaseDir = baseDir?.trim().length > 0 ? baseDir : _opts.outputRootDir
  const outputDir = await reserveBatchChildOutputDir(batchChildContext, {
    title: label,
    fallbackLabel: label
  }) ?? `${effectiveBaseDir}/${createUniqueDirectoryName(label)}`
  await ensureDirectory(outputDir)

  const jsonReport = renderSpacesJson(artifact)
  await Bun.write(`${outputDir}/result.json`, jsonReport)

  const mdReport = renderSpacesMarkdown(artifact)
  await Bun.write(`${outputDir}/extraction.md`, mdReport)

  await writeRunManifest(outputDir, 'extract', {
    extractRoute: 'x-space',
    step1: {
      title: label,
      source: 'x-space',
      spaceCount: artifact.totals.spaces,
      errorCount: artifact.totals.errors
    }
  })

  l.report.complete(outputDir, {
    result: 'result.json',
    extraction: 'extraction.md',
    run: 'run.json'
  })

  return { outputDir }
}
