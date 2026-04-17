import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const extensionFromUrl = (
  url: string,
  contentType?: string | null,
  contentDisposition?: string | null
): string => {
  const lowerContentType = contentType?.toLowerCase() ?? ''
  const lowerContentDisposition = contentDisposition?.toLowerCase() ?? ''

  if (lowerContentDisposition.includes('.epub') || lowerContentType.includes('application/epub+zip')) return '.epub'
  if (lowerContentDisposition.includes('.docx') || lowerContentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) return '.docx'
  if (lowerContentDisposition.includes('.pptx') || lowerContentType.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation')) return '.pptx'
  if (lowerContentDisposition.includes('.xlsx') || lowerContentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) return '.xlsx'
  if (lowerContentDisposition.includes('.odt') || lowerContentType.includes('application/vnd.oasis.opendocument.text')) return '.odt'
  if (lowerContentDisposition.includes('.ods') || lowerContentType.includes('application/vnd.oasis.opendocument.spreadsheet')) return '.ods'
  if (lowerContentDisposition.includes('.odp') || lowerContentType.includes('application/vnd.oasis.opendocument.presentation')) return '.odp'
  if (lowerContentDisposition.includes('.png') || lowerContentType.startsWith('image/png')) return '.png'
  if (lowerContentDisposition.includes('.jpg') || lowerContentDisposition.includes('.jpeg') || lowerContentType.startsWith('image/jpeg')) return '.jpg'
  if (lowerContentDisposition.includes('.tif') || lowerContentDisposition.includes('.tiff') || lowerContentType.startsWith('image/tiff')) return '.tif'
  if (lowerContentDisposition.includes('.pdf') || lowerContentType.includes('application/pdf')) return '.pdf'

  try {
    const pathname = new URL(url).pathname.toLowerCase()
    if (pathname.endsWith('.pdf')) return '.pdf'
    if (pathname.endsWith('.epub')) return '.epub'
    if (pathname.endsWith('.docx')) return '.docx'
    if (pathname.endsWith('.pptx')) return '.pptx'
    if (pathname.endsWith('.xlsx')) return '.xlsx'
    if (pathname.endsWith('.odt')) return '.odt'
    if (pathname.endsWith('.ods')) return '.ods'
    if (pathname.endsWith('.odp')) return '.odp'
    if (pathname.endsWith('.png')) return '.png'
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return '.jpg'
    if (pathname.endsWith('.tif') || pathname.endsWith('.tiff')) return '.tif'
  } catch {
  }

  return '.pdf'
}

export const downloadDocumentUrlToTempFile = async (
  url: string
): Promise<{ filePath: string, cleanup: () => Promise<void> }> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download document URL: ${url} (${response.status})`)
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-doc-url-'))
  const ext = extensionFromUrl(
    url,
    response.headers.get('content-type'),
    response.headers.get('content-disposition')
  )
  const filePath = join(tempDir, `document${ext}`)
  try {
    const bytes = await response.arrayBuffer()
    await Bun.write(filePath, bytes)
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true })
    throw error
  }

  return {
    filePath,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}
