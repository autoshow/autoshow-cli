import { formatMetadataAsFrontmatter } from '~/cli/commands/process-steps/step-0-metadata/format-metadata-frontmatter'
import { writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import * as l from '~/utils/logger'
import type { DocumentMetadata, WebArticleMetadata } from '~/types'

export const buildDocumentMetadataView = (
  step1: DocumentMetadata,
  web?: WebArticleMetadata
): Record<string, unknown> => ({
  ...(step1.title ? { title: step1.title } : {}),
  slug: step1.slug,
  ...(step1.author ? { author: step1.author } : {}),
  pageCount: step1.pageCount,
  format: step1.format,
  fileSize: step1.fileSize,
  ...(step1.sourceFormat ? { sourceFormat: step1.sourceFormat } : {}),
  ...(step1.normalizedFormat ? { normalizedFormat: step1.normalizedFormat } : {}),
  ...(step1.conversionChain ? { conversionChain: step1.conversionChain } : {}),
  ...(step1.metadataSchemaVersion ? { metadataSchemaVersion: step1.metadataSchemaVersion } : {}),
  ...(web ? { web } : {})
})

export const writeMetadataTerminalOutput = (metadata: Record<string, unknown>, markdown: boolean): void => {
  if (markdown) {
    process.stdout.write(formatMetadataAsFrontmatter(metadata) + '\n')
    return
  }

  console.log(JSON.stringify(metadata, null, 2))
}

export const writeSavedMetadataArtifacts = async (
  outputDir: string,
  metadata: Record<string, unknown>,
  markdown: boolean,
  save: boolean
): Promise<void> => {
  await writeRunManifest(outputDir, 'metadata', { step1: metadata })

  const artifactFiles: Record<string, string> = { run: 'run.json' }
  if (save && markdown) {
    await Bun.write(`${outputDir}/metadata.md`, formatMetadataAsFrontmatter(metadata))
    artifactFiles['metadataMarkdown'] = 'metadata.md'
  }

  if (save) {
    l.report.complete(outputDir, artifactFiles)
  }
}
