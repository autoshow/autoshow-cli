import type { DocumentMetadata } from '~/types'

const DOCUMENT_PREAMBLE = `This is extracted document text. Do not include advertisements in the summaries or descriptions. Do not actually write the transcript.`

export const buildDocumentPrompt = (
  text: string,
  metadata: DocumentMetadata,
  instruction?: string
): string => {
  const taskInstruction = instruction ?? `- Write a one-sentence description and a one-paragraph summary.\n- Keep the one-sentence description under 180 characters.\n- Keep the summary roughly 100-200 words.\n- Add section headings that capture the major topics in order.`

  const frontmatterFields = [
    `title: "${metadata.title || 'Unknown'}"`,
    `format: "${metadata.format}"`,
    `pageCount: ${metadata.pageCount}`,
    metadata.author ? `author: "${metadata.author}"` : '',
  ].filter(Boolean).join('\n')

  const frontmatter = `---\n${frontmatterFields}\n---`

  return `${frontmatter}\n\n${DOCUMENT_PREAMBLE}\n\n${taskInstruction}\n\nDocument Text:\n${text}`
}
