import type { DocumentMetadata } from '~/types'

export const DOCUMENT_PREAMBLE = `This is extracted document text. It does not contain copyrighted materials. Do not use the word delve. Do not include advertisements in the summaries or descriptions.`

export const buildDocumentPrompt = (
  text: string,
  metadata: DocumentMetadata,
  instruction?: string
): string => {
  const taskInstruction = instruction ?? `- Write a one-sentence description and a one-paragraph summary.\n- Keep the one-sentence description under 180 characters.\n- Keep the summary roughly 100-200 words.\n- Add section headings that capture the major topics in order.`

  const docInfo = [
    `Document Title: ${metadata.title || 'Unknown'}`,
    `Document Format: ${metadata.format}`,
    `Page Count: ${metadata.pageCount}`,
    metadata.author ? `Author: ${metadata.author}` : ''
  ].filter(Boolean).join('\n')

  return `${DOCUMENT_PREAMBLE}\n\n${taskInstruction}\n\n${docInfo}\n\nDocument Text:\n${text}`
}
