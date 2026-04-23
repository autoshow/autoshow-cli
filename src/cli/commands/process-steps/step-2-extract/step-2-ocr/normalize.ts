import type { DocumentMetadata } from '~/types'
import type { OcrSourceKind } from '~/types'

const IMAGE_FORMATS = new Set(['png', 'jpg', 'tif', 'webp', 'bmp', 'gif'])
const OFFICE_FORMATS = new Set(['docx', 'pptx', 'xlsx', 'odf'])

export const classifyOcrSourceKind = (
  metadata: Pick<DocumentMetadata, 'format'>,
  options?: {
    preparedMarkdown?: string | undefined
    epubInspect?: boolean | undefined
    forceOcr?: boolean | undefined
  }
): OcrSourceKind => {
  if (typeof options?.preparedMarkdown === 'string' && options.preparedMarkdown.trim().length > 0) {
    return 'article'
  }

  if (metadata.format === 'epub' && options?.epubInspect) {
    return 'epub-inspect'
  }

  if (metadata.format === 'epub') {
    return options?.forceOcr ? 'office-pdf' : 'office-native'
  }

  if (metadata.format === 'pdf') {
    return 'pdf'
  }

  if (IMAGE_FORMATS.has(metadata.format)) {
    return 'image'
  }

  if (OFFICE_FORMATS.has(metadata.format)) {
    return options?.forceOcr ? 'office-pdf' : 'office-native'
  }

  if (metadata.format === 'rtf') {
    return 'rtf-pdf'
  }

  if (metadata.format === 'cbz') {
    return 'cbz-images'
  }

  return 'pdf'
}
